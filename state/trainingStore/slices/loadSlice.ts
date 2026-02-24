import { addDaysISO, todayISO } from "../../../utils/virtualClock";
import { diffDays, toDayKey } from "../../../engine/dailyAggregation";
import { updateTrainingLoad, decayLoadOverDays } from "../../../engine/loadModel";
import { DEV_FLAGS } from "../../../config/devFlags";
import { TRAINING_DEFAULTS, LOAD_CAPS } from "../../../config/trainingDefaults";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../../domain/microcycles";
import type { Rating0to5 } from "../../../domain/types";

import { computeDailyTotals, computeInterveningOffDays, pruneDailyAppliedWindow, type ExternalLoadLike } from "../../computeDailyApplied";

import { dayKeyToDow, hasStructuredRun, hasCircuitOrCore } from "../helpers";
import type { TrainingState, ExternalLoad, DebugEvent } from "../types";

type LoadSlice = Pick<
  TrainingState,
  | "runTestHarness"
  | "_applyAutoExternalLoads"
  | "_rebuildLoadFromHistory"
  | "addFeedback"
  | "addExternalLoad"
  | "advanceDays"
  | "restUntil"
  | "_rehydrateFromStorage"
>;

export const createLoadSlice = (set: any, get: any): LoadSlice => ({
  runTestHarness: (days = 7) => {
    const todayKey = toDayKey(get().devNowISO ?? todayISO());
    const dayKeys = Array.from({ length: Math.max(1, Math.floor(days)) })
      .map((_, i) => addDaysISO(`${todayKey}T00:00:00.000Z`, -(Math.max(1, Math.floor(days)) - 1 - i)).slice(0, 10));

    set({
      atl: TRAINING_DEFAULTS.ATL0,
      ctl: TRAINING_DEFAULTS.CTL0,
      tsb: TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0,
      externalLoads: [],
      sessions: [],
      dailyApplied: {},
      lastLoadDayKey: null,
      lastUpdateISO: null,
      tsbHistory: [],
      debugLog: [],
    });

    get()._applyAutoExternalLoads?.(dayKeys);

    dayKeys.forEach((k, idx) => {
      if (idx % 2 === 0) {
        get().addExternalLoad({
          id: `test_other_${k}`,
          source: "other",
          dateISO: `${k}T18:00:00.000Z`,
          rpe: 4 + (idx % 3),
          durationMin: 45 + (idx % 3) * 10,
          notes: "Test harness other",
        });
      }
    });
  },

  _applyAutoExternalLoads: (dayKeys: string[]) => {
    if (!get().autoExternalEnabled) return;
    const uniq = Array.from(new Set(dayKeys)).sort();
    for (const dayKey of uniq) {
      const stNow: TrainingState = get();
      const cfg = stNow.autoExternalConfig ?? {};
      const matchDay = stNow.matchDay ?? stNow.matchDays?.[0] ?? null;
      const dow = dayKeyToDow(dayKey);

      let candidate: { source: ExternalLoad["source"]; rpe: number; durationMin: number } | null = null;

      if (matchDay && dow === matchDay && cfg.match?.rpe && cfg.match?.durationMin) {
        candidate = { source: "match", rpe: cfg.match.rpe, durationMin: cfg.match.durationMin };
      } else if (
        Array.isArray(stNow.clubTrainingDays) &&
        stNow.clubTrainingDays.includes(dow) &&
        cfg.club?.rpe &&
        cfg.club?.durationMin
      ) {
        candidate = { source: "club", rpe: cfg.club.rpe, durationMin: cfg.club.durationMin };
      }

      if (!candidate) continue;

      const already = (stNow.externalLoads ?? []).some(
        (e) => e.source === candidate!.source && toDayKey(e.dateISO ?? "") === dayKey
      );
      if (already) continue;

      get().addExternalLoad({
        id: `auto_${candidate.source}_${dayKey}`,
        source: candidate.source,
        dateISO: `${dayKey}T12:00:00.000Z`,
        rpe: candidate.rpe,
        durationMin: candidate.durationMin,
        notes: "Auto (profil club/match)",
      });
    }
  },

  _rebuildLoadFromHistory: (opts) => {
    const st: TrainingState = get();
    const sessions = (st.sessions ?? []).filter((s) => s?.completed);
    const externals = st.externalLoads ?? [];

    const daySet = new Set<string>();
    sessions.forEach((s) => {
      const dk = toDayKey((s as any).dateISO ?? (s as any).date ?? todayISO());
      daySet.add(dk);
    });
    externals.forEach((e) => {
      if (!e?.dateISO) return;
      daySet.add(toDayKey(e.dateISO));
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
        (s) => toDayKey((s as any).dateISO ?? (s as any).date ?? "") === dayKey
      );
      const rpes = daySessions
        .map((s) => (typeof s.feedback?.rpe === "number" ? s.feedback.rpe : Number((s as any).rpe)))
        .filter((x) => Number.isFinite(x) && x > 0) as number[];
      const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 5;
      const painFromState = st.dayStates?.[dayKey]?.feedback?.pain;
      const painToday =
        typeof painFromState === "number"
          ? painFromState
          : (() => {
              const pains = daySessions
                .map((s) => s.feedback?.pain)
                .filter((x): x is Rating0to5 => typeof x === "number" && Number.isFinite(x));
              if (!pains.length) return 0;
              return pains.reduce((sum: number, val) => sum + val, 0) / pains.length;
            })();

      const totals = computeDailyTotals({
        sessions: st.sessions,
        externalLoads: externals as ExternalLoadLike[],
        dayKey,
        loadCaps: LOAD_CAPS,
        adjustedRpeForCap: avgRpe,
        painForCap: painToday,
        clubTrainingDays: st.clubTrainingDays ?? [],
        matchDays: st.matchDays ?? (st.matchDay ? [st.matchDay] : []),
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

    const nowKey = toDayKey(st.devNowISO ?? todayISO());
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
      lastKey = st.lastLoadDayKey ?? nowKey;
      tsbChrono.push(tsb);
    }

    const tsbHistory = [...tsbChrono].slice(-7).reverse();

    set({
      atl,
      ctl,
      tsb,
      dailyApplied,
      lastLoadDayKey: lastKey,
      lastUpdateISO: new Date().toISOString(),
      tsbHistory,
    });
  },

  addFeedback: (sessionId, feedback) => {
    const state: TrainingState = get();

    const idx = state.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return null;

    const session = state.sessions[idx];
    if (!session || session.completed) return null;

    const sessionDateISO =
      typeof session?.dateISO === "string"
        ? session.dateISO
        : typeof (session as any)?.date === "string"
          ? (session as any).date
          : null;
    const normalizedISO =
      sessionDateISO && sessionDateISO.length === 10
        ? `${sessionDateISO}T00:00:00.000Z`
        : sessionDateISO;
    const usedISO = normalizedISO ?? state.devNowISO ?? todayISO();
    const dayKey = toDayKey(usedISO);
    const alreadyToday = state.dailyApplied[dayKey] ?? 0;

    const durationMin =
      typeof feedback.durationMin === "number" && Number.isFinite(feedback.durationMin)
        ? Math.max(1, Math.round(feedback.durationMin))
        : session.durationMin;
    const updatedSession = {
      ...session,
      dateISO: usedISO,
      completed: true,
      feedback,
      rpe: feedback.rpe,
      ...(durationMin ? { durationMin } : {}),
    };
    const nextSessions = [...state.sessions];
    nextSessions[idx] = updatedSession;

    // charge de base (avec decay et onboarding protect)
    let atlBase = state.atl;
    let ctlBase = state.ctl;
    let tsbBase = state.tsb;

    const gap = computeInterveningOffDays(state.lastLoadDayKey, dayKey);
    if (gap > 0) {
      const decayed = decayLoadOverDays(atlBase, ctlBase, gap);
      atlBase = decayed.atl;
      ctlBase = decayed.ctl;
      tsbBase = decayed.tsb;
    }

    const completedBefore = state.sessions.filter((s) => s.completed).length;
    if (completedBefore === 0) {
      atlBase = TRAINING_DEFAULTS.ATL0;
      ctlBase = TRAINING_DEFAULTS.CTL0;
      tsbBase = TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0;
    }

    // totals jour
    const painToday = typeof feedback.pain === "number" ? feedback.pain : 0;
    const totals = computeDailyTotals({
      sessions: nextSessions,
      externalLoads: state.externalLoads as ExternalLoadLike[],
      dayKey,
      loadCaps: LOAD_CAPS,
      adjustedRpeForCap: (feedback as any).rpe ?? 6,
      painForCap: painToday,
      clubTrainingDays: state.clubTrainingDays ?? [],
      matchDays: state.matchDays ?? (state.matchDay ? [state.matchDay] : []),
    });

    const totalToday = totals.totalToday;
    const deltaLoad = Math.max(0, totalToday - alreadyToday);

    const nextLoad =
      deltaLoad > 0
        ? updateTrainingLoad(atlBase, ctlBase, deltaLoad, { dtDays: 1 })
        : { atl: atlBase, ctl: ctlBase, tsb: tsbBase };

    const inOnboarding = completedBefore < TRAINING_DEFAULTS.ONBOARDING_SESSIONS;
    const tsbAfter = inOnboarding ? Math.max(nextLoad.tsb, TRAINING_DEFAULTS.TSB_FLOOR_ONBOARDING) : nextLoad.tsb;

    const atlDelta = +(nextLoad.atl - atlBase).toFixed(2);
    const ctlDelta = +(nextLoad.ctl - ctlBase).toFixed(2);

    const nextDailyApplied = pruneDailyAppliedWindow({ ...state.dailyApplied, [dayKey]: totalToday }, 90, dayKey);
    const nextTsbHistory = [tsbAfter, ...(state.tsbHistory ?? [])].slice(0, 7);

    // phase (playlist mode : statique)
    const nextPhaseValue = state.phase;
    const nextPhaseCount = state.phaseCount;

    // weekly
    const hasRun = hasStructuredRun(updatedSession.exercises);
    const hasCircuit = hasCircuitOrCore(updatedSession.exercises);
    const nextWeekly = {
      ...state.weekly,
      hasRunStructured: state.weekly.hasRunStructured || hasRun,
      hasCircuit: state.weekly.hasCircuit || hasCircuit,
    };

    // micro-cycle (guard against double feedback on same session)
    const appliedSet = new Set(state.microcycleAppliedSessionIds ?? []);
    const alreadyAppliedMicro = appliedSet.has(sessionId);
    const goalKey = (state.microcycleGoal ?? "").toLowerCase().trim();
    const hasActiveMicrocycle = Boolean(goalKey);
    const hasAiPayload = Boolean((updatedSession as any).aiV2 ?? (updatedSession as any).ai);
    // For explosivite, only advance on AI-generated sessions to avoid skipping.
    const shouldAdvanceMicro = hasActiveMicrocycle && (goalKey !== "explosivite" || hasAiPayload);
    const baseMicroIdx = Math.max(0, Math.trunc(state.microcycleSessionIndex ?? 0));
    const microcycleTotal = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
    const microcycleCompleted = hasActiveMicrocycle && baseMicroIdx >= microcycleTotal;
    const nextMicroIdx =
      shouldAdvanceMicro && !alreadyAppliedMicro && !microcycleCompleted ? baseMicroIdx + 1 : baseMicroIdx;
    const nextMicroApplied =
      shouldAdvanceMicro && !alreadyAppliedMicro && !microcycleCompleted
        ? [sessionId, ...Array.from(appliedSet)].slice(0, 80)
        : Array.from(appliedSet);

    // virtual clock
    const baseISO = state.devNowISO ?? todayISO();
    const nextDevNowISO =
      DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? addDaysISO(baseISO, 1) : state.devNowISO;

    // debug event (calculé sans re-get)
    const evt: DebugEvent = {
      kind: "feedback_applied",
      whenISO: new Date().toISOString(),
      sessionId,
      rpe: feedback.rpe,
      fatigue: feedback.fatigue,
      pain: feedback.pain,
      totalToday,
      deltaLoad,
      atl: nextLoad.atl,
      ctl: nextLoad.ctl,
      tsb: tsbAfter,
      phase: nextPhaseValue,
      phaseCount: nextPhaseCount,
    };

    set({
      sessions: nextSessions,
      atl: nextLoad.atl,
      ctl: nextLoad.ctl,
      tsb: tsbAfter,
      lastRpe: feedback.rpe,
      lastUpdateISO: new Date().toISOString(),
      lastLoadDayKey: dayKey,
      dailyApplied: nextDailyApplied,
      tsbHistory: nextTsbHistory,
      lastAppliedDate: dayKey,
      phase: nextPhaseValue,
      phaseCount: nextPhaseCount,
      weekly: nextWeekly,
      microcycleSessionIndex: nextMicroIdx,
      microcycleAppliedSessionIds: nextMicroApplied,
      ...(DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? { devNowISO: nextDevNowISO } : {}),
      debugLog: [evt, ...(state.debugLog ?? [])].slice(0, 200),
    });

    // best-effort persistance Firestore pour éviter de devoir revalider
    get().persistCompletedSession?.(updatedSession as any).catch?.(() => {});

    return { sessionId, dateISO: usedISO, rpe: feedback.rpe, atlDelta, ctlDelta };
  },

  addExternalLoad: (load) => {
    const st: TrainingState = get();

    const effectiveISO =
      load.dateISO ?? (DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? (st.devNowISO ?? todayISO()) : todayISO());
    const dayKey = toDayKey(effectiveISO);

    const gap = computeInterveningOffDays(st.lastLoadDayKey, dayKey);
    if (gap > 0) {
      const decayed = decayLoadOverDays(st.atl, st.ctl, gap);
      set({ atl: decayed.atl, ctl: decayed.ctl, tsb: decayed.tsb });
    }

    const normalizedLoad: ExternalLoad = { ...load, dateISO: effectiveISO };
    const nextExternals = [normalizedLoad, ...(st.externalLoads ?? [])].slice(0, 100);

    const completedToday = (st.sessions ?? []).filter(
      (s) => s.completed && toDayKey(s.dateISO ?? "") === dayKey
    );
    const rpes = completedToday.map((s) => Number(s.rpe)).filter((x) => Number.isFinite(x) && x > 0);
    const adjustedRpeForCap = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 6;

    const painToday = Number(st.dayStates?.[dayKey]?.feedback?.pain ?? 0) || 0;

    const totals = computeDailyTotals({
      sessions: st.sessions,
      externalLoads: nextExternals as ExternalLoadLike[],
      dayKey,
      loadCaps: LOAD_CAPS,
      adjustedRpeForCap,
      painForCap: painToday,
      clubTrainingDays: st.clubTrainingDays ?? [],
      matchDays: st.matchDays ?? (st.matchDay ? [st.matchDay] : []),
    });

    const totalToday = totals.totalToday;

    const already = st.dailyApplied[dayKey] ?? 0;
    const deltaLoad = Math.max(0, totalToday - already);

    const before: TrainingState = get();
    const nextLoad =
      deltaLoad > 0
        ? updateTrainingLoad(before.atl, before.ctl, deltaLoad, { dtDays: 1 })
        : { atl: before.atl, ctl: before.ctl, tsb: before.tsb };

    set({
      externalLoads: nextExternals,
      atl: nextLoad.atl,
      ctl: nextLoad.ctl,
      tsb: nextLoad.tsb,
      lastUpdateISO: new Date().toISOString(),
      lastLoadDayKey: dayKey,
      dailyApplied: pruneDailyAppliedWindow({ ...before.dailyApplied, [dayKey]: totalToday }, 90, dayKey),
      tsbHistory: [nextLoad.tsb, ...(before.tsbHistory ?? [])].slice(0, 7),
    });

    const evt: DebugEvent = {
      kind: "external_applied",
      whenISO: new Date().toISOString(),
      rpe: load.rpe,
      totalToday,
      deltaLoad,
      atl: +nextLoad.atl.toFixed(2),
      ctl: +nextLoad.ctl.toFixed(2),
      tsb: +nextLoad.tsb.toFixed(2),
      phase: before.phase,
      phaseCount: before.phaseCount,
      source: load.source,
    };
    set((s: TrainingState) => ({ debugLog: [evt, ...s.debugLog].slice(0, 200) }));
  },

  advanceDays: (n) => {
    if (!Number.isFinite(n) || n <= 0) return;

    const { atl, ctl, devNowISO, lastLoadDayKey } = get();
    const decayed = decayLoadOverDays(atl, ctl, n);
    const newDevISO = devNowISO ? addDaysISO(devNowISO, n) : devNowISO;

    const baseKey = (lastLoadDayKey ?? (devNowISO ?? todayISO())).slice(0, 10);
    const baseISO = `${baseKey}T00:00:00.000Z`;
    const newKey = addDaysISO(baseISO, n).slice(0, 10);

    set({
      atl: decayed.atl,
      ctl: decayed.ctl,
      tsb: decayed.tsb,
      devNowISO: newDevISO,
      lastUpdateISO: new Date().toISOString(),
      lastLoadDayKey: newKey,
      tsbHistory: [decayed.tsb, ...(get().tsbHistory ?? [])].slice(0, 7),
    });

    const dayKeys: string[] = [];
    for (let i = 1; i <= n; i++) dayKeys.push(addDaysISO(baseISO, i).slice(0, 10));
    get()._applyAutoExternalLoads?.(dayKeys);
  },

  /**
   * Programme une période de repos obligatoire.
   *
   * `nextAllowedDateISO` = date ISO à partir de laquelle la génération de séance
   * est à nouveau autorisée. Une fois la date dépassée, le check dans
   * NewSessionScreen.tsx (isBeforeNextAllowed) revient automatiquement à false
   * sans nécessiter de reset manuel.
   *
   * Exemple : restUntil(2) → bloque la génération pendant 2 jours.
   */
  restUntil: (days) => {
    const baseISO = get().devNowISO ?? new Date().toISOString();
    const target = addDaysISO(baseISO, Math.max(0, Math.floor(days)));
    set({ nextAllowedDateISO: target });
  },

  _rehydrateFromStorage: () => {
    if (get()._rehydrating) return;
    set({ _rehydrating: true });

    const st: TrainingState = get();
    const lastKey = st.lastLoadDayKey ?? (st.lastUpdateISO ? toDayKey(st.lastUpdateISO) : null);

    const nowISO = st.devNowISO ?? todayISO();
    const nowKey = toDayKey(nowISO);

    if (!lastKey) {
      set({
        tsb: st.ctl - st.atl,
        lastUpdateISO: nowISO,
        lastLoadDayKey: nowKey,
        tsbHistory: [st.ctl - st.atl],
      });
      set({ _rehydrating: false });
      return;
    }

    let gapDays = Math.max(0, diffDays(lastKey, nowKey));
    if (gapDays > 14) gapDays = 14;

    if (gapDays > 0) {
      const decayed = decayLoadOverDays(st.atl, st.ctl, gapDays);
      set({
        atl: decayed.atl,
        ctl: decayed.ctl,
        tsb: decayed.tsb,
        lastUpdateISO: nowISO,
        lastLoadDayKey: nowKey,
        tsbHistory: [decayed.tsb, ...(get().tsbHistory ?? [])].slice(0, 7),
      });
    } else {
      set({
        tsb: st.ctl - st.atl,
        lastUpdateISO: nowISO,
        lastLoadDayKey: st.lastLoadDayKey ?? nowKey,
        tsbHistory: [st.ctl - st.atl, ...(get().tsbHistory ?? [])].slice(0, 7),
      });
    }

    // applique auto externals sur 7 jours
    const recentKeys = Array.from({ length: 7 }).map((_, i) =>
      addDaysISO(`${nowKey}T00:00:00.000Z`, -i).slice(0, 10)
    );
    get()._applyAutoExternalLoads?.(recentKeys);

    set({ _rehydrating: false });
  },
});
