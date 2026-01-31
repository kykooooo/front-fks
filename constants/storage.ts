// constants/storage.ts
// Centralized AsyncStorage keys to avoid typos and improve maintainability

export const STORAGE_KEYS = {
  // Test data
  TESTS_V1: "fks_tests_v1",

  // Offline queue
  OFFLINE_QUEUE: "fks_offline_queue",

  // Onboarding
  ONBOARDING_DONE: "fks_onboarding_done",

  // Training store per-user snapshots
  TRAINING_SNAPSHOT: (uid: string) => `training-store-snapshot-${uid}`,
} as const;
