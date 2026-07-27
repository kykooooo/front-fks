// functions/tests/integration/rebuild.emulator.test.ts
// Intégration Admin SDK ↔ émulateur Firestore. Couvre §8 (intégration) + P0.1 (races).

import { clearFirestore, seedClubA, testDb, wm } from "./emulatorHelper";
import { rebuildPlayerSummary } from "../../src/rebuild";
import { assertCoachSafe, FORBIDDEN_KEYS } from "../../src/dto";

const db = testDb();
const summaryRef = () => db.doc("clubs/clubA/playerSummaries/playerA1");

beforeEach(async () => {
  await clearFirestore();
  await seedClubA(db);
});

describe("rebuildPlayerSummary — écriture propre", () => {
  it("écrit au bon path avec une projection propre (sensible NON fuité)", async () => {
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect(res.action).toBe("written");

    const snap = await summaryRef().get();
    expect(snap.exists).toBe(true);
    const data = snap.data()!;
    expect(data.playerUid).toBe("playerA1");
    expect(data.firstName).toBe("Anna");
    expect(data.position).toBe("Milieu");
    expect(data.level).toBe("Regional");
    expect(data.latestSession).toMatchObject({ status: "done", durationMin: 40, blockCount: 4, title: "Séance renfo / force" });
    expect(data.adaptation).toMatchObject({ adapted: true });
    expect(typeof data.sourceEventAt).toBe("number");
    expect(typeof data.sourceEventTime).toBe("string");
    expect(typeof data.sourceEventId).toBe("string");
    expect(data.updatedAt).toBeDefined();

    expect(() => assertCoachSafe(data)).not.toThrow();
    const serialized = JSON.stringify(data).toLowerCase();
    for (const k of ["pain", "comment", "tsb", "atl", "ctl", "metrics", "feedback", "aiv2", "rpe"]) {
      expect(serialized).not.toContain(`"${k}"`);
    }
    expect(serialized).not.toContain("renfo bas du corps"); // titre libre supprimé
    for (const k of FORBIDDEN_KEYS) expect(Object.keys(data)).not.toContain(k);
  });

  it("second rebuild identique = même contenu métier (idempotent)", async () => {
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    const first = (await summaryRef().get()).data()!;

    const res2 = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    expect(res2.action).toBe("written");
    const second = (await summaryRef().get()).data()!;

    const strip = (d: FirebaseFirestore.DocumentData) => {
      const { updatedAt, sourceEventAt, sourceEventTime, sourceEventId, ...rest } = d;
      void updatedAt;
      void sourceEventAt;
      void sourceEventTime;
      void sourceEventId;
      return rest;
    };
    expect(strip(second)).toEqual(strip(first));
    expect(second.sourceEventAt).toBe(2000);
  });
});

describe("rebuildPlayerSummary — P0.1 races write/delete", () => {
  it("ancien write après nouveau write → skipped-stale", async () => {
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(5000) }, db);
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect(res.action).toBe("skipped-stale");
    expect((await summaryRef().get()).data()!.sourceEventAt).toBe(5000);
  });

  it("ancien delete après nouveau write → la projection récente reste", async () => {
    // Projection récente écrite (wm 5000).
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(5000) }, db);
    // Le membre est retiré → un rebuild verrait core=null (suppression)…
    await db.doc("clubs/clubA/members/playerA1").delete();
    // …mais l'événement de suppression est ANCIEN (wm 1000) → ne doit pas supprimer.
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect(res.action).toBe("skipped-stale");
    expect((await summaryRef().get()).exists).toBe(true);
  });

  it("suppression puis recréation concurrente → résultat récent conservé (quel que soit l'ordre)", async () => {
    // 1) Le create récent (wm 3000) arrive AVANT le delete ancien (wm 2000).
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(3000) }, db);
    await db.doc("clubs/clubA/members/playerA1").delete();
    const stale = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    expect(stale.action).toBe("skipped-stale");
    expect((await summaryRef().get()).exists).toBe(true); // le create récent gagne
  });

  it("événements de timestamp ÉGAL → comportement déterministe (id le plus grand gagne)", async () => {
    const SAME = 4000;
    // "aaa" écrit, puis "bbb" (même temps, id > ) doit gagner ; l'inverse est skip.
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(SAME, "aaa") }, db);
    const win = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(SAME, "bbb") }, db);
    expect(win.action).toBe("written");
    expect((await summaryRef().get()).data()!.sourceEventId).toBe("bbb");
    const skip = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(SAME, "aaa") }, db);
    expect(skip.action).toBe("skipped-stale");
    expect((await summaryRef().get()).data()!.sourceEventId).toBe("bbb");
  });

  it("rejeu EXACT du même événement ne mute rien (idempotent), puis E2 récent passe", async () => {
    const E = wm(3000, "evtE");
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: E }, db);
    const after1 = (await summaryRef().get()).data()!;
    const ts1 = after1.updatedAt.toMillis();
    expect(after1.latestSession.dateKey).toBe("2026-06-28");

    // Les sources changent APRÈS le premier write (nouvelle séance faite plus récente).
    await db.doc("users/playerA1/sessions/s2").set({
      date: "2026-07-15", dateISO: "2026-07-15", intensity: "easy", focus: "core",
      feedback: { durationMin: 20 }, aiV2: { blocks: [{}] },
    });

    // Rejeu EXACT de E → aucune mutation malgré les sources modifiées.
    const replay = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: E }, db);
    expect(replay.action).toBe("skipped-duplicate");
    const after2 = (await summaryRef().get()).data()!;
    expect(after2.updatedAt.toMillis()).toBe(ts1); // updatedAt inchangé
    expect(after2.latestSession.dateKey).toBe("2026-06-28"); // contenu métier inchangé

    // Un événement E2 réellement plus récent → la mise à jour légitime passe.
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(4000, "evtE2") }, db);
    expect(res.action).toBe("written");
    expect((await summaryRef().get()).data()!.latestSession.dateKey).toBe("2026-07-15");
  });

  it("suppression légitime récente → summary supprimé", async () => {
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect((await summaryRef().get()).exists).toBe(true);
    await db.doc("clubs/clubA/members/playerA1").delete();
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    expect(res.action).toBe("deleted");
    expect((await summaryRef().get()).exists).toBe(false);
  });

  it("summary absent + suppression → noop propre", async () => {
    await db.doc("clubs/clubA/members/playerA1").delete();
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    expect(res.action).toBe("noop-absent");
    expect((await summaryRef().get()).exists).toBe(false);
  });
});

