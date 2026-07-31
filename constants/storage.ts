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
} as const;
