// prototype/home-vnext/lib/stubs/scenarioState.js
// =============================================================================
// ETAT FICTIF PARTAGE PAR TOUS LES STUBS DE STORE
// =============================================================================
// Le moteur de rendu appelle `setState()` avant chaque rendu. Les hooks de store
// du projet sont des FONCTIONS A SELECTEUR (`useLoadStore((s) => s.tsb)`) : on
// applique donc le selecteur sur la tranche d'etat courante.
//
// AUCUNE de ces valeurs ne vient d'un compte reel. Aucun acces reseau.
// =============================================================================
"use strict";

const noop = () => {};

const DEFAULT = {
  // --- meta harnais (ce ne sont pas des stores) ---
  displayName: "joueur",
  offline: false,

  // --- useLoadStore ---
  load: {
    atl: 0,
    ctl: 0,
    tsb: 0,
    tsbHistory: [],
    lastRpe: null,
    lastUpdateISO: null,
    lastLoadDayKey: null,
    dailyApplied: {},
    ignoreFatigueCap: false,
    lastAppliedDate: null,
    nextAllowedDateISO: null,
    setManualLoad: noop,
    resetLoadMetrics: noop,
    setIgnoreFatigueCap: noop,
    getResilience: () => 1,
    computeLoadDeltas: () => ({ atlDelta: 0, ctlDelta: 0 }),
    advanceDays: noop,
    restUntil: noop,
  },

  // --- useSessionsStore ---
  sessions: {
    sessions: [],
    phase: "Playlist",
    phaseCount: 0,
    weekly: {},
    microcycleGoal: null,
    microcycleSessionIndex: 0,
    microcycleAppliedSessionIds: [],
    activePathwayId: null,
    activePathwayIndex: 0,
    lastAiSessionV2: null,
    lastAiContext: null,
    pushSession: noop,
    setPhase: noop,
    updateWeekly: noop,
    getSessionById: () => undefined,
    latestSessionId: () => undefined,
    setMicrocycleGoal: noop,
    setMicrocycleSessionIndex: noop,
    setActivePathway: noop,
    setLastAiContext: noop,
    setLastAiSessionV2: noop,
    completeSession: () => null,
  },

  // --- useExternalStore ---
  external: {
    externalLoads: [],
    completedRoutines: [],
    favoriteExerciseIds: [],
    recentExerciseIds: [],
    clubTrainingDays: [],
    matchDays: [],
    matchDay: null,
    clubTrainingsPerWeek: null,
    matchesPerWeek: null,
    targetFksSessionsPerWeek: null,
    autoExternalEnabled: true,
    autoExternalConfig: {},
    ageCategory: null,
    gymEquipment: [],
    homeEquipment: [],
    hasGymAccess: null,
    addCompletedRoutine: noop,
    toggleFavoriteExercise: noop,
    addRecentExercise: noop,
    setClubTrainingDays: noop,
    setMatchDays: noop,
    setAutoExternalEnabled: noop,
  },

  // --- useSyncStore ---
  sync: {
    storeHydrated: true,
    _rehydrating: false,
    _currentUid: "harnais-uid",
    plannedFksDays: [],
    startFirestoreWatch: noop,
    persistCompletedSession: async () => {},
    persistPlannedSession: async () => {},
    resetForUser: noop,
    togglePlannedFksDay: noop,
    clearPlannedFksDays: noop,
    setPlannedFksDays: noop,
  },

  // --- useDebugStore ---
  debug: {
    debugLog: [],
    devNowISO: null,
    clearDebugLog: noop,
    pushDebugEvent: noop,
    setDevNowISO: noop,
    runTestHarness: noop,
  },

  // --- useFeedbackStore ---
  feedback: {
    dayStates: {},
    getPrevFatigueSmoothed: () => null,
    setDailyFeedback: noop,
    setInjury: noop,
    getAdaptiveFactorsForDate: () => null,
  },

  // --- useSettingsStore ---
  settings: {
    notificationsEnabled: true,
    sessionReminders: true,
    reminderStrategy: "prev_evening",
    soundsEnabled: true,
    hapticsEnabled: true,
    autoFeedbackEnabled: true,
    privacyAnalytics: true,
    privateMode: false,
    distanceUnit: "km",
    weightUnit: "kg",
    weekStart: "mon",
    themeMode: "light",
    weeklyGoal: 2,
    _hydrated: true,
    updateSettings: noop,
    resetSettings: noop,
  },
};

let current = DEFAULT;

/** Fusionne un patch de scenario sur le socle par defaut (deux niveaux). */
function setState(patch) {
  const next = {};
  for (const key of Object.keys(DEFAULT)) {
    const base = DEFAULT[key];
    if (base && typeof base === "object" && !Array.isArray(base)) {
      next[key] = { ...base, ...((patch && patch[key]) || {}) };
    } else {
      next[key] = patch && key in patch ? patch[key] : base;
    }
  }
  for (const key of Object.keys(patch || {})) {
    if (!(key in next)) next[key] = patch[key];
  }
  current = next;
  return current;
}

function getState() {
  return current;
}

/**
 * Fabrique un hook facon zustand : accepte un selecteur, l'applique sur la
 * tranche demandee. Expose aussi getState / setState / subscribe.
 */
function makeHook(sliceName) {
  const hook = (selector) => {
    const slice = current[sliceName];
    return typeof selector === "function" ? selector(slice) : slice;
  };
  hook.getState = () => current[sliceName];
  hook.setState = (patch) => {
    current[sliceName] = {
      ...current[sliceName],
      ...(typeof patch === "function" ? patch(current[sliceName]) : patch),
    };
  };
  hook.subscribe = () => () => {};
  hook.destroy = () => {};
  return hook;
}

module.exports = { DEFAULT, setState, getState, makeHook };
