// state/orchestrators/__tests__/applyFeedback.test.ts
// Couvre le coeur métier : applyFeedback (feedback -> session complétée + charge
// + avancement du microcycle + écriture stores). La persistance Firestore est
// stubbée pour rester hors réseau.
// services/analytics.ts importe @amplitude/analytics-react-native, dont la
// copie imbriquée de @react-native-async-storage/async-storage accède au
// module natif directement (jest.setup.js ne mocke que le paquet top-level)
// -> crash "NativeModule: AsyncStorage is null" au simple import, hors de
// toute utilisation. applyFeedback.ts importe desormais trackEvent (Lot 4,
// tracking_decision_shadow) : mock local pour rester hors de cette chaine.
jest.mock("../../../services/analytics", () => ({
  trackEvent: jest.fn(),
  initAnalytics: jest.fn(),
  setAnalyticsUserId: jest.fn(),
}));

import { applyFeedback } from "../applyFeedback";
import { useSessionsStore } from "../../stores/useSessionsStore";
import { useLoadStore } from "../../stores/useLoadStore";
import { useExternalStore } from "../../stores/useExternalStore";
import { useSyncStore } from "../../stores/useSyncStore";
import { useFeedbackStore } from "../../stores/useFeedbackStore";
import { useBodyStore, getBodyDefaults } from "../../stores/useBodyStore";
import { useExecutionStore } from "../../stores/useExecutionStore";
import type { Session, SessionFeedback } from "../../../domain/types";
import type { PrescribedItem, PrescribedSnapshot, SessionExecution } from "../../../domain/tracking/types";

const feedback = (over: Partial<SessionFeedback> = {}): SessionFeedback =>
  ({ rpe: 7, fatigue: 3, sleep: 3, pain: 0, createdAt: "2026-04-20T18:00:00.000Z", ...over } as SessionFeedback);

const makeSession = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    dateISO: "2026-04-20T00:00:00.000Z",
    date: "2026-04-20",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    durationMin: 60,
    exercises: [],
    completed: false,
    rpe: 0,
    ...over,
  } as Session);

beforeEach(() => {
  // Stub la persistance Firestore (pas de réseau en test)
  useSyncStore.setState({ persistCompletedSession: async () => {} } as any);
  useExternalStore.setState({ externalLoads: [], clubTrainingDays: [], matchDays: [], matchDay: null } as any);
  useLoadStore.setState({ atl: 0, ctl: 0, tsb: 0, dailyApplied: {}, tsbHistory: [], lastLoadDayKey: null } as any);
  useSessionsStore.setState({
    sessions: [],
    microcycleGoal: null,
    microcycleSessionIndex: 0,
    microcycleAppliedSessionIds: [],
    phase: "Playlist",
    phaseCount: 0,
    weekly: { hasRunStructured: false, hasCircuit: false },
  } as any);
  useFeedbackStore.setState({ dayStates: {} } as any);
  useBodyStore.setState({ ...getBodyDefaults() } as any);
  useExecutionStore.getState().resetAll();
});

// ---------------------------------------------------------------------------
// Boucle de suivi (Lot 4) — execution finalisee + decision shadow
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

function makeSnapshotFor(sessionId: string): PrescribedSnapshot {
  return {
    sessionId,
    fingerprint: `fp-${sessionId}`,
    generatedAtISO: null,
    launchedAtISO: "2026-04-20T17:00:00.000Z",
    cycleGoal: "force",
    sessionIndex: 3,
    phase: "Construction",
    matchContext: "none",
    plannedDurationMin: 55,
    rpeTarget: 6,
    intensity: "moderate",
    focusPrimary: "strength",
    items: [makePrescribedItem(0), makePrescribedItem(1)],
  };
}

