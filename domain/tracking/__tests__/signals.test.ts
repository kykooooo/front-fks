// domain/tracking/__tests__/signals.test.ts
import { computeTrackingSignals, findLastCompletedSessionDateMs } from "../signals";
import type { TrackingHistoryEntry } from "../signals";
import { TRACKING_CONFIG } from "../config";
import { applyReplacement, finalizeExecution, initExecution, setItemStatus } from "../execution";
import type { DeviationReason, ItemStatus, PrescribedSnapshot, SessionExecution } from "../types";

const NOW_ISO = "2026-07-25T12:00:00.000Z";

function daysAgo(n: number): string {
  const d = new Date(NOW_ISO);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function buildExecution(params: {
  sessionId: string;
  startedAtISO: string;
  finishedAtISO: string;
  items: Array<{ exerciseId: string; status: ItemStatus; reason?: DeviationReason | null }>;
}): SessionExecution {
  const snapshot: PrescribedSnapshot = {
    sessionId: params.sessionId,
    fingerprint: `fp-${params.sessionId}`,
    generatedAtISO: null,
    launchedAtISO: params.startedAtISO,
    cycleGoal: "force",
    sessionIndex: 0,
    phase: "Progression",
    matchContext: "none",
    plannedDurationMin: 60,
    rpeTarget: 6,
    intensity: "moderate",
    focusPrimary: "strength",
    items: params.items.map((it, idx) => ({
      key: `0-${idx}`,
      exerciseId: it.exerciseId,
      name: it.exerciseId,
      blockId: "b0",
      blockIndex: 0,
      itemIndex: idx,
      blockType: "strength",
      role: null,
      sets: 3,
      reps: 8,
      workS: null,
      restS: 60,
      durationMin: null,
      notes: null,
    })),
  };

  let exec = initExecution(snapshot, params.startedAtISO);
  params.items.forEach((it, idx) => {
    const key = `0-${idx}`;
    if (it.status === "replaced") {
      exec = applyReplacement(exec, key, {
        originalExerciseId: it.exerciseId,
        replacementExerciseId: `${it.exerciseId}_alt`,
        reason: it.reason ?? "equipment",
        equivalent: true,
        prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
      });
    } else {
      exec = setItemStatus(exec, key, it.status, it.reason ?? null);
    }
  });
  return finalizeExecution(exec, params.finishedAtISO, 55);
}

/** Entree "feedback-only" (historique ancien) : jamais d'execution enregistree -- P1-b. */
function feedbackOnlyEntry(daysAgoValue: number, overrides: Partial<TrackingHistoryEntry> = {}): TrackingHistoryEntry {
  const dateISO = daysAgo(daysAgoValue);
  return {
    dateISO,
    completedAtISO: dateISO,
    feedback: { rpe: 6, pain: 0, durationMin: 58 },
    rpeTarget: 6,
    plannedDurationMin: 60,
    ...overrides,
  };
}

function fullSessionEntry(daysAgoValue: number, overrides: Partial<TrackingHistoryEntry> = {}): TrackingHistoryEntry {
  const dateISO = daysAgo(daysAgoValue);
  return {
    dateISO,
    completedAtISO: dateISO,
    feedback: { rpe: 6, pain: 0, durationMin: 58 },
    rpeTarget: 6,
    plannedDurationMin: 60,
    execution: buildExecution({
      sessionId: `s-${daysAgoValue}`,
      startedAtISO: dateISO,
      finishedAtISO: dateISO,
      items: [
        { exerciseId: "str_squat", status: "done" },
        { exerciseId: "str_lunge", status: "done" },
      ],
    }),
    ...overrides,
  };
}

describe("computeTrackingSignals -- donnees manquantes/malformees", () => {
  it("historique vide -> insufficient, 0 seance analysee, tous les signaux a defaut", () => {
    const signals = computeTrackingSignals([], NOW_ISO);
    expect(signals.dataQuality).toBe("insufficient");
    expect(signals.sessionsAnalyzed).toBe(0);
    expect(signals.completionRateAvg).toBeNull();
    expect(signals.rpeDeltaAvg).toBeNull();
    expect(signals.rpeDeltaCount).toBe(0);
    expect(signals.gapDays).toBeNull();
    expect(signals.streakOkSessions).toBe(0);
    expect(signals.painSignal).toEqual({ active: false, source: null, occurrences: 0 });
  });

  it("entrees a date invalide sont ignorees sans planter (ne comptent pas comme exploitables)", () => {
    const history: TrackingHistoryEntry[] = [
      { dateISO: "n'importe-quoi" },
      { dateISO: "" },
      fullSessionEntry(1),
    ];
    expect(() => computeTrackingSignals(history, NOW_ISO)).not.toThrow();
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.sessionsAnalyzed).toBe(1);
    expect(signals.dataQuality).toBe("ok");
  });

  it("ne modifie jamais l'historique passe en entree (purete)", () => {
    const history = [fullSessionEntry(1), fullSessionEntry(3)];
    const snapshot = JSON.parse(JSON.stringify(history));
    computeTrackingSignals(history, NOW_ISO);
    expect(history).toEqual(snapshot);
  });
});

