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
export type Modality = 'run' | 'circuit' | 'strength' | 'plyo' | 'cod' | 'core' | 'mobility';

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

}

export type ModalityLoadWeights = Record<Modality, number>;
export const DEFAULT_MODALITY_WEIGHTS: ModalityLoadWeights = {
  run: 1.0,
  circuit: 1.1,
  strength: 0.9,
  plyo: 1.2,
  cod: 1.0,
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

  // ---- Charge / feedback ----
  durationMin?: number;     // durée effective (minutes)
  modality?: Modality;      // modalité dominante
  feedback?: SessionFeedback;

  /** @deprecated Utiliser feedback.rpe */
  rpe?: number;             // encore là pour compat (agrégation existante)

  // DEBUG M3 (optionnel, utilisé par HomeScreen)
  targetLoadBefore?: number;
  targetLoadAfter?: number;
  adaptive?: AdaptiveFactors;
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
