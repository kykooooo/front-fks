// functions/src/triggers.ts
//
// Triggers Firestore v2 qui déclenchent la reconstruction de la projection.
// AUCUN trigger sur `playerSummaries` → pas de boucle. Chaque handler se contente
// de résoudre (playerUid, clubId) puis délègue à `rebuildPlayerSummary`, qui relit
// les sources actuelles (les triggers ne transmettent jamais le contenu brut).

import { onDocumentWritten, type FirestoreEvent, type Change, type DocumentSnapshot } from "firebase-functions/v2/firestore";
import { getDb } from "./admin";
import { MIN_INSTANCES, paths, REGION } from "./config";
import { rebuildPlayerSummary } from "./rebuild";
import { watermarkFromEvent } from "./watermark";

const triggerOpts = { region: REGION, minInstances: MIN_INSTANCES } as const;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

type WrittenEvent = FirestoreEvent<Change<DocumentSnapshot> | undefined, Record<string, string>>;

/** clubId courant d'un joueur, lu depuis users/{uid}.clubId. */
async function clubIdOfUser(playerUid: string): Promise<string | null> {
  const snap = await getDb().doc(paths.user(playerUid)).get();
  return snap.exists ? str((snap.data() as Record<string, unknown>).clubId) : null;
}

// ── clubs/{clubId}/members/{playerUid} ──────────────────────────────────────
// Membership créé/supprimé/modifié → reconstruit (ou supprime) la projection.
export const onMemberWritten = onDocumentWritten(
  { ...triggerOpts, document: "clubs/{clubId}/members/{playerUid}" },
  async (event: WrittenEvent) => {
    const { clubId, playerUid } = event.params;
    await rebuildPlayerSummary({ clubId, playerUid, watermark: watermarkFromEvent(event) });
  },
);

// ── users/{playerUid} ───────────────────────────────────────────────────────
// Profil mis à jour ou changement de club. On reconstruit pour l'ancien ET le
// nouveau clubId : l'ancienne projection est supprimée (club incohérent), la
// nouvelle est (re)construite.
export const onUserWritten = onDocumentWritten(
  { ...triggerOpts, document: "users/{playerUid}" },
  async (event: WrittenEvent) => {
    const { playerUid } = event.params;
    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;
    const clubIds = new Set<string>();
    const beforeClub = str(before?.clubId);
    const afterClub = str(after?.clubId);
    if (beforeClub) clubIds.add(beforeClub);
    if (afterClub) clubIds.add(afterClub);
    const watermark = watermarkFromEvent(event);
    await Promise.all(
      [...clubIds].map((clubId) => rebuildPlayerSummary({ clubId, playerUid, watermark })),
    );
  },
);

// ── users/{playerUid}/sessions/{sessionId} ──────────────────────────────────
// Séance faite créée/modifiée/supprimée → activité + latestSession recalculées.
export const onSessionWritten = onDocumentWritten(
  { ...triggerOpts, document: "users/{playerUid}/sessions/{sessionId}" },
  async (event: WrittenEvent) => {
    const { playerUid } = event.params;
    const clubId = await clubIdOfUser(playerUid);
    if (!clubId) return;
    await rebuildPlayerSummary({ clubId, playerUid, watermark: watermarkFromEvent(event) });
  },
);

// ── users/{playerUid}/plannedSessions/{sessionId} ───────────────────────────
// Séance planifiée créée/modifiée/supprimée → latestSession recalculée.
export const onPlannedSessionWritten = onDocumentWritten(
  { ...triggerOpts, document: "users/{playerUid}/plannedSessions/{sessionId}" },
  async (event: WrittenEvent) => {
    const { playerUid } = event.params;
    const clubId = await clubIdOfUser(playerUid);
    if (!clubId) return;
    await rebuildPlayerSummary({ clubId, playerUid, watermark: watermarkFromEvent(event) });
  },
);
