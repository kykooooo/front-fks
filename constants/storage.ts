// constants/storage.ts
// Centralized AsyncStorage keys to avoid typos and improve maintainability

export const STORAGE_KEYS = {
  // Test data
  TESTS_V1: "fks_tests_v1",

  // Offline queue
  OFFLINE_QUEUE: "fks_offline_queue",

  // Onboarding
  WELCOME_DONE: "fks_welcome_done",
  // Intention « je suis coach », déclarée AVANT qu'un compte existe (accueil,
  // connexion, inscription). Elle choisit l'écran d'ARRIVÉE quand le profil
  // n'est pas encore rempli — création de club plutôt que questionnaire joueur —
  // et RIEN D'AUTRE : elle n'accorde aucun droit, l'espace coach restant dérivé
  // de l'appartenance `clubs/{clubId}/members/{uid}` (domain/appSpace.ts).
  //
  // POURQUOI PERSISTÉE (audit inscription 2026-09, P1-02) : en mémoire React,
  // elle mourait dès que l'app était tuée entre l'inscription et la création du
  // club — et l'écran d'accueil qui la posait est INATTEIGNABLE au relancement
  // (`WELCOME_DONE` déjà vrai). Le coach retombait sur les 4 étapes du
  // questionnaire joueur. Voir services/coachIntent.ts.
  COACH_INTENT: "fks_coach_intent",
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

  // RÉSERVATION de création de club : l'identifiant retenu avant la première
  // écriture, ET la dernière écriture réussie. JSON `{ clubId, etape }` —
  // cf. services/reservationClub. PAR COMPTE : sans l'uid, deux comptes sur le
  // même téléphone se disputeraient la même réservation.
  //
  // POURQUOI (audit inscription 2026-09, P1-03) : la création enchaîne trois
  // écritures que les règles Firestore INTERDISENT de grouper en `writeBatch`
  // (l'appartenance propriétaire doit exister AVANT `users/{uid}.clubId` —
  // firestore.rules:429-434). Sans identifiant réservé, chaque réessai après un
  // timeout créait un club de plus.
  //
  // POURQUOI L'ÉTAPE EN PLUS (R2, 05/09) : réécrire un club déjà écrit est une
  // UPDATE, que les règles n'acceptent que d'un propriétaire déjà membre
  // (`firestore.rules:783`). Sans la progression, le réessai après un timeout
  // survenu entre les écritures 1 et 2 était refusé À CHAQUE FOIS — le coach
  // était bloqué à vie sur son compte. Une valeur écrite par l'ancien format
  // (identifiant nu) est relue comme « étape 0 ». Effacée au succès.
  CLUB_CREATION_ID: (uid: string) => `fks_club_creation_${uid}`,
} as const;
