// functions/src/backfill.ts
//
// Script Admin ONE-SHOT pour (re)construire les projections coach-safe existantes.
// - dry-run par défaut : ne calcule que ce qui SERAIT écrit, n'écrit rien ;
// - `--apply` obligatoire pour écrire réellement ;
// - `--clubId=<id>` pour cibler un club ;
// - parcourt uniquement les members role=player ;
// - reconstruit via `rebuildPlayerSummary` (même fonction centrale que les triggers) ;
// - compte scanned/written/skipped/errors ; ne logue AUCUNE donnée sensible.
//
// ⚠️ Ne pas exécuter en production dans le cadre de cette PR. Compatible émulateur
// (Admin SDK ⇒ FIRESTORE_EMULATOR_HOST). Aucun credential committé.

import { type Firestore } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { paths, SESSION_FETCH_LIMIT } from "./config";
import { projectPlayerSummary, type RawSessionDoc } from "./projector";
import { rebuildPlayerSummary } from "./rebuild";
import { explicitWatermark, type EventWatermark } from "./watermark";

/**
 * Watermark explicite du backfill = le PLUS BAS possible (epoch 0). Par design, le
 * backfill ne peut jamais écraser une projection déjà produite par un trigger
 * (donc plus récente) : il ne fait que combler les projections manquantes.
 */
export const BACKFILL_WATERMARK: EventWatermark = explicitWatermark("1970-01-01T00:00:00.000Z", "backfill");

export interface BackfillOptions {
  apply: boolean;
  clubId?: string;
  /** Watermark attribué aux écritures. Défaut : BACKFILL_WATERMARK (le plus bas). */
  watermark?: EventWatermark;
  db?: Firestore;
}

export interface BackfillStats {
  scanned: number;
  written: number;
  skipped: number;
  deleted: number;
  errors: number;
}

async function listClubIds(db: Firestore, only?: string): Promise<string[]> {
  if (only) return [only];
  const snap = await db.collection(paths.clubs()).get();
  return snap.docs.map((d) => d.id);
}

async function fetchRecent(db: Firestore, collectionPath: string): Promise<RawSessionDoc[]> {
  const snap = await db.collection(collectionPath).orderBy("date", "desc").limit(SESSION_FETCH_LIMIT).get();
  return snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), __id: d.id }));
}

/**
 * Backfill idempotent. En dry-run, projette pour décider (would-write / would-skip)
 * SANS écrire. En apply, délègue à `rebuildPlayerSummary`.
 */
export async function runBackfill(opts: BackfillOptions): Promise<BackfillStats> {
  const db = opts.db ?? getDb();
  const watermark = opts.watermark ?? BACKFILL_WATERMARK;
  const stats: BackfillStats = { scanned: 0, written: 0, skipped: 0, deleted: 0, errors: 0 };

  const clubIds = await listClubIds(db, opts.clubId);

  for (const clubId of clubIds) {
    const membersSnap = await db.collection(paths.members(clubId)).where("role", "==", "player").get();
    for (const memberDoc of membersSnap.docs) {
      const playerUid = memberDoc.id;
      stats.scanned += 1;
      try {
        if (opts.apply) {
          const res = await rebuildPlayerSummary({ clubId, playerUid, watermark }, db);
          if (res.action === "written") stats.written += 1;
          else if (res.action === "deleted") stats.deleted += 1;
          else stats.skipped += 1;
        } else {
          // Dry-run : relire les sources et projeter, sans écrire.
          const [memberSnap, userSnap, sessions, plannedSessions] = await Promise.all([
            db.doc(paths.member(clubId, playerUid)).get(),
            db.doc(paths.user(playerUid)).get(),
            fetchRecent(db, paths.userSessions(playerUid)),
            fetchRecent(db, paths.userPlannedSessions(playerUid)),
          ]);
          const core = projectPlayerSummary({
            playerUid,
            clubId,
            membership: memberSnap.exists ? (memberSnap.data() as Record<string, unknown>) : null,
            profile: userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null,
            sessions,
            plannedSessions,
            now: new Date(),
          });
          if (core) stats.written += 1; // "would write"
          else stats.skipped += 1; // "would skip/delete"
        }
      } catch {
        stats.errors += 1; // aucune donnée sensible loguée
      }
    }
  }

  return stats;
}

// ─── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): { apply: boolean; clubId?: string } {
  const apply = argv.includes("--apply");
  const clubArg = argv.find((a) => a.startsWith("--clubId="));
  const clubId = clubArg ? clubArg.slice("--clubId=".length) : undefined;
  return { apply, clubId };
}

async function main(): Promise<void> {
  const { apply, clubId } = parseArgs(process.argv.slice(2));
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  // eslint-disable-next-line no-console
  console.log(
    `[backfill] mode=${apply ? "APPLY" : "DRY-RUN"} clubId=${clubId ?? "ALL"} target=${usingEmulator ? "emulator" : "default-credentials"}`,
  );
  // getDb() respecte FIRESTORE_EMULATOR_HOST (émulateur) ou les credentials par défaut.
  const stats = await runBackfill({ apply, clubId, db: getDb() });
  // eslint-disable-next-line no-console
  console.log(`[backfill] done ${JSON.stringify(stats)}`);
}

// Exécuté uniquement si lancé directement (`node lib/backfill.js`), pas à l'import.
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[backfill] fatal", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
