import { z } from "zod";

// ---------------------------------------------------------------------------
// Sous-schemas
// ---------------------------------------------------------------------------

const timerPresetSchema = z.object({
  label: z.string().catch("Timer"),
  work_s: z.number().min(0).catch(30),
  rest_s: z.number().min(0).catch(15),
  rounds: z.number().nullable().catch(null),
});

const blockItemSchema = z.object({
  exercise_id: z.string().nullable().optional().catch(null),
  name: z.string().catch("Exercice"),
  description: z.string().nullable().optional().catch(null),
  football_context: z.string().nullable().optional().catch(null),
  sets: z.number().nullable().optional().catch(null),
  reps: z.number().nullable().optional().catch(null),
  work_s: z.number().nullable().optional().catch(null),
  rest_s: z.number().nullable().optional().catch(null),
  notes: z.string().nullable().optional().catch(null),
});

const blockSchema = z.object({
  id: z.string().catch("block_unknown"),
  type: z.string().catch("run"),
  goal: z.string().catch(""),
  intensity: z.string().catch("moderate"),
  duration_min: z.number().min(1).catch(5),
  items: z.array(blockItemSchema).optional().catch([]),
  notes: z.string().nullable().optional().catch(null),
});

const displaySchema = z.object({
  color_theme: z.string().optional().catch(undefined),
  icon: z.string().optional().catch(undefined),
  timer_presets: z.array(timerPresetSchema).optional().catch([]),
}).nullable().catch(null);

const postSessionSchema = z.object({
  cooldown_min: z.number().optional().catch(undefined),
  mobility: z.array(z.string()).optional().catch([]),
  recovery_tips: z.array(z.string()).optional().catch([]),
}).nullable().catch(null);

const resetVariantSchema = z.object({
  id: z.string(),
  title: z.string().optional().catch(undefined),
  subtitle: z.string().optional().catch(undefined),
  duration_min: z.number().min(1).optional().catch(undefined),
  blocks: z.array(blockSchema).optional().catch([]),
  display: displaySchema.optional().catch(null),
});

// ---------------------------------------------------------------------------
// Schema principal FKS_NextSessionV2
// ---------------------------------------------------------------------------

export const sessionV2Schema = z.object({
  version: z.string().catch("v2"),
  title: z.string().catch("Séance"),
  subtitle: z.string().nullable().optional().catch(null),
  intensity: z.string().catch("moderate"),
  focus_primary: z.string().catch("run"),
  focus_secondary: z.string().nullable().optional().catch(null),
  duration_min: z.number().min(1).catch(30),
  rpe_target: z.number().min(1).max(10).catch(6),
  estimated_load: z.object({
    srpe: z.number().optional().catch(undefined),
    notes: z.string().optional().catch(undefined),
  }).nullable().optional().catch(null),
  archetype_id: z.string().nullable().optional().catch(null),
  location: z.string().nullable().optional().catch(null),
  equipment_used: z.array(z.string()).optional().catch([]),
  equipment_available: z.array(z.string()).optional().catch([]),
  badges: z.array(z.string()).optional().catch([]),
  blocks: z.array(blockSchema).catch([]),
  safety_notes: z.string().nullable().optional().catch(null),
  guardrails_applied: z.array(z.string()).optional().catch([]),
  session_theme: z.string().nullable().optional().catch(null),
  coaching_tips: z.array(z.string()).optional().catch([]),
  post_session: postSessionSchema.optional().catch(null),
  selection_debug: z.object({
    reasons: z.array(z.string()).optional().catch([]),
    reset_variant_id: z.string().optional().catch(undefined),
  }).optional().catch(undefined),
  display: displaySchema.optional().catch(null),
  analytics: z.object({
    target_metrics: z.object({
      total_reps: z.number().optional().catch(undefined),
    }).optional().catch(undefined),
    rationale: z.string().optional().catch(undefined),
  }).nullable().optional().catch(null),
  reset_variants: z.array(resetVariantSchema).optional().catch([]),
});

export type SessionV2Parsed = z.infer<typeof sessionV2Schema>;
