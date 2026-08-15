// domain/types.ts
// ===============================
// Types “métier” FKS (unifiés, compatibles exactOptionalPropertyTypes)
// ===============================

export type Phase = 'Playlist' | 'Construction' | 'Progression' | 'Performance' | 'Deload';

export type Intensity =
  | 'easy'       // Z1–Z2 / faible RPE
  | 'moderate'   // tempo / RPE moyen
  | 'hard'       // haute intensité
  | 'max';       // très rare, tests

// ⚠️ Garde ce Modality en source de vérité côté domaine.
// (Si tu utilises domain/exerciseTypes.ts, veille à ce que les valeurs matchent.)
export type Modality = 'run' | 'circuit' | 'strength' | 'plyo' | 'cod' | 'speed' | 'core' | 'mobility';

// ===============================
// Catégorie d'âge (FKS Club)
// ===============================
// Brique structurante : pilote (à terme) les caps de durée / familles d'exos autorisées.
// On stocke UNE catégorie, pas de date de naissance (minimisation des données).
//
// ⚠️ U13 RETIRÉE DE LA SÉLECTION (décision produit, 2026-07) — l'app ne cible
// plus les U13, MAIS 'U13' reste ICI, dans AGE_CATEGORIES/AgeCategory/
// normalizeAgeCategory. Ne la retire JAMAIS de ce type : normalizeAgeCategory()
// alimente directement le payload envoyé au backend (services/aiContext.ts →
// age_category), qui pilote AGE_CATEGORY_CAPS côté moteur (plafonds durée/volume/
// familles interdites — SEULE protection réelle d'un joueur U13). Si on neutralise
// 'U13' ici, un profil déjà en U13 enverrait age_category: null et perdrait TOUTE
// protection de dosage. On retire l'OPTION proposée à l'utilisateur (cf.
// SELECTABLE_AGE_CATEGORIES ci-dessous, utilisée par le sélecteur de
// ProfileSetupScreen), jamais la reconnaissance/défense de la valeur existante.
export const AGE_CATEGORIES = ['U13', 'U15', 'U17', 'U18', 'Senior'] as const;
export type AgeCategory = (typeof AGE_CATEGORIES)[number];

/** Renvoie la catégorie si valide, sinon null. N'invente jamais de valeur. */
export function normalizeAgeCategory(value: unknown): AgeCategory | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return (AGE_CATEGORIES as readonly string[]).includes(v) ? (v as AgeCategory) : null;
}

// Catégories réellement PROPOSÉES à la sélection (inscription/profil) — l'app ne
// cible plus les U13 (moins de 13 ans = régimes Apple Kids/COPPA, hors du pilote
// actuel U15+). Un profil déjà enregistré en 'U13' n'apparaîtra sélectionné dans
// aucun chip (cf. ProfileSetupScreen) : il doit choisir une nouvelle catégorie
// pour continuer — sa donnée stockée reste 'U13' (donc protégée côté moteur) tant
// qu'il n'a pas validé un nouveau choix.
export const SELECTABLE_AGE_CATEGORIES = AGE_CATEGORIES.filter(
  (c): c is Exclude<AgeCategory, 'U13'> => c !== 'U13'
);

// ===============================
// Contexte de semaine club (FKS Club — "le coach donne le terrain")
// ===============================
export const CLUB_TRAINING_INTENSITIES = ['light', 'normal', 'heavy', 'very_heavy'] as const;
export type ClubTrainingIntensity = (typeof CLUB_TRAINING_INTENSITIES)[number];

export const CLUB_WEEK_GOALS = ['freshness', 'prevention', 'speed', 'strength', 'comeback'] as const;
export type ClubWeekGoal = (typeof CLUB_WEEK_GOALS)[number];

export function normalizeClubTrainingIntensity(value: unknown): ClubTrainingIntensity | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return (CLUB_TRAINING_INTENSITIES as readonly string[]).includes(v) ? (v as ClubTrainingIntensity) : null;
}

export function normalizeClubWeekGoal(value: unknown): ClubWeekGoal | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return (CLUB_WEEK_GOALS as readonly string[]).includes(v) ? (v as ClubWeekGoal) : null;
}

