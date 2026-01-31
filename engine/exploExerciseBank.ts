import { EXERCISE_BY_ID, type Exercise } from './exerciseBank';

export type ExploBlockKey = 'preload' | 'accel' | 'maxv' | 'cod_light' | 'power_lowload';

export type ExploExercise = Exercise & {
  explo_block: ExploBlockKey;
  tier?: 'primary' | 'secondary';
};

const pick = (
  id: string,
  block: ExploBlockKey,
  tier: 'primary' | 'secondary' = 'secondary'
): ExploExercise => {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) throw new Error(`[exploWhitelist] Unknown exercise id="${id}"`);
  return { ...ex, explo_block: block, tier };
};

// TOKEN -> BLOCK
export const EXPLO_TOKEN_TO_BLOCK: Record<string, ExploBlockKey> = {
  plyo_explo_preload: 'preload',
  speed_accel: 'accel',
  speed_maxv: 'maxv',
  speed_cod_light: 'cod_light',
  strength_power_lowload: 'power_lowload',
  core_brace: 'preload',
};

export const EXPLO_EXERCISE_BANK: ExploExercise[] = [
  // preload
  pick('plyo_pogo_hops', 'preload', 'primary'),
  pick('plyo_line_hops_lateral', 'preload', 'secondary'),
  pick('plyo_line_hops_fwd_back', 'preload', 'secondary'),
  pick('plyo_ankle_bounces', 'preload', 'secondary'),
  pick('plyo_snapdown_stick', 'preload', 'secondary'),
  pick('plyo_jump_rope_easy', 'preload', 'secondary'),
  pick('plyo_cmj_stick', 'preload', 'primary'),
  pick('plyo_squat_jump_stick', 'preload', 'secondary'),
  pick('plyo_vertical_jump_reach', 'preload', 'secondary'),
  pick('plyo_broad_jump_stick', 'preload', 'secondary'),
  pick('plyo_jump_forward_step_stick', 'preload', 'secondary'),
  pick('plyo_single_leg_hop_stick', 'preload', 'secondary'),
  pick('plyo_lateral_bound_stick', 'preload', 'secondary'),
  pick('plyo_skater_jump_stick', 'preload', 'secondary'),
  pick('plyo_single_leg_hop_in_place_stick', 'preload', 'secondary'),

  // accel
  pick('sprint_accel_5m', 'accel', 'secondary'),
  pick('sprint_accel_10m', 'accel', 'primary'),
  pick('sprint_accel_15m', 'accel', 'secondary'),
  pick('sprint_accel_20m', 'accel', 'secondary'),
  pick('sprint_falling_start_10m', 'accel', 'secondary'),
  pick('sprint_hill_8_10s', 'accel', 'secondary'),
  pick('speed_wall_drill_hold', 'accel', 'secondary'),
  pick('speed_wall_drill_switches', 'accel', 'secondary'),
  pick('speed_a_march', 'accel', 'secondary'),
  pick('speed_a_skip', 'accel', 'secondary'),

  // maxv
  pick('run_strides_10_15s', 'maxv', 'primary'),
  pick('run_build_up_20_30m', 'maxv', 'secondary'),
  pick('speed_dribbles', 'maxv', 'secondary'),
  pick('speed_fast_leg_cycles', 'maxv', 'secondary'),
  pick('sprint_flying_10m', 'maxv', 'secondary'),

  // cod_light
  pick('cod_decel_to_stick', 'cod_light', 'primary'),
  pick('cod_45_cut_tech', 'cod_light', 'primary'),
  pick('cod_90_cut_tech', 'cod_light', 'secondary'),
  pick('cod_shuffle_to_sprint_5_10m', 'cod_light', 'secondary'),
  pick('cod_lateral_shuffle_decel', 'cod_light', 'secondary'),

  // power_lowload
  pick('mb_chest_pass_wall', 'power_lowload', 'primary'),
  pick('mb_rotational_throw_wall', 'power_lowload', 'secondary'),
  pick('mb_overhead_slam', 'power_lowload', 'secondary'),
  pick('upper_fast_pushup', 'power_lowload', 'primary'),
  pick('upper_hand_release_pushup', 'power_lowload', 'secondary'),
  pick('upper_incline_fast_pushup', 'power_lowload', 'secondary'),
];

export const EXPLO_BY_BLOCK: Record<ExploBlockKey, ExploExercise[]> = {
  preload: [],
  accel: [],
  maxv: [],
  cod_light: [],
  power_lowload: [],
};

for (const ex of EXPLO_EXERCISE_BANK) {
  EXPLO_BY_BLOCK[ex.explo_block].push(ex);
}
