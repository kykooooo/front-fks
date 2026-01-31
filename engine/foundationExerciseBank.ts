import { EXERCISE_BY_ID, type Exercise, type ExerciseFocus } from './exerciseBank';

export type FoundationBlockKey =
  | 'lower_force'           // F1 — Force duels (squat pattern)
  | 'hinge'                 // F2 — Puissance sprint (hinge + hip extension)
  | 'unilateral_prevent'    // F3 — Stabilité + prévention (unilat + ischios/adducteurs)
  | 'core'                  // F4 / U4 — Tronc anti-contact
  | 'upper_main'            // U1 — Haut du corps “duel” (push + pull)
  | 'upper_armor'           // U2 — Armure posture/épaules (scap + haut du dos)
  | 'ankle_frontal'         // U3 — Appuis (cheville/tibia) + plan frontal
  | 'run';                  // R  — Cardio fondation

export type FoundationExercise = Exercise & {
  foundation_block: FoundationBlockKey;
  tier?: 'primary' | 'secondary';
};

const pick = (
  id: string,
  block: FoundationBlockKey,
  tier: 'primary' | 'secondary' = 'secondary'
): FoundationExercise => {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) throw new Error(`[foundationExerciseBank] Unknown exercise id="${id}"`);
  return { ...ex, foundation_block: block, tier };
};

