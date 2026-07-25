// domain/tracking/config.ts
// Tous les seuils de la boucle de suivi. Aucune valeur magique ailleurs :
// signals.ts, rulesEngine.ts, execution.ts, resumption.ts et apply.ts lisent
// exclusivement cet objet. Voir docs/boucle-suivi-2026-07-25/REGLES_AJUSTEMENT.md
// pour la justification de chaque seuil (doctrine : securite d'abord, jamais
// de ML, deterministe et versionne).

export const TRACKING_CONFIG = {
  // Bump de version obligatoire a chaque changement de seuil ou d'ordre des
  // regles -- embarque dans chaque TrackingDecision stockee (audit/traçabilite).
  rulesVersion: "tracking-rules/1.0.0",

  // Fenetre d'analyse des signaux : au plus 5 seances ET au plus 28 jours
  // (le plus restrictif des deux s'applique cote signals.ts).
  window: { sessions: 5, days: 28 },

  completion: {
    fullPct: 90, // pct >= 90 -> seance "full"
    partialPct: 40, // pct >= 40 -> "partial", sinon "abandoned"
    // Poids par statut d'item pour le calcul du pct de completion (execution.ts).
    doneWeight: 1,
    adaptedWeight: 1,
    replacedEquivalentWeight: 1, // remplacement a equivalence sportive validee = comme fait
    replacedPartialWeight: 0.5, // remplacement sans equivalence complete = moitie
    skippedWeight: 0,
  },

  rpe: {
    minSessionsForSignal: 3, // aligne le backend (>= 3 deltas RPE avant tout signal)
    highDelta: 2, // moyenne (rpe reel - rpe cible) >= +2 -> seance trop dure
    lowDelta: -2, // moyenne <= -2 -> marge, petit pas de progression possible
    streakTolerance: 1, // |rpe reel - rpe cible| > ce seuil -> casse la serie "ok" (computeStreakOkSessions)
  },

  // Bornes de plausibilite des donnees declaratives (feedback.durationMin).
  // Separe de rpe/pct ci-dessus qui restent des bornes d'ECHELLE fixes
  // (1-10, 0-100), pas des seuils metier ajustables.
  consistency: {
    maxPlausibleDurationMin: 240, // duree reelle declaree > 4h -> dataQuality "inconsistent"
    maxDurationRatio: 3, // ecretage du ratio duree reelle/prevue avant moyenne (durationRatioAvg)
  },

  // Nombre de seances comparables reussies requis avant d'autoriser un petit
  // pas de progression (jamais plus que ce que le plan backend prevoit deja).
  progression: { minStreakForSmallStep: 2 },

  // Meme exercice/famille marque "too_difficult" >= ce seuil -> suggest_variant.
  difficulty: { repeatThreshold: 2 },

  // Meme exercice remplace pour raison "equipment" >= ce seuil -> preference
  // durable (prefer_replacement) pour les prochaines seances.
  equipment: { durableThreshold: 2 },

  pain: {
    feedbackThreshold: 3, // echelle app 0-5 (>= 3 = douleur reelle, pas une gene mineure)
    windowDays: 7, // aligne collectActivePainConstraints (services/aiContext.ts)
  },

  resumption: {
    gapDaysSoft: 14, // >= 14 jours sans seance terminee -> reprise prudente (dose reduite)
    gapDaysHard: 28, // >= 28 jours -> recommandation fondations / reprise temporaire
    minCompletionForLastSession: 40, // une seance "abandoned" ne compte pas comme reprise d'activite
  },

  // Bornes du mode Application (OFF par defaut au pilote) -- jamais depassees,
  // le front ne demande jamais plus que le plan backend.
  apply: {
    volumeReductionFactor: 0.9, // reduction "legere" de volume -> available_time_min x 0.9
    neverIncreaseBeyondPlan: true, // garde-fou : jamais d'augmentation demandee cote front
  },
} as const;

export type TrackingConfig = typeof TRACKING_CONFIG;
