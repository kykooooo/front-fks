// functions/tests/integration/backfill.emulator.test.ts
// Backfill contre l'émulateur : dry-run n'écrit rien ; apply écrit les joueuses ciblées.

import { clearFirestore, seedClubA, testDb, wm } from "./emulatorHelper";
import { runBackfill } from "../../src/backfill";

const db = testDb();

async function countSummaries(clubId: string): Promise<number> {
  const snap = await db.collection(`clubs/${clubId}/playerSummaries`).get();
  return snap.size;
}

beforeEach(async () => {
  await clearFirestore();
  await seedClubA(db);
  // Deuxième club pour vérifier le ciblage --clubId.
  await db.doc("clubs/clubB").set({ name: "Club B", ownerUid: "coachB" });
  await db.doc("clubs/clubB/members/coachB").set({ uid: "coachB", accessRole: "owner" });
  // "not_required" : joueur adulte, aucune étape supplémentaire (cf. coachAccess.ts).
  await db.doc("clubs/clubB/members/playerB").set({ uid: "playerB", playerStatus: "active", coachAccess: "not_required" });
  await db.doc("users/playerB").set({ uid: "playerB", clubId: "clubB", playerStatus: "active", firstName: "Clea", profileCompleted: true });
});

describe("runBackfill — émulateur", () => {
  it("dry-run (apply=false) n'écrit AUCUNE projection", async () => {
    const stats = await runBackfill({ apply: false, db });
    expect(stats.scanned).toBe(3); // playerA1, playerA2, playerB (coachs exclus par where role==player)
    expect(stats.written).toBeGreaterThan(0); // "would write"
    expect(await countSummaries("clubA")).toBe(0);
    expect(await countSummaries("clubB")).toBe(0);
  });

  it("apply + --clubId=clubA n'écrit QUE les joueuses de clubA", async () => {
    const stats = await runBackfill({ apply: true, clubId: "clubA", watermark: wm(1000), db });
    expect(stats.scanned).toBe(2);
    expect(stats.written).toBe(2); // playerA1 + playerA2
    expect(await countSummaries("clubA")).toBe(2);
    expect(await countSummaries("clubB")).toBe(0); // non ciblé → intact
  });

  it("apply global écrit toutes les joueuses players (coachs exclus)", async () => {
    const stats = await runBackfill({ apply: true, watermark: wm(1000), db });
    expect(stats.scanned).toBe(3);
    expect(stats.written).toBe(3);
    expect(await countSummaries("clubA")).toBe(2);
    expect(await countSummaries("clubB")).toBe(1);
    // Coach non projeté.
    expect((await db.doc("clubs/clubA/playerSummaries/coachA").get()).exists).toBe(false);
  });
});