// ───────────────────────────
// Banque Fondation v3 (exos exclusifs par bloc)
// Objectif: séances “semi-pro amateur” lisibles, variées, démontrables.
// ───────────────────────────
export const FOUNDATION_EXERCISE_BANK: FoundationExercise[] = [
  // ───────────────────────────
  // F1 — lower_force (Force duels / squat pattern)
  // ───────────────────────────
  pick('str_back_squat', 'lower_force', 'primary'),
  pick('str_front_squat', 'lower_force', 'primary'),
  pick('str_box_squat', 'lower_force', 'secondary'),
  pick('str_pause_squat', 'lower_force', 'secondary'),
  pick('str_goblet_squat', 'lower_force', 'secondary'),
  pick('str_wall_sit', 'lower_force', 'secondary'),
  pick('str_leg_press', 'lower_force', 'primary'),
  pick('str_hack_squat_machine', 'lower_force', 'secondary'),
  pick('str_belt_squat', 'lower_force', 'secondary'),
  pick('str_goblet_box_squat', 'lower_force', 'secondary'),
  pick('str_air_squat_box', 'lower_force', 'secondary'),
  pick('str_spanish_squat_iso', 'lower_force', 'secondary'),
  pick('str_sit_to_stand', 'lower_force', 'secondary'),

  // ───────────────────────────
  // F2 — hinge (Puissance sprint / hip extension)
  // ───────────────────────────
  pick('str_trapbar_deadlift', 'hinge', 'primary'),
  pick('str_rdl_bar', 'hinge', 'primary'),
  pick('str_good_morning', 'hinge', 'secondary'),
  pick('str_bb_hip_thrust', 'hinge', 'primary'),
  pick('str_db_hip_thrust', 'hinge', 'secondary'),
  pick('str_glute_bridge', 'hinge', 'secondary'),
  pick('str_single_leg_bridge', 'hinge', 'secondary'),
  pick('str_single_leg_rdl', 'hinge', 'secondary'),
  pick('str_single_leg_rdl_reach', 'hinge', 'secondary'),
  pick('str_db_rdl', 'hinge', 'primary'),
  pick('str_kb_deadlift', 'hinge', 'secondary'),
  pick('str_cable_pullthrough', 'hinge', 'secondary'),
  pick('str_back_extension_45', 'hinge', 'secondary'),
  pick('str_hamstring_curl_machine', 'hinge', 'secondary'),
  pick('str_swiss_ball_leg_curl', 'hinge', 'secondary'),
  pick('str_slider_leg_curl', 'hinge', 'secondary'),
  pick('str_hip_thrust_iso_hold', 'hinge', 'secondary'),

  // ───────────────────────────
  // F3 — unilateral_prevent (stabilité + prévention)
  // ───────────────────────────
  pick('str_db_split_squat', 'unilateral_prevent', 'primary'),
  pick('str_bulgarian_split', 'unilateral_prevent', 'secondary'),
  pick('str_reverse_lunge', 'unilateral_prevent', 'secondary'),
  pick('str_forward_lunge', 'unilateral_prevent', 'secondary'),
  pick('str_step_up', 'unilateral_prevent', 'secondary'),
  pick('str_step_down', 'unilateral_prevent', 'secondary'),
  pick('str_db_hip_airplane', 'unilateral_prevent', 'secondary'),
  pick('str_split_squat_iso_hold', 'unilateral_prevent', 'secondary'),
  pick('str_single_leg_box_squat', 'unilateral_prevent', 'secondary'),
  pick('str_lateral_step_up', 'unilateral_prevent', 'secondary'),
  pick('str_skater_squat_to_box', 'unilateral_prevent', 'secondary'),

  pick('str_nordic', 'unilateral_prevent', 'primary'),
  pick('str_razor_curl', 'unilateral_prevent', 'secondary'),
  pick('str_ham_walkout', 'unilateral_prevent', 'secondary'),
  pick('str_copenhagen', 'unilateral_prevent', 'primary'),
  pick('str_nordic_assisted_band', 'unilateral_prevent', 'secondary'),
  pick('str_eccentric_nordic_3s', 'unilateral_prevent', 'primary'),
  pick('str_adductor_slide', 'unilateral_prevent', 'secondary'),
  pick('str_adductor_squeeze_iso', 'unilateral_prevent', 'secondary'),
  pick('str_copenhagen_short_lever', 'unilateral_prevent', 'secondary'),

  // ───────────────────────────
  // U1 — upper_main (push + pull “duel”)
  // ───────────────────────────
  pick('str_bench_press', 'upper_main', 'primary'),
  pick('str_db_press', 'upper_main', 'secondary'),
  pick('str_incline_db_press', 'upper_main', 'secondary'),
  pick('str_pushup', 'upper_main', 'secondary'),
  pick('str_pushup_feet_elevated', 'upper_main', 'secondary'),
  pick('str_landmine_press', 'upper_main', 'secondary'),
  pick('str_oh_press', 'upper_main', 'secondary'),
  pick('str_incline_pushup', 'upper_main', 'primary'),
  pick('str_floor_press_db', 'upper_main', 'secondary'),
  pick('str_machine_chest_press', 'upper_main', 'secondary'),

  pick('str_row', 'upper_main', 'primary'),
  pick('str_one_arm_row', 'upper_main', 'secondary'),
  pick('str_inverted_row', 'upper_main', 'secondary'),
  pick('str_pullup', 'upper_main', 'secondary'),
  pick('str_band_row', 'upper_main', 'secondary'),
  pick('str_table_row', 'upper_main', 'secondary'),
  pick('str_lat_pulldown', 'upper_main', 'primary'),
  pick('str_chest_supported_row', 'upper_main', 'primary'),
  pick('str_cable_row', 'upper_main', 'secondary'),
  pick('str_trx_row', 'upper_main', 'secondary'),
  pick('str_pullup_assisted_band', 'upper_main', 'secondary'),

  // ───────────────────────────
  // U2 — upper_armor (armure posture/épaules)
  // ───────────────────────────
  pick('str_face_pull', 'upper_armor', 'primary'),
  pick('str_band_pull_apart', 'upper_armor', 'primary'),
  pick('str_ytw_raise', 'upper_armor', 'secondary'),
  pick('str_prone_ytw', 'upper_armor', 'secondary'),
  pick('str_scap_pushup', 'upper_armor', 'secondary'),
  pick('str_wall_slide', 'upper_armor', 'secondary'),
  pick('str_band_external_rotation', 'upper_armor', 'secondary'),
  pick('str_serratus_punch_band', 'upper_armor', 'secondary'),
  pick('str_prone_t_raise', 'upper_armor', 'secondary'),
  pick('str_dead_hang', 'upper_armor', 'secondary'),
  pick('str_scapular_pullup', 'upper_armor', 'secondary'),
  pick('str_low_trap_raise', 'upper_armor', 'secondary'),
  pick('str_band_w_external_rotation', 'upper_armor', 'secondary'),
  pick('str_prone_cobra_hold', 'upper_armor', 'secondary'),
  pick('str_wall_angels', 'upper_armor', 'secondary'),

  // ───────────────────────────
  // U3 — ankle_frontal (appuis + plan frontal)
  // ───────────────────────────
  pick('str_calf_raise', 'ankle_frontal', 'primary'),
  pick('str_calf_raise_bent_knee', 'ankle_frontal', 'primary'),
  pick('str_single_leg_calf_raise', 'ankle_frontal', 'secondary'),
  pick('str_tib_raise', 'ankle_frontal', 'primary'),
  pick('str_ankle_dorsiflexion_band', 'ankle_frontal', 'secondary'),
  pick('str_toe_walks', 'ankle_frontal', 'secondary'),
  pick('str_heel_walks', 'ankle_frontal', 'secondary'),
  pick('str_band_inversion_eversion', 'ankle_frontal', 'secondary'),
  pick('str_single_leg_balance_reach', 'ankle_frontal', 'secondary'),
  pick('str_lateral_step_down', 'ankle_frontal', 'secondary'),
  pick('str_side_shuffle_band', 'ankle_frontal', 'secondary'),
  pick('str_seated_calf_raise', 'ankle_frontal', 'primary'),
  pick('str_soleus_iso_hold_wall', 'ankle_frontal', 'secondary'),
  pick('str_single_leg_soleus_iso', 'ankle_frontal', 'secondary'),
  pick('str_jump_rope_easy', 'ankle_frontal', 'secondary'),
  pick('str_pogo_hops_low', 'ankle_frontal', 'secondary'),
  pick('str_short_foot', 'ankle_frontal', 'secondary'),
  pick('str_toe_yoga', 'ankle_frontal', 'secondary'),
  pick('str_lateral_band_walk', 'ankle_frontal', 'primary'),
  pick('str_monster_walk', 'ankle_frontal', 'secondary'),
  pick('str_side_plank_hip_abduction', 'ankle_frontal', 'secondary'),

  pick('str_lateral_lunge', 'ankle_frontal', 'primary'),
  pick('str_cossack', 'ankle_frontal', 'secondary'),

  // ───────────────────────────
  // Core — anti-contact / clean & stable
  // ───────────────────────────
  pick('core_pallof', 'core', 'primary'),
  pick('core_deadbug', 'core', 'primary'),
  pick('core_rkc_plank', 'core', 'secondary'),
  pick('core_plank', 'core', 'secondary'),
  pick('core_side_plank', 'core', 'secondary'),
  pick('core_bird_dog', 'core', 'secondary'),
  pick('core_suitcase_carry', 'core', 'primary'),
  pick('core_farmer_carry', 'core', 'secondary'),
  pick('core_band_chop', 'core', 'secondary'),
  pick('core_pallof_iso_march', 'core', 'secondary'),
  pick('core_hollow_hold', 'core', 'secondary'),
  pick('core_plank_shoulder_taps', 'core', 'secondary'),
  pick('core_stir_the_pot_swissball', 'core', 'secondary'),
  pick('core_half_kneeling_pallof', 'core', 'secondary'),
  pick('core_deadbug_band_resisted', 'core', 'secondary'),

  // ───────────────────────────
  // Run — cardio fondation (simple, safe)
  // ───────────────────────────
  pick('easy_jog_20_30', 'run', 'primary'),
  pick('tempo_20_30', 'run', 'secondary'),
  pick('run_strides', 'run', 'secondary'),
  pick('match_recovery_jog', 'run', 'secondary'),
  pick('run_walk_run_intervals_20', 'run', 'primary'),
  pick('bike_easy_25_35', 'run', 'secondary'),
  pick('row_easy_15_25', 'run', 'secondary'),
  pick('incline_walk_20_30', 'run', 'secondary'),
  pick('run_fartlek_easy_20', 'run', 'secondary'),
];

