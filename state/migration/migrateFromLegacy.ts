// state/migration/migrateFromLegacy.ts
// One-time migration: splits the old "training-store" AsyncStorage key into 6 new per-store keys.
// This runs once at app startup before stores are created.
import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_KEY = "training-store";
const MIGRATION_FLAG = "fks-migration-v2-done";

function wrap(state: any, version: number) {
  return JSON.stringify({ state, version });
}

export async function migrateFromLegacyStore(): Promise<boolean> {
  try {
    // Already migrated?
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (flag === "1") return false;

    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) {
      // No legacy data — mark as done
      await AsyncStorage.setItem(MIGRATION_FLAG, "1");
      return false;
    }

    const parsed = JSON.parse(raw);
    const s = parsed?.state;
    if (!s) {
      await AsyncStorage.setItem(MIGRATION_FLAG, "1");
      return false;
    }

    // Split into 6 new keys
    await AsyncStorage.setItem("fks-load-v1", wrap({
      atl: s.atl,
      ctl: s.ctl,
      tsb: s.tsb,
      tsbHistory: s.tsbHistory,
      lastRpe: s.lastRpe,
      lastUpdateISO: s.lastUpdateISO,
      lastLoadDayKey: s.lastLoadDayKey,
      dailyApplied: s.dailyApplied,
      ignoreFatigueCap: s.ignoreFatigueCap,
      lastAppliedDate: s.lastAppliedDate,
      nextAllowedDateISO: s.nextAllowedDateISO,
    }, 1));

    await AsyncStorage.setItem("fks-sessions-v1", wrap({
      sessions: s.sessions,
      phase: s.phase,
      phaseCount: s.phaseCount,
      weekly: s.weekly,
      microcycleGoal: s.microcycleGoal,
      microcycleSessionIndex: s.microcycleSessionIndex,
      microcycleAppliedSessionIds: s.microcycleAppliedSessionIds,
      activePathwayId: s.activePathwayId,
      activePathwayIndex: s.activePathwayIndex,
      lastAiSessionV2: s.lastAiSessionV2,
      lastAiContext: s.lastAiContext,
    }, 1));

    await AsyncStorage.setItem("fks-feedback-v1", wrap({
      dayStates: s.dayStates,
    }, 1));

    await AsyncStorage.setItem("fks-external-v1", wrap({
      externalLoads: s.externalLoads,
      completedRoutines: s.completedRoutines,
      favoriteExerciseIds: s.favoriteExerciseIds,
      recentExerciseIds: s.recentExerciseIds,
      clubTrainingDays: s.clubTrainingDays,
      matchDays: s.matchDays,
      matchDay: s.matchDay,
      autoExternalEnabled: s.autoExternalEnabled,
      autoExternalConfig: s.autoExternalConfig,
    }, 1));

    await AsyncStorage.setItem("fks-sync-v1", wrap({
      _currentUid: s._currentUid,
      plannedFksDays: s.plannedFksDays,
    }, 1));

    await AsyncStorage.setItem("fks-debug-v1", wrap({
      debugLog: s.debugLog,
      devNowISO: s.devNowISO,
    }, 1));

    // Mark as done (keep legacy key as backup)
    await AsyncStorage.setItem(MIGRATION_FLAG, "1");
    return true;
  } catch (err) {
    // Log in dev + report to Sentry in production (migration will retry next startup)
    if (__DEV__) console.warn("[migrateFromLegacy] error:", err);
    try {
      const { captureException } = require("@sentry/react-native");
      captureException(err);
    } catch (_) { /* Sentry not available */ }
    return false;
  }
}
