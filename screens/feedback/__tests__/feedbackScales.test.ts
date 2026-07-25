// screens/feedback/__tests__/feedbackScales.test.ts
//
// Verrou anti-regression pour `buildSessionFeedback` : le SessionFeedback
// construit ici est ce qui atterrit dans `session.feedback` (via applyFeedback),
// puis dans le payload backend `recent_fks_sessions[].feedback.recovery_perceived`
// (services/aiContextHelpers.ts). Avant ce chantier, `useFeedbackSave.ts`
// n'ecrivait que `sleep` (legacy 1-5) et jamais `recoveryPerceived` -> le champ
// backend `recovery_perceived` etait mort silencieusement, cf.
// INDIVIDUALISATION_FINE_DESIGN.md §1.3.

import { buildSessionFeedback, clamp } from "../feedbackScales";
import { FEEDBACK_LIMITS } from "../../../constants/feedback";
import type { PrescribedItem, PrescribedSnapshot, SessionExecution } from "../../../domain/tracking/types";

describe("buildSessionFeedback", () => {
  test("ecrit recoveryPerceived en plus du champ legacy sleep (verrou anti-regression)", () => {
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 2, recovery: 4 });
    expect(fb.recoveryPerceived).toBe(4);
    expect(fb.sleep).toBe(4); // meme echelle 1-5, les deux doivent etre coherents
  });

  test("recoveryPerceived est clampe a [recoveryMin, recoveryMax]", () => {
    const tropHaut = buildSessionFeedback({ rpe: 5, fatigue: 3, pain0to5: 0, recovery: 8 });
    expect(tropHaut.recoveryPerceived).toBe(FEEDBACK_LIMITS.recoveryMax);
    const tropBas = buildSessionFeedback({ rpe: 5, fatigue: 3, pain0to5: 0, recovery: 0 });
    expect(tropBas.recoveryPerceived).toBe(FEEDBACK_LIMITS.recoveryMin);
  });

  test("rpe/fatigue/pain sont arrondis + clampes sur leurs echelles respectives", () => {
    const fb = buildSessionFeedback({ rpe: 11, fatigue: 0, pain0to5: 7, recovery: 3 });
    expect(fb.rpe).toBe(10);
    expect(fb.fatigue).toBe(1);
    expect(fb.pain).toBe(5);
  });

  test("durationMin present seulement si fourni (jamais 0 ou undefined invente)", () => {
    const withDuration = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3, durationClamped: 45 });
    expect(withDuration.durationMin).toBe(45);
    const withoutDuration = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3 });
    expect(withoutDuration.durationMin).toBeUndefined();
  });

  test("createdAt est un ISO valide", () => {
    const fb = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3 });
    expect(Number.isNaN(new Date(fb.createdAt).getTime())).toBe(false);
  });
});

describe("clamp", () => {
  test("borne dans [min, max]", () => {
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(3, 0, 5)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Boucle de suivi (Lot 4) — executionSummary attache via summarizeExecution.
// ---------------------------------------------------------------------------

function makePrescribedItem(index: number): PrescribedItem {
  return {
    key: `0-${index}`,
    exerciseId: `ex_${index}`,
    name: `Exercice ${index}`,
    blockId: "block",
    blockIndex: 0,
    itemIndex: index,
    blockType: "strength",
    role: null,
    sets: 3,
    reps: 8,
    workS: null,
    restS: 60,
    durationMin: null,
    notes: null,
  };
}

function makeSnapshot(count: number): PrescribedSnapshot {
  return {
    sessionId: "sess-fb",
    fingerprint: "fp-fb",
    generatedAtISO: null,
    launchedAtISO: "2026-07-25T09:00:00.000Z",
    cycleGoal: "force",
    sessionIndex: 3,
    phase: "Progression",
    matchContext: "none",
    plannedDurationMin: 55,
    rpeTarget: 6,
    intensity: "moderate",
    focusPrimary: "strength",
    items: Array.from({ length: count }, (_, i) => makePrescribedItem(i)),
  };
}

function makeFinishedExecution(overrides: Partial<SessionExecution> = {}): SessionExecution {
  return {
    version: 1,
    sessionId: "sess-fb",
    fingerprint: "fp-fb",
    snapshot: makeSnapshot(2),
    items: [
      { key: "0-0", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
      { key: "0-1", status: "skipped", reason: "time", comment: null, actual: null, replacement: null, setsChecked: 0, setsTotal: 3 },
    ],
    startedAtISO: "2026-07-25T09:00:00.000Z",
    finishedAtISO: "2026-07-25T10:00:00.000Z",
    actualDurationMin: 45,
    allAsPlanned: false,
    completion: {
      pct: 50, done: 1, adapted: 0, skipped: 1, replacedEquivalent: 0, replacedPartial: 0,
      status: "partial", mainReasons: ["time"],
    },
    ...overrides,
  };
}

describe("buildSessionFeedback · executionSummary (Lot 4)", () => {
  test("sans execution -> pas de champ executionSummary (compat stricte)", () => {
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 0, recovery: 4 });
    expect(fb.executionSummary).toBeUndefined();
  });

  test("execution non finalisee (finishedAtISO null) -> pas de champ ajoute", () => {
    const notFinished = makeFinishedExecution({ finishedAtISO: null });
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 0, recovery: 4, execution: notFinished });
    expect(fb.executionSummary).toBeUndefined();
  });

  test("execution finalisee -> executionSummary correct (resume de summarizeExecution)", () => {
    const exec = makeFinishedExecution();
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 0, recovery: 4, execution: exec });
    expect(fb.executionSummary).toEqual({
      completionPct: 50,
      completionStatus: "partial",
      done: 1,
      adapted: 0,
      skipped: 1,
      replaced: 0,
      mainReasons: ["time"],
      fingerprint: "fp-fb",
    });
  });

  test("execution null explicite -> pas de crash, pas de champ ajoute", () => {
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 0, recovery: 4, execution: null });
    expect(fb.executionSummary).toBeUndefined();
  });
});