function makeFinishedExecution(sessionId: string, overrides: Partial<SessionExecution> = {}): SessionExecution {
  return {
    version: 1,
    sessionId,
    fingerprint: `fp-${sessionId}`,
    snapshot: makeSnapshotFor(sessionId),
    items: [
      { key: "0-0", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
      { key: "0-1", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
    ],
    startedAtISO: "2026-04-20T17:00:00.000Z",
    finishedAtISO: "2026-04-20T17:55:00.000Z",
    actualDurationMin: 55,
    allAsPlanned: true,
    completion: {
      pct: 100, done: 2, adapted: 0, skipped: 0, replacedEquivalent: 0, replacedPartial: 0,
      status: "full", mainReasons: [],
    },
    ...overrides,
  };
}

describe("applyFeedback — boucle de suivi (Lot 4)", () => {
  test("sans execution en cours -> session.execution absent, mais decision shadow calculee et stockee (mode shadow ON par defaut)", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    applyFeedback("s1", feedback());

    const s = useSessionsStore.getState().sessions[0];
    expect(s.execution).toBeUndefined();
    expect(s.tracking).toBeTruthy();
    expect((s.tracking as any).mode).toBe("shadow");
    expect(useExecutionStore.getState().lastDecision).toEqual(s.tracking);
  });

  test("avec execution finalisee pour la seance -> attachee telle quelle sur session.execution", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    const exec = makeFinishedExecution("s1");
    useExecutionStore.getState().startExecution(exec);

    applyFeedback("s1", feedback());

    const s = useSessionsStore.getState().sessions[0];
    expect(s.execution).toEqual(exec);
  });

  test("execution NON finalisee (finishedAtISO null) -> jamais attachee (feedback sans passer par live)", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    const unfinished = makeFinishedExecution("s1", { finishedAtISO: null });
    useExecutionStore.getState().startExecution(unfinished);

    applyFeedback("s1", feedback());

    const s = useSessionsStore.getState().sessions[0];
    expect(s.execution).toBeUndefined();
  });

  test("execution d'une AUTRE seance en cours -> jamais attachee (garde-fou sessionId)", () => {
    useSessionsStore.setState({
      sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" })],
    } as any);
    const execForOther = makeFinishedExecution("s2");
    useExecutionStore.getState().startExecution(execForOther);

    applyFeedback("s1", feedback());

    const s1 = useSessionsStore.getState().sessions.find((s) => s.id === "s1")!;
    expect(s1.execution).toBeUndefined();
  });

  test("decision shadow n'influence JAMAIS la charge (ATL/CTL/TSB identiques avec ou sans execution attachee)", () => {
    useSessionsStore.setState({ sessions: [makeSession({ id: "sA" })] } as any);
    const resWithout = applyFeedback("sA", feedback({ rpe: 8 }));

    useLoadStore.setState({ atl: 0, ctl: 0, tsb: 0, dailyApplied: {}, tsbHistory: [], lastLoadDayKey: null } as any);
    useSessionsStore.setState({ sessions: [makeSession({ id: "sB" })] } as any);
    useExecutionStore.getState().resetAll();
    useExecutionStore.getState().startExecution(makeFinishedExecution("sB"));
    const resWith = applyFeedback("sB", feedback({ rpe: 8 }));

    expect(resWith?.atlDelta).toBe(resWithout?.atlDelta);
    expect(resWith?.ctlDelta).toBe(resWithout?.ctlDelta);
  });

  test("rejeu sur une seance deja completee (replay offline) : retourne null, aucune double decision", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    applyFeedback("s1", feedback());
    const decisionAfterFirst = useExecutionStore.getState().lastDecision;
    expect(decisionAfterFirst).toBeTruthy();

    // Sentinelle : si le rejeu recalculait quoi que ce soit, cette valeur serait écrasée.
    const sentinel = { ...decisionAfterFirst, decidedAtISO: "SENTINEL" } as any;
    useExecutionStore.getState().setLastDecision(sentinel);

    const replay = applyFeedback("s1", feedback());
    expect(replay).toBeNull();
    expect(useExecutionStore.getState().lastDecision).toEqual(sentinel);
  });

  test("une erreur dans le calcul de la decision shadow n'empeche jamais le reste du feedback (try/catch non-bloquant)", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    // La source des gênes est désormais « Mon corps » (state/selectors/blessures) :
    // c'est ce store-là qu'on fait exploser pour rejouer le crash.
    const spy = jest.spyOn(useBodyStore, "getState").mockImplementationOnce(() => {
      throw new Error("boom — shadow computation failure");
    });

    const res = applyFeedback("s1", feedback({ rpe: 8 }));
    spy.mockRestore();

    expect(res).not.toBeNull();
    const s = useSessionsStore.getState().sessions[0];
    expect(s.completed).toBe(true);
    expect(s.metrics).toBeTruthy();
    expect(s.tracking).toBeUndefined(); // le crash a coupé avant l'assignation
  });
});

describe("applyFeedback", () => {
  test("retourne null si la séance est introuvable", () => {
    expect(applyFeedback("inconnue", feedback())).toBeNull();
  });

  test("retourne null si la séance est déjà complétée", () => {
    useSessionsStore.setState({ sessions: [makeSession({ completed: true })] } as any);
    expect(applyFeedback("s1", feedback())).toBeNull();
  });

  test("marque la séance complétée, stocke le feedback + un snapshot de charge", () => {
    useSessionsStore.setState({ sessions: [makeSession()] } as any);
    const res = applyFeedback("s1", feedback({ rpe: 8 }));
    expect(res).not.toBeNull();
    expect(res?.sessionId).toBe("s1");
    expect(typeof res?.atlDelta).toBe("number");
    expect(typeof res?.ctlDelta).toBe("number");

    const s = useSessionsStore.getState().sessions[0];
    expect(s.completed).toBe(true);
    expect(s.feedback?.rpe).toBe(8);
    expect(s.metrics).toBeTruthy();
    expect(typeof s.metrics?.tsb).toBe("number");

    const load = useLoadStore.getState();
    expect(load.lastLoadDayKey).toBe("2026-04-20");
    expect(load.dailyApplied["2026-04-20"]).toBeDefined();
    expect(load.lastRpe).toBe(8);
  });

  test("avance le microcycle d'un cran quand un cycle est actif", () => {
    useSessionsStore.setState({
      sessions: [makeSession()],
      microcycleGoal: "force",
      microcycleSessionIndex: 2,
    } as any);
    applyFeedback("s1", feedback());
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(3);
    expect(useSessionsStore.getState().microcycleAppliedSessionIds).toContain("s1");
  });

  test("n'avance PAS le microcycle si aucun cycle actif", () => {
    useSessionsStore.setState({
      sessions: [makeSession()],
      microcycleGoal: null,
      microcycleSessionIndex: 0,
    } as any);
    applyFeedback("s1", feedback());
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(0);
  });

  test("ne double-avance pas si le feedback est ré-appliqué sur la même séance", () => {
    useSessionsStore.setState({
      sessions: [makeSession()],
      microcycleGoal: "force",
      microcycleSessionIndex: 0,
    } as any);
    applyFeedback("s1", feedback());
    const idxApres1 = useSessionsStore.getState().microcycleSessionIndex;
    // 2e appel : la séance est désormais complétée -> retourne null, index inchangé
    expect(applyFeedback("s1", feedback())).toBeNull();
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(idxApres1);
  });

  test("ne dépasse pas le total du microcycle (12)", () => {
    useSessionsStore.setState({
      sessions: [makeSession()],
      microcycleGoal: "force",
      microcycleSessionIndex: 12,
    } as any);
    applyFeedback("s1", feedback());
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(12);
  });
});
