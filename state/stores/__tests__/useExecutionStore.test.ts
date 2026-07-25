// state/stores/__tests__/useExecutionStore.test.ts
// Couvre deux fixes de la boucle de suivi (docs/boucle-suivi-2026-07-25/) :
// - P2-d : finishCurrent DEDUPLIQUE l'entree history par sessionId (jamais de
//   doublon quand une meme seance est relancee et refinalisee, cf. P1-2).
// - P1-2 : ensureExecution (SessionLiveScreen) ne reutilise plus une
//   execution deja finalisee -- ce fichier couvre la contrepartie store :
//   getExecutionForSession lit HISTORY D'ABORD (finalisee, deduplique par
//   P2-d) puis current en filet, pour que le feedback retrouve toujours la
//   BONNE version (la finalisee la plus recente), jamais une "current"
//   perimee ou en cours.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useExecutionStore } from "../useExecutionStore";
import { initExecution } from "../../../domain/tracking/execution";
import type { PrescribedSnapshot } from "../../../domain/tracking/types";

function makeSnapshot(sessionId: string): PrescribedSnapshot {
  return {
    sessionId,
    fingerprint: "fp",
    generatedAtISO: null,
    launchedAtISO: "2026-07-20T10:00:00.000Z",
    cycleGoal: "force",
    sessionIndex: 3,
    phase: null,
    matchContext: "none",
    plannedDurationMin: 60,
    rpeTarget: 6,
    intensity: "moderate",
    focusPrimary: "strength",
    items: [
      {
        key: "0-0",
        exerciseId: "str_squat_gobelet",
        name: "Squat gobelet",
        blockId: "b0",
        blockIndex: 0,
        itemIndex: 0,
        blockType: "strength",
        role: "primary",
        sets: 3,
        reps: 8,
        workS: null,
        restS: 90,
        durationMin: null,
        notes: null,
      },
    ],
  };
}

beforeEach(async () => {
  // Laisse finir l'hydratation initiale (meme precaution que les autres
  // tests de store persiste, cf. loadStoreRestLockPurge.test.ts) avant de
  // repartir d'un etat propre.
  await new Promise((r) => setTimeout(r, 0));
  await AsyncStorage.clear();
  useExecutionStore.getState().resetAll();
});

describe("useExecutionStore.finishCurrent — dedup history par sessionId (P2-d)", () => {
  test("finalise une execution en cours -> pousse dans history ET current", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);

    const state = useExecutionStore.getState();
    expect(state.current?.finishedAtISO).toBe("2026-07-20T11:00:00.000Z");
    expect(state.history).toHaveLength(1);
    expect(state.history[0].sessionId).toBe("s1");
  });

  test("no-op si current est deja finalise (idempotence existante conservee)", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);
    useExecutionStore.getState().finishCurrent("2026-07-20T12:00:00.000Z", 99);

    const state = useExecutionStore.getState();
    expect(state.current?.finishedAtISO).toBe("2026-07-20T11:00:00.000Z");
    expect(state.history).toHaveLength(1);
  });

  test("2e finalisation de la MEME session (relance, cf. P1-2) remplace l'entree history existante -- jamais de doublon", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);
    expect(useExecutionStore.getState().history).toHaveLength(1);

    // Relance : nouvelle execution neuve pour le MEME sessionId (comme le
    // ferait ensureExecution apres le fix P1-2), puis 2e finalisation.
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-21T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-21T11:30:00.000Z", 90);

    const state = useExecutionStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0].sessionId).toBe("s1");
    expect(state.history[0].finishedAtISO).toBe("2026-07-21T11:30:00.000Z");
    expect(state.history[0].actualDurationMin).toBe(90);
  });

  test("le dedup par sessionId ne touche pas les entrees d'AUTRES sessions", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("sA"), "2026-07-19T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-19T11:00:00.000Z", 40);

    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("sB"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 45);

    const state = useExecutionStore.getState();
    expect(state.history.map((e) => e.sessionId).sort()).toEqual(["sA", "sB"]);
  });
});

describe("useExecutionStore.getExecutionForSession — ordre history puis current (P1-2)", () => {
  test("execution en cours (non finalisee, absente de history) -> retrouvee via current", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));

    const found = useExecutionStore.getState().getExecutionForSession("s1");
    expect(found?.sessionId).toBe("s1");
    expect(found?.finishedAtISO).toBeNull();
  });

  test("execution finalisee -> retrouvee (current et history pointent la meme version finalisee)", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);

    const found = useExecutionStore.getState().getExecutionForSession("s1");
    expect(found?.finishedAtISO).toBe("2026-07-20T11:00:00.000Z");
  });

  test("apres clearCurrent (sortie du Summary), la version finalisee reste retrouvable via history", () => {
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);
    useExecutionStore.getState().clearCurrent();

    const state = useExecutionStore.getState();
    expect(state.current).toBeNull();
    expect(state.getExecutionForSession("s1")?.finishedAtISO).toBe("2026-07-20T11:00:00.000Z");
  });

  test("scenario P1-2 complet : relance apres relance-avant-feedback -> retrouve la version FINALISEE la plus recente, jamais une 'current' perimee", () => {
    // 1er passage complet, app tuee AVANT le feedback (current reste
    // finalise, jamais efface -- aucun clearCurrent n'a ete appele).
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-20T10:00:00.000Z"));
    useExecutionStore.getState().finishCurrent("2026-07-20T11:00:00.000Z", 55);

    // Relance de la MEME seance : ensureExecution (post-fix) detecte
    // finishedAtISO pose et redemarre une execution neuve.
    useExecutionStore.getState().startExecution(initExecution(makeSnapshot("s1"), "2026-07-21T09:00:00.000Z"));
    expect(useExecutionStore.getState().current?.finishedAtISO).toBeNull();

    // 2e passage, vraiment capture cette fois.
    useExecutionStore.getState().finishCurrent("2026-07-21T10:15:00.000Z", 70);

    const found = useExecutionStore.getState().getExecutionForSession("s1");
    expect(found?.finishedAtISO).toBe("2026-07-21T10:15:00.000Z");
    expect(found?.actualDurationMin).toBe(70);
  });
});