// Genre de l'ÉQUIPE (attribut d'équipe posé par le coach). Oriente le focus
// neuromusculaire (contrôle moteur). PAS une donnée individuelle, AUCUN cycle/menstruel.
export const CLUB_TEAM_GENDERS = ['female', 'male', 'mixed'] as const;
export type ClubTeamGender = (typeof CLUB_TEAM_GENDERS)[number];

export function normalizeTeamGender(value: unknown): ClubTeamGender | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (CLUB_TEAM_GENDERS as readonly string[]).includes(v) ? (v as ClubTeamGender) : null;
}

export type RPE1to10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Rating1to5 = 1 | 2 | 3 | 4 | 5;
export type Rating0to5 = 0 | 1 | 2 | 3 | 4 | 5;

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function toRPE1to10(n: number): RPE1to10 {
  const v = Math.round(clamp(n, 1, 10));
  return v as RPE1to10;
}
export function toRating1to5(n: number): Rating1to5 {
  const v = Math.round(clamp(n, 1, 5));
  return v as Rating1to5;
}
export function toRating0to5(n: number): Rating0to5 {
  const v = Math.round(clamp(n, 0, 5));
  return v as Rating0to5;
}

export type Exercise = {
  id: string;
  name: string;
  modality: Modality;
  sets?: number;
  reps?: number;
  durationSec?: number; // pour run structuré / circuits
  restSec?: number;
  intensity?: Intensity;
  notes?: string;
};

export type SessionFocus = 'endurance' | 'threshold' | 'speed' | 'strength' | 'mixed';

export interface SessionFeedback {
  rpe: RPE1to10;       // 1–10
  fatigue: Rating1to5; // 1–5
  sleep: Rating1to5;   // 1–5 (legacy UI) → mappée en recoveryPerceived (info-only)
  pain: Rating0to5;    // 0–5 (0 = aucune gêne)
  durationMin?: number;
  comment?: string;
  createdAt: string;   // ISO
  recoveryPerceived?: number;   // ← AJOUT

  // Boucle de suivi (Lot 4, docs/boucle-suivi-2026-07-25/) — resume auto de
  // l'execution en seance (domain/tracking/execution.ts summarizeExecution),
  // attache au feedback quand une execution finalisee existe pour la seance.
  // `mainReasons` en string[] (pas DeviationReason[]) : evite de coupler
  // domain/types.ts au module domain/tracking (types stables, valeurs
  // compatibles — DeviationReason est un sous-ensemble de string).
  executionSummary?: {
    completionPct: number;
    completionStatus: "full" | "partial" | "abandoned";
    done: number;
    adapted: number;
    skipped: number;
    replaced: number;
    mainReasons: string[];
    fingerprint: string;
  };
}

export type ModalityLoadWeights = Record<Modality, number>;
export const DEFAULT_MODALITY_WEIGHTS: ModalityLoadWeights = {
  run: 1.0,
  circuit: 1.1,
  strength: 0.9,
  plyo: 1.3,
  cod: 1.15,
  speed: 1.25,
  core: 0.6,
  mobility: 0.3,
};

