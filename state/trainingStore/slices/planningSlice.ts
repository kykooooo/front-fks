// src/state/trainingStore/slices/planningSlice.ts
import type { TrainingState } from "../types";

type PlanningSlice = Pick<
  TrainingState,
  "togglePlannedFksDay" | "clearPlannedFksDays"
>;

/**
 * IMPORTANT:
 * - On n'initialise PAS plannedFksDays ici.
 * - plannedFksDays est initialisé UNE SEULE FOIS dans baseTrainingState().
 */
export const createPlanningSlice = (set: any): PlanningSlice => ({
  togglePlannedFksDay: (dayKey: string) =>
    set((s: TrainingState) => {
      const list = s.plannedFksDays ?? [];
      const exists = list.includes(dayKey);
      const next = exists ? list.filter((d) => d !== dayKey) : [...list, dayKey];
      return { plannedFksDays: next };
    }),
  clearPlannedFksDays: () => set({ plannedFksDays: [] }),
});
