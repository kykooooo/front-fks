// hooks/__tests__/useTrackingProgress.test.ts
// Couvre la fonction PURE buildTrackingProgress (section "Ton suivi",
// ProgressScreen, Lot 6) : complétion, RPE, évolution charges/reps (même
// exerciseId uniquement), reprise, dernière décision, phase/prochaine étape.
// Aucun mock nécessaire : buildTrackingProgress ne touche ni React ni Zustand
// ni Firebase -- seulement domain/tracking/** (lecture seule) + utils purs.
import { buildTrackingProgress, type TrackingProgressInput } from "../trackingProgress/buildTrackingProgress";
import { initExecution, setItemActual, setItemStatus, finalizeExecution } from "../../domain/tracking/execution";
import type { ItemStatus, PrescribedSnapshot, SessionExecution, TrackingDecision } from "../../domain/tracking/types";
import type { Session } from "../../domain/types";

const NOW_ISO = "2026-07-30T12:00:00.000Z"; // jeudi -- lundi de la semaine = 2026-07-27

function makeSnapshot(overrides: Partial<PrescribedSnapshot> = {}): PrescribedSnapshot {
  return {
    sessionId: "s_default",
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
    ...overrides,
  };
}

function makeExecution(opts: {
  sessionId: string;
  finishedAtISO: string;
  items?: PrescribedSnapshot["items"];
  rpeTarget?: number | null;
  plannedDurationMin?: number | null;
  itemActuals?: Record<string, { loadKg?: number; reps?: number }>;
  itemStatuses?: Record<string, ItemStatus>;
}): SessionExecution {
  const items = opts.items ?? makeSnapshot().items;
  const snapshot = makeSnapshot({
    sessionId: opts.sessionId,
    items,
    rpeTarget: opts.rpeTarget ?? 6,
    plannedDurationMin: opts.plannedDurationMin ?? 60,
  });
  let exec = initExecution(snapshot, opts.finishedAtISO);
  for (const item of items) {
    exec = setItemStatus(exec, item.key, opts.itemStatuses?.[item.key] ?? "done");
    const actual = opts.itemActuals?.[item.key];
    if (actual) exec = setItemActual(exec, item.key, actual);
  }
  return finalizeExecution(exec, opts.finishedAtISO, opts.plannedDurationMin ?? 60);
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? "s_default",
    date: "2026-07-20",
    dateISO: "2026-07-20T09:00:00.000Z",
    focus: "strength",
    phase: "Playlist" as any,
    intensity: "moderate" as any,
    volumeScore: 40,
    exercises: [],
    completed: true,
    ...overrides,
  } as Session;
}

function baseInput(overrides: Partial<TrackingProgressInput> = {}): TrackingProgressInput {
  return {
    nowISO: NOW_ISO,
    executionHistory: [],
    sessions: [],
    lastDecision: null,
    microcycleGoal: "force",
    microcycleSessionIndex: 3,
    selfReportedGapDays: null,
    ...overrides,
  };
}

describe("buildTrackingProgress — phase / cycle", () => {
  test("cycle actif : sessionLabel + phaseLabel + prochaine étape dérivés de l'index", () => {
    const vm = buildTrackingProgress(baseInput({ microcycleGoal: "force", microcycleSessionIndex: 3 }));
    expect(vm.hasCycle).toBe(true);
    expect(vm.sessionLabel).toBe("Séance 4/12");
    expect(vm.phaseLabel).toBe("Fondations");
    expect(vm.nextStepLabel).toBe("Prochaine séance : 5/12 — Montée en puissance");
  });

  test("aucun cycle actif : message neutre, pas de séance N/12 fantôme", () => {
    const vm = buildTrackingProgress(baseInput({ microcycleGoal: null, microcycleSessionIndex: 0 }));
    expect(vm.hasCycle).toBe(false);
    expect(vm.nextStepLabel).toBe("Choisis un cycle actif pour démarrer ta progression.");
  });

  test("dernière séance du cycle (deload) : pas de '12/12' fantôme en prochaine étape", () => {
    const vm = buildTrackingProgress(baseInput({ microcycleGoal: "force", microcycleSessionIndex: 11 }));
    expect(vm.sessionLabel).toBe("Séance 12/12");
    expect(vm.nextStepLabel).toBe("Cycle terminé : choisis ta prochaine étape.");
  });
});

