import { EXERCISE_BY_ID } from "./exerciseBank";

export type ExerciseVideoRef =
  | { kind: "vetted"; url: string; label: string }
  | { kind: "search"; url: string; query: string };

const ytSearch = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// Helper to reuse a single vetted URL for multiple variations.
const addMany = (
  map: Record<string, ExerciseVideoRef>,
  ids: string[],
  url: string,
  label: string
) => {
  for (const id of ids) map[id] = { kind: "vetted", url, label };
};

const addSearch = (map: Record<string, ExerciseVideoRef>, id: string, query: string) => {
  map[id] = { kind: "search", url: ytSearch(query), query };
};

// Mapping: vetted URLs for key movements, fallback to YouTube search.
const VETTED_BY_ID: Record<string, ExerciseVideoRef> = {};

// LOWER / HINGE
addMany(
  VETTED_BY_ID,
  ["str_rdl_bar", "str_db_rdl", "str_single_leg_rdl", "str_single_leg_rdl_reach"],
  "https://www.youtube.com/watch?v=uhghy9pFIPY",
  "E3 Rehab - Romanian Deadlift (RDL)"
);

addMany(
  VETTED_BY_ID,
  ["str_nordic", "str_nordic_assisted_band", "str_eccentric_nordic_3s"],
  "https://www.youtube.com/watch?v=_e9vFU9-tkc",
  "E3 Rehab - Nordic Hamstring Curl (setup + progressions)"
);

addMany(
  VETTED_BY_ID,
  ["str_copenhagen", "str_copenhagen_short_lever"],
  "https://www.youtube.com/watch?v=9k2XGLMJV_s",
  "Physiotutors - Copenhagen (adducteurs)"
);

addMany(
  VETTED_BY_ID,
  ["str_back_squat"],
  "https://www.youtube.com/watch?v=Po9CDtfcLJI",
  "Squat University - Back Squat (technique)"
);

addMany(
  VETTED_BY_ID,
  ["str_front_squat"],
  "https://www.youtube.com/watch?v=G-Vamqoy8qM",
  "Squat University - Front Squat (technique)"
);

addMany(
  VETTED_BY_ID,
  ["str_trapbar_deadlift"],
  "https://www.youtube.com/watch?v=T9wErdvjTQo",
  "Resilient Performance - Trap Bar Deadlift (technique)"
);

addMany(
  VETTED_BY_ID,
  [
    "str_bb_hip_thrust",
    "str_db_hip_thrust",
    "str_hip_thrust_iso_hold",
    "str_glute_bridge",
    "str_single_leg_bridge",
  ],
  "https://www.youtube.com/watch?v=qkFtdG0LgQ4",
  "Jeff Nippard - Hip Thrust (technique + erreurs)"
);

// UNILAT
addMany(
  VETTED_BY_ID,
  ["str_bulgarian_split", "str_db_split_squat", "str_split_squat_iso_hold"],
  "https://www.youtube.com/watch?v=hPlKPjohFS0",
  "Squat University - Bulgarian Split Squat (technique)"
);

// UPPER MAIN
addMany(
  VETTED_BY_ID,
  ["str_bench_press"],
  "https://www.youtube.com/watch?v=vcBig73ojpE",
  "Jeff Nippard - Bench Press (technique 5 etapes)"
);

addMany(
  VETTED_BY_ID,
  ["str_row", "str_chest_supported_row"],
  "https://www.youtube.com/watch?v=axoeDmW0oAY",
  "Jeff Nippard - Row technique (dos epais, cues)"
);

addMany(
  VETTED_BY_ID,
  ["str_pullup", "str_pullup_assisted_band"],
  "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  "Calisthenicmovement - Pull-up (forme parfaite)"
);

addMany(
  VETTED_BY_ID,
  ["str_pushup", "str_pushup_feet_elevated", "str_incline_pushup"],
  "https://www.youtube.com/watch?v=IODxDxX7oi4",
  "Calisthenicmovement - Push-up (forme parfaite)"
);

