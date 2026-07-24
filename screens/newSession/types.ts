export type FKS_TimerPreset = {
  label: string;
  workS: number;
  restS: number;
  rounds: number | null;
};

export type FKS_BlockItem = {
  exerciseId?: string | null;
  /** Ancien ID V1 explicite fourni par le backend (contrat sessionSchema :
   *  `legacy_exercise_id` → snakeToCamel). Conservé même sans affichage. */
  legacyExerciseId?: string | null;
  variantId?: string | null;
  id?: string | null;
  name: string;
  description?: string | null;
  footballContext?: string | null;
  sets?: number | null;
  reps?: number | null;
  workS?: number | null;
  restS?: number | null;
  distanceM?: number | null;
  contacts?: number | null;
  rounds?: number | null;
  signalConfig?: {
    mode: "voice_direction" | "color_gate";
    cues: string[];
    minDelayMs: number;
    maxDelayMs: number;
  } | null;
  workRest?: string | null;
  workRestSec?: number[] | null;
  durationMin?: number | null;
  durationPerSetSec?: number | null;
  notes?: string | null;
  modality?: string | null;
};

export type FKS_Block = {
  id: string;
  blockId?: string;
  name?: string | null;
  type: string;
  goal: string;
  focus?: string | null;
  intensity: string;
  durationMin: number;
  items?: FKS_BlockItem[];
  notes?: string | null;
  timerPresets?: {
    label?: string;
    workS?: number | null;
    restS?: number | null;
    rounds?: number | null;
  }[] | null;
};

export type FKS_PlayerContext = {
  title: string;
  summary: string;
  cycleKey?: string | null;
  cycleLabel?: string | null;
  cycleProgressLabel?: string | null;
  cyclePhaseLabel?: string | null;
  adaptationLabels?: string[];
  coachNote?: string | null;
};

export type FKS_NextSessionV2 = {
  version: string;
  catalogVersion?: string | null;
  title: string;
  subtitle?: string | null;
  intensity: string;
  focusPrimary: string;
  focusSecondary?: string | null;
  durationMin: number;
  rpeTarget: number;
  estimatedLoad?: { srpe?: number; notes?: string } | null;
  archetypeId?: string | null;
  location?: string | null;
  equipmentUsed?: string[];
  equipmentAvailable?: string[];
  badges?: string[];
  blocks: FKS_Block[];
  safetyNotes?: string | null;
  injuryAdaptationExplanation?: string | null;
  guardrailsApplied?: string[];
  sessionTheme?: string | null;
  coachingTips?: string[];
  /** Émis par le backend à la RACINE de la réponse (fks/src/fksSchema.ts).
   *  postSession.recoveryTips est conservé en compat — toujours lire les deux. */
  recoveryTips?: string[];
  postSession?: {
    cooldownMin?: number;
    mobility?: string[];
    recoveryTips?: string[];
  } | null;
  selectionDebug?: {
    reasons?: string[];
    resetVariantId?: string;
  };
  display?: {
    colorTheme?: string;
    icon?: string;
    timerPresets?: FKS_TimerPreset[];
  } | null;
  analytics?: {
    targetMetrics?: { totalReps?: number };
    rationale?: string;
  } | null;
  resetVariants?: Array<{
    id: string;
    title?: string;
    subtitle?: string;
    durationMin?: number;
    blocks?: FKS_Block[];
    display?: FKS_NextSessionV2["display"];
  }>;
  playerContext?: FKS_PlayerContext | null;
};

export type PlannedIntensity = "easy" | "moderate" | "hard";
export type PlannedPhase = "Playlist" | "Construction" | "Progression" | "Performance" | "Deload";

export type ResetVariant = {
  id: string;
  title: string;
  subtitle: string;
  durationMin?: number;
  blocks?: FKS_Block[];
  display?: FKS_NextSessionV2["display"];
};

export type SessionDebugInfo = {
  reasons?: string[];
  resetVariantId?: string;
  contextUsed?: Record<string, unknown>;
  generationParams?: Record<string, unknown>;
};

export type ResetChoiceState = {
  v2: FKS_NextSessionV2;
  debug: SessionDebugInfo | null;
  location: string;
  variants: ResetVariant[];
} | null;

export type EnvironmentSelection = ("gym" | "pitch" | "home")[];
