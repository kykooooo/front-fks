// state/orchestrators/applyFeedback.ts
// Cross-cutting orchestrator: applies session feedback across multiple stores.
import { todayISO, addDaysISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { updateTrainingLoad, decayLoadOverDays } from "../../engine/loadModel";
import { DEV_FLAGS } from "../../config/devFlags";
import { TRAINING_DEFAULTS, LOAD_CAPS, getTauForLevel } from "../../config/trainingDefaults";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";
import { computeDailyTotals, computeInterveningOffDays, pruneDailyAppliedWindow, type ExternalLoadLike } from "../computeDailyApplied";
import type { Session, SessionFeedback, TrainingLogItem } from "../../domain/types";

function hasStructuredRun(exercises: Session["exercises"]): boolean {
  return exercises.some(
    (e) => e.modality === "run" && ((e.durationSec ?? 0) > 0 || (e.sets ?? 0) > 0)
  );
}
function hasCircuitOrCore(exercises: Session["exercises"]): boolean {
  return exercises.some((e) => e.modality === "circuit" || e.modality === "core");
}
import type { DebugEvent } from "../stores/types";

import { safeNum } from "../../engine/safeNum";
import { classifyError, retryWithBackoff } from "../../utils/errorHandler";
import { showToast } from "../../utils/toast";
import { isSessionCompleted } from "../../utils/sessionStatus";
import { enqueueAction } from "../../utils/offlineQueue";

import { useLoadStore } from "../stores/useLoadStore";
import { useSessionsStore } from "../stores/useSessionsStore";
import { useExternalStore } from "../stores/useExternalStore";
import { useDebugStore } from "../stores/useDebugStore";
import { useSyncStore } from "../stores/useSyncStore";

export function applyFeedback(
  sessionId: string,
  feedback: SessionFeedback
): TrainingLogItem | null {
  // 1. Read from all stores synchronously
  const sessionsState = useSessionsStore.getState();
  const loadState = useLoadStore.getState();
  const externalState = useExternalStore.getState();
  const debugState = useDebugStore.getState();
  const { tauAtl, tauCtl } = getTauForLevel(sessionsState.playerLevel);

  const idx = sessionsState.sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const session = sessionsState.sessions[idx];
  if (!session || isSessionCompleted(session)) return null;

  const sessionDateISO =
    typeof session?.dateISO === "string"
      ? session.dateISO
      : typeof session?.date === "string"
        ? session.date
        : null;
  const normalizedISO =
    sessionDateISO && sessionDateISO.length === 10
      ? `${sessionDateISO}T00:00:00.000Z`
      : sessionDateISO;
  const usedISO = normalizedISO ?? debugState.devNowISO ?? todayISO();
  const dayKey = toDateKey(usedISO);
  const alreadyToday = loadState.dailyApplied[dayKey] ?? 0;

  const durationMin =
    typeof feedback.durationMin === "number" && Number.isFinite(feedback.durationMin)
      ? Math.max(1, Math.round(feedback.durationMin))
      : session.durationMin;
  const updatedSession = {
    ...session,
    dateISO: usedISO,
    status: "completed" as const,
    completed: true,
    completedAt: new Date().toISOString(),
    feedback,
    rpe: feedback.rpe,
    ...(durationMin ? { durationMin } : {}),
  };
  const nextSessions = [...sessionsState.sessions];
  nextSessions[idx] = updatedSession;

  // 2. Load decay + onboarding protection
  let atlBase = loadState.atl;
  let ctlBase = loadState.ctl;
  let tsbBase = loadState.tsb;

  const gap = computeInterveningOffDays(loadState.lastLoadDayKey, dayKey);
  if (gap > 0) {
    const decayed = decayLoadOverDays(atlBase, ctlBase, gap, { tauAtl, tauCtl });
    atlBase = decayed.atl;
    ctlBase = decayed.ctl;
    tsbBase = decayed.tsb;
  }

  const completedBefore = sessionsState.sessions.filter((s) => isSessionCompleted(s)).length;
  if (completedBefore === 0) {
    atlBase = TRAINING_DEFAULTS.ATL0;
    ctlBase = TRAINING_DEFAULTS.CTL0;
    tsbBase = TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0;
  }

  // 3. Daily totals (guard NaN on user-facing inputs)
  const safeRpe = safeNum(feedback.rpe, 6, "applyFeedback.rpe");
  const painToday = safeNum(feedback.pain, 0, "applyFeedback.pain");
  const totals = computeDailyTotals({
    sessions: nextSessions,
    externalLoads: externalState.externalLoads as ExternalLoadLike[],
    dayKey,
    loadCaps: LOAD_CAPS,
    adjustedRpeForCap: safeRpe,
    painForCap: painToday,
    clubTrainingDays: externalState.clubTrainingDays ?? [],
    matchDays: externalState.matchDays ?? (externalState.matchDay ? [externalState.matchDay] : []),
  });

  const totalToday = totals.totalToday;
  const deltaLoad = Math.max(0, totalToday - alreadyToday);

  const nextLoad =
    deltaLoad > 0
      ? updateTrainingLoad(atlBase, ctlBase, deltaLoad, { dtDays: 1, tauAtl, tauCtl })
      : { atl: atlBase, ctl: ctlBase, tsb: tsbBase };

  const inOnboarding = completedBefore < TRAINING_DEFAULTS.ONBOARDING_SESSIONS;
  const tsbAfter = inOnboarding ? Math.max(nextLoad.tsb, TRAINING_DEFAULTS.TSB_FLOOR_ONBOARDING) : nextLoad.tsb;

  const atlDelta = +(nextLoad.atl - atlBase).toFixed(2);
  const ctlDelta = +(nextLoad.ctl - ctlBase).toFixed(2);

  const nextDailyApplied = pruneDailyAppliedWindow({ ...loadState.dailyApplied, [dayKey]: totalToday }, 90, dayKey);
  const nextTsbHistory = [tsbAfter, ...(loadState.tsbHistory ?? [])].slice(0, 7);

  // 4. Phase (playlist mode: static)
  const nextPhaseValue = sessionsState.phase;
  const nextPhaseCount = sessionsState.phaseCount;

  // 5. Weekly
  const hasRun = hasStructuredRun(updatedSession.exercises);
  const hasCircuit = hasCircuitOrCore(updatedSession.exercises);
  const nextWeekly = {
    ...sessionsState.weekly,
    hasRunStructured: sessionsState.weekly.hasRunStructured || hasRun,
    hasCircuit: sessionsState.weekly.hasCircuit || hasCircuit,
  };

  // 6. Micro-cycle advancement
  const appliedSet = new Set(sessionsState.microcycleAppliedSessionIds ?? []);
  const alreadyAppliedMicro = appliedSet.has(sessionId);
  const goalKey = (sessionsState.microcycleGoal ?? "").toLowerCase().trim();
  const hasActiveMicrocycle = Boolean(goalKey);
  const shouldAdvanceMicro = hasActiveMicrocycle;
  const baseMicroIdx = Math.max(0, Math.trunc(sessionsState.microcycleSessionIndex ?? 0));
  const microcycleTotal = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const microcycleCompleted = hasActiveMicrocycle && baseMicroIdx >= microcycleTotal;
  const nextMicroIdx =
    shouldAdvanceMicro && !alreadyAppliedMicro && !microcycleCompleted ? baseMicroIdx + 1 : baseMicroIdx;
  const nextMicroApplied =
    shouldAdvanceMicro && !alreadyAppliedMicro && !microcycleCompleted
      ? [sessionId, ...Array.from(appliedSet)].slice(0, 80)
      : Array.from(appliedSet);

  // 7. Virtual clock
  const baseISO = debugState.devNowISO ?? todayISO();
  const nextDevNowISO =
    DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? addDaysISO(baseISO, 1) : debugState.devNowISO;

  // 8. Debug event
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

  // 9. Write to stores (React 18 batches synchronous setState calls)
  useSessionsStore.setState({
    sessions: nextSessions,
    phase: nextPhaseValue,
    phaseCount: nextPhaseCount,
    weekly: nextWeekly,
    microcycleSessionIndex: nextMicroIdx,
    microcycleAppliedSessionIds: nextMicroApplied,
  });

  useLoadStore.setState({
    atl: nextLoad.atl,
    ctl: nextLoad.ctl,
    tsb: tsbAfter,
    lastRpe: feedback.rpe,
    lastUpdateISO: new Date().toISOString(),
    lastLoadDayKey: dayKey,
    dailyApplied: nextDailyApplied,
    tsbHistory: nextTsbHistory,
    lastAppliedDate: dayKey,
  });

  useDebugStore.setState({
    debugLog: [evt, ...(debugState.debugLog ?? [])].slice(0, 200),
    ...(DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? { devNowISO: nextDevNowISO } : {}),
  });

  // 10. Firestore persist with retry (critical — local-only data if this fails)
  retryWithBackoff(
    () => useSyncStore.getState().persistCompletedSession(updatedSession),
    { maxRetries: 3, baseDelayMs: 500, context: "persistCompletedSession" }
  ).catch(async (err) => {
    if (__DEV__) {
      console.error("[applyFeedback] Firestore persist failed after retries:", err);
    }
    const appError = classifyError(err);
    await enqueueAction(
      "session",
      { session: updatedSession },
      appError.retryable ? 5 : 2
    );
    showToast({
      type: appError.retryable ? "warn" : "error",
      title: "Synchronisation en attente",
      message: "Ton feedback est enregistré localement et la synchronisation de la séance sera retentée automatiquement.",
    });
  });

  return { sessionId, dateISO: usedISO, rpe: feedback.rpe, atlDelta, ctlDelta };
}