// UPPER ARMOR / SCAP
addMany(
  VETTED_BY_ID,
  ["str_face_pull"],
  "https://www.youtube.com/watch?v=eFxMixk_qPQ",
  "Athlean-X - Face Pull (setup + cues)"
);

addMany(
  VETTED_BY_ID,
  ["str_band_pull_apart"],
  "https://www.youtube.com/watch?v=smSSXITNpCI",
  "Rogue / Matt Chan - Band Pull-Apart (setup + execution)"
);

addMany(
  VETTED_BY_ID,
  ["str_wall_slide"],
  "https://www.youtube.com/watch?v=D351y9ecIwc",
  "MGH Sports PT - Wall Slides"
);

addMany(
  VETTED_BY_ID,
  ["str_scap_pushup"],
  "https://www.youtube.com/watch?v=WLXjk2Z1b7Y",
  "Olympic Weightlifting Library - Scap Push-Up"
);

// ANKLE / FRONTAL
addMany(
  VETTED_BY_ID,
  ["str_tib_raise"],
  "https://www.youtube.com/watch?v=TIQztY1_p_8",
  "E3 Rehab - Tibialis anterior (exos + cues)"
);

addMany(
  VETTED_BY_ID,
  ["str_calf_raise", "str_single_leg_calf_raise", "str_seated_calf_raise"],
  "https://www.youtube.com/watch?v=UdrQ8DK1w0w",
  "E3 Rehab - Heel raises / calf training (cues)"
);

addMany(
  VETTED_BY_ID,
  ["str_calf_raise_bent_knee", "str_single_leg_soleus_iso", "str_soleus_iso_hold_wall"],
  "https://www.youtube.com/watch?v=BqfPjR2DmPo",
  "E3 Rehab - Bent-knee heel raise (soleus)"
);

addMany(
  VETTED_BY_ID,
  ["str_lateral_band_walk"],
  "https://www.youtube.com/watch?v=1LvxZrJFy9Y",
  "MedBridge - Lateral Band Walk"
);

addMany(
  VETTED_BY_ID,
  ["str_monster_walk"],
  "https://www.youtube.com/watch?v=snbNxUIUQPc",
  "Monster Walk (demonstration)"
);

addMany(
  VETTED_BY_ID,
  ["str_cossack"],
  "https://www.youtube.com/watch?v=dhDjKmTX8tU",
  "FitnessFAQs - Cossack Squat (mobility + pattern)"
);

addMany(
  VETTED_BY_ID,
  ["str_pogo_hops_low"],
  "https://www.youtube.com/watch?v=OCkmQTag-e8",
  "ALTIS - Rudiment hops / ankle stiffness"
);

addMany(
  VETTED_BY_ID,
  ["str_lateral_lunge"],
  "https://www.youtube.com/watch?v=4NlJdSzHeUg",
  "Childrens Hospital Colorado - Lateral Lunge"
);

// PLYO / SPEED (explosivite)
addMany(
  VETTED_BY_ID,
  [
    "plyo_pogo_hops",
    "plyo_pogos",
    "plyo_line_hops_lateral",
    "plyo_line_hops_fwd_back",
    "plyo_ankle_bounces",
    "plyo_pogo_lateral",
  ],
  "https://www.youtube.com/watch?v=OCkmQTag-e8",
  "ALTIS - Rudiment hops (pogo family)"
);
addSearch(VETTED_BY_ID, "plyo_jump_rope_easy", "jump rope basic technique soft landing");

addMany(
  VETTED_BY_ID,
  ["plyo_snapdown_stick"],
  "https://www.youtube.com/watch?v=1IDRgtr4u6g",
  "Snap down (landing mechanics)"
);

