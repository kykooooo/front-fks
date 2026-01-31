export type FKS_TimerPreset = {
  label: string;
  work_s: number;
  rest_s: number;
  rounds: number | null;
};

export type FKS_BlockItem = {
  name: string;
  sets?: number | null;
  reps?: number | null;
  work_s?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

export type FKS_Block = {
  id: string;
  type: string;
  goal: string;
  intensity: string;
  duration_min: number;
  items?: FKS_BlockItem[];
  notes?: string | null;
};

export type FKS_NextSessionV2 = {
  version: string;
  title: string;
  subtitle?: string | null;
  intensity: string;
  focus_primary: string;
  focus_secondary?: string | null;
  duration_min: number;
  rpe_target: number;
  estimated_load?: { srpe?: number; notes?: string } | null;
  archetype_id?: string | null;
  location?: string | null;
  equipment_used?: string[];
  equipment_available?: string[];
  badges?: string[];
  blocks: FKS_Block[];
  safety_notes?: string | null;
  guardrails_applied?: string[];
  coaching_tips?: string[];
  post_session?: {
    cooldown_min?: number;
    mobility?: string[];
    recovery_tips?: string[];
  } | null;
  selection_debug?: {
    reasons?: string[];
    reset_variant_id?: string;
  };
  display?: {
    color_theme?: string;
    icon?: string;
    timer_presets?: FKS_TimerPreset[];
  } | null;
  analytics?: {
    target_metrics?: { total_reps?: number };
    rationale?: string;
  } | null;
  reset_variants?: Array<{
    id: string;
    title?: string;
    subtitle?: string;
    duration_min?: number;
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
  duration_min?: number;
  blocks?: FKS_Block[];
  display?: FKS_NextSessionV2["display"];
};

export type SessionDebugInfo = {
  reasons?: string[];
  reset_variant_id?: string;
  context_used?: Record<string, unknown>;
  generation_params?: Record<string, unknown>;
};

export type ResetChoiceState = {
  v2: FKS_NextSessionV2;
  debug: SessionDebugInfo | null;
  location: string;
  variants: ResetVariant[];
} | null;

export type EnvironmentSelection = ("gym" | "pitch" | "home")[];
