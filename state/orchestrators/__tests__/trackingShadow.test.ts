// state/orchestrators/__tests__/trackingShadow.test.ts
// Tests purs (aucun store, aucun firebase) pour les helpers de la decision
// shadow attachee au feedback (Lot 4). Voir state/orchestrators/trackingShadow.ts.
import {
  buildTrackingHistory,
  castSessionExecution,
  computeShadowDecision,
  readPlannedDurationMin,
  sessionToTrackingHistoryEntry,
} from "../trackingShadow";
import type { PrescribedItem, PrescribedSnapshot, SessionExecution } from "../../../domain/tracking/types";
import type { DayState, Session } from "../../../domain/types";

function makePrescribedItem(index: number, overrides: Partial<PrescribedItem> = {}): PrescribedItem {
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
    ...overrides,
  };
}

function makeSnapshot(sessionId: string, count = 2): PrescribedSnapshot {
  return {
    sessionId,
    fingerprint: `fp-${sessionId}`,
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

function makeExecution(sessionId: string, overrides: Partial<SessionExecution> = {}): SessionExecution {
  const snapshot = makeSnapshot(sessionId, 2);
  return {
    version: 1,
    sessionId,
    fingerprint: snapshot.fingerprint,
    snapshot,
    items: [
      { key: "0-0", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
      { key: "0-1", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
    ],
    startedAtISO: "2026-07-25T09:00:00.000Z",
    finishedAtISO: "2026-07-25T10:00:00.000Z",
    actualDurationMin: 55,
    allAsPlanned: true,
    completion: {
      pct: 100, done: 2, adapted: 0, skipped: 0, replacedEquivalent: 0, replacedPartial: 0,
      status: "full", mainReasons: [],
    },
    ...overrides,
  };
}

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: "s1",
    date: "2026-07-25",
    dateISO: "2026-07-25T00:00:00.000Z",
    focus: "strength",
    phase: "Progression",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: true,
    ...over,
  } as Session;
}

describe("castSessionExecution", () => {
  test("cast une execution valide", () => {
    const exec = makeExecution("s1");
    expect(castSessionExecution(exec)).toEqual(exec);
  });

  test("null / undefined / non-objet -> null", () => {
    expect(castSessionExecution(null)).toBeNull();
    expect(castSessionExecution(undefined)).toBeNull();
    expect(castSessionExecution("execution")).toBeNull();
    expect(castSessionExecution(42)).toBeNull();
  });

  test("forme incoherente (version/sessionId/items/completion manquants) -> null, jamais de crash", () => {
    expect(castSessionExecution({})).toBeNull();
    expect(castSessionExecution({ version: 2, sessionId: "s1", items: [], completion: { pct: 1 } })).toBeNull();
    expect(castSessionExecution({ version: 1, items: [], completion: { pct: 1 } })).toBeNull();
    expect(castSessionExecution({ version: 1, sessionId: "s1", completion: { pct: 1 } })).toBeNull();
    expect(castSessionExecution({ version: 1, sessionId: "s1", items: [] })).toBeNull();
  });
});

describe("readPlannedDurationMin", () => {
  test("prefere aiV2.duration_min meme si session.durationMin (post-feedback = duree reelle) differe", () => {
    const s = makeSession({ durationMin: 62, aiV2: { duration_min: 55 } });
    expect(readPlannedDurationMin(s)).toBe(55);
  });

  test("accepte aiV2.durationMin (camelCase) si duration_min absent", () => {
    const s = makeSession({ aiV2: { durationMin: 48 } });
    expect(readPlannedDurationMin(s)).toBe(48);
  });

  test("fallback sur session.durationMin si aucun blueprint aiV2", () => {
    const s = makeSession({ durationMin: 60, aiV2: undefined });
    expect(readPlannedDurationMin(s)).toBe(60);
  });

  test("aucune source -> null", () => {
    const s = makeSession({ durationMin: undefined, aiV2: undefined });
    expect(readPlannedDurationMin(s)).toBeNull();
  });
});

describe("sessionToTrackingHistoryEntry", () => {
  test("construit l'entree depuis une session avec feedback + aiV2", () => {
    const s = makeSession({
      feedback: { rpe: 8, fatigue: 3, sleep: 3, pain: 1, createdAt: "2026-07-25T10:00:00.000Z", durationMin: 55 } as any,
      aiV2: { rpe_target: 6, duration_min: 55 },
    });
    const entry = sessionToTrackingHistoryEntry(s, {});
    expect(entry.dateISO).toBe("2026-07-25T00:00:00.000Z");
    expect(entry.feedback).toEqual({ rpe: 8, pain: 1, durationMin: 55 });
    expect(entry.rpeTarget).toBe(6);
    expect(entry.plannedDurationMin).toBe(55);
    expect(entry.injuryDeclared).toBe(false);
  });

  test("dateISO retombe sur `date` si dateISO absent", () => {
    const s = makeSession({ dateISO: undefined as any, date: "2026-07-20" });
    const entry = sessionToTrackingHistoryEntry(s, {});
    expect(entry.dateISO).toBe("2026-07-20");
  });

  test("injuryDeclared=true quand feedback.pain >= seuil (3)", () => {
    const s = makeSession({ feedback: { rpe: 5, fatigue: 3, sleep: 3, pain: 4, createdAt: "x" } as any });
    expect(sessionToTrackingHistoryEntry(s, {}).injuryDeclared).toBe(true);
  });

  test("injuryDeclared=true via dayStates meme si pain feedback bas (injury structuree severite>0)", () => {
    const s = makeSession({
      dateISO: "2026-07-25T00:00:00.000Z",
      feedback: { rpe: 5, fatigue: 3, sleep: 3, pain: 0, createdAt: "x" } as any,
    });
    const dayStates: Record<string, DayState> = {
      "2026-07-25": {
        date: "2026-07-25",
        feedback: {
          fatigue: 3,
          injury: { area: "genou", severity: 2, type: "aigu", restrictions: {}, startDate: "x", lastConfirm: "x" },
          timestamp: "x",
        },
        adaptive: { fatigueFactor: 1, painFactor: 1, combined: 1 },
      },
    };
    expect(sessionToTrackingHistoryEntry(s, dayStates).injuryDeclared).toBe(true);
  });

  test("injury severite 0 (levee explicite) ne declenche pas injuryDeclared", () => {
    const s = makeSession({
      dateISO: "2026-07-25T00:00:00.000Z",
      feedback: { rpe: 5, fatigue: 3, sleep: 3, pain: 0, createdAt: "x" } as any,
    });
    const dayStates: Record<string, DayState> = {
      "2026-07-25": {
        date: "2026-07-25",
        feedback: {
          fatigue: 3,
          injury: { area: "genou", severity: 0, type: "aigu", restrictions: {}, startDate: "x", lastConfirm: "x" },
          timestamp: "x",
        },
        adaptive: { fatigueFactor: 1, painFactor: 1, combined: 1 },
      },
    };
    expect(sessionToTrackingHistoryEntry(s, dayStates).injuryDeclared).toBe(false);
  });

  test("execution attachee via cast defensif (invalide -> null)", () => {
    const exec = makeExecution("s1");
    const withValid = sessionToTrackingHistoryEntry(makeSession({ execution: exec }), {});
    expect(withValid.execution).toEqual(exec);

    const withInvalid = sessionToTrackingHistoryEntry(makeSession({ execution: { garbage: true } }), {});
    expect(withInvalid.execution).toBeNull();
  });
});

describe("buildTrackingHistory", () => {
  test("ne garde que les seances completees", () => {
    const sessions = [
      makeSession({ id: "a", completed: true }),
      makeSession({ id: "b", completed: false }),
      makeSession({ id: "c", completed: true }),
    ];
    const history = buildTrackingHistory(sessions, {});
    expect(history).toHaveLength(2);
  });
});

describe("computeShadowDecision", () => {
  test("historique vide -> donnees insuffisantes, explication non vide", () => {
    const { decision, signals } = computeShadowDecision([], "2026-07-25T10:00:00.000Z");
    expect(signals.dataQuality).toBe("insufficient");
    expect(decision.kind).toBe("standard_insufficient_data");
    expect(decision.explanation.length).toBeGreaterThan(0);
    expect(decision.mode).toBe("shadow");
  });

  test("historique sain, execution complete, RPE proche cible -> continue_planned", () => {
    const history = [
      {
        dateISO: "2026-07-20T10:00:00.000Z",
        feedback: { rpe: 6, pain: 0, durationMin: 55 },
        rpeTarget: 6,
        plannedDurationMin: 55,
        execution: makeExecution("s0"),
        injuryDeclared: false,
      },
    ];
    const { decision } = computeShadowDecision(history, "2026-07-21T10:00:00.000Z");
    expect(decision.kind).toBe("continue_planned");
    expect(decision.signalsDigest.painActive).toBe(false);
  });
});