addMany(
  VETTED_BY_ID,
  [
    "plyo_cmj_stick",
    "plyo_cm_jump",
    "plyo_squat_jump_stick",
    "plyo_squat_jump",
    "plyo_vertical_jump_reach",
    "plyo_drop_jump",
    "plyo_low_box_drop_stick",
    "plyo_drop_to_broad_stick",
    "plyo_broad_jump_stick",
    "plyo_jump_forward_step_stick",
    "plyo_single_leg_hop_stick",
    "plyo_single_leg_hop_in_place_stick",
    "plyo_lateral_bound_stick",
    "plyo_skater_jump_stick",
  ],
  "https://www.youtube.com/watch?v=24vTemdHiqY",
  "E3 Rehab - Jumping/landing progressions"
);
addSearch(VETTED_BY_ID, "plyo_lateral_hop", "lateral hop stick landing tutorial");
addSearch(VETTED_BY_ID, "plyo_skater_jump", "skater jump lateral bounds technique");
addSearch(VETTED_BY_ID, "plyo_bounds", "bounding drill track technique");

addMany(
  VETTED_BY_ID,
  ["plyo_split_jump", "plyo_split_jump_power"],
  "https://www.youtube.com/watch?v=yncmjpwl_9g",
  "Split squat jump demo"
);
addMany(
  VETTED_BY_ID,
  ["plyo_box_jump"],
  "https://www.youtube.com/watch?v=cLSB_Zn0awM",
  "Box jump - safe technique and landing"
);
addSearch(VETTED_BY_ID, "plyo_hurdle_hop_low", "low hurdle hop plyometric tutorial");

addMany(
  VETTED_BY_ID,
  ["speed_accel", "spd_accel_10_20_30", "sprint_accel_5m", "sprint_accel_10m", "sprint_accel_15m", "sprint_accel_20m"],
  "https://www.youtube.com/watch?v=77YR0tOHn44",
  "Acceleration drills overview"
);
addMany(
  VETTED_BY_ID,
  ["sprint_falling_start_10m", "spd_start_fall_forward"],
  "https://www.youtube.com/watch?v=xzJ96zkv3TI",
  "Falling start tutorial"
);
addSearch(VETTED_BY_ID, "sprint_hill_8_10s", "hill sprint 8-10 seconds technique");

addMany(
  VETTED_BY_ID,
  ["speed_wall_drill_hold", "cod_wall_drill_a_skip"],
  "https://www.youtube.com/watch?v=rZ2TpUc1I9M",
  "Wall drills - sprint positions"
);
addMany(
  VETTED_BY_ID,
  ["speed_wall_drill_switches"],
  "https://www.youtube.com/watch?v=VWeGJmHQOc8",
  "Wall sprint drill"
);
addMany(
  VETTED_BY_ID,
  [
    "speed_a_march",
    "speed_a_skip",
    "speed_b_skip",
    "speed_high_knees",
    "speed_butt_kicks",
    "speed_straight_leg_run",
  ],
  "https://www.youtube.com/watch?v=bISzKMBflPM",
  "A-march / A-skip / A-run"
);

addSearch(VETTED_BY_ID, "speed_maxv", "max velocity sprint mechanics drills");
addSearch(VETTED_BY_ID, "run_strides_10_15s", "running strides 10-15 seconds drill");
addSearch(VETTED_BY_ID, "run_build_up_20_30m", "run build up 20-30 meters drill");
addMany(
  VETTED_BY_ID,
  ["speed_dribbles"],
  "https://www.youtube.com/watch?v=_chp1KjOuis",
  "ALTIS - Coach Dan Pfaff on dribbles"
);
addSearch(VETTED_BY_ID, "speed_fast_leg_cycles", "fast leg cycles sprint drill");
addMany(
  VETTED_BY_ID,
  ["sprint_flying_10m"],
  "https://www.youtube.com/watch?v=qF88X_wLGlg",
  "Flying sprints (flying start)"
);

addSearch(VETTED_BY_ID, "speed_cod_light", "change of direction technique drills basics");
addSearch(VETTED_BY_ID, "cod_decel_to_stick", "deceleration to stick drill tutorial");
addMany(
  VETTED_BY_ID,
  ["cod_45_cut_tech"],
  "https://www.youtube.com/watch?v=3Q3AYuASTqs",
  "45 degree cut technique"
);
addMany(
  VETTED_BY_ID,
  ["cod_90_cut_tech"],
  "https://www.youtube.com/watch?v=oAGUbBqD2wI",
  "90 degree speed cut technique"
);
addMany(
  VETTED_BY_ID,
  ["cod_shuffle_to_sprint_5_10m"],
  "https://www.youtube.com/watch?v=anePOgDALy0",
  "Lateral shuffle to sprint"
);
addSearch(VETTED_BY_ID, "cod_lateral_shuffle_decel", "lateral shuffle deceleration drill");

