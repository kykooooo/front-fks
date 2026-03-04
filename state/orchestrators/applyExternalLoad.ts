// state/orchestrators/applyExternalLoad.ts
// Cross-cutting orchestrator: applies an external load across multiple stores.
import { todayISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { updateTrainingLoad, decayLoadOverDays } from "../../engine/loadModel";
import { DEV_FLAGS } from "../../config/devFlags";
import { LOAD_CAPS } from "../../config/trainingDefaults";
import { computeDailyTotals, computeInterveningOffDays, pruneDailyAppliedWindow, type ExternalLoadLike } from "../computeDailyApplied";
import { dayKeyToDow } from "../../utils/dateHelpers";
import type { ExternalLoad, DebugEvent } from "../stores/types";

import { useLoadStore } from "../stores/useLoadStore";
import { useSessionsStore } from "../stores/useSessionsStore";
import { useExternalStore } from "../stores/useExternalStore";
import { useFeedbackStore } from "../stores/useFeedbackStore";
import { useDebugStore } from "../stores/useDebugStore";

export function applyExternalLoad(load: ExternalLoad): void {
  const loadState = useLoadStore.getState();
  const sessionsState = useSessionsStore.getState();
  const externalState = useExternalStore.getState();
  const feedbackState = useFeedbackStore.getState();
  const debugState = useDebugStore.getState();

  const effectiveISO =
    load.dateISO ?? (DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? (debugState.devNowISO ?? todayISO()) : todayISO());
  const dayKey = toDateKey(effectiveISO);

  // Decay if gap
  let { atl, ctl, tsb } = loadState;
  const gap = computeInterveningOffDays(loadState.lastLoadDayKey, dayKey);
  if (gap > 0) {
    const decayed = decayLoadOverDays(atl, ctl, gap);
    atl = decayed.atl;
    ctl = decayed.ctl;
    tsb = decayed.tsb;
  }

  const normalizedLoad: ExternalLoad = { ...load, dateISO: effectiveISO };
  const nextExternals = [normalizedLoad, ...(externalState.externalLoads ?? [])].slice(0, 100);

  const completedToday = (sessionsState.sessions ?? []).filter(
    (s) => s.completed && toDateKey(s.dateISO ?? "") === dayKey
  );
  const rpes = completedToday.map((s) => Number(s.rpe)).filter((x) => Number.isFinite(x) && x > 0);
  const adjustedRpeForCap = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 6;

  const painToday = Number(feedbackState.dayStates?.[dayKey]?.feedback?.pain ?? 0) || 0;

  const totals = computeDailyTotals({
    sessions: sessionsState.sessions,
    externalLoads: nextExternals as ExternalLoadLike[],
    dayKey,
    loadCaps: LOAD_CAPS,
    adjustedRpeForCap,
    painForCap: painToday,
    clubTrainingDays: externalState.clubTrainingDays ?? [],
    matchDays: externalState.matchDays ?? (externalState.matchDay ? [externalState.matchDay] : []),
  });

  const totalToday = totals.totalToday;
  const already = loadState.dailyApplied[dayKey] ?? 0;
  const deltaLoad = Math.max(0, totalToday - already);

  const nextLoad =
    deltaLoad > 0
      ? updateTrainingLoad(atl, ctl, deltaLoad, { dtDays: 1 })
      : { atl, ctl, tsb };

  // Write to external store
  useExternalStore.setState({ externalLoads: nextExternals });

  // Write to load store
  useLoadStore.setState({
    atl: nextLoad.atl,
    ctl: nextLoad.ctl,
    tsb: nextLoad.tsb,
    lastUpdateISO: new Date().toISOString(),
    lastLoadDayKey: dayKey,
    dailyApplied: pruneDailyAppliedWindow({ ...loadState.dailyApplied, [dayKey]: totalToday }, 90, dayKey),
    tsbHistory: [nextLoad.tsb, ...(loadState.tsbHistory ?? [])].slice(0, 7),
  });

  // Debug event
  const evt: DebugEvent = {
    kind: "external_applied",
    whenISO: new Date().toISOString(),
    rpe: load.rpe,
    totalToday,
    deltaLoad,
    atl: +nextLoad.atl.toFixed(2),
    ctl: +nextLoad.ctl.toFixed(2),
    tsb: +nextLoad.tsb.toFixed(2),
    phase: sessionsState.phase,
    phaseCount: sessionsState.phaseCount,
    source: load.source,
  };
  useDebugStore.setState((s) => ({ debugLog: [evt, ...s.debugLog].slice(0, 200) }));
}

/**
 * Auto-apply external loads for a set of day keys (club training / match days).
 */
export function applyAutoExternalLoads(dayKeys: string[]): void {
  const externalState = useExternalStore.getState();
  if (!externalState.autoExternalEnabled) return;

  const uniq = Array.from(new Set(dayKeys)).sort();
  for (const dayKey of uniq) {
    const cfg = externalState.autoExternalConfig ?? {};
    const matchDay = externalState.matchDay ?? externalState.matchDays?.[0] ?? null;
    const dow = dayKeyToDow(dayKey);

    let candidate: { source: ExternalLoad["source"]; rpe: number; durationMin: number } | null = null;

    if (matchDay && dow === matchDay && cfg.match?.rpe && cfg.match?.durationMin) {
      candidate = { source: "match", rpe: cfg.match.rpe, durationMin: cfg.match.durationMin };
    } else if (
      Array.isArray(externalState.clubTrainingDays) &&
      externalState.clubTrainingDays.includes(dow) &&
      cfg.club?.rpe &&
      cfg.club?.durationMin
    ) {
      candidate = { source: "club", rpe: cfg.club.rpe, durationMin: cfg.club.durationMin };
    }

    if (!candidate) continue;

    // Re-read external state to check for already-added loads
    const currentExternals = useExternalStore.getState().externalLoads ?? [];
    const already = currentExternals.some(
      (e) => e.source === candidate!.source && toDateKey(e.dateISO ?? "") === dayKey
    );
    if (already) continue;

    applyExternalLoad({
      id: `auto_${candidate.source}_${dayKey}`,
      source: candidate.source,
      dateISO: `${dayKey}T12:00:00.000Z`,
      rpe: candidate.rpe,
      durationMin: candidate.durationMin,
      notes: "Auto (profil club/match)",
    });
  }
}
