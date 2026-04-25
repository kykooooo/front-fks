// config/trainingDefaults.ts
// ===========================================================================
// FKS TRAINING LOAD MODEL v2.0
// ===========================================================================
// Basé sur le modèle PMC (Performance Management Chart) de Banister
// Adapté pour footballeurs amateurs/semi-pro avec :
// - Constantes de temps plus courtes (récupération plus rapide)
// - Guards pour protéger les jours club/match
// - Caps progressifs pour éviter les pics de charge
// ===========================================================================

export const TRAINING_DEFAULTS = {
  // Valeurs initiales (joueur "moyennement entraîné")
  CTL0: 15,                   // Chronic Training Load de départ (forme/fitness)
  ATL0: 12,                   // Acute Training Load de départ (fatigue)
  // → TSB initial = 15 - 12 = +3 (légèrement frais)

  // Protection onboarding
  ONBOARDING_SESSIONS: 3,     // Nombre de séances protégées
  TSB_FLOOR_ONBOARDING: -10,  // TSB ne descend pas en dessous pendant l'onboarding
};

// ─── Tau dynamiques selon le niveau du joueur ────────────────────────
// Débutant : fatigue de surface, part vite. Fitness monte/descend vite.
// Intermédiaire : encaisse mieux, fatigue plus profonde.
// Confirmé : fatigue insidieuse, fitness très stable.
export const TAU_BY_LEVEL = {
  debutant:      { tauAtl: 7,  tauCtl: 21 },
  intermediaire: { tauAtl: 10, tauCtl: 28 },
  confirme:      { tauAtl: 14, tauCtl: 35 },
} as const;

export type TauLevelKey = keyof typeof TAU_BY_LEVEL;

// Mapping des niveaux de ProfileSetupScreen → clé tau
const LEVEL_TO_TAU_KEY: Record<string, TauLevelKey> = {
  // Nouveaux labels (v2)
  "Loisir": "debutant",
  "Compétition": "intermediaire",
  "Haut niveau": "confirme",
  // Legacy compat (v1)
  Amateur: "debutant",
  Regional: "debutant",
  National: "intermediaire",
  "Semi-pro": "confirme",
  Pro: "confirme",
};

/** Retourne les tau EWMA pour un niveau joueur donné (fallback: intermediaire) */
export function getTauForLevel(level: string | null | undefined): { tauAtl: number; tauCtl: number } {
  const key = (level ? LEVEL_TO_TAU_KEY[level] : undefined) ?? "intermediaire";
  return TAU_BY_LEVEL[key];
}

// Legacy — conservé pour backward compat (ne plus utiliser directement)
export const TAU = {
  ATL: 14,
  CTL: 28,
};

// Caps de charge journalière (soft-caps via tanh)
export const LOAD_CAPS = {
  sessionsDay: 180,   // Cap FKS sessions (préparation physique)
  externDay: 230,     // Cap externe (club + match)
  totalDay: 320,      // Cap total journalier (sécurité finale)
};

// Pondération des sources externes
export const EXTERNAL_WEIGHTS = {
  match: 0.80,    // Match = haute intensité mais durée limitée (était 0.75)
  club: 0.70,     // Club = intensité variable selon le coach (était 0.65)
  other: 0.60,    // Autre activité (cross-training, etc.)
};

// Guard factors (réduction de charge)
export const GUARD_FACTORS = {
  clubDay: 0.75,      // Jour d'entraînement club : -25%
  clubEve: 0.90,      // Veille d'entraînement club : -10%
  matchDay: 0.60,     // Jour de match : -40% (pas d'entraînement FKS recommandé)
  matchEve: 0.80,     // Veille de match : -20%
};