addMany(
  VETTED_BY_ID,
  ["str_jump_squat_light"],
  "https://www.youtube.com/watch?v=A-cFYWvaHr0",
  "Squat jump technique"
);
addMany(
  VETTED_BY_ID,
  ["str_kb_swing"],
  "https://www.youtube.com/watch?v=PAhDt_0PjP4",
  "StrongFirst - kettlebell swing"
);
addMany(
  VETTED_BY_ID,
  ["str_trapbar_deadlift_light"],
  "https://www.youtube.com/watch?v=vX0QDhjexzI",
  "Juggernaut - trap bar deadlift technique"
);
addMany(
  VETTED_BY_ID,
  ["str_trapbar_jump"],
  "https://www.youtube.com/watch?v=rZGkx5PaZSM",
  "Trap bar jumps"
);
addMany(
  VETTED_BY_ID,
  ["str_split_squat_jump_low"],
  "https://www.youtube.com/watch?v=yncmjpwl_9g",
  "Split squat jump demo"
);

addMany(
  VETTED_BY_ID,
  ["upper_fast_pushup", "upper_plyo_pushup"],
  "https://www.youtube.com/watch?v=MH4gcTKQiEc",
  "NASM - plyometric push-up"
);
addSearch(VETTED_BY_ID, "upper_hand_release_pushup", "hand release push up tutorial");
addSearch(VETTED_BY_ID, "upper_incline_fast_pushup", "incline explosive push up tutorial");

// CORE
addMany(
  VETTED_BY_ID,
  ["core_pallof", "core_half_kneeling_pallof", "core_pallof_iso_march"],
  "https://www.youtube.com/watch?v=P4394cXqs3E",
  "E3 Rehab - Half Kneeling Pallof Press"
);

addMany(
  VETTED_BY_ID,
  ["core_deadbug", "core_deadbug_band_resisted"],
  "https://www.youtube.com/watch?v=BZYaCzbP09M",
  "E3 Rehab - Dead Bug"
);

addMany(
  VETTED_BY_ID,
  ["core_plank", "core_rkc_plank"],
  "https://www.youtube.com/watch?v=kL_NJAkCQBg",
  "Calisthenicmovement - Plank (2 minutes)"
);

addMany(
  VETTED_BY_ID,
  ["core_side_plank"],
  "https://www.youtube.com/watch?v=eRygfYEe1hs",
  "E3 Rehab - Side Plank"
);

addMany(
  VETTED_BY_ID,
  ["core_farmer_carry"],
  "https://www.youtube.com/watch?v=XNdENhq4ads",
  "E3 Rehab - Farmers Carry"
);

// Returns either a vetted URL or a clean YouTube search link.
export const getExerciseVideoRef = (exerciseId: string): ExerciseVideoRef => {
  const vetted = VETTED_BY_ID[exerciseId];
  if (vetted) return vetted;

  const ex = EXERCISE_BY_ID[exerciseId];
  const variants = Array.isArray(ex?.variants) ? ex!.variants : [];
  for (const variantId of variants) {
    const v = VETTED_BY_ID[variantId];
    if (!v || v.kind !== "vetted") continue;
    const variantName = EXERCISE_BY_ID[variantId]?.name ?? variantId;
    const originalName = ex?.name ?? exerciseId;
    return {
      kind: "vetted",
      url: v.url,
      label: `Alternative (${variantName}) pour ${originalName} — ${v.label}`,
    };
  }

  const name = ex?.name ?? exerciseId;
  const query = `${name} exercise technique`;
  return { kind: "search", url: ytSearch(query), query };
};
