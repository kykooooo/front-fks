export const FEEDBACK_NORM = {
    windowDays: 14,               // historique perso
    emaAlpha: 0.3,                // lissage des critères
    zClip: 1.5,                   // limite d'écart (robuste)
    rMin: 0.2, rMax: 1.0,         // bornes fiabilité
    rpeAdjustMin: 0.8,            // -20%
    rpeAdjustMax: 1.2,            // +20%
  };
  