export const FOUNDATION_BY_BLOCK: Record<FoundationBlockKey, FoundationExercise[]> = {
  lower_force: [],
  hinge: [],
  unilateral_prevent: [],
  upper_main: [],
  upper_armor: [],
  ankle_frontal: [],
  core: [],
  run: [],
};

for (const ex of FOUNDATION_EXERCISE_BANK) {
  FOUNDATION_BY_BLOCK[ex.foundation_block].push(ex);
}

// ───────────────────────────
// Règles “intra-bloc” Fondation
// ───────────────────────────
const isPush = (f: ExerciseFocus | string) => f === 'upper_push';
const isPull = (f: ExerciseFocus | string) => f === 'upper_pull';

const ANKLE_IDS = new Set([
  'str_calf_raise',
  'str_calf_raise_bent_knee',
  'str_single_leg_calf_raise',
  'str_tib_raise',
  'str_ankle_dorsiflexion_band',
  'str_toe_walks',
  'str_heel_walks',
]);

const FRONTAL_IDS = new Set(['str_lateral_lunge', 'str_cossack']);

const UNILAT_IDS = new Set([
  'str_db_split_squat',
  'str_bulgarian_split',
  'str_reverse_lunge',
  'str_forward_lunge',
  'str_step_up',
  'str_step_down',
  'str_db_hip_airplane',
  'str_lateral_step_up',
  'str_single_leg_box_squat',
  'str_skater_squat_to_box',
]);

const PREVENT_IDS = new Set([
  'str_nordic',
  'str_razor_curl',
  'str_ham_walkout',
  'str_copenhagen',
  'str_nordic_assisted_band',
  'str_eccentric_nordic_3s',
  'str_adductor_slide',
  'str_adductor_squeeze_iso',
  'str_copenhagen_short_lever',
]);

export const FOUNDATION_BLOCK_RULES = {
  upper_main: {
    mustHave: ['push', 'pull'] as const,
    isCategory: (id: string, focus: ExerciseFocus | string) => {
      if (isPush(focus)) return 'push';
      if (isPull(focus)) return 'pull';
      if (id.includes('press') || id.includes('pushup')) return 'push';
      return 'pull';
    },
  },
  ankle_frontal: {
    mustHave: ['ankle', 'frontal'] as const,
    isCategory: (id: string) => {
      if (ANKLE_IDS.has(id)) return 'ankle';
      if (FRONTAL_IDS.has(id)) return 'frontal';
      return 'ankle';
    },
  },
  unilateral_prevent: {
    mustHave: ['unilat', 'prevent'] as const,
    isCategory: (id: string) => {
      if (UNILAT_IDS.has(id)) return 'unilat';
      if (PREVENT_IDS.has(id)) return 'prevent';
      return 'unilat';
    },
  },
  upper_armor: {
    mustHave: ['scap'] as const,
    isCategory: () => 'scap',
  },
  core: undefined,
  hinge: undefined,
  lower_force: undefined,
  run: undefined,
} as const;
