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

  // Dernier espace utilisé (Joueur / Coach) pour les comptes qui ont RÉELLEMENT
  // les deux — un entraîneur-joueur. PAR COMPTE : une préférence globale
  // ferait hériter le choix d'un compte au suivant sur un téléphone partagé.
  //
  // Cette clé ne DONNE aucun accès. Elle ne fait que choisir entre deux espaces
  // déjà autorisés par le serveur (cf. domain/appSpace.resolveAppSpace) : la
  // falsifier ne peut ouvrir aucun écran, seulement changer lequel des deux
  // s'ouvre en premier. Elle est effacée avec le compte
  // (services/accountDeletionHelpers.localAccountKeysToPurge).
  APP_SPACE_PREFERENCE: (uid: string) => `fks_app_space_${uid}`,
} as const;
