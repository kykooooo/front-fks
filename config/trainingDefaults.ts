// config/trainingDefaults.ts
export const TRAINING_DEFAULTS = {
    CTL0: 15,                 // “forme” de départ
    ATL0: 12,                 // “fatigue” de départ (plus bas que CTL)
    ONBOARDING_SESSIONS: 3,   // nb de séances protégées au début
    TSB_FLOOR_ONBOARDING: -10, // plancher TSB pendant l’onboarding
  };
  // config/trainingDefaults.ts
export const LOAD_CAPS = {
  sessionsDay: 180, // cap tanh pour la part FKS (prépa)
  externDay: 230,   // cap tanh pour la part externe (club/match)
  totalDay: 320,    // cap tanh du total journalier (sécurité finale)
};

export const EXTERNAL_WEIGHTS = {
  match: 0.75,
  club: 0.65,
  other: 0.60,
};
