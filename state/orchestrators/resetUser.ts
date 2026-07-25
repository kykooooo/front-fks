// state/orchestrators/resetUser.ts
// Cross-cutting orchestrator: resets all 7 stores when switching users
// (6 original + useExecutionStore, boucle de suivi Lot 4 -- reliquat assume du Lot 1).
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useLoadStore, getLoadDefaults } from "../stores/useLoadStore";
import { useSessionsStore, getSessionsDefaults } from "../stores/useSessionsStore";
import { useFeedbackStore, getFeedbackDefaults } from "../stores/useFeedbackStore";
import { useExternalStore, getExternalDefaults } from "../stores/useExternalStore";
import { useSyncStore, getSyncDefaults, deactivateListeners, reactivateListeners, resetWatchGuard, cleanupAllListeners } from "../stores/useSyncStore";
import { useDebugStore, getDebugDefaults } from "../stores/useDebugStore";
import { useExecutionStore, getExecutionDefaults } from "../stores/useExecutionStore";

const SNAPSHOT_PREFIX = "fks-snapshot-v2-";

type AllStoresSnapshot = {
  load: Partial<ReturnType<typeof getLoadDefaults>>;
  sessions: Partial<ReturnType<typeof getSessionsDefaults>>;
  feedback: Partial<ReturnType<typeof getFeedbackDefaults>>;
  external: Partial<ReturnType<typeof getExternalDefaults>>;
  debug: Partial<ReturnType<typeof getDebugDefaults>>;
  sync: { plannedFksDays?: string[] };
  // Boucle de suivi (Lot 4, reliquat assume du Lot 1) : execution en cours +
  // historique local + preferences de remplacement + derniere decision shadow
  // suivent le MEME pattern snapshot/reset que les 6 autres stores ci-dessus.
  execution: Partial<ReturnType<typeof getExecutionDefaults>>;
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
        "clubTrainingDays", "matchDays", "matchDay", "autoExternalEnabled", "autoExternalConfig", "ageCategory",
        "gymEquipment", "homeEquipment", "hasGymAccess",
      ]),
      debug: extractData(useDebugStore.getState(), ["debugLog", "devNowISO"]),
      sync: { plannedFksDays: useSyncStore.getState().plannedFksDays },
      execution: extractData(useExecutionStore.getState(), [
        "current", "history", "replacementPreferences", "lastDecision",
      ]),
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

// ─── AUDIT P0-2 : sérialisation des resets ──────────────────────────────────
// resetForUser n'était pas sérialisé : l'appel n°1 (null, "logout") pouvait se
// garer sur `await saveSnapshot` AVANT d'avoir écrit `_currentUid = null` ; si
// l'auth résolvait dans cette fenêtre, l'appel n°2 (uid) lisait encore
// `_currentUid === uid` → early return → la restauration n'arrivait jamais et
// l'appel n°1 finissait le wipe (stores vidés, snapshot intact, utilisateur
// pourtant connecté — observé en live sur la preview web).
// Chaque appel attend désormais la fin du précédent et RELIT `_currentUid` au
// moment où il démarre réellement : la décision early-return/wipe/restore se
// prend toujours sur un état à jour.
let _resetQueue: Promise<void> = Promise.resolve();

export function resetForUser(uid: string | null): Promise<void> {
  const run = _resetQueue.then(() => performResetForUser(uid));
  // La file survit aux échecs : un reset qui rejette ne doit pas bloquer les suivants.
  _resetQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function performResetForUser(uid: string | null): Promise<void> {
  // Relecture au démarrage réel (après la fin du reset précédent, cf. file ci-dessus).
  const sync = useSyncStore.getState();
  if (sync._rehydrating) return;
  if (sync._currentUid === uid) return;
  const prevUid = sync._currentUid;

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
  if (prevUid) {
    await saveSnapshot(prevUid);
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
  useExecutionStore.setState({ ...getExecutionDefaults(), ...(restored?.execution ?? {}) });
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

  // 7. Relance la watch Firestore si un utilisateur est connecté. Le reset a
  // tué tous les listeners (cleanupAllListeners) ; une watch démarrée PENDANT
  // le reset (effets RootNavigator/HomeScreen, qui ne re-déclenchent pas après
  // coup) resterait morte sinon. Pendant la fenêtre deactivate→reactivate, les
  // snapshots en vol sont jetés (_active === false) : acceptable, car les
  // listeners sont désabonnés dès l'étape 2 et la re-souscription ci-dessous
  // re-livre TOUJOURS l'état complet (onSnapshot émet l'état initial).
  // startFirestoreWatch est idempotent (_watchGuard).
  if (uid) {
    useSyncStore.getState().startFirestoreWatch();
  }
}
