// constants/storage.ts
// Centralized AsyncStorage keys to avoid typos and improve maintainability

export const STORAGE_KEYS = {
  // Test data
  TESTS_V1: "fks_tests_v1",

  // Offline queue
  OFFLINE_QUEUE: "fks_offline_queue",

  // Onboarding
  WELCOME_DONE: "fks_welcome_done",
  // Timestamp (ms) posé au register_success, consommé par first_session_generated
  // pour mesurer le temps bout-en-bout jusqu'à la première séance.
  ONBOARDING_START_TS: "fks_onboarding_start_ts",

  // Training store per-user snapshots
  TRAINING_SNAPSHOT: (uid: string) => `training-store-snapshot-${uid}`,

  // ── CLÉS HÉRITÉES DE L'ANCIEN ESPACE CLUB / COACH (retiré en 2026-09) ──
  // Plus AUCUN code ne les lit ni ne les écrit : elles ne peuvent donc plus
  // rediriger vers un écran retiré. Elles restent nommées ici pour UNE raison :
  // les purger (déconnexion / suppression de compte — cf.
  // services/accountDeletionHelpers.localAccountKeysToPurge et
  // navigation/RootNavigator) sur les téléphones où une ancienne version les a
  // écrites. Ne pas les réutiliser pour autre chose.
  LEGACY_COACH_INTENT: "fks_coach_intent",
  LEGACY_APP_SPACE_PREFERENCE: (uid: string) => `fks_app_space_${uid}`,
  LEGACY_CLUB_CREATION_ID: (uid: string) => `fks_club_creation_${uid}`,
  LEGACY_COACH_ROSTER_SIZE: (uid: string) => `fks_coach_roster_size_${uid}`,
} as const;
