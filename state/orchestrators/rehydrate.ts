// state/orchestrators/rehydrate.ts
// Post-hydration time-decay: applies load decay for days elapsed since last update.
// Also coordinates cross-store hydration: waits for all 6 stores to hydrate before running.
import { todayISO, addDaysISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { diffDays } from "../../engine/dailyAggregation";
import { decayLoadOverDays } from "../../engine/loadModel";
import { DEV_FLAGS } from "../../config/devFlags";

import { useLoadStore } from "../stores/useLoadStore";
import { useDebugStore } from "../stores/useDebugStore";
import { useSyncStore } from "../stores/useSyncStore";
import { applyAutoExternalLoads } from "./applyExternalLoad";

// ---------------------------------------------------------------------------
// Hydration coordination: wait for all 6 stores before running rehydrate
// ---------------------------------------------------------------------------
const TOTAL_STORES = 6;
let _hydrationCount = 0;
let _rehydrateOnce = false;

/**
 * Called by each store's onRehydrateStorage callback.
 * Once all 6 stores have hydrated, triggers rehydrateFromStorage() on next tick.
 */
export function onStoreHydrated(): void {
  _hydrationCount++;
  if (_hydrationCount < TOTAL_STORES) return;
  if (_rehydrateOnce) {
    // Already ran once — just set hydrated flag
    useSyncStore.setState({ storeHydrated: true, _rehydrating: false });
    return;
  }
  // Use setTimeout(0) to let all stores finish updating before we read
  setTimeout(() => {
    rehydrateFromStorage();
    _rehydrateOnce = true;
  }, 0);
}

// Safety timeout: if stores don't all hydrate within 10s, force storeHydrated=true
// so the app doesn't stay stuck on the loading spinner forever.
setTimeout(() => {
  if (!_rehydrateOnce && _hydrationCount < TOTAL_STORES) {
    if (__DEV__) console.warn(`[rehydrate] safety timeout: only ${_hydrationCount}/${TOTAL_STORES} stores hydrated`);
    useSyncStore.setState({ storeHydrated: true, _rehydrating: false });
    _rehydrateOnce = true;
  }
}, 10_000);

// ---------------------------------------------------------------------------
// Core rehydration logic
// ---------------------------------------------------------------------------
export function rehydrateFromStorage(): void {
  const sync = useSyncStore.getState();
  if (sync._rehydrating) return;
  useSyncStore.setState({ _rehydrating: true });

  try {
    const loadState = useLoadStore.getState();
    const debugState = useDebugStore.getState();

    // Reset virtual clock if not in dev mode
    if (!DEV_FLAGS.ENABLED || !DEV_FLAGS.VIRTUAL_CLOCK) {
      useDebugStore.setState({ devNowISO: null });
    }

    const lastKey = loadState.lastLoadDayKey ?? (loadState.lastUpdateISO ? toDateKey(loadState.lastUpdateISO) : null);
    const nowISO = debugState.devNowISO ?? todayISO();
    const nowKey = toDateKey(nowISO);

    if (!lastKey) {
      useLoadStore.setState({
        tsb: loadState.ctl - loadState.atl,
        lastUpdateISO: nowISO,
        lastLoadDayKey: nowKey,
        tsbHistory: [loadState.ctl - loadState.atl],
      });
      useSyncStore.setState({ storeHydrated: true, _rehydrating: false });
      return;
    }

    let gapDays = Math.max(0, diffDays(lastKey, nowKey));
    if (gapDays > 14) gapDays = 14;

    if (gapDays > 0) {
      const decayed = decayLoadOverDays(loadState.atl, loadState.ctl, gapDays);
      useLoadStore.setState({
        atl: decayed.atl,
        ctl: decayed.ctl,
        tsb: decayed.tsb,
        lastUpdateISO: nowISO,
        lastLoadDayKey: nowKey,
        tsbHistory: [decayed.tsb, ...(loadState.tsbHistory ?? [])].slice(0, 7),
      });
    } else {
      useLoadStore.setState({
        tsb: loadState.ctl - loadState.atl,
        lastUpdateISO: nowISO,
        lastLoadDayKey: loadState.lastLoadDayKey ?? nowKey,
        tsbHistory: [loadState.ctl - loadState.atl, ...(loadState.tsbHistory ?? [])].slice(0, 7),
      });
    }

    // Auto-external loads for recent 7 days
    const recentKeys = Array.from({ length: 7 }).map((_, i) =>
      addDaysISO(`${nowKey}T00:00:00.000Z`, -i).slice(0, 10)
    );
    applyAutoExternalLoads(recentKeys);
  } finally {
    useSyncStore.setState({ storeHydrated: true, _rehydrating: false });
  }
}
