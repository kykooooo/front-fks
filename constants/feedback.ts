// constants/feedback.ts

// Bornes et seuils utilisés par le moteur M3 (feedback adaptatif)
export const FEEDBACK_LIMITS = {
    fatigueMin: 1,
    fatigueMax: 5,
    painMin: 0,
    painMax: 5,
    recoveryMin: 1,
    recoveryMax: 5,
  } as const;
  
  // Impact borné (conservateur, public semi-pro/amateur)
  export const FACTOR_BOUNDS = {
    fatigueMinFactor: 0.92, // -8%
    fatigueMaxFactor: 1.08, // +8%
    painMinFactor: 0.95,    // -5% max
    painNeutral: 1.0,
  } as const;
  
  // Seuils de douleur (impact faible, expérimental)
  export const PAIN_THRESHOLDS = {
    smallEffectFrom: 3, // à partir de 3, appliquer une petite réduction
    maxReduction: 0.05, // 5% max
  } as const;
  
  // EMA pour la fatigue perçue (lissage sur court terme)
  export const EMA_CONFIG = {
    alpha: 0.5, // pondération dernière entrée
    seed: 3,    // valeur neutre de départ (entre 1 et 5)
  } as const;
  