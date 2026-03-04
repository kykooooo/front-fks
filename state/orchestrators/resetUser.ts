// state/orchestrators/resetUser.ts
// Cross-cutting orchestrator: resets all 6 stores when switching users.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useLoadStore, getLoadDefaults } from "../stores/useLoadStore";
import { useSessionsStore, getSessionsDefaults } from "../stores/useSessionsStore";
import { useFeedbackStore, getFeedbackDefaults } from "../stores/useFeedbackStore";
import { useExternalStore, getExternalDefaults } from "../stores/useExternalStore";
import { useSyncStore, getSyncDefaults, deactivateListeners, reactivateListeners, resetWatchGuard, cleanupAllListeners } from "../stores/useSyncStore";
import { useDebugStore, getDebugDefaults } from "../stores/useDebugStore";

const SNAPSHOT_PREFIX = "fks-snapshot-v2-";

type AllStoresSnapshot = {
  load: Partial<ReturnType<typeof getLoadDefaults>>;
  sessions: Partial<ReturnType<typeof getSessionsDefaults>>;
  feedback: Partial<ReturnType<typeof getFeedbackDefaults>>;
  external: Partial<ReturnType<typeof getExternalDefaults>>;
  debug: Partial<ReturnType<typeof getDebugDefaults>>;
  sync: { plannedFksDays?: string[] };
};

async function saveSnapshot(uid: string): Promise<void> {
  try {
    const snapshot: AllStoresSnapshot = {
      load: extractData(useLoadStore.getState(), [
        "atl", "ctl", "tsb", "tsbHistory", "lastRpe", "lastUpdateISO",
        "lastLoadDayKey", "dailyApplied", "ignoreFatigueCap", "lastAppliedDate", "nextAllowedDateISO",
      ]),
      sessions: extractData(useSessionsStore.getState(), [
        "sessions", "phase", "phaseCount", "weekly", "microcycleGoal", "microcycleSessionIndex",
        "microcycleAppliedSessionIds", "activePathwayId", "activePathwayIndex", "lastAiSessionV2", "lastAiContext",
      ]),
      feedback: extractData(useFeedbackStore.getState(), ["dayStates"]),
      external: extractData(useExternalStore.getState(), [
        "externalLoads", "completedRoutines", "favoriteExerciseIds", "recentExerciseIds",
        "clubTrainingDays", "matchDays", "matchDay", "autoExternalEnabled", "autoExternalConfig",
      ]),
      debug: extractData(useDebugStore.getState(), ["debugLog", "devNowISO"]),
      sync: { plannedFksDays: useSyncStore.getState().plannedFksDays },
    };
    await AsyncStorage.setItem(`${SNAPSHOT_PREFIX}${uid}`, JSON.stringify(snapshot));
  } catch {
    // Best effort
  }
}

async function loadSnapshot(uid: string): Promise<AllStoresSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SNAPSHOT_PREFIX}${uid}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractData<T extends Record<string, unknown>>(state: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (k in state) out[k] = state[k];
  }
  return out;
}

export async function resetForUser(uid: string | null): Promise<void> {
  const sync = useSyncStore.getState();
  if (sync._rehydrating) return;
  if (sync._currentUid === uid) return;

  // 1. Deactivate listeners
  deactivateListeners();

  // 2. Unsubscribe all Firestore listeners (module-level Map — race-proof)
  cleanupAllListeners();
  resetWatchGuard();

  useSyncStore.setState({
    _unsubSessions: undefined,
    _unsubPlanned: undefined,
    _unsubProfile: undefined,
    _unsubAuth: undefined,
  });

  // 3. Save current user's snapshot
  if (sync._currentUid) {
    await saveSnapshot(sync._currentUid);
  }

  // 4. Load new user's snapshot
  let restored: AllStoresSnapshot | null = null;
  if (uid) {
    restored = await loadSnapshot(uid);
  }

  // 5. Reset all stores
  useLoadStore.setState({ ...getLoadDefaults(), ...(restored?.load ?? {}) });
  useSessionsStore.setState({ ...getSessionsDefaults(), ...(restored?.sessions ?? {}) });
  useFeedbackStore.setState({ ...getFeedbackDefaults(), ...(restored?.feedback ?? {}) });
  useExternalStore.setState({ ...getExternalDefaults(), ...(restored?.external ?? {}) });
  useDebugStore.setState({ ...getDebugDefaults(), ...(restored?.debug ?? {}) });
  useSyncStore.setState({
    ...getSyncDefaults(),
    ...(restored?.sync ?? {}),
    _currentUid: uid ?? null,
    storeHydrated: true,
    _rehydrating: false,
    _unsubSessions: undefined,
    _unsubPlanned: undefined,
    _unsubProfile: undefined,
    _unsubAuth: undefined,
  });

  // 6. Reactivate listeners
  reactivateListeners();
}
