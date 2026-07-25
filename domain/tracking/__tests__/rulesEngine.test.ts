// domain/tracking/__tests__/rulesEngine.test.ts
import { decideAdjustment, RULE_ORDER } from "../rulesEngine";
import type { TrackingDecisionWithRule } from "../rulesEngine";
import { computeTrackingSignals } from "../signals";
import type { TrackingHistoryEntry } from "../signals";
import { TRACKING_CONFIG } from "../config";
import { applyReplacement, finalizeExecution, initExecution, setItemStatus } from "../execution";
import type { DeviationReason, ItemStatus, PrescribedSnapshot, SessionExecution, TrackingSignals } from "../types";

const NOW_ISO = "2026-07-25T12:00:00.000Z";

function daysAgo(n: number): string {
  const d = new Date(NOW_ISO);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function ruleIndexOf(decision: ReturnType<typeof decideAdjustment>): number | undefined {
  return (decision as TrackingDecisionWithRule).ruleIndex;
}

function baseSignals(overrides: Partial<TrackingSignals> = {}): TrackingSignals {
  return {
    dataQuality: "ok",
    sessionsAnalyzed: 3,
    completionRateAvg: 100,
    rpeDeltaAvg: 0,
    rpeDeltaCount: 3,
    durationRatioAvg: 1,
    timeConstrainedIncomplete: false,
    painSignal: { active: false, source: null, occurrences: 0 },
    repeatedDifficulty: { exerciseIds: [], families: [] },
    durableEquipmentIssues: [],
    gapDays: 2,
    streakOkSessions: 3,
    ...overrides,
  };
}

describe("RULE_ORDER", () => {
  it("documente les 11 regles dans l'ordre", () => {
    expect(RULE_ORDER).toHaveLength(11);
    expect(RULE_ORDER[0]).toBe("block_increase_pain");
    expect(RULE_ORDER[3]).toBe("standard_insufficient_data");
  });
});

describe("decideAdjustment -- regles unitaires (signaux artisanaux)", () => {
  it("regle 1 : douleur active -> block_increase_pain, priorite absolue", () => {
    const signals = baseSignals({
      painSignal: { active: true, source: "feedback", occurrences: 1 },
      gapDays: 40, // devrait matcher regle 2 sinon
      dataQuality: "inconsistent", // devrait matcher regle 4 sinon
    });
    const decision = decideAdjustment(signals, NOW_ISO);
    expect(decision.kind).toBe("block_increase_pain");
    expect(ruleIndexOf(decision)).toBe(1);
  });

  it("regle 2 : gapDays >= gapDaysHard -> resume_mode", () => {
    const decision = decideAdjustment(baseSignals({ gapDays: TRACKING_CONFIG.resumption.gapDaysHard }), NOW_ISO);
    expect(decision.kind).toBe("resume_mode");
    expect(ruleIndexOf(decision)).toBe(2);
  });

  it("regle 3 : gapDays >= gapDaysSoft mais < gapDaysHard -> resume_mode (variante douce)", () => {
    const decision = decideAdjustment(baseSignals({ gapDays: TRACKING_CONFIG.resumption.gapDaysSoft }), NOW_ISO);
    expect(decision.kind).toBe("resume_mode");
    expect(ruleIndexOf(decision)).toBe(3);
  });

  it("gapDays sous le seuil soft ne declenche pas resume_mode", () => {
    const decision = decideAdjustment(baseSignals({ gapDays: TRACKING_CONFIG.resumption.gapDaysSoft - 1 }), NOW_ISO);
    expect(decision.kind).not.toBe("resume_mode");
  });

  it("regle 4 : dataQuality insufficient -> standard_insufficient_data", () => {
    const decision = decideAdjustment(baseSignals({ dataQuality: "insufficient", gapDays: null }), NOW_ISO);
    expect(decision.kind).toBe("standard_insufficient_data");
    expect(ruleIndexOf(decision)).toBe(4);
  });

  it("regle 4 : dataQuality inconsistent -> standard_insufficient_data", () => {
    const decision = decideAdjustment(baseSignals({ dataQuality: "inconsistent", gapDays: null }), NOW_ISO);
    expect(decision.kind).toBe("standard_insufficient_data");
  });

  it("regle 5 : durableEquipmentIssues non vide -> prefer_replacement avec targets", () => {
    const decision = decideAdjustment(baseSignals({ durableEquipmentIssues: ["str_bench"] }), NOW_ISO);
    expect(decision.kind).toBe("prefer_replacement");
    expect(decision.targets).toEqual(["str_bench"]);
    expect(ruleIndexOf(decision)).toBe(5);
  });

  it("regle 6 : repeatedDifficulty non vide -> suggest_variant avec targets", () => {
    const decision = decideAdjustment(
      baseSignals({ repeatedDifficulty: { exerciseIds: ["plyo_box_jump"], families: ["plyo"] } }),
      NOW_ISO
    );
    expect(decision.kind).toBe("suggest_variant");
    expect(decision.targets).toEqual(["plyo_box_jump"]);
    expect(ruleIndexOf(decision)).toBe(6);
  });

  it("regle 7 : rpe eleve persistant + completion pleine -> reduce_intensity_light", () => {
    const decision = decideAdjustment(
      baseSignals({ rpeDeltaAvg: 2, rpeDeltaCount: 3, completionRateAvg: 100 }),
      NOW_ISO
    );
    expect(decision.kind).toBe("reduce_intensity_light");
    expect(ruleIndexOf(decision)).toBe(7);
  });

  it("regle 7 : rpe eleve persistant + completion sous fullPct -> reduce_volume_light", () => {
    const decision = decideAdjustment(
      baseSignals({ rpeDeltaAvg: 2.5, rpeDeltaCount: 4, completionRateAvg: 60 }),
      NOW_ISO
    );
    expect(decision.kind).toBe("reduce_volume_light");
  });

  it("rpe eleve mais count < minSessionsForSignal -> ne declenche pas la regle 7", () => {
    const decision = decideAdjustment(baseSignals({ rpeDeltaAvg: 3, rpeDeltaCount: 2 }), NOW_ISO);
    expect(decision.kind).not.toBe("reduce_intensity_light");
    expect(decision.kind).not.toBe("reduce_volume_light");
  });

  it("regle 8 : timeConstrainedIncomplete -> keep_despite_time (jamais reduce)", () => {
    const decision = decideAdjustment(
      baseSignals({ timeConstrainedIncomplete: true, streakOkSessions: 0 }),
      NOW_ISO
    );
    expect(decision.kind).toBe("keep_despite_time");
    expect(ruleIndexOf(decision)).toBe(8);
  });

  it("regle 9 : streak brise (0) sans raison time/douleur -> hold_dose, une seule fois", () => {
    const decision = decideAdjustment(baseSignals({ streakOkSessions: 0, sessionsAnalyzed: 1 }), NOW_ISO);
    expect(decision.kind).toBe("hold_dose");
    expect(ruleIndexOf(decision)).toBe(9);
  });

  it("regle 10 : marge de progression validee -> continue_planned avec note de marge", () => {
    const decision = decideAdjustment(
      baseSignals({
        rpeDeltaAvg: TRACKING_CONFIG.rpe.lowDelta,
        rpeDeltaCount: 3,
        streakOkSessions: TRACKING_CONFIG.progression.minStreakForSmallStep,
        completionRateAvg: TRACKING_CONFIG.completion.fullPct,
      }),
      NOW_ISO
    );
    expect(decision.kind).toBe("continue_planned");
    expect(ruleIndexOf(decision)).toBe(10);
  });

  it("regle 11 : defaut -- seances reussies, rpe proche, pas de douleur -> continue_planned", () => {
    const decision = decideAdjustment(baseSignals(), NOW_ISO);
    expect(decision.kind).toBe("continue_planned");
    expect(ruleIndexOf(decision)).toBe(11);
  });

  it("embarque rulesVersion et decidedAtISO = nowISO passe en parametre, mode = shadow", () => {
    const decision = decideAdjustment(baseSignals(), "2026-07-25T18:30:00.000Z");
    expect(decision.rulesVersion).toBe(TRACKING_CONFIG.rulesVersion);
    expect(decision.decidedAtISO).toBe("2026-07-25T18:30:00.000Z");
    expect(decision.mode).toBe("shadow");
    expect(decision.version).toBe(1);
  });

  it("signalsDigest reprend fidelement les signaux", () => {
    const signals = baseSignals({ completionRateAvg: 77, rpeDeltaAvg: 1.5, gapDays: 3 });
    const decision = decideAdjustment(signals, NOW_ISO);
    expect(decision.signalsDigest).toEqual({
      completionRateAvg: 77,
      rpeDeltaAvg: 1.5,
      painActive: false,
      gapDays: 3,
      dataQuality: "ok",
    });
  });
});

describe("decideAdjustment -- purete", () => {
  it("ne modifie jamais les signaux passes en entree", () => {
    const signals = baseSignals({ durableEquipmentIssues: ["a", "b"] });
    const snapshot = JSON.parse(JSON.stringify(signals));
    decideAdjustment(signals, NOW_ISO);
    expect(signals).toEqual(snapshot);
  });

  it("est deterministe : memes entrees -> meme decision (hors reference d'objet)", () => {
    const signals = baseSignals();
    const d1 = decideAdjustment(signals, NOW_ISO);
    const d2 = decideAdjustment(signals, NOW_ISO);
    expect(d1).toEqual(d2);
  });

  it("ne mute pas TRACKING_CONFIG", () => {
    const before = JSON.parse(JSON.stringify(TRACKING_CONFIG));
    decideAdjustment(baseSignals(), NOW_ISO);
    expect(TRACKING_CONFIG).toEqual(before);
  });
});

// ----------------------------------------------------------------------------
// Scenarios bout-en-bout : computeTrackingSignals (Lot 5) + decideAdjustment.
// ----------------------------------------------------------------------------

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

function decideFrom(history: TrackingHistoryEntry[]) {
  const signals = computeTrackingSignals(history, NOW_ISO);
  return decideAdjustment(signals, NOW_ISO);
}

describe("Scenarios bout-en-bout", () => {
  it("seance realisee entierement -> continue_planned", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(1),
        feedback: { rpe: 6, pain: 0, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_lunge", status: "done" },
          ],
        }),
      },
    ];
    expect(decideFrom(history).kind).toBe("continue_planned");
  });

  it("partielle par manque de temps -> keep_despite_time (jamais reduce)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(1),
        feedback: { rpe: 6, pain: 0, durationMin: 30 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_lunge", status: "skipped", reason: "time" },
          ],
        }),
      },
    ];
    const decision = decideFrom(history);
    expect(decision.kind).toBe("keep_despite_time");
    expect(decision.kind).not.toBe("reduce_volume_light");
    expect(decision.kind).not.toBe("reduce_intensity_light");
  });

  it("adapte faute de materiel 1x -> pas d'influence (meme resultat qu'une bonne seance)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(1),
        feedback: { rpe: 6, pain: 0, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_bench", status: "adapted", reason: "equipment" },
          ],
        }),
      },
    ];
    expect(decideFrom(history).kind).toBe("continue_planned");
  });

  it("materiel manquant 2x sur le meme exercice -> prefer_replacement avec la cible", () => {
    const history: TrackingHistoryEntry[] = [1, 3].map((d) => ({
      dateISO: daysAgo(d),
      feedback: { rpe: 6, pain: 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [{ exerciseId: "str_bench", status: "replaced", reason: "equipment" }],
      }),
    }));
    const decision = decideFrom(history);
    expect(decision.kind).toBe("prefer_replacement");
    expect(decision.targets).toEqual(["str_bench"]);
  });

  it("exercice trouve trop difficile 2x -> suggest_variant", () => {
    const history: TrackingHistoryEntry[] = [1, 3].map((d) => ({
      dateISO: daysAgo(d),
      feedback: { rpe: 6, pain: 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [{ exerciseId: "plyo_box_jump", status: "adapted", reason: "too_difficult" }],
      }),
    }));
    const decision = decideFrom(history);
    expect(decision.kind).toBe("suggest_variant");
    expect(decision.targets).toEqual(["plyo_box_jump"]);
  });

  it("rpe moyen >= +2 sur 3 seances completes -> reduce_intensity_light", () => {
    const history: TrackingHistoryEntry[] = [1, 2, 3].map((d) => ({
      dateISO: daysAgo(d),
      feedback: { rpe: 8, pain: 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [
          { exerciseId: "str_squat", status: "done" },
          { exerciseId: "str_lunge", status: "done" },
        ],
      }),
    }));
    expect(decideFrom(history).kind).toBe("reduce_intensity_light");
  });

  it("rpe moyen >= +2 sur 3 seances incompletes -> reduce_volume_light", () => {
    const history: TrackingHistoryEntry[] = [1, 2, 3].map((d) => ({
      dateISO: daysAgo(d),
      feedback: { rpe: 8, pain: 0, durationMin: 40 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [
          { exerciseId: "str_squat", status: "done" },
          { exerciseId: "str_lunge", status: "skipped", reason: "fatigue" },
        ],
      }),
    }));
    expect(decideFrom(history).kind).toBe("reduce_volume_light");
  });

  it("rpe <= -2 sur 3 + streak 2 + complet + sans douleur -> continue_planned avec note de marge", () => {
    const history: TrackingHistoryEntry[] = [
      { d: 1, rpe: 5 },
      { d: 2, rpe: 5 },
      { d: 3, rpe: 2 },
    ].map(({ d, rpe }) => ({
      dateISO: daysAgo(d),
      feedback: { rpe, pain: 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [
          { exerciseId: "str_squat", status: "done" },
          { exerciseId: "str_lunge", status: "done" },
        ],
      }),
    }));
    const signals = computeTrackingSignals(history, NOW_ISO);
    expect(signals.rpeDeltaAvg).toBe(-2);
    expect(signals.streakOkSessions).toBe(2);
    const decision = decideAdjustment(signals, NOW_ISO);
    expect(decision.kind).toBe("continue_planned");
    expect(ruleIndexOf(decision)).toBe(10);
  });

  it("douleur feedback 3/5 -> block_increase_pain, prioritaire meme avec rpe bas et seance complete", () => {
    const history: TrackingHistoryEntry[] = [
      { d: 1, rpe: 5 },
      { d: 2, rpe: 5 },
      { d: 3, rpe: 5 },
    ].map(({ d, rpe }) => ({
      dateISO: daysAgo(d),
      feedback: { rpe, pain: d === 1 ? 3 : 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      execution: buildExecution({
        sessionId: `s-${d}`,
        startedAtISO: daysAgo(d),
        finishedAtISO: daysAgo(d),
        items: [
          { exerciseId: "str_squat", status: "done" },
          { exerciseId: "str_lunge", status: "done" },
        ],
      }),
    }));
    expect(decideFrom(history).kind).toBe("block_increase_pain");
  });

  it("donnees manquantes -> standard_insufficient_data", () => {
    expect(decideFrom([]).kind).toBe("standard_insufficient_data");
  });

  it("donnees incoherentes (rpe 15, duree 500 min) -> standard_insufficient_data", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(1),
        feedback: { rpe: 15, pain: 0, durationMin: 500 },
        rpeTarget: 6,
        plannedDurationMin: 60,
      },
    ];
    expect(decideFrom(history).kind).toBe("standard_insufficient_data");
  });

  it("coupure de 15 jours -> resume_mode (soft)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(15),
        completedAtISO: daysAgo(15),
        feedback: { rpe: 6, pain: 0, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s-old",
          startedAtISO: daysAgo(15),
          finishedAtISO: daysAgo(15),
          items: [{ exerciseId: "str_squat", status: "done" }],
        }),
      },
    ];
    const decision = decideFrom(history);
    expect(decision.kind).toBe("resume_mode");
    expect(ruleIndexOf(decision)).toBe(3);
  });

  it("coupure de 30 jours -> resume_mode (hard)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(30),
        completedAtISO: daysAgo(30),
        feedback: { rpe: 6, pain: 0, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s-old",
          startedAtISO: daysAgo(30),
          finishedAtISO: daysAgo(30),
          items: [{ exerciseId: "str_squat", status: "done" }],
        }),
      },
    ];
    const decision = decideFrom(history);
    expect(decision.kind).toBe("resume_mode");
    expect(ruleIndexOf(decision)).toBe(2);
  });

  it("une seule mauvaise seance (raison autre que temps/douleur) -> hold_dose, pas plus", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(1),
        feedback: { rpe: 6, pain: 0, durationMin: 45 },
        rpeTarget: 6,
        plannedDurationMin: 60,
        execution: buildExecution({
          sessionId: "s1",
          startedAtISO: daysAgo(1),
          finishedAtISO: daysAgo(1),
          items: [
            { exerciseId: "str_squat", status: "done" },
            { exerciseId: "str_lunge", status: "skipped", reason: "technical" },
          ],
        }),
      },
    ];
    const decision = decideFrom(history);
    expect(decision.kind).toBe("hold_dose");
  });
});