describe("rebuildPlayerSummary — membership / club", () => {
  it("membre non-player → aucune projection (noop-absent)", async () => {
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "coachA", watermark: wm(1000) }, db);
    expect(res.action).toBe("noop-absent");
    expect((await db.doc("clubs/clubA/playerSummaries/coachA").get()).exists).toBe(false);
  });

  it("planned puis completed plus récent → latestSession/lastActivity mis à jour", async () => {
    await db.doc("users/playerA1/plannedSessions/p1").set({
      date: "2026-07-10", title: "Explosivite", focus: "speed", intensity: "hard",
      ai: { title: "Explosivite", blocks: [{}, {}, {}] },
    });
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect((await summaryRef().get()).data()!.latestSession.status).toBe("planned");

    await db.doc("users/playerA1/sessions/s2").set({
      date: "2026-07-12", dateISO: "2026-07-12", title: "Séance faite", intensity: "easy", focus: "core",
      feedback: { durationMin: 30, pain: 0 }, aiV2: { blocks: [{}, {}] },
    });
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    const data = (await summaryRef().get()).data()!;
    expect(data.latestSession.status).toBe("done");
    expect(data.latestSession.dateKey).toBe("2026-07-12");
    expect(data.lastActivity).toEqual({ dateKey: "2026-07-12", durationMin: 30 });
  });

  // ── Autorisation d'accès aux données de suivi (default-deny) ──────────────
  it("état d'accès non autorisant → AUCUNE projection écrite", async () => {
    for (const etat of ["pending", "revoked", "APPROVED"]) {
      await db.doc("clubs/clubA/members/playerA1").update({ coachAccess: etat });
      const res = await rebuildPlayerSummary(
        { clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) },
        db,
      );
      expect(res.action).toBe("noop-absent");
      expect((await summaryRef().get()).exists).toBe(false);
    }
  });

  it("champ d'accès ABSENT (membership ancien) → AUCUNE projection écrite", async () => {
    await db.doc("clubs/clubA/members/playerA1").set({ uid: "playerA1", role: "player" });
    const res = await rebuildPlayerSummary(
      { clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) },
      db,
    );
    expect(res.action).toBe("noop-absent");
    expect((await summaryRef().get()).exists).toBe(false);
  });

  it("bascule approved → revoked : la projection DÉJÀ ÉCRITE est SUPPRIMÉE", async () => {
    // C'est le point qui distingue un verrou d'un simple filtre d'affichage :
    // retirer l'accès doit retirer la donnée déjà projetée, pas seulement cesser
    // d'en produire de nouvelle.
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect((await summaryRef().get()).exists).toBe(true);

    await db.doc("clubs/clubA/members/playerA1").update({ coachAccess: "revoked" });
    const res = await rebuildPlayerSummary(
      { clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) },
      db,
    );
    expect(res.action).toBe("deleted");
    expect((await summaryRef().get()).exists).toBe(false);
  });

  it("changement de club → ancienne projection supprimée quand le profil pointe ailleurs", async () => {
    await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(1000) }, db);
    expect((await summaryRef().get()).exists).toBe(true);

    await db.doc("users/playerA1").update({ clubId: "clubB" });
    const res = await rebuildPlayerSummary({ clubId: "clubA", playerUid: "playerA1", watermark: wm(2000) }, db);
    expect(res.action).toBe("deleted");
    expect((await summaryRef().get()).exists).toBe(false);
  });
});
