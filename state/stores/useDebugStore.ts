// state/stores/useDebugStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEV_FLAGS } from "../../config/devFlags";
import { todayISO } from "../../utils/virtualClock";
import type { DebugState } from "./types";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

const baseDebugState = () => ({
  debugLog: [] as DebugState["debugLog"],
  devNowISO: (DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? todayISO() : null) as string | null,
});

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      ...baseDebugState(),

      clearDebugLog: () => set({ debugLog: [] }),

      pushDebugEvent: (evt) =>
        set((s) => ({ debugLog: [evt, ...s.debugLog].slice(0, 200) })),

      setDevNowISO: (iso) => set({ devNowISO: iso }),

      runTestHarness: () => {
        // Stub: the real implementation is in the orchestrator (applyTestHarness)
        // because it needs cross-store access.
      },
    }),
    {
      name: "fks-debug-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        debugLog: s.debugLog ?? [],
        devNowISO: s.devNowISO,
      }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as DebugState,
    }
  )
);

export const getDebugDefaults = baseDebugState;
