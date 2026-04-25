import { EXERCISE_BY_ID } from "./exerciseBank";

export type ExerciseVideoRef =
  | { kind: "vetted"; url: string; label: string }
  | { kind: "search"; url: string; query: string };

const YT_SHORTS_FILTER = "EgQQARgB";
const ytShortsSearch = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${YT_SHORTS_FILTER}`;

const addMany = (
  map: Record<string, ExerciseVideoRef>,
  ids: readonly string[],
  url: string,
  label: string
) => {
  for (const id of ids) map[id] = { kind: "vetted", url, label };
};

const addSearchMany = (
  map: Record<string, ExerciseVideoRef>,
  ids: readonly string[],
  query: string
) => {
  for (const id of ids) map[id] = { kind: "search", url: ytShortsSearch(query), query };
};

type VettedGroup = {
  ids: readonly string[];
  url: string;
  label: string;
};

type SearchGroup = {
  ids: readonly string[];
  query: string;
};

const SAFE_VARIANT_FALLBACK_GROUPS: readonly (readonly string[])[] = [
  ["core_deadbug", "core_deadbug_band_resisted", "core_deadbug_iso_hold", "core_deadbug_loaded"],
  ["core_plank", "core_plank_knee_taps", "core_plank_shoulder_taps", "core_rkc_plank"],
  ["str_nordic", "str_nordic_assisted_band", "str_eccentric_nordic_3s"],
  ["str_copenhagen", "str_copenhagen_short_lever"],
  [
    "str_bb_hip_thrust",
    "str_db_hip_thrust",
    "str_hip_thrust_iso_hold",
    "str_glute_bridge",
    "str_single_leg_bridge",
  ],
  [
    "str_calf_raise",
    "str_single_leg_calf_raise",
    "str_seated_calf_raise",
    "str_calf_raise_iso_hold",
    "str_calf_raise_bent_knee",
    "str_single_leg_soleus_iso",
    "str_soleus_iso_hold_wall",
  ],
  ["str_bulgarian_split", "str_db_split_squat", "str_split_squat_iso_hold"],
  [
    "str_pushup",
    "str_incline_pushup",
    "str_pushup_close_grip",
    "str_pushup_feet_elevated",
    "str_pushup_pause_2s",
    "str_pushup_tempo_3s",
    "str_pushup_wide",
    "upper_fast_pushup",
    "upper_plyo_pushup",
    "upper_hand_release_pushup",
    "upper_incline_fast_pushup",
  ],
];

const VETTED_GROUPS: readonly VettedGroup[] = [
  // Lower body / strength
  {
    ids: ["str_front_squat"],
    url: "https://www.youtube.com/shorts/NX_LRfGneT0",
    label: "Juggernaut Training Systems - Front Squat (#shorts)",
  },
  {
    ids: ["str_back_squat"],
    url: "https://www.youtube.com/shorts/7eWS45uEx7Q",
    label: "PS Fit - Barbell Back Squat Tutorial (#shorts)",
  },
  {
    ids: ["str_rdl_bar", "str_db_rdl"],
    url: "https://www.youtube.com/shorts/UVtjjagirFQ",
    label: "Critical Bench Compound - Romanian Deadlift (#shorts)",
  },
  {
    ids: ["str_single_leg_rdl"],
    url: "https://www.youtube.com/watch?v=s32cCgmRV3I",
    label: "Single Leg RDL balance + form cue (#shorts)",
  },
  {
    ids: ["str_single_leg_rdl_reach"],
    url: "https://www.youtube.com/watch?v=wXJUrniWVPI",
    label: "Single Leg RDL with Reach (#short-form)",
  },
  {
    ids: ["str_bb_hip_thrust", "str_db_hip_thrust", "str_hip_thrust_iso_hold"],
    url: "https://www.youtube.com/shorts/44Saea4QUaI",
    label: "Kirra Mitlo - Hip Thrust Form (#shorts)",
  },
  {
    ids: ["str_nordic", "str_nordic_assisted_band", "str_eccentric_nordic_3s"],
    url: "https://www.youtube.com/shorts/IFIc0GVJIeE",
    label: "BarBend / The Proactive Athlete - Dowel Assist Nordic Ham Curl (Short)",
  },
  {
    ids: ["str_copenhagen", "str_copenhagen_short_lever"],
    url: "https://www.youtube.com/shorts/zRdWVBoYsmQ",
    label: "Gift Mclaren - Short-Lever Copenhagen Plank (#shorts)",
  },
  {
    ids: ["str_bulgarian_split"],
    url: "https://www.youtube.com/watch?v=uBSoEWZu07k",
    label: "Bulgarian Split Squat Proper Form (#short-form)",
  },
  {
    ids: ["str_db_split_squat"],
    url: "https://www.youtube.com/watch?v=DRNTAaLApUA",
    label: "Split Squat (Short Stride) (#short-form)",
  },
  {
    ids: ["str_trapbar_deadlift", "str_trapbar_deadlift_light"],
    url: "https://www.youtube.com/watch?v=2N8TtsyETkI",
    label: "How To: Trap Bar Deadlift (#short-form)",
  },

  // Upper body / accessory
  {
    ids: ["str_bench_press"],
    url: "https://www.youtube.com/watch?v=hWbUlkb5Ms4",
    label: "How to Bench Press: 5 Simple Steps (#short-form)",
  },
  {
    ids: ["str_row"],
    url: "https://www.youtube.com/watch?v=D4LNpUbhFUk",
    label: "How To Do Bent Over Rows (With Dumbbells) (#shorts)",
  },
  {
    ids: ["str_chest_supported_row"],
    url: "https://www.youtube.com/watch?v=dGG2fGEas68",
    label: "Chest Supported Row (#short-form)",
  },
  {
    ids: ["str_pullup", "str_pullup_assisted_band"],
    url: "https://www.youtube.com/watch?v=v38H6F1caB4",
    label: "How To Do The Perfect Pull-up (#short-form)",
  },
  {
    ids: [
      "str_pushup",
      "str_incline_pushup",
      "str_pushup_close_grip",
      "str_pushup_feet_elevated",
      "str_pushup_pause_2s",
      "str_pushup_tempo_3s",
      "str_pushup_wide",
    ],
    url: "https://www.youtube.com/watch?v=pKZ-lkKKMws",
    label: "How to Push Up (#short-form)",
  },
  {
    ids: ["upper_fast_pushup"],
    url: "https://www.youtube.com/watch?v=cLmgZf1yDsU",
    label: "Regular Explosive Push-Up (#short-form)",
  },
  {
    ids: ["upper_plyo_pushup"],
    url: "https://www.youtube.com/watch?v=qd3l9fgUASw",
    label: "Plyo Push Up (#short-form)",
  },
  {
    ids: ["upper_hand_release_pushup"],
    url: "https://www.youtube.com/watch?v=qj6Ok6HBVTg",
    label: "Hand Release Push Ups (#short-form)",
  },
  {
    ids: ["upper_incline_fast_pushup"],
    url: "https://www.youtube.com/watch?v=5e7KLvz7o3o",
    label: "Incline Explosive Push Up (#short-form)",
  },
  {
    ids: ["str_face_pull"],
    url: "https://www.youtube.com/watch?v=IeOqdw9WI90",
    label: "Face Pull Common Mistakes (#shorts)",
  },
  {
    ids: ["str_band_pull_apart"],
    url: "https://www.youtube.com/watch?v=SuvO4TBwSu4",
    label: "Band Pull Apart (#short-form)",
  },
  {
    ids: ["str_wall_slide"],
    url: "https://www.youtube.com/watch?v=WIdjSjzNS2A",
    label: "A Better Way To Do Wall Slides (#short-form)",
  },
  {
    ids: ["str_scap_pushup"],
    url: "https://www.youtube.com/watch?v=NKekqeudgWs",
    label: "Scapular Push Up (#short-form)",
  },

  // Lower leg / prehab / frontal plane
  {
    ids: ["str_tib_raise", "str_tib_raise_iso_hold"],
    url: "https://www.youtube.com/watch?v=8qPSTlsbWHk",
    label: "Improve Your Walking With Tibialis Raises (#shorts)",
  },
  {
    ids: ["str_calf_raise", "str_single_leg_calf_raise", "str_calf_raise_iso_hold"],
    url: "https://www.youtube.com/watch?v=sNqa1ad2qIQ",
    label: "Calf Raise Technique (#shorts)",
  },
  {
    ids: ["str_seated_calf_raise", "str_calf_raise_bent_knee", "str_single_leg_soleus_iso", "str_soleus_iso_hold_wall"],
    url: "https://www.youtube.com/watch?v=V68OPfUy-OA",
    label: "How to Perform a Seated Calf Raise (#shorts)",
  },
  {
    ids: ["str_lateral_band_walk"],
    url: "https://www.youtube.com/watch?v=HW9xLHrLhxI",
    label: "How to do Lateral Band Walking (#short-form)",
  },
  {
    ids: ["str_monster_walk"],
    url: "https://www.youtube.com/watch?v=U-4lUvrly7I",
    label: "Monster Walk / Pas lateraux avec elastique (#short-form)",
  },
  {
    ids: ["str_cossack"],
    url: "https://www.youtube.com/watch?v=vMjH_Tjjxgc",
    label: "The Cossack Squat (#short-form)",
  },
  {
    ids: ["str_lateral_lunge"],
    url: "https://www.youtube.com/watch?v=h63_4qrFO1g",
    label: "Side (Lateral) Lunge Technique (#short-form)",
  },

  // Plyo / landing
  {
    ids: ["plyo_pogo_hops", "plyo_pogos", "str_pogo_hops_low"],
    url: "https://www.youtube.com/watch?v=ztjByc9Afj4",
    label: "Pogo Jumps Tutorial - Proper Form and Technique (#short-form)",
  },
  {
    ids: [
      "plyo_broad_jump_stick",
      "plyo_cm_jump",
      "plyo_cmj_stick",
      "plyo_drop_jump",
      "plyo_drop_to_broad_stick",
      "plyo_jump_forward_step_stick",
      "plyo_low_box_drop_stick",
      "plyo_single_leg_hop_in_place_stick",
      "plyo_single_leg_hop_stick",
      "plyo_squat_jump",
      "plyo_squat_jump_stick",
      "plyo_vertical_jump_reach",
    ],
    url: "https://www.youtube.com/watch?v=24vTemdHiqY",
    label: "E3 Rehab - Jumping/landing progressions",
  },
  {
    ids: ["plyo_snapdown_stick"],
    url: "https://www.youtube.com/watch?v=NSU8RQCyD08",
    label: "Introduction to Landings: Snap Downs (#short-form)",
  },
  {
    ids: ["plyo_lateral_hop"],
    url: "https://www.youtube.com/watch?v=IyMLKJX4MRU",
    label: "Lateral Hop (Stick Landing) (#short-form)",
  },
  {
    ids: ["plyo_skater_jump", "plyo_skater_jump_stick"],
    url: "https://www.youtube.com/watch?v=2U1-2vFTigM",
    label: "Skater Hops (#short-form)",
  },
  {
    ids: ["plyo_bounds"],
    url: "https://www.youtube.com/watch?v=fPcGgGDz6_8",
    label: "Alternating Bounds (#short-form)",
  },
  {
    ids: ["plyo_hurdle_hop_low"],
    url: "https://www.youtube.com/watch?v=s0qCe5MVeYM",
    label: "Low Hurdle Hops (#short-form)",
  },

  // Sprint / COD
  {
    ids: ["speed_accel", "sprint_accel_5m", "sprint_accel_15m", "sprint_accel_20m"],
    url: "https://www.youtube.com/watch?v=7_-gaumnzWw",
    label: "10m Acceleration / acceleration mechanics (#short-form)",
  },
  {
    ids: ["sprint_accel_10m"],
    url: "https://www.youtube.com/watch?v=7_-gaumnzWw",
    label: "10m Acceleration (#short-form)",
  },
  {
    ids: ["sprint_falling_start_10m", "spd_start_fall_forward"],
    url: "https://www.youtube.com/watch?v=-7KXYwzN3NA",
    label: "Falling Starts (#short-form)",
  },
  {
    ids: ["sprint_hill_8_10s"],
    url: "https://www.youtube.com/watch?v=OygF8pfdhU4",
    label: "Hill Sprint Training (#short-form)",
  },
  {
    ids: ["speed_wall_drill_hold"],
    url: "https://www.youtube.com/watch?v=yC3Vpiv9InY",
    label: "Wall Sprint Drill (#shorts)",
  },
  {
    ids: ["speed_wall_drill_switches"],
    url: "https://www.youtube.com/watch?v=VWeGJmHQOc8",
    label: "Wall sprint drill",
  },
  {
    ids: ["cod_wall_drill_a_skip"],
    url: "https://www.youtube.com/watch?v=xu9UqoKugSI",
    label: "Wall Drill: A Skip (#short-form)",
  },
  {
    ids: ["speed_a_march"],
    url: "https://www.youtube.com/watch?v=xVLSDkNJhBE",
    label: "A March Drill (#short-form)",
  },
  {
    ids: ["speed_a_skip"],
    url: "https://www.youtube.com/watch?v=NEBEQba4Fb8",
    label: "How To A Skip - Sprint Drill (#short-form)",
  },
  {
    ids: ["speed_fast_leg_cycles"],
    url: "https://www.youtube.com/watch?v=mpZZHS38Ym8",
    label: "Fast Leg Drill (#short-form)",
  },
  {
    ids: ["speed_dribbles"],
    url: "https://www.youtube.com/watch?v=_chp1KjOuis",
    label: "ALTIS - Coach Dan Pfaff on dribbles",
  },
  {
    ids: ["speed_maxv"],
    url: "https://www.youtube.com/watch?v=TOzj49VSl4Y",
    label: "Improve Top Speed Mechanics With This Drill (#shorts)",
  },
  {
    ids: ["sprint_flying_10m"],
    url: "https://www.youtube.com/watch?v=qF88X_wLGlg",
    label: "Flying sprints (flying start)",
  },
  {
    ids: ["speed_cod_light"],
    url: "https://www.youtube.com/watch?v=7HoBu2isIqg",
    label: "Change Direction Efficiently! (#short-form)",
  },
  {
    ids: ["cod_decel_to_stick"],
    url: "https://www.youtube.com/watch?v=4yhOD983ZJI",
    label: "Lean, Fall, Sprint with Deceleration to Single Leg Stick (#short-form)",
  },
  {
    ids: ["cod_lateral_shuffle_decel"],
    url: "https://www.youtube.com/watch?v=mMYypSKXogY",
    label: "Lateral Shuffle to Deceleration (#short-form)",
  },
  {
    ids: ["cod_45_cut_tech"],
    url: "https://www.youtube.com/watch?v=XLQDdxxVr6w",
    label: "45 Degree Cut Drill (#short-form)",
  },
  {
    ids: ["cod_90_cut_tech"],
    url: "https://www.youtube.com/watch?v=Q8uVmserSZQ",
    label: "90 Degree Cut Drill (#short-form)",
  },
  {
    ids: ["cod_shuffle_to_sprint_5_10m"],
    url: "https://www.youtube.com/watch?v=anePOgDALy0",
    label: "Lateral shuffle to sprint",
  },

  // Core
  {
    ids: ["core_deadbug", "core_deadbug_band_resisted", "core_deadbug_iso_hold", "core_deadbug_loaded"],
    url: "https://www.youtube.com/shorts/Lxu5u9KaKQE",
    label: "Back In Shape Program - Dead Bug Exercise (#shorts)",
  },
  {
    ids: ["core_plank", "core_plank_knee_taps", "core_plank_shoulder_taps", "core_rkc_plank"],
    url: "https://www.youtube.com/shorts/BHmGSwv553Y",
    label: "Coached by Karolina - Plank Proper Technique (#shorts)",
  },
  {
    ids: ["core_side_plank", "core_side_plank_reach_through", "core_side_plank_row"],
    url: "https://www.youtube.com/watch?v=F63KKkm18xw",
    label: "Side Plank Tutorial (#shorts)",
  },
  {
    ids: ["core_farmer_carry"],
    url: "https://www.youtube.com/watch?v=dKTnDkvhwxQ",
    label: "How to do a Farmer's Carry (#short-form)",
  },
];

const SEARCH_GROUPS: readonly SearchGroup[] = [
  { ids: ["core_half_kneeling_pallof", "core_pallof", "core_pallof_iso_march"], query: "pallof press technique shorts" },
  { ids: ["plyo_box_jump"], query: "box jump landing technique shorts" },
  { ids: ["plyo_ankle_bounces", "plyo_line_hops_fwd_back", "plyo_line_hops_lateral", "plyo_pogo_lateral"], query: "pogo hops plyometric shorts" },
  { ids: ["plyo_jump_rope_easy"], query: "jump rope basic technique soft landing" },
  { ids: ["plyo_lateral_bound_stick"], query: "lateral bounds skater jump plyometric shorts" },
  { ids: ["plyo_split_jump", "plyo_split_jump_power", "str_split_squat_jump_low"], query: "split squat jump shorts" },
  { ids: ["run_build_up_20_30m"], query: "run build up 20-30 meters drill" },
  { ids: ["run_strides_10_15s"], query: "running strides 10-15 seconds drill" },
  { ids: ["spd_accel_10_20_30"], query: "10m acceleration sprint drill shorts" },
  { ids: ["speed_b_skip", "speed_butt_kicks", "speed_high_knees", "speed_straight_leg_run"], query: "sprint mechanics max velocity drills shorts" },
  { ids: ["str_glute_bridge", "str_single_leg_bridge"], query: "hip thrust technique shorts" },
  { ids: ["str_jump_squat_light"], query: "jump squat technique shorts" },
  { ids: ["str_kb_swing", "str_kb_swing_one_arm"], query: "kettlebell swing technique shorts" },
  { ids: ["str_split_squat_iso_hold"], query: "split squat dumbbell technique shorts" },
  { ids: ["str_trapbar_jump"], query: "trap bar jump technique shorts" },
];

const VETTED_BY_ID: Record<string, ExerciseVideoRef> = {};

for (const group of VETTED_GROUPS) {
  addMany(VETTED_BY_ID, group.ids, group.url, group.label);
}

for (const group of SEARCH_GROUPS) {
  addSearchMany(VETTED_BY_ID, group.ids, group.query);
}

const canUseVariantFallback = (exerciseId: string, variantId: string) =>
  SAFE_VARIANT_FALLBACK_GROUPS.some(
    (group) => group.includes(exerciseId) && group.includes(variantId)
  );

// Returns either a curated URL or a YouTube Shorts search link.
export const getExerciseVideoRef = (exerciseId: string): ExerciseVideoRef => {
  const vetted = VETTED_BY_ID[exerciseId];
  if (vetted) return vetted;

  const ex = EXERCISE_BY_ID[exerciseId];
  const variants = Array.isArray(ex?.variants) ? ex.variants : [];
  for (const variantId of variants) {
    if (!canUseVariantFallback(exerciseId, variantId)) continue;
    const variant = VETTED_BY_ID[variantId];
    if (!variant || variant.kind !== "vetted") continue;
    const variantName = EXERCISE_BY_ID[variantId]?.name ?? variantId;
    const originalName = ex?.name ?? exerciseId;
    return {
      kind: "vetted",
      url: variant.url,
      label: `Alternative (${variantName}) pour ${originalName} - ${variant.label}`,
    };
  }

  const name = ex?.name ?? exerciseId;
  const query = `${name} shorts exercise technique`;
  return { kind: "search", url: ytShortsSearch(query), query };
};