describe("buildTrackingProgress — complétion", () => {
  test("aucune exécution connue -> honnête, pas de donnée inventée", () => {
    const vm = buildTrackingProgress(baseInput({ executionHistory: [], sessions: [] }));
    expect(vm.completion).toEqual({ hasData: false, sessionsTracked: 0, completionAvgPct: null });
  });

  test("2 exécutions terminées -> complétion moyenne calculée", () => {
    const exec1 = makeExecution({ sessionId: "s1", finishedAtISO: "2026-07-28T10:00:00.000Z" }); // tout "done" -> 100%
    const exec2 = makeExecution({
      sessionId: "s2",
      finishedAtISO: "2026-07-29T10:00:00.000Z",
      itemStatuses: { "0-0": "skipped" },
    }); // -> 0%
    const vm = buildTrackingProgress(
      baseInput({ executionHistory: [exec1, exec2], sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" })] })
    );
    expect(vm.completion.hasData).toBe(true);
    expect(vm.completion.sessionsTracked).toBe(2);
    expect(vm.completion.completionAvgPct).toBe(50);
  });
});

describe("buildTrackingProgress — RPE ressenti vs prévu", () => {
  test("moins de 3 séances avec RPE+cible -> pas de signal (honnête)", () => {
    const execs = ["2026-07-27T10:00:00.000Z", "2026-07-28T10:00:00.000Z"].map((iso, i) =>
      makeExecution({ sessionId: `s${i}`, finishedAtISO: iso, rpeTarget: 6 })
    );
    const sessions = execs.map((e) => makeSession({ id: e.sessionId, feedback: { rpe: 8, fatigue: 3, sleep: 3, pain: 0, createdAt: e.finishedAtISO! } as any }));
    const vm = buildTrackingProgress(baseInput({ executionHistory: execs, sessions }));
    expect(vm.rpe.hasSignal).toBe(false);
    expect(vm.rpe.deltaAvg).toBeNull();
  });

  test("3 séances avec effort +2 au-dessus de la cible -> signal exploitable", () => {
    const dates = ["2026-07-26T10:00:00.000Z", "2026-07-27T10:00:00.000Z", "2026-07-28T10:00:00.000Z"];
    const execs = dates.map((iso, i) => makeExecution({ sessionId: `s${i}`, finishedAtISO: iso, rpeTarget: 6 }));
    const sessions = execs.map((e) =>
      makeSession({ id: e.sessionId, feedback: { rpe: 8, fatigue: 3, sleep: 3, pain: 0, createdAt: e.finishedAtISO! } as any })
    );
    const vm = buildTrackingProgress(baseInput({ executionHistory: execs, sessions }));
    expect(vm.rpe.hasSignal).toBe(true);
    expect(vm.rpe.deltaAvg).toBe(2);
  });
});

describe("buildTrackingProgress — évolution charges/reps (même exerciseId uniquement)", () => {
  test("2 points sur le même exercice -> évolution affichée", () => {
    const items = makeSnapshot().items;
    const exec1 = makeExecution({
      sessionId: "s1",
      finishedAtISO: "2026-07-20T10:00:00.000Z",
      items,
      itemActuals: { "0-0": { loadKg: 12 } },
    });
    const exec2 = makeExecution({
      sessionId: "s2",
      finishedAtISO: "2026-07-27T10:00:00.000Z",
      items,
      itemActuals: { "0-0": { loadKg: 14 } },
    });
    const vm = buildTrackingProgress(baseInput({ executionHistory: [exec1, exec2] }));
    expect(vm.exerciseEvolutions).toEqual([
      { exerciseId: "str_squat_gobelet", label: "Squat gobelet", metric: "loadKg", from: 12, to: 14 },
    ]);
  });

  test("1 seul point connu -> aucune évolution montrée (jamais 2 exos comparés entre eux)", () => {
    const itemsA = [
      { ...makeSnapshot().items[0], key: "0-0", exerciseId: "squat", name: "Squat" },
      { ...makeSnapshot().items[0], key: "0-1", exerciseId: "deadlift", name: "Soulevé de terre" },
    ];
    const exec = makeExecution({
      sessionId: "s1",
      finishedAtISO: "2026-07-27T10:00:00.000Z",
      items: itemsA,
      itemActuals: { "0-0": { loadKg: 10 }, "0-1": { loadKg: 50 } },
    });
    const vm = buildTrackingProgress(baseInput({ executionHistory: [exec] }));
    expect(vm.exerciseEvolutions).toEqual([]);
  });

  test("plus de 3 exercices éligibles -> tronqué à 3, les plus récemment travaillés d'abord", () => {
    // 5 séances (= plafond TRACKING_CONFIG.window.sessions), plusieurs exos par
    // séance (cas réaliste). ex1..ex4 ont chacun exactement 2 points ; le 2e
    // point de chaque exercice arrive à une séance différente -> ordre de
    // récence net (ex4 le plus récent, ex1 le plus ancien -> exclu).
    const mkItem = (id: string) => ({ ...makeSnapshot().items[0], key: `k_${id}`, exerciseId: id, name: id });
    const execS1 = makeExecution({
      sessionId: "S1",
      finishedAtISO: "2026-07-10T10:00:00.000Z",
      items: [mkItem("ex1"), mkItem("ex2")],
      itemActuals: { k_ex1: { loadKg: 10 }, k_ex2: { loadKg: 10 } },
    });
    const execS2 = makeExecution({
      sessionId: "S2",
      finishedAtISO: "2026-07-13T10:00:00.000Z",
      items: [mkItem("ex1")],
      itemActuals: { k_ex1: { loadKg: 11 } },
    });
    const execS3 = makeExecution({
      sessionId: "S3",
      finishedAtISO: "2026-07-16T10:00:00.000Z",
      items: [mkItem("ex2"), mkItem("ex3")],
      itemActuals: { k_ex2: { loadKg: 11 }, k_ex3: { loadKg: 10 } },
    });
    const execS4 = makeExecution({
      sessionId: "S4",
      finishedAtISO: "2026-07-19T10:00:00.000Z",
      items: [mkItem("ex3"), mkItem("ex4")],
      itemActuals: { k_ex3: { loadKg: 11 }, k_ex4: { loadKg: 10 } },
    });
    const execS5 = makeExecution({
      sessionId: "S5",
      finishedAtISO: "2026-07-22T10:00:00.000Z",
      items: [mkItem("ex4")],
      itemActuals: { k_ex4: { loadKg: 11 } },
    });
    const vm = buildTrackingProgress(
      baseInput({
        nowISO: "2026-07-23T00:00:00.000Z",
        executionHistory: [execS1, execS2, execS3, execS4, execS5],
      })
    );
    expect(vm.exerciseEvolutions).toHaveLength(3);
    expect(vm.exerciseEvolutions.map((e) => e.exerciseId)).toEqual(["ex4", "ex3", "ex2"]);
  });
});

describe("buildTrackingProgress — dernière décision", () => {
  test("aucune décision stockée -> rien (pas de carte vide)", () => {
    const vm = buildTrackingProgress(baseInput({ lastDecision: null }));
    expect(vm.lastDecisionView).toBeNull();
  });

  test("décision stockée -> badge FR + explication complète + date relative", () => {
    const decision: TrackingDecision = {
      version: 1,
      rulesVersion: "tracking-rules/1.0.0",
      decidedAtISO: "2026-07-29T12:00:00.000Z", // hier par rapport à NOW_ISO
      kind: "reduce_volume_light",
      targets: [],
      explanation: "La dernière séance a été plus difficile que prévu.",
      signalsDigest: { completionRateAvg: 80, rpeDeltaAvg: 2, painActive: false, gapDays: null, dataQuality: "ok" },
      mode: "shadow",
    };
    const vm = buildTrackingProgress(baseInput({ lastDecision: decision }));
    expect(vm.lastDecisionView).toEqual({
      kind: "reduce_volume_light",
      kindLabel: "Volume allégé",
      explanation: "La dernière séance a été plus difficile que prévu.",
      dateLabel: "hier",
    });
  });
});

describe("buildTrackingProgress — reprise (resumption)", () => {
  test("aucun historique, gap auto-déclaré > 28 j -> reprise dure, source self_reported", () => {
    const vm = buildTrackingProgress(baseInput({ executionHistory: [], sessions: [], selfReportedGapDays: 60 }));
    expect(vm.resumption).toEqual({
      level: "hard",
      source: "self_reported",
      message: "Reprise détectée : on y va progressivement.",
    });
  });

  test("aucun historique, gap auto-déclaré faible -> pas de reprise détectée", () => {
    const vm = buildTrackingProgress(baseInput({ executionHistory: [], sessions: [], selfReportedGapDays: 3 }));
    expect(vm.resumption).toBeNull();
  });

  test("historique réel prioritaire sur le gap auto-déclaré", () => {
    const exec = makeExecution({ sessionId: "s1", finishedAtISO: "2026-06-01T10:00:00.000Z" }); // ~59 jours avant NOW_ISO
    const vm = buildTrackingProgress(
      baseInput({ executionHistory: [exec], sessions: [makeSession({ id: "s1" })], selfReportedGapDays: 1 })
    );
    expect(vm.resumption?.level).toBe("hard");
    expect(vm.resumption?.source).toBe("history");
  });

  // Fix P2-e : le bandeau "Reprise détectée" calculait le gap UNIQUEMENT
  // depuis executionHistory (exécutions live), alors que le moteur de
  // décision (state/orchestrators/trackingShadow.ts, appelé par
  // applyFeedback) le calcule depuis TOUTES les séances complétées
  // (`sessions`). Un joueur régulier qui n'a jamais utilisé le tracking live
  // (executionHistory vide) déclenchait donc à tort le bandeau dès qu'un
  // selfReportedGapDays ancien/élevé traînait -- alors que ses séances
  // complétées récentes prouvent qu'il n'y a AUCUNE coupure réelle.
  test("séance complétée récente SANS exécution live -> pas de reprise à tort, même avec un gap auto-déclaré élevé/périmé", () => {
    // Le gap se calcule sur dateISO (date de séance, même sémantique que
    // sessionToTrackingHistoryEntry côté moteur) -- 1 jour avant NOW_ISO.
    const recentSession = makeSession({
      id: "s1",
      completed: true,
      dateISO: "2026-07-29T10:00:00.000Z",
      completedAt: "2026-07-29T10:00:00.000Z",
    });
    const vm = buildTrackingProgress(
      baseInput({ executionHistory: [], sessions: [recentSession], selfReportedGapDays: 60 })
    );
    expect(vm.resumption).toBeNull();
  });

  test("séance complétée ANCIENNE (sans exécution live) -> reprise détectée depuis les sessions, source history", () => {
    const oldSession = makeSession({
      id: "s1",
      completed: true,
      dateISO: "2026-05-20T10:00:00.000Z", // > 60 jours avant NOW_ISO
      completedAt: "2026-05-20T10:00:00.000Z",
    });
    const vm = buildTrackingProgress(
      baseInput({ executionHistory: [], sessions: [oldSession], selfReportedGapDays: 1 })
    );
    expect(vm.resumption?.level).toBe("hard");
    expect(vm.resumption?.source).toBe("history");
  });
});

describe("buildTrackingProgress — le compteur hebdo n'est plus ici", () => {
  // Cette section testait un compteur « régularité hebdo » : numérateur à lundi
  // fixe, cible `targetFksSessionsPerWeek`. Il fonctionnait. Ce qui n'allait
  // pas, c'est qu'il était le TROISIÈME de l'app à répondre à la même question,
  // avec sa propre semaine et sa propre cible — à côté de celui du Home
  // (semaine du joueur, cible `weeklyGoal`). Décision fermée du fondateur : le
  // compteur hebdomadaire vit au Home, seul.
  //
  // Ces deux tests remplacent les deux anciens. Ils ne vérifient plus un
  // calcul : ils verrouillent une ABSENCE, pour que le doublon ne puisse pas
  // revenir en silence par un `?? 2` ajouté un jour de fatigue.

  test("le ViewModel ne porte plus aucun champ hebdomadaire", () => {
    const sessions = [
      makeSession({ id: "a", dateISO: "2026-07-27T09:00:00.000Z", completed: true }),
      makeSession({ id: "b", dateISO: "2026-07-29T09:00:00.000Z", completed: true }),
    ];
    const vm = buildTrackingProgress(baseInput({ sessions }));
    // Pas `toBeUndefined()` : le champ ne doit pas EXISTER, même à `null`. Un
    // champ mort qu'un écran peut encore lire, c'est le doublon qui attend.
    expect(Object.keys(vm)).not.toContain("weekly");
  });

  test("aucune clé du ViewModel ne parle de semaine", () => {
    const vm = buildTrackingProgress(baseInput());
    const clesHebdo = Object.keys(vm).filter((k) => /week|hebdo|semaine/i.test(k));
    expect(clesHebdo).toEqual([]);
  });
});
