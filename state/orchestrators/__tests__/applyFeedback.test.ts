// state/orchestrators/__tests__/applyFeedback.test.ts
// Couvre le coeur métier : applyFeedback (feedback -> session complétée + charge
// + avancement du microcycle + écriture stores). La persistance Firestore est
// stubbée pour rester hors réseau.
import { applyFeedback } from "../applyFeedback";
import { useSessionsStore } from "../../stores/useSessionsStore";
import { useLoadStore } from "../../stores/useLoadStore";
import { useExternalStore } from "../../stores/useExternalStore";
import { useSyncStore } from "../../stores/useSyncStore";
import type { Session, SessionFeedback } from "../../../domain/types";

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