export type Session = {
  date: string;
  id: string;
  dateISO: string;          // date de génération
  focus: SessionFocus;
  phase: Phase;             // phase au moment de la génération
  intensity: Intensity;     // intensité globale perçue
  volumeScore: number;      // score volume (heuristique simple)
  exercises: Exercise[];
  completed?: boolean;

  // ---- « Je ne l'ai pas faite » (décision Kyllian 15/08) ----
  // Séance générée puis déclarée non faite par le joueur : archivée SANS
  // charge (ATL/CTL intacts, aucun RPE inventé), ne bloque plus le CTA ni la
  // génération. Distinct de `completed` (feedback donné) et de la zombie
  // (non complétée sortie de fenêtre toute seule).
  notDone?: boolean;
  notDoneAt?: string;       // ISO

  // ---- Charge / feedback ----
  durationMin?: number;     // durée effective (minutes)
  modality?: Modality;      // modalité dominante
  feedback?: SessionFeedback;
  metrics?: {
    atl?: number;
    ctl?: number;
    tsb?: number;
  };

  /** @deprecated Utiliser feedback.rpe */
  rpe?: number;             // encore là pour compat (agrégation existante)

  // ---- AI session payload (stocké après génération) ----
  aiV2?: Record<string, unknown>;
  ai?: Record<string, unknown>;

  // ---- Timestamps ----
  createdAt?: string;       // ISO
  completedAt?: string;     // ISO

  // ---- Planned session fields (from Firestore) ----
  plannedLoad?: number;
  title?: string;

  // DEBUG M3 (optionnel, utilisé par HomeScreen)
  targetLoadBefore?: number;
  targetLoadAfter?: number;
  adaptive?: AdaptiveFactors;

  // ---- Boucle de suivi (Lot 1-5, docs/boucle-suivi-2026-07-25/) ----
  // `unknown` volontaire : evite de coupler domain/types.ts au module
  // domain/tracking (SessionExecution / TrackingDecision). Les frontieres qui
  // en ont besoin castent explicitement (cf. state/orchestrators/trackingShadow.ts).
  execution?: unknown; // SessionExecution serialisee (embed Firestore, cf. persistHelpers.ts)
  tracking?: unknown;  // TrackingDecision shadow serialisee (idem)
};

export type WeeklyIndicators = {
  hasRunStructured: boolean;
  hasCircuit: boolean;
};

export type TrainingLogItem = {
  sessionId: string;
  dateISO: string;
  rpe: number;     // on laisse number pour compat avec log existant
  atlDelta: number;
  ctlDelta: number;
};

export type EngineContext = {
  phase: Phase;
  lastSessions: Session[];           // complétées en premier si possible
  weekly: WeeklyIndicators;
  tsb?: number | undefined;          // optionnel
  painNotes?: string | null;
  equipment?: string[];
  phaseCount?: number;               // nombre de phases
};

// ===============================
// Blessures / Feedback jour / Adaptation
// ===============================

// === Injuries ===
export type InjuryArea =
  | 'cheville'
  | 'genou'
  | 'ischio'
  | 'quadriceps'
  | 'mollet'
  | 'hanche'
  | 'dos'
  | 'épaule'
  | 'poignet'
  | 'autre';

export type InjurySeverity = 0 | 1 | 2 | 3; // 0 = OK, 3 = forte
export type InjuryType = 'aigu' | 'chronique';

export interface InjuryRestrictions {
  avoidSprint?: boolean;
  avoidPlyo?: boolean;
  avoidHeavyLower?: boolean;
  avoidHeavyUpper?: boolean;
  avoidCutsImpacts?: boolean;
  avoidOverhead?: boolean;
  // extensible
}

export interface InjuryRecord {
  area: InjuryArea;
  severity: InjurySeverity; // 0..3
  type: InjuryType;
  restrictions: InjuryRestrictions;
  startDate: string; // ISO
  lastConfirm: string; // ISO (pour decay/hysteresis)
  note?: string;
}

// === Daily State / Feedback ===
export interface DailyFeedback {
  // 1..5, clamp en store
  fatigue: number;
  // 0..5, clamp en store
  pain?: number;
  // 1..5, info-only, pas d'impact direct
  recoveryPerceived?: number;
  // Blessure structurée (optionnelle)
  injury?: InjuryRecord | null;
  // trace horodatée de la saisie
  timestamp: string; // ISO
}

// === Adaptive factor (dérivé) ===
export interface AdaptiveFactors {
  fatigueFactor: number; // 0.92..1.08 (borné)
  painFactor: number;    // 1.00..0.95 (réducteur max -5%)
  combined: number;      // multiplicatif final (appliqué à la cible)
  // debug
  fatigueSmoothed?: number;
}

// (alias utile pour logs externes éventuels)
export type SessionIntensity = 'easy' | 'moderate' | 'hard';

// === Root Domain State fragments (utiles au store) ===
export interface DayState {
  date: string; // ISO day
  feedback?: DailyFeedback;
  // on peut y stocker les metrics dérivées utiles à l'écran
  adaptive: AdaptiveFactors; // requis (le store met un fallback neutre si absent)
}
