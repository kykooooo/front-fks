// state/stores/useLoadStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRAINING_DEFAULTS, getTauForLevel } from "../../config/trainingDefaults";
import { todayISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { addDaysISO } from "../../utils/virtualClock";
import { decayLoadOverDays } from "../../engine/loadModel";
/** CTL resilience factor (0..1) */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const computeResilience = (ctl: number) => clamp01(ctl / 100);
import { useDebugStore } from "./useDebugStore";
import { useExternalStore } from "./useExternalStore";
import type { LoadState } from "./types";
import { useSessionsStore } from "./useSessionsStore";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

const baseLoadState = () => ({
  atl: TRAINING_DEFAULTS.ATL0,
  ctl: TRAINING_DEFAULTS.CTL0,
  tsb: TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0,
  tsbHistory: [] as number[],
  lastRpe: null as number | null,
  lastUpdateISO: null as string | null,
  lastLoadDayKey: null as string | null,
  dailyApplied: {} as Record<string, number>,
  ignoreFatigueCap: false,
  lastAppliedDate: null as string | null,
  nextAllowedDateISO: null as string | null,
});

export const useLoadStore = create<LoadState>()(
  persist(
    (set, get) => ({
      ...baseLoadState(),

      setManualLoad: (atl, ctl, tsb) =>
        set(() => {
          const devNowISO = useDebugStore.getState().devNowISO;
          const dayKey = toDateKey(devNowISO ?? todayISO());
          return {
            atl,
            ctl,
            tsb,
            lastUpdateISO: new Date().toISOString(),
            lastLoadDayKey: dayKey,
            tsbHistory: [tsb, ...(get().tsbHistory ?? [])].slice(0, 7),
          };
        }),

      resetLoadMetrics: () =>
        set(() => {
          const devNowISO = useDebugStore.getState().devNowISO;
          const dayKey = toDateKey(devNowISO ?? todayISO());
          const tsb0 = TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0;
          return {
            atl: TRAINING_DEFAULTS.ATL0,
            ctl: TRAINING_DEFAULTS.CTL0,
            tsb: tsb0,
            tsbHistory: [tsb0],
            dailyApplied: {},
            lastRpe: null,
            lastUpdateISO: new Date().toISOString(),
            lastLoadDayKey: dayKey,
          };
        }),

      setIgnoreFatigueCap: (enabled) => set({ ignoreFatigueCap: Boolean(enabled) }),

      getResilience: () => computeResilience(get().ctl),

      computeLoadDeltas: () => ({ atlDelta: 0, ctlDelta: 0 }),

      advanceDays: (n) => {
        if (!Number.isFinite(n) || n <= 0) return;
        const { atl, ctl, lastLoadDayKey } = get();
        const devNowISO = useDebugStore.getState().devNowISO;
        const { tauAtl, tauCtl } = getTauForLevel(useSessionsStore.getState().playerLevel);
        const decayed = decayLoadOverDays(atl, ctl, n, { tauAtl, tauCtl });
        const newDevISO = devNowISO ? addDaysISO(devNowISO, n) : devNowISO;

        const baseKey = lastLoadDayKey ?? toDateKey(devNowISO ?? todayISO());
        const baseISO = `${baseKey}T00:00:00.000Z`;
        const newKey = addDaysISO(baseISO, n).slice(0, 10);

        set({
          atl: decayed.atl,
          ctl: decayed.ctl,
          tsb: decayed.tsb,
          lastUpdateISO: new Date().toISOString(),
          lastLoadDayKey: newKey,
          tsbHistory: [decayed.tsb, ...(get().tsbHistory ?? [])].slice(0, 7),
        });

        if (newDevISO) {
          useDebugStore.setState({ devNowISO: newDevISO });
        }

        // Auto-external loads for skipped days
        const dayKeys: string[] = [];
        for (let i = 1; i <= n; i++) dayKeys.push(addDaysISO(baseISO, i).slice(0, 10));
        // Deferred: orchestrators.applyAutoExternalLoads would handle this
      },

      restUntil: (days) => {
        const devNowISO = useDebugStore.getState().devNowISO;
        const baseISO = devNowISO ?? new Date().toISOString();
        const target = addDaysISO(baseISO, Math.max(0, Math.floor(days)));
        set({ nextAllowedDateISO: target });
      },
    }),
    {
      name: "fks-load-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        atl: s.atl,
        ctl: s.ctl,
        tsb: s.tsb,
        tsbHistory: s.tsbHistory,
        lastRpe: s.lastRpe,
        lastUpdateISO: s.lastUpdateISO,
        lastLoadDayKey: s.lastLoadDayKey,
        dailyApplied: s.dailyApplied,
        ignoreFatigueCap: s.ignoreFatigueCap ?? false,
        lastAppliedDate: s.lastAppliedDate ?? null,
        nextAllowedDateISO: s.nextAllowedDateISO ?? null,
      }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as LoadState,
    }
  )
);

export const getLoadDefaults = baseLoadState;
