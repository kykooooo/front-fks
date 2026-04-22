export type FKS_TimerPreset = {
  label: string;
  workS: number;
  restS: number;
  rounds: number | null;
};

export type FKS_BlockItem = {
  exerciseId?: string | null;
  id?: string | null;
  name: string;
  description?: string | null;
  footballContext?: string | null;
  sets?: number | null;
  reps?: number | null;
  workS?: number | null;
  restS?: number | null;
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

export type FKS_NextSessionV2 = {
  version: string;
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
  guardrailsApplied?: string[];
  sessionTheme?: string | null;
  coachingTips?: string[];
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
  playerContext?: {
    title?: string | null;
    summary?: string | null;
    cycleKey?: string | null;
    cycleLabel?: string | null;
    cycleProgressLabel?: string | null;
    cyclePhaseLabel?: string | null;
    adaptationLabels?: string[];
    coachNote?: string | null;
  } | null;
  resetVariants?: Array<{
    id: string;
    title?: string;
    subtitle?: string;
    durationMin?: number;
    blocks?: FKS_Block[];
    display?: FKS_NextSessionV2["display"];
  }>;
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