describe("computeTrackingSignals -- dataQuality incoherente", () => {
  it("rpe hors [1,10] -> inconsistent", () => {
    const history = [fullSessionEntry(1, { feedback: { rpe: 15, pain: 0, durationMin: 55 } })];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("inconsistent");
  });

  it("duree reelle aberrante (> 4h) -> inconsistent", () => {
    const history = [fullSessionEntry(1, { feedback: { rpe: 6, pain: 0, durationMin: 500 } })];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("inconsistent");
  });

  it("duree reelle declaree <= 0 -> inconsistent", () => {
    const history = [fullSessionEntry(1, { feedback: { rpe: 6, pain: 0, durationMin: 0 } })];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("inconsistent");
  });

  it("pct de completion hors [0,100] -> inconsistent", () => {
    const entry = fullSessionEntry(1);
    const exec = entry.execution as SessionExecution;
    const corrupted: SessionExecution = { ...exec, completion: { ...exec.completion, pct: 150 } };
    const history = [{ ...entry, execution: corrupted }];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("inconsistent");
  });

  it("deux entrees avec le meme sessionId -> inconsistent", () => {
    const a = fullSessionEntry(1);
    const b = fullSessionEntry(2);
    const dupExec: SessionExecution = { ...(b.execution as SessionExecution), sessionId: (a.execution as SessionExecution).sessionId };
    const history = [a, { ...b, execution: dupExec }];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("inconsistent");
  });

  it("rpe/duree incoherents -> standard (dataQuality inconsistent), pas insufficient", () => {
    const history = [fullSessionEntry(1, { feedback: { rpe: 15, pain: 0, durationMin: 500 } })];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.dataQuality).toBe("inconsistent");
    expect(signals.sessionsAnalyzed).toBe(1); // l'entree existe, elle est juste incoherente
  });
});

describe("computeTrackingSignals -- P1-b : insufficient = 0 execution exploitable (feedback seul ne suffit pas)", () => {
  it("historique 100% feedback-only (aucune execution enregistree) -> insufficient, meme avec des feedbacks coherents", () => {
    const history = [feedbackOnlyEntry(1), feedbackOnlyEntry(2), feedbackOnlyEntry(3)];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.dataQuality).toBe("insufficient");
  });

  it("sessionsAnalyzed compte les executions exploitables, pas les entrees feedback-only", () => {
    const history = [feedbackOnlyEntry(1), feedbackOnlyEntry(2), fullSessionEntry(3)];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.sessionsAnalyzed).toBe(1);
  });

  it("au moins une execution exploitable dans la fenetre -> dataQuality redevient ok malgre des entrees feedback-only", () => {
    const history = [fullSessionEntry(1), feedbackOnlyEntry(2)];
    expect(computeTrackingSignals(history, NOW_ISO).dataQuality).toBe("ok");
  });
});

