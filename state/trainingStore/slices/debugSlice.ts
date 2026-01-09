// src/state/trainingStore/slices/debugSlice.ts
import type { TrainingState } from "../types";

type DebugSlice = Pick<TrainingState, "clearDebugLog">;

/**
 * IMPORTANT:
 * - On n'initialise PAS debugLog ici.
 * - debugLog est initialisé UNE SEULE FOIS dans baseTrainingState().
 */
export const createDebugSlice = (set: any): DebugSlice => ({
  clearDebugLog: () => set({ debugLog: [] }),
});