describe("Scenarios bout-en-bout -- P1-b : historique feedback-only (0 execution exploitable)", () => {
  it("feedback-only avec RPE haut persistant -> standard_insufficient_data, jamais reduce_volume_light/reduce_intensity_light", () => {
    const history: TrackingHistoryEntry[] = [1, 2, 3].map((d) => ({
      dateISO: daysAgo(d),
      completedAtISO: daysAgo(d),
      feedback: { rpe: 8, pain: 0, durationMin: 58 },
      rpeTarget: 6,
      plannedDurationMin: 60,
      // pas d'execution enregistree (historique ancien, feedback seul)
    }));
    const decision = decideFrom(history);
    expect(decision.kind).toBe("standard_insufficient_data");
    expect(decision.kind).not.toBe("reduce_volume_light");
    expect(decision.kind).not.toBe("reduce_intensity_light");
  });

  it("feedback-only avec douleur -> block_increase_pain (la securite prime sur les donnees insuffisantes)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(2),
        completedAtISO: daysAgo(2),
        feedback: { rpe: 6, pain: 4, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
      },
    ];
    expect(decideFrom(history).kind).toBe("block_increase_pain");
  });

  it("feedback-only avec coupure de 30 jours -> resume_mode (la coupure prime sur les donnees insuffisantes)", () => {
    const history: TrackingHistoryEntry[] = [
      {
        dateISO: daysAgo(30),
        completedAtISO: daysAgo(30),
        feedback: { rpe: 6, pain: 0, durationMin: 58 },
        rpeTarget: 6,
        plannedDurationMin: 60,
      },
    ];
    const decision = decideFrom(history);
    expect(decision.kind).toBe("resume_mode");
    expect(ruleIndexOf(decision)).toBe(2);
  });
});