describe("computeTrackingSignals -- fenetre d'analyse (sessions ET jours, le plus restrictif)", () => {
  it("une entree pile a 28 jours est incluse, au-dela de 28 jours elle est exclue", () => {
    const within = computeTrackingSignals([fullSessionEntry(TRACKING_CONFIG.window.days)], NOW_ISO);
    expect(within.sessionsAnalyzed).toBe(1);

    const outside = computeTrackingSignals([fullSessionEntry(TRACKING_CONFIG.window.days + 1)], NOW_ISO);
    expect(outside.sessionsAnalyzed).toBe(0);
    expect(outside.dataQuality).toBe("insufficient");
  });

  it("plus de config.window.sessions entrees recentes -> seules les N plus recentes comptent", () => {
    const history = [1, 2, 3, 4, 5, 6, 7].map((d) => fullSessionEntry(d));
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.sessionsAnalyzed).toBe(TRACKING_CONFIG.window.sessions);
  });
});

describe("computeTrackingSignals -- completionRateAvg / rpeDelta / durationRatio", () => {
  it("completionRateAvg moyenne les pct disponibles, null si aucune execution", () => {
    const history = [
      { dateISO: daysAgo(1), feedback: { rpe: 6 }, rpeTarget: 6 }, // pas d'execution
    ];
    expect(computeTrackingSignals(history, NOW_ISO).completionRateAvg).toBeNull();

    const withExec = [fullSessionEntry(1), fullSessionEntry(2)];
    const signals = computeTrackingSignals(withExec, NOW_ISO);
    expect(signals.completionRateAvg).toBe(100);
  });

  it("rpeDeltaCount est toujours renseigne, rpeDeltaAvg seulement si count >= minSessionsForSignal", () => {
    const twoSessions = [
      fullSessionEntry(1, { feedback: { rpe: 8, pain: 0, durationMin: 55 } }),
      fullSessionEntry(2, { feedback: { rpe: 8, pain: 0, durationMin: 55 } }),
    ];
    const signals2 = computeTrackingSignals(twoSessions, NOW_ISO);
    expect(signals2.rpeDeltaCount).toBe(2);
    expect(signals2.rpeDeltaAvg).toBeNull(); // < minSessionsForSignal (3)

    const threeSessions = [
      fullSessionEntry(1, { feedback: { rpe: 8, pain: 0, durationMin: 55 } }),
      fullSessionEntry(2, { feedback: { rpe: 8, pain: 0, durationMin: 55 } }),
      fullSessionEntry(3, { feedback: { rpe: 8, pain: 0, durationMin: 55 } }),
    ];
    const signals3 = computeTrackingSignals(threeSessions, NOW_ISO);
    expect(signals3.rpeDeltaCount).toBe(3);
    expect(signals3.rpeDeltaAvg).toBe(2); // rpe 8 - cible 6 = +2
  });

  it("durationRatioAvg moyenne reel/prevu, ecrete les ratios extremes (bornee saine)", () => {
    const history = [
      fullSessionEntry(1, { feedback: { rpe: 6, pain: 0, durationMin: 30 }, plannedDurationMin: 60 }), // 0.5
      fullSessionEntry(2, { feedback: { rpe: 6, pain: 0, durationMin: 600 }, plannedDurationMin: 60 }), // ratio brut 10 -> ecrete a 3
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.durationRatioAvg).toBeCloseTo((0.5 + 3) / 2, 5);
  });
});

