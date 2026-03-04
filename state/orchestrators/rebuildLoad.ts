// state/orchestrators/rebuildLoad.ts
// Cross-cutting orchestrator: rebuilds ATL/CTL/TSB from full session + external load history.
import { todayISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { diffDays } from "../../engine/dailyAggregation";
import { updateTrainingLoad, decayLoadOverDays } from "../../engine/loadModel";
import { TRAINING_DEFAULTS, LOAD_CAPS } from "../../config/trainingDefaults";
import { computeDailyTotals, computeInterveningOffDays, type ExternalLoadLike } from "../computeDailyApplied";
import { safeNum } from "../../engine/safeNum";
import type { Rating0to5 } from "../../domain/types";

import { useLoadStore } from "../stores/useLoadStore";
import { useSessionsStore } from "../stores/useSessionsStore";
import { useExternalStore } from "../stores/useExternalStore";
import { useFeedbackStore } from "../stores/useFeedbackStore";
import { useDebugStore } from "../stores/useDebugStore";

export function rebuildLoad(opts?: { decayToNow?: boolean }): void {
  const sessionsState = useSessionsStore.getState();
  const externalState = useExternalStore.getState();
  const feedbackState = useFeedbackStore.getState();
  const debugState = useDebugStore.getState();
  const loadState = useLoadStore.getState();

  const sessions = (sessionsState.sessions ?? []).filter((s) => s?.completed);
  const externals = externalState.externalLoads ?? [];

  const daySet = new Set<string>();
  sessions.forEach((s) => {
    const dk = toDateKey(s.dateISO ?? s.date ?? todayISO());
    daySet.add(dk);
  });
  externals.forEach((e) => {
    if (!e?.dateISO) return;
    daySet.add(toDateKey(e.dateISO));
  });

  const orderedDays = Array.from(daySet).sort();
  let atl = TRAINING_DEFAULTS.ATL0;
  let ctl = TRAINING_DEFAULTS.CTL0;
  let tsb = ctl - atl;
  let lastKey: string | null = null;
  let completedCount = 0;
  const dailyApplied: Record<string, number> = {};
  const tsbChrono: number[] = [];

  for (const dayKey of orderedDays) {
    if (lastKey) {
      const gap = computeInterveningOffDays(lastKey, dayKey);
      if (gap > 0) {
        const dec = decayLoadOverDays(atl, ctl, gap);
        atl = dec.atl;
        ctl = dec.ctl;
        tsb = dec.tsb;
      }
    }

    const daySessions = sessions.filter(
      (s) => toDateKey(s.dateISO ?? s.date ?? "") === dayKey
    );
    const rpes = daySessions
      .map((s) => (typeof s.feedback?.rpe === "number" ? s.feedback.rpe : Number(s.rpe)))
      .filter((x) => Number.isFinite(x) && x > 0) as number[];
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 5;
    const painFromState = feedbackState.dayStates?.[dayKey]?.feedback?.pain;
    const painToday =
      typeof painFromState === "number" && Number.isFinite(painFromState)
        ? painFromState
        : (() => {
            const pains = daySessions
              .map((s) => s.feedback?.pain)
              .filter((x): x is Rating0to5 => typeof x === "number" && Number.isFinite(x));
            if (!pains.length) return 0;
            return pains.reduce((sum: number, val) => sum + val, 0) / pains.length;
          })();

    const totals = computeDailyTotals({
      sessions: sessionsState.sessions,
      externalLoads: externals as ExternalLoadLike[],
      dayKey,
      loadCaps: LOAD_CAPS,
      adjustedRpeForCap: safeNum(avgRpe, 5, "rebuildLoad.avgRpe"),
      painForCap: safeNum(painToday, 0, "rebuildLoad.painToday"),
      clubTrainingDays: externalState.clubTrainingDays ?? [],
      matchDays: externalState.matchDays ?? (externalState.matchDay ? [externalState.matchDay] : []),
    });

    const totalToday = totals.totalToday;
    const deltaLoad = Math.max(0, totalToday);
    const next = deltaLoad > 0 ? updateTrainingLoad(atl, ctl, deltaLoad, { dtDays: 1 }) : { atl, ctl, tsb };

    const inOnboarding = completedCount < TRAINING_DEFAULTS.ONBOARDING_SESSIONS;
    const tsbAfter = inOnboarding ? Math.max(next.tsb, TRAINING_DEFAULTS.TSB_FLOOR_ONBOARDING) : next.tsb;

    atl = next.atl;
    ctl = next.ctl;
    tsb = tsbAfter;

    dailyApplied[dayKey] = totalToday;
    tsbChrono.push(tsbAfter);
    lastKey = dayKey;
    completedCount += daySessions.length;
  }

  const nowKey = toDateKey(debugState.devNowISO ?? todayISO());
  if (lastKey) {
    const gap = Math.max(0, diffDays(lastKey, nowKey));
    if (opts?.decayToNow !== false && gap > 0) {
      const dec = decayLoadOverDays(atl, ctl, gap);
      atl = dec.atl;
      ctl = dec.ctl;
      tsb = dec.tsb;
      lastKey = nowKey;
      tsbChrono.push(tsb);
    }
  } else {
    tsb = ctl - atl;
    lastKey = loadState.lastLoadDayKey ?? nowKey;
    tsbChrono.push(tsb);
  }

  const tsbHistory = [...tsbChrono].slice(-7).reverse();

  useLoadStore.setState({
    atl,
    ctl,
    tsb,
    dailyApplied,
    lastLoadDayKey: lastKey,
    lastUpdateISO: new Date().toISOString(),
    tsbHistory,
  });
}
