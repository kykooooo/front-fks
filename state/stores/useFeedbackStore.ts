// state/stores/useFeedbackStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DayState, DailyFeedback, AdaptiveFactors } from "../../domain/types";
import { toDateKey, lastNDates } from "../../utils/dateHelpers";
import { FEEDBACK_LIMITS } from "../../constants/feedback";
import { FEEDBACK_NORM } from "../../config/feedbackNormalization";
import { normalizeFeedback, mixByReliability } from "../../utils/subjectiveNormalizer";
import { computeAdaptiveFactors } from "../../utils/feedbackFactor";

/** Ajoute une clé seulement si la valeur est définie */
export function withIfDefined<T extends object, K extends string, V>(
  obj: T,
  key: K,
  value: V | undefined
): T & (V extends undefined ? {} : { [P in K]: V }) {
  if (value !== undefined) {
    // @ts-expect-error écriture contrôlée
    obj[key] = value;
  }
  return obj as any;
}

/** Facteur neutre pour DayState.adaptive */
export const NEUTRAL_ADAPTIVE: AdaptiveFactors = {
  fatigueFactor: 1,
  painFactor: 1,
  combined: 1,
  fatigueSmoothed: 3,
};

/** Collecte les N derniers jours d'historique subjectif (fatigue, recovery, pain). */
export function collectHistory(
  dayStates: Record<string, DayState>,
  datesISO: string[],
  n: number
) {
  const keys = [...datesISO].slice(0, n);
  const fatigue: number[] = [];
  const recovery: number[] = [];
  const pain: number[] = [];
  for (const k of keys) {
    const ds = dayStates[k];
    if (!ds?.feedback) continue;
    if (typeof ds.feedback.fatigue === "number") fatigue.push(ds.feedback.fatigue);
    if (typeof ds.feedback.recoveryPerceived === "number") recovery.push(ds.feedback.recoveryPerceived);
    if (typeof ds.feedback.pain === "number") pain.push(ds.feedback.pain);
  }
  return { fatigue, recovery, pain };
}
import type { FeedbackState } from "./types";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

const baseFeedbackState = () => ({
  dayStates: {} as Record<string, DayState>,
});

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      ...baseFeedbackState(),

      getPrevFatigueSmoothed: (dateISO) => {
        const d = new Date(dateISO);
        d.setDate(d.getDate() - 1);
        const prevKey = toDateKey(d);
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

        const dayKey = toDateKey(dateISO);
        const histDates = lastNDates(dayKey, FEEDBACK_NORM.windowDays);
        const histories = collectHistory(get().dayStates, histDates, FEEDBACK_NORM.windowDays);

        const prevDayDate = new Date(`${dayKey}T12:00:00`);
        prevDayDate.setDate(prevDayDate.getDate() - 1);
        const prevKey = toDateKey(prevDayDate);
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

        set((state) => {
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
        const dayKey = toDateKey(dateISO);

        set((state) => {
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

      getAdaptiveFactorsForDate: (dateISO) =>
        get().dayStates[toDateKey(dateISO)]?.adaptive ?? null,
    }),
    {
      name: "fks-feedback-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({ dayStates: s.dayStates }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as FeedbackState,
    }
  )
);

export const getFeedbackDefaults = baseFeedbackState;