describe("computeTrackingSignals -- timeConstrainedIncomplete", () => {
  it("derniere seance partielle avec raison dominante time -> true", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s-time",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_lunge", status: "skipped", reason: "time" },
          ],
        }),
      }),
    ];
    expect(computeTrackingSignals(history, NOW_ISO).timeConstrainedIncomplete).toBe(true);
  });

  it("derniere seance complete -> false", () => {
    expect(computeTrackingSignals([fullSessionEntry(1)], NOW_ISO).timeConstrainedIncomplete).toBe(false);
  });

  it("derniere seance partielle mais raison dominante non-time -> false", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s-other",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_lunge", status: "skipped", reason: "fatigue" },
          ],
        }),
      }),
    ];
    expect(computeTrackingSignals(history, NOW_ISO).timeConstrainedIncomplete).toBe(false);
  });
});

describe("computeTrackingSignals -- painSignal", () => {
  it("feedback.pain >= seuil dans la fenetre 7 j -> active, source feedback", () => {
    const history = [fullSessionEntry(2, { feedback: { rpe: 6, pain: 3, durationMin: 55 } })];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.painSignal).toEqual({ active: true, source: "feedback", occurrences: 1 });
  });

  it("blessure declaree sans feedback.pain -> active, source injury", () => {
    const history = [fullSessionEntry(2, { feedback: { rpe: 6, pain: 0, durationMin: 55 }, injuryDeclared: true })];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.painSignal.active).toBe(true);
    expect(signals.painSignal.source).toBe("injury");
  });

  it("item execution avec reason pain -> active, source replacement", () => {
    const history = [
      fullSessionEntry(2, {
        execution: buildExecution({
          sessionId: "s-pain-item",
          startedAtISO: daysAgo(2),
          finishedAtISO: daysAgo(2),
          items: [{ exerciseId: "str_squat", status: "skipped", reason: "pain" }],
        }),
      }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.painSignal.active).toBe(true);
    expect(signals.painSignal.source).toBe("replacement");
  });

  it("douleur au-dela de la fenetre pain (7j) n'est pas comptee", () => {
    const history = [fullSessionEntry(8, { feedback: { rpe: 6, pain: 4, durationMin: 55 } })];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.painSignal.active).toBe(false);
  });

  it("occurrences comptabilise toutes les seances a douleur dans la fenetre 7 j", () => {
    const history = [
      fullSessionEntry(1, { feedback: { rpe: 6, pain: 3, durationMin: 55 } }),
      fullSessionEntry(3, { feedback: { rpe: 6, pain: 4, durationMin: 55 } }),
      fullSessionEntry(6, { feedback: { rpe: 6, pain: 0, durationMin: 55 } }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.painSignal.occurrences).toBe(2);
  });
});

describe("computeTrackingSignals -- repeatedDifficulty / durableEquipmentIssues", () => {
  it("meme exercice 'too_difficult' 1x -> aucune influence (sous le seuil)", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [{ exerciseId: "plyo_box", status: "adapted", reason: "too_difficult" }],
        }),
      }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.repeatedDifficulty.exerciseIds).toEqual([]);
  });

  it("meme exercice 'too_difficult' 2x -> repeatedDifficulty rempli avec la famille", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [{ exerciseId: "plyo_box_jump", status: "adapted", reason: "too_difficult" }],
        }),
      }),
      fullSessionEntry(3, {
        execution: buildExecution({
          sessionId: "s2",
          startedAtISO: daysAgo(3),
          finishedAtISO: daysAgo(3),
          items: [{ exerciseId: "plyo_box_jump", status: "skipped", reason: "too_difficult" }],
        }),
      }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.repeatedDifficulty.exerciseIds).toEqual(["plyo_box_jump"]);
    expect(signals.repeatedDifficulty.families).toEqual(["plyo"]);
  });

  it("meme exercice remplace pour materiel 2x -> durableEquipmentIssues", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [{ exerciseId: "str_bench", status: "replaced", reason: "equipment" }],
        }),
      }),
      fullSessionEntry(3, {
        execution: buildExecution({
          sessionId: "s2",
          startedAtISO: daysAgo(3),
          finishedAtISO: daysAgo(3),
          items: [{ exerciseId: "str_bench", status: "replaced", reason: "equipment" }],
        }),
      }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.durableEquipmentIssues).toEqual(["str_bench"]);
  });

  it("materiel manquant 1x seulement -> pas d'influence", () => {
    const history = [
      fullSessionEntry(1, {
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [{ exerciseId: "str_bench", status: "adapted", reason: "equipment" }],
        }),
      }),
    ];
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.durableEquipmentIssues).toEqual([]);
  });
});

