// constants/feedback.ts

// Bornes et seuils utilisés par le moteur M3 (feedback adaptatif)
// Unification pain 0-10 (EVA médicale) — voir INJURY_IA_CHARTER.md règle 5.
export const FEEDBACK_LIMITS = {
    fatigueMin: 1,
    fatigueMax: 5,
    painMin: 0,
    painMax: 10,         // EVA 0..10 (était 0..5, aligné avec Rating0to10)
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

  // Seuils de douleur (impact faible, expérimental).
  // smallEffectFrom = 6/10 (milieu de l'échelle EVA).
  //   - À partir de 6, applique une petite réduction progressive.
  //   - À pain=10 (max), reduction atteint maxReduction (5%).
  // Rescalage depuis l'ancienne valeur 3/5 (identiquement "à partir du milieu").
  export const PAIN_THRESHOLDS = {
    smallEffectFrom: 6, // à partir de 6, appliquer une petite réduction
    maxReduction: 0.05, // 5% max
  } as const;
  
  // EMA pour la fatigue perçue (lissage sur court terme)
  export const EMA_CONFIG = {
    alpha: 0.5, // pondération dernière entrée
    seed: 3,    // valeur neutre de départ (entre 1 et 5)
  } as const;
  