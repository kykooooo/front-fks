import type { DayState, DailyFeedback } from "../../../domain/types";
import type { TrainingState } from "../types";

import { toDayKey } from "../../../engine/dailyAggregation";
import { FEEDBACK_LIMITS } from "../../../constants/feedback";
import { FEEDBACK_NORM } from "../../../config/feedbackNormalization";
import { normalizeFeedback, mixByReliability } from "../../../utils/subjectiveNormalizer";
import { computeAdaptiveFactors } from "../../../utils/feedbackFactor";
import { withIfDefined, NEUTRAL_ADAPTIVE, collectHistory, lastNDates } from "../helpers";

type SubjectiveSlice = Pick<
  TrainingState,
  | "getPrevFatigueSmoothed"
  | "setDailyFeedback"
  | "setInjury"
  | "getAdaptiveFactorsForDate"
>;

export const createSubjectiveSlice = (set: any, get: any): SubjectiveSlice => ({
  getPrevFatigueSmoothed: (dateISO) => {
    const d = new Date(dateISO);
    d.setUTCDate(d.getUTCDate() - 1);
    const prevKey = d.toISOString().slice(0, 10);
    const prev = get().dayStates[prevKey];
    return prev?.adaptive?.fatigueSmoothed ?? null;
  },

  setDailyFeedback: (dateISO, payload) => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const fatigue = clamp(payload.fatigue, FEEDBACK_LIMITS.fatigueMin, FEEDBACK_LIMITS.fatigueMax);
    const pain =
      payload.pain == null ? undefined : clamp(payload.pain, FEEDBACK_LIMITS.painMin, FEEDBACK_LIMITS.painMax);
    const recoveryPerceived =
      payload.recoveryPerceived == null
        ? undefined
        : clamp(payload.recoveryPerceived, FEEDBACK_LIMITS.recoveryMin, FEEDBACK_LIMITS.recoveryMax);

    const prevSmoothed = get().getPrevFatigueSmoothed(dateISO);

    const dayKey = toDayKey(dateISO);
    const histDates = lastNDates(dayKey, FEEDBACK_NORM.windowDays);
    const histories = collectHistory(get().dayStates, histDates, FEEDBACK_NORM.windowDays);

    const prevDayKeyISO = new Date(`${dayKey}T00:00:00.000Z`);
    prevDayKeyISO.setUTCDate(prevDayKeyISO.getUTCDate() - 1);
    const prevKey = prevDayKeyISO.toISOString().slice(0, 10);
    const prevDay = get().dayStates[prevKey];

    const norm = normalizeFeedback(
      { rpe: 5, fatigue, recoveryPerceived, pain },
      histories,
      {
        fatigue: prevDay?.adaptive?.fatigueSmoothed ?? prevSmoothed ?? undefined,
        recovery: prevDay?.feedback?.recoveryPerceived ?? undefined,
        pain: prevDay?.feedback?.pain ?? undefined,
      }
    );

    let factors = computeAdaptiveFactors({
      fatigue: norm.fatigueEMA,
      prevFatigueSmoothed: prevSmoothed,
      pain: typeof norm.painEMA === "number" ? norm.painEMA : undefined,
    });

    factors = {
      ...factors,
      combined: mixByReliability(factors.combined, norm.reliability),
      fatigueSmoothed: norm.fatigueEMA,
    };

    set((state: TrainingState) => {
      const prevDayState = state.dayStates[dayKey] ?? ({ date: dayKey, adaptive: NEUTRAL_ADAPTIVE } as DayState);

      let fb: DailyFeedback = {
        fatigue,
        injury: prevDayState.feedback?.injury ?? null,
        timestamp: new Date().toISOString(),
      } as DailyFeedback;

      fb = withIfDefined(fb, "pain", pain);
      fb = withIfDefined(fb, "recoveryPerceived", recoveryPerceived);

      const next: DayState = { date: dayKey, feedback: fb, adaptive: factors };
      return { dayStates: { ...state.dayStates, [dayKey]: next } };
    });
  },

  setInjury: (dateISO, injury) => {
    const dayKey = toDayKey(dateISO);

    set((state: TrainingState) => {
      const prevDayState = state.dayStates[dayKey] ?? ({ date: dayKey, adaptive: NEUTRAL_ADAPTIVE } as DayState);

      let fb: DailyFeedback = {
        fatigue: prevDayState.feedback?.fatigue ?? 3,
        injury,
        timestamp: new Date().toISOString(),
      } as DailyFeedback;

      fb = withIfDefined(fb, "pain", prevDayState.feedback?.pain);
      fb = withIfDefined(fb, "recoveryPerceived", prevDayState.feedback?.recoveryPerceived);

      const next: DayState = { date: dayKey, feedback: fb, adaptive: prevDayState.adaptive ?? NEUTRAL_ADAPTIVE };
      return { dayStates: { ...state.dayStates, [dayKey]: next } };
    });
  },

  getAdaptiveFactorsForDate: (dateISO) => get().dayStates[toDayKey(dateISO)]?.adaptive ?? null,
});
