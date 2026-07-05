// functions/src/rebuild.ts
//
// Fonction centrale idempotente : relit les sources ACTUELLES dans Firestore,
// reconstruit entièrement la projection via le projecteur pur, et écrit/supprime
// via l'Admin SDK. Ne dépend JAMAIS du contenu brut de l'événement déclencheur —
// tout est relu depuis Firestore, ce qui rend les rejeux/réordonnancements sûrs.
//
// P0.1 : écriture ET suppression sont dans UNE transaction, gardées par un
// watermark (heure CloudEvent exacte + id). Un événement plus ancien ne peut ni
// écraser ni supprimer une projection produite par un événement plus récent.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { paths, SESSION_FETCH_LIMIT } from "./config";
import { assertCoachSafe } from "./dto";
import { projectPlayerSummary, type RawSessionDoc } from "./projector";
import { incomingWins, isSameEvent, readWatermark, type EventWatermark } from "./watermark";

export type RebuildAction = "written" | "deleted" | "skipped-stale" | "skipped-duplicate" | "noop-absent";

export interface RebuildParams {
  playerUid: string;
  clubId: string;
  /** Watermark de l'événement source (ordonne les mutations concurrentes/rejouées). */
  watermark: EventWatermark;
}

export interface RebuildResult {
  action: RebuildAction;
  playerUid: string;
  clubId: string;
}

async function fetchRecent(db: Firestore, collectionPath: string): Promise<RawSessionDoc[]> {
  const snap = await db.collection(collectionPath).orderBy("date", "desc").limit(SESSION_FETCH_LIMIT).get();
  return snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), __id: d.id }));
}

/**
 * Reconstruit la projection `clubs/{clubId}/playerSummaries/{playerUid}`.
 *  - relit sources actuelles ;
 *  - projette ; `null` (non-player / profil incohérent / membre absent) ⇒ suppression ;
 *  - écriture ET suppression sont dans une transaction qui refuse toute mutation si
 *    le watermark stocké est PLUS RÉCENT que celui de l'événement courant.
 */
export async function rebuildPlayerSummary(
  params: RebuildParams,
  db: Firestore = getDb(),
): Promise<RebuildResult> {
  const { playerUid, clubId, watermark } = params;
  const result = (action: RebuildResult["action"]): RebuildResult => ({ action, playerUid, clubId });

  const [memberSnap, userSnap, sessions, plannedSessions] = await Promise.all([
    db.doc(paths.member(clubId, playerUid)).get(),
    db.doc(paths.user(playerUid)).get(),
    fetchRecent(db, paths.userSessions(playerUid)),
    fetchRecent(db, paths.userPlannedSessions(playerUid)),
  ]);

  const membership = memberSnap.exists ? (memberSnap.data() as Record<string, unknown>) : null;
  const profile = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;

  const core = projectPlayerSummary({
    playerUid,
    clubId,
    membership,
    profile,
    sessions,
    plannedSessions,
    now: new Date(),
  });

  // Dernier rempart anti-fuite (sur le cœur métier, avant enveloppe).
  if (core) assertCoachSafe(core);

  const ref = db.doc(paths.playerSummary(clubId, playerUid));

  return db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);

    // Garde watermark : s'applique AUX DEUX mutations (write ET delete).
    if (cur.exists) {
      const existing = readWatermark(cur.data() as Record<string, unknown>);
      if (!incomingWins(watermark, existing)) {
        // Rejeu EXACT du même événement → aucune mutation (idempotence stricte,
        // même si les sources ont changé entre-temps). Sinon watermark plus ancien.
        return result(isSameEvent(watermark, existing) ? "skipped-duplicate" : "skipped-stale");
      }
    }

    if (!core) {
      if (!cur.exists) return result("noop-absent");
      tx.delete(ref);
      return result("deleted");
    }

    tx.set(ref, {
      ...core,
      sourceEventAt: watermark.at,
      sourceEventTime: watermark.time,
      sourceEventId: watermark.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return result("written");
  });
}
