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

// .passthrough() : on cesse de jeter l'enrichissement du moteur. Le contrat
// backend (fks/src/fksSchema.ts) émet déjà des champs non déclarés ici
// (pairing_id, pairing_order, role…) et pourra en ajouter d'autres ; sans
// passthrough, z.object les supprimait silencieusement avant l'écran de séance.
// (Merge Signal + main : champs catalogue V2 — legacy_exercise_id, variant_id,
// distance_m, contacts, rounds, signal_config — conservés, passthrough de main
// conservé.)
const blockItemSchema = z
  .object({
    exercise_id: z.string().nullable().optional().catch(null),
    legacy_exercise_id: z.string().nullable().optional().catch(null),
    variant_id: z.string().nullable().optional().catch(null),
    name: z.string().catch("Exercice"),
    description: z.string().nullable().optional().catch(null),
    football_context: z.string().nullable().optional().catch(null),
    sets: z.number().nullable().optional().catch(null),
    reps: z.number().nullable().optional().catch(null),
    work_s: z.number().nullable().optional().catch(null),
    rest_s: z.number().nullable().optional().catch(null),
    distance_m: z.number().nullable().optional().catch(null),
    contacts: z.number().nullable().optional().catch(null),
    rounds: z.number().nullable().optional().catch(null),
    signal_config: z.object({
      mode: z.enum(["voice_direction", "color_gate"]),
      cues: z.array(z.string()),
      min_delay_ms: z.number().min(500),
      max_delay_ms: z.number().min(500),
    }).nullable().optional().catch(null),
    notes: z.string().nullable().optional().catch(null),
  })
  .passthrough();

const blockSchema = z
  .object({
    id: z.string().catch("block_unknown"),
    type: z.string().catch("run"),
    goal: z.string().catch(""),
    intensity: z.string().catch("moderate"),
    duration_min: z.number().min(1).catch(5),
    items: z.array(blockItemSchema).optional().catch([]),
    notes: z.string().nullable().optional().catch(null),
  })
  .passthrough();

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

const playerContextSchema = z.object({
  title: z.string().catch("Pourquoi cette séance pour toi"),
  summary: z.string().catch(""),
  cycle_key: z.string().nullable().optional().catch(null),
  cycle_label: z.string().nullable().optional().catch(null),
  cycle_progress_label: z.string().nullable().optional().catch(null),
  cycle_phase_label: z.string().nullable().optional().catch(null),
  adaptation_labels: z.array(z.string()).optional().catch([]),
  coach_note: z.string().nullable().optional().catch(null),
});

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
// .passthrough() sur la racine : même règle que blocs/items. Sans lui, z.object
// jetait silencieusement tout champ racine non déclaré — c'est ce strip qui a
// coûté player_context pendant des mois, puis recovery_tips (le backend les
// émet à la RACINE, pas dans post_session — cf. fks/src/fksSchema.ts).

export const sessionV2Schema = z.object({
  version: z.string().catch("v2"),
  catalog_version: z.string().nullable().optional().catch(null),
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
  injury_adaptation_explanation: z.string().nullable().optional().catch(null),
  guardrails_applied: z.array(z.string()).optional().catch([]),
  session_theme: z.string().nullable().optional().catch(null),
  coaching_tips: z.array(z.string()).optional().catch([]),
  // Le backend (Agent B) émet recovery_tips à la racine de la réponse ;
  // post_session.recovery_tips est gardé en compat si le backend les y remet.
  recovery_tips: z.array(z.string()).optional().catch([]),
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
  player_context: playerContextSchema.nullable().optional().catch(null),
}).passthrough();

export type SessionV2Parsed = z.infer<typeof sessionV2Schema>;