describe("computeTrackingSignals -- gapDays (portee = tout l'historique, pas seulement la fenetre)", () => {
  it("null si aucune seance terminee connue", () => {
    const history = [{ dateISO: daysAgo(1), feedback: { rpe: 6 } }]; // pas d'execution, pas de completedAtISO
    expect(computeTrackingSignals(history, NOW_ISO).gapDays).toBeNull();
  });

  it("calcule les jours entiers depuis la derniere seance terminee, meme au-dela de la fenetre de 28 j", () => {
    const signals = computeTrackingSignals([fullSessionEntry(40)], NOW_ISO);
    expect(signals.gapDays).toBe(40);
    expect(signals.sessionsAnalyzed).toBe(0); // hors fenetre -- decouple de gapDays
  });

  it("compat : une seance sans execution mais completedAtISO compte comme terminee", () => {
    const history = [{ dateISO: daysAgo(10), completedAtISO: daysAgo(10) }];
    expect(computeTrackingSignals(history, NOW_ISO).gapDays).toBe(10);
  });

  it("une seance 'abandoned' (pct < minCompletionForLastSession) ne compte pas comme reprise d'activite", () => {
    const abandoned = fullSessionEntry(5, {
      execution: buildExecution({
        sessionId: "s-abandoned",
        startedAtISO: daysAgo(5),
        finishedAtISO: daysAgo(5),
        items: [
          { exerciseId: "str_squat", status: "skipped", reason: "fatigue" },
          { exerciseId: "str_lunge", status: "skipped", reason: "fatigue" },
        ],
      }),
    });
    const goodBefore = fullSessionEntry(20);
    const signals = computeTrackingSignals([abandoned, goodBefore], NOW_ISO);
    expect(signals.gapDays).toBe(20); // remonte a la bonne seance precedente, pas la seance abandonnee
  });
});

describe("computeTrackingSignals -- streakOkSessions", () => {
  it("compte les seances consecutives (depuis la plus recente) full + rpe proche + sans douleur", () => {
    const history = [fullSessionEntry(1), fullSessionEntry(2), fullSessionEntry(3)];
    expect(computeTrackingSignals(history, NOW_ISO).streakOkSessions).toBe(3);
  });

  it("s'arrete a la premiere seance qui casse la serie", () => {
    const history = [
      fullSessionEntry(1),
      fullSessionEntry(2, { feedback: { rpe: 9, pain: 0, durationMin: 55 } }), // ecart rpe > 1
      fullSessionEntry(3),
    ];
    expect(computeTrackingSignals(history, NOW_ISO).streakOkSessions).toBe(1);
  });

  it("streak brise a 0 quand la seance la plus recente echoue", () => {
    const history = [
      fullSessionEntry(1, { feedback: { rpe: 9, pain: 0, durationMin: 55 } }),
      fullSessionEntry(2),
    ];
    expect(computeTrackingSignals(history, NOW_ISO).streakOkSessions).toBe(0);
  });
});

describe("findLastCompletedSessionDateMs", () => {
  it("retourne null si aucune seance terminee", () => {
    expect(findLastCompletedSessionDateMs([{ dateISO: daysAgo(1) }])).toBeNull();
  });

  it("retourne la date (ms) de la seance terminee la plus recente", () => {
    const entryDateMs = new Date(daysAgo(5)).getTime();
    const ms = findLastCompletedSessionDateMs([fullSessionEntry(5), fullSessionEntry(20)]);
    expect(ms).toBe(entryDateMs);
  });
});
