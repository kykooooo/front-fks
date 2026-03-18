// state/orchestrators/rehydrate.ts
// Post-hydration: rebuilds ATL/CTL/TSB from cached session history on app mount.
// Also coordinates cross-store hydration: waits for all 6 stores to hydrate before running.
import { todayISO, addDaysISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { DEV_FLAGS } from "../../config/devFlags";

import { useDebugStore } from "../stores/useDebugStore";
import { useSyncStore } from "../stores/useSyncStore";
import { applyAutoExternalLoads } from "./applyExternalLoad";
import { rebuildLoad } from "./rebuildLoad";

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
    const debugState = useDebugStore.getState();

    // Reset virtual clock if not in dev mode
    if (!DEV_FLAGS.ENABLED || !DEV_FLAGS.VIRTUAL_CLOCK) {
      useDebugStore.setState({ devNowISO: null });
    }

    const nowISO = debugState.devNowISO ?? todayISO();
    const nowKey = toDateKey(nowISO);

    // Auto-external loads for recent 7 days (club/match)
    const recentKeys = Array.from({ length: 7 }).map((_, i) =>
      addDaysISO(`${nowKey}T00:00:00.000Z`, -i).slice(0, 10)
    );
    applyAutoExternalLoads(recentKeys);

    // Full rebuild from cached session + external history.
    // This correctly decays ATL/CTL for every rest day (load=0) between
    // sessions and from the last session to today, fixing the stale-TSB bug
    // where a player returning after days of rest still saw "Chargé".
    rebuildLoad();
  } finally {
    useSyncStore.setState({ storeHydrated: true, _rehydrating: false });
  }
}
