// state/orchestrators/__tests__/rebuildLoad.test.ts
// Couvre rebuildLoad : recalcul complet ATL/CTL/TSB à partir de l'historique
// des séances complétées + charges externes, et écriture dans useLoadStore.
import { rebuildLoad } from "../rebuildLoad";
import { useSessionsStore } from "../../stores/useSessionsStore";
import { useLoadStore } from "../../stores/useLoadStore";
import { useExternalStore } from "../../stores/useExternalStore";
import { useFeedbackStore } from "../../stores/useFeedbackStore";
import { useDebugStore } from "../../stores/useDebugStore";
import { TRAINING_DEFAULTS } from "../../../config/trainingDefaults";
import type { Session } from "../../../domain/types";

const makeSession = (over: Partial<Session> = {}): Session =>
  ({
    id: "x",
    dateISO: "2026-04-20T00:00:00.000Z",
    date: "2026-04-20",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    durationMin: 60,
    exercises: [],
    completed: true,
    rpe: 8,
    ...over,
  } as Session);

beforeEach(() => {
  useExternalStore.setState({ externalLoads: [], clubTrainingDays: [], matchDays: [], matchDay: null } as any);
  useFeedbackStore.setState({ dayStates: {} } as any);
  useDebugStore.setState({ devNowISO: "2026-04-25T00:00:00.000Z" } as any);
  // valeurs volontairement aberrantes : rebuildLoad doit les écraser
  useLoadStore.setState({ atl: 999, ctl: 999, tsb: 999, dailyApplied: {}, tsbHistory: [], lastLoadDayKey: null } as any);
  useSessionsStore.setState({ sessions: [] } as any);
});

describe("rebuildLoad", () => {
  test("sans séance complétée : retombe sur les valeurs par défaut (ATL0/CTL0)", () => {
    rebuildLoad({ decayToNow: false });
    const { atl, ctl } = useLoadStore.getState();
    expect(atl).toBe(TRAINING_DEFAULTS.ATL0);
    expect(ctl).toBe(TRAINING_DEFAULTS.CTL0);
  });

  test("ignore les séances non complétées", () => {
    useSessionsStore.setState({ sessions: [makeSession({ id: "a", completed: false })] } as any);
    rebuildLoad({ decayToNow: false });
    const { atl, ctl } = useLoadStore.getState();
    expect(atl).toBe(TRAINING_DEFAULTS.ATL0);
    expect(ctl).toBe(TRAINING_DEFAULTS.CTL0);
  });

  test("une séance complétée alimente dailyApplied + pose lastLoadDayKey", () => {
    useSessionsStore.setState({
      sessions: [makeSession({ id: "a", dateISO: "2026-04-20T00:00:00.000Z", date: "2026-04-20" })],
    } as any);
    rebuildLoad({ decayToNow: false });
    const st = useLoadStore.getState();
    expect(st.dailyApplied["2026-04-20"]).toBeDefined();
    expect(st.lastLoadDayKey).toBe("2026-04-20");
    expect(Array.isArray(st.tsbHistory)).toBe(true);
    expect(st.tsbHistory.length).toBeGreaterThan(0);
  });

  test("est déterministe : deux exécutions donnent le même résultat", () => {
    const sessions = [
      makeSession({ id: "a", dateISO: "2026-04-18T00:00:00.000Z", date: "2026-04-18" }),
      makeSession({ id: "b", dateISO: "2026-04-20T00:00:00.000Z", date: "2026-04-20" }),
    ];
    useSessionsStore.setState({ sessions } as any);
    rebuildLoad({ decayToNow: false });
    const first = { ...useLoadStore.getState() };
    useLoadStore.setState({ atl: 0, ctl: 0, tsb: 0 } as any);
    rebuildLoad({ decayToNow: false });
    const second = useLoadStore.getState();
    expect(second.atl).toBeCloseTo(first.atl, 5);
    expect(second.ctl).toBeCloseTo(first.ctl, 5);
    expect(second.tsb).toBeCloseTo(first.tsb, 5);
  });

  test("tsbHistory est borné à 7 points", () => {
    const sessions = Array.from({ length: 10 }).map((_, i) =>
      makeSession({ id: `s${i}`, dateISO: `2026-04-0${(i % 9) + 1}T00:00:00.000Z`, date: `2026-04-0${(i % 9) + 1}` })
    );
    useSessionsStore.setState({ sessions } as any);
    rebuildLoad({ decayToNow: false });
    expect(useLoadStore.getState().tsbHistory.length).toBeLessThanOrEqual(7);
  });
});