// ===========================================================================
// ZONES TSB (Training Stress Balance)
// ===========================================================================
// TSB = CTL - ATL
// Positif = forme > fatigue (frais)
// Négatif = fatigue > forme (chargé)
// ===========================================================================
export const TSB_ZONES = {
  // Zone performance optimale : -5 à +5
  OPTIMAL_LOW: -5,
  OPTIMAL_HIGH: 5,

  // Seuils d'alerte
  OVERREACHING_THRESHOLD: -10,   // Surcharge fonctionnelle (attention)
  OVERTRAINING_THRESHOLD: -20,   // Risque surentraînement (danger)
  DETRAINING_THRESHOLD: 15,      // Perte de forme (trop de repos)

  // Labels pour l'UI
  LABELS: {
    OVERTRAINED: { min: -Infinity, max: -20, label: "Surentraînement", color: "#dc2626", icon: "warning" },
    OVERREACHING: { min: -20, max: -10, label: "Surcharge", color: "#f59e0b", icon: "alert-circle" },
    LOADED: { min: -10, max: -5, label: "Chargé", color: "#eab308", icon: "fitness" },
    OPTIMAL: { min: -5, max: 5, label: "Optimal", color: "#22c55e", icon: "checkmark-circle" },
    FRESH: { min: 5, max: 15, label: "Frais", color: "#3b82f6", icon: "battery-full" },
    DETRAINING: { min: 15, max: Infinity, label: "Désentraîné", color: "#6b7280", icon: "bed" },
  } as const,
};

// Helper pour obtenir la zone TSB
export function getTsbZone(tsb: number): keyof typeof TSB_ZONES.LABELS {
  if (tsb <= -20) return "OVERTRAINED";
  if (tsb <= -10) return "OVERREACHING";
  if (tsb <= -5) return "LOADED";
  if (tsb <= 5) return "OPTIMAL";
  if (tsb <= 15) return "FRESH";
  return "DETRAINING";
}

export function getTsbLabel(tsb: number): string {
  return TSB_ZONES.LABELS[getTsbZone(tsb)].label;
}

export function getTsbColor(tsb: number): string {
  return TSB_ZONES.LABELS[getTsbZone(tsb)].color;
}

export function getTsbIcon(tsb: number): string {
  return TSB_ZONES.LABELS[getTsbZone(tsb)].icon;
}

// ===========================================================================
// LABELS FOOTBALL-FRIENDLY
// ===========================================================================
// Remplace le jargon ATL/CTL/TSB par des termes que tout joueur comprend.
// ===========================================================================

export type FootballLabel = {
  label: string;
  emoji: string;
  message: string;
  color: string;
};

export const FOOTBALL_LABELS: Record<string, FootballLabel> = {
  OVERTRAINED: { label: "Cramé", emoji: "🔴", message: "Comme après 3 matchs en 5 jours — ton corps a besoin de souffler.", color: "#dc2626" },
  OVERREACHING: { label: "Cuit", emoji: "🟠", message: "Tu accumules la fatigue, va falloir lever le pied.", color: "#f59e0b" },
  LOADED: { label: "Chargé", emoji: "🟡", message: "Un peu de fatigue dans les jambes, comme en milieu de semaine.", color: "#eab308" },
  OPTIMAL: { label: "En forme", emoji: "🟢", message: "Prêt à performer, c'est le moment d'envoyer.", color: "#22c55e" },
  FRESH: { label: "Frais", emoji: "🔵", message: "Bien reposé, comme après une coupure.", color: "#3b82f6" },
  DETRAINING: { label: "Rouillé", emoji: "⚪", message: "Ça fait longtemps — reprends doucement pour pas te blesser.", color: "#6b7280" },
};

/** Retourne le label football pour un TSB donné */
export function getFootballLabel(tsb: number): FootballLabel {
  return FOOTBALL_LABELS[getTsbZone(tsb)];
}

/** Message court football-friendly pour un TSB donné */
export function getFootballStatus(tsb: number): string {
  return getFootballLabel(tsb).label;
}

/** Message détaillé football-friendly pour un TSB donné */
export function getFootballMessage(tsb: number): string {
  return getFootballLabel(tsb).message;
}
