// state/stores/useExternalStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO } from "../../utils/virtualClock";
import type { ExternalState } from "./types";
import type { CompletedRoutine, ExternalLoad } from "./types";
import { useDebugStore } from "./useDebugStore";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

const baseExternalState = () => ({
  externalLoads: [] as ExternalLoad[],
  completedRoutines: [] as CompletedRoutine[],
  favoriteExerciseIds: [] as string[],
  recentExerciseIds: [] as string[],
  clubTrainingDays: [] as string[],
  matchDays: [] as string[],
  matchDay: null as string | null,
  autoExternalEnabled: true,
  autoExternalConfig: {} as ExternalState["autoExternalConfig"],
});

export const useExternalStore = create<ExternalState>()(
  persist(
    (set, get) => ({
      ...baseExternalState(),

      addCompletedRoutine: (routine) =>
        set((state) => {
          const devNowISO = useDebugStore.getState().devNowISO;
          const now = devNowISO ?? todayISO();
          const entry: CompletedRoutine = {
            id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            dateISO: now,
            category: routine.category,
            title: routine.title,
            durationMin: routine.durationMin,
          };
          const updated = [entry, ...(state.completedRoutines ?? [])].slice(0, 200);
          return { completedRoutines: updated };
        }),

      toggleFavoriteExercise: (exerciseId) =>
        set((state) => {
          const next = new Set(state.favoriteExerciseIds ?? []);
          if (next.has(exerciseId)) {
            next.delete(exerciseId);
          } else {
            next.add(exerciseId);
          }
          return { favoriteExerciseIds: Array.from(next) };
        }),

      addRecentExercise: (exerciseId) =>
        set((state) => {
          const current = state.recentExerciseIds ?? [];
          const next = [exerciseId, ...current.filter((id) => id !== exerciseId)];
          return { recentExerciseIds: next.slice(0, 30) };
        }),

      setClubTrainingDays: (days) => set({ clubTrainingDays: days }),
      setMatchDays: (days) => set({ matchDays: days }),
      setAutoExternalEnabled: (enabled) => set({ autoExternalEnabled: Boolean(enabled) }),
    }),
    {
      name: "fks-external-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        externalLoads: s.externalLoads,
        completedRoutines: s.completedRoutines ?? [],
        favoriteExerciseIds: s.favoriteExerciseIds ?? [],
        recentExerciseIds: s.recentExerciseIds ?? [],
        clubTrainingDays: s.clubTrainingDays,
        matchDays: s.matchDays,
        matchDay: s.matchDay ?? null,
        autoExternalEnabled: s.autoExternalEnabled ?? true,
        autoExternalConfig: s.autoExternalConfig,
      }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as ExternalState,
    }
  )
);

export const getExternalDefaults = baseExternalState;
