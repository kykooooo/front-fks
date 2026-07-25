// domain/tracking/replacements/registry.ts
// Registre CURE A LA MAIN des alternatives d'exercice (Lot 3). Aucune donnee
// generee, aucun LLM : chaque entree est ecrite et justifiee ligne a ligne.
// Regles sportives ABSOLUES respectees pour chaque entree (voir brief) :
//   - la qualite physique centrale de l'original n'est jamais trahie (un
//     sprint ne devient jamais du gainage, un exercice de force principal ne
//     devient jamais de la mobilite seule) -- voir `preservedQuality`.
//   - relativeDifficulty n'est jamais "harder" (uniquement "easier"/"similar").
//   - painSafe=false par defaut ; true UNIQUEMENT quand l'alternative ne
//     porte aucun tag de risque articulaire (cf. STRESS_TAGS ci-dessous et
//     validateRegistryIntegrity dans contract.ts qui verifie ce point).
//   - AUCUN exercice medball (mb_*) n'apparait ici, ni comme original ni
//     comme alternative : regle "zero ballon" du projet (voir CLAUDE.md).
//
// Convention equipementRequired : reprend le vocabulaire deja utilise par
// l'app (screens/newSession/ui/EquipmentSelector.tsx + api.ts) :
//   [] = poids du corps pur.
//   "water_bottles" = charge legere improvisee (equivalent DB/KB maison).
//   "home_small" = petit materiel maison (bandes elastiques, tapis).
//   "chair" = chaise/banc pour appui.
//   "gym_full" = materiel de salle standard (barres, machines, poulies).
import { EXERCISE_BY_ID, type ExerciseTag } from "../../../engine/exerciseBank";
import type { DeviationReason, ReplacementEntry } from "../types";

/**
 * Tags consideres comme un risque articulaire/zone a l'ExerciseBank. Tout le
 * reste (technique/tempo/mobility) est considere neutre. Utilise a la fois
 * pour choisir painSafe manuellement ici ET par contract.ts pour verifier
 * qu'aucune entree painSafe=true ne porte un tel tag (garde-fou automatise).
 */
export const STRESS_TAGS: ExerciseTag[] = [
  "sprint",
  "plyo",
  "heavy_lower",
  "heavy_upper",
  "overhead",
  "cuts",
  "impact",
  "knee_stress",
  "ankle_stress",
  "hamstring_load",
  "quad_load",
  "calf_load",
  "hip_load",
  "shoulder_load",
  "spine_load",
  "jump",
];

/** Tags neutres tolerables sur une entree painSafe=true. */
export const NEUTRAL_TAGS: ExerciseTag[] = ["technique", "tempo", "mobility"];

// ----------------------------------------------------------------------------
// Registre
// ----------------------------------------------------------------------------
// L'ordre des entrees DANS un tableau = ordre de preference (select.ts prend
// la premiere entree qui satisfait le contexte de la requete).

export const REPLACEMENT_REGISTRY: Record<string, ReplacementEntry[]> = {
  // ----------------------------------------------------------------------------
  // FORCE -- bas du corps : squat / fente / souleve
  // ----------------------------------------------------------------------------
  str_back_squat: [
    {
      altExerciseId: "str_air_squat",
      reasonsAllowed: ["equipment", "no_partner", "space"],
      preservedQuality: "bilateral_lower_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.4, note: "Sans charge : priorite technique, tempo controle, amplitude complete." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_goblet_squat",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "bilateral_lower_strength",
      equipmentRequired: ["water_bottles"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2, note: "Charge legere (bouteilles), technique avant charge." },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_front_squat: [
    {
      altExerciseId: "str_goblet_squat",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "bilateral_lower_strength_quad_bias",
      equipmentRequired: ["water_bottles"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_air_squat_tempo_3s",
      reasonsAllowed: ["equipment", "no_partner", "space", "too_difficult"],
      preservedQuality: "bilateral_lower_strength_quad_bias",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3, note: "Descente lente 3s pour compenser l'absence de charge." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_leg_press: [
    {
      altExerciseId: "str_bulgarian_split",
      reasonsAllowed: ["equipment"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: ["chair"],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1.1, note: "Unilateral : meme charge relative par jambe." },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_reverse_lunge",
      reasonsAllowed: ["equipment", "no_partner", "space"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_deadlift_heavy: [
    {
      altExerciseId: "str_db_rdl",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "hip_hinge_posterior_chain",
      equipmentRequired: ["water_bottles"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2, note: "Charge legere, dos neutre, tempo controle." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_single_leg_rdl",
      reasonsAllowed: ["equipment", "no_partner", "space", "too_difficult"],
      preservedQuality: "hip_hinge_posterior_chain",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3, note: "Version unilaterale sans charge, equilibre + chaine posterieure." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_trapbar_deadlift: [
    {
      altExerciseId: "str_db_rdl",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "hip_hinge_posterior_chain",
      equipmentRequired: ["water_bottles"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_kb_deadlift",
      reasonsAllowed: ["equipment"],
      preservedQuality: "hip_hinge_posterior_chain",
      equipmentRequired: ["water_bottles"],
      // Original charge (trap bar, heavy_lower) -> alternative a charge legere
      // improvisee (bouteilles) : jamais "similar" (voir contract.ts
      // checkHeavyToLightDifficulty -- une charge lourde qui devient une
      // charge legere n'est jamais une equivalence sportive complete).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_rdl: [
    {
      altExerciseId: "str_single_leg_rdl",
      reasonsAllowed: ["equipment", "no_partner", "space"],
      preservedQuality: "hip_hinge_posterior_chain",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_bulgarian_split: [
    {
      altExerciseId: "str_reverse_lunge",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_forward_lunge: [
    {
      altExerciseId: "str_split_squat_iso_hold",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { durationFactor: 1, note: "Isometrie : plus accessible que la fente dynamique." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_step_up: [
    {
      altExerciseId: "str_reverse_lunge",
      reasonsAllowed: ["equipment", "space"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: [],
      // Original charge (heavy_lower) -> alternative poids du corps pur :
      // jamais "similar" (voir contract.ts checkHeavyToLightDifficulty).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.1 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_db_split_squat: [
    {
      altExerciseId: "str_split_squat_iso_hold",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "unilateral_lower_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { durationFactor: 1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  // Nordic : demande classiquement un partenaire pour bloquer les chevilles.
  // La version elastique (assistee, ancree seule) resout equipment ET
  // no_partner en une seule alternative.
  str_nordic: [
    {
      altExerciseId: "str_nordic_assisted_band",
      reasonsAllowed: ["no_partner", "equipment", "too_difficult"],
      preservedQuality: "eccentric_hamstring_strength",
      equipmentRequired: ["home_small"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 0.8, note: "Assistance elastique : moins de repetitions, focus qualite excentrique." },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_bb_hip_thrust: [
    {
      altExerciseId: "str_glute_bridge",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "hip_extension_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_single_leg_bridge",
      reasonsAllowed: ["equipment"],
      preservedQuality: "hip_extension_strength",
      equipmentRequired: [],
      // Original charge (barre, heavy_lower) -> alternative poids du corps
      // pur : jamais "similar" (voir contract.ts checkHeavyToLightDifficulty).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],

  // ----------------------------------------------------------------------------
  // FORCE -- haut du corps : pousse / tire
  // ----------------------------------------------------------------------------
  str_bench_press: [
    {
      altExerciseId: "str_pushup",
      reasonsAllowed: ["equipment", "no_partner", "space"],
      preservedQuality: "horizontal_upper_push",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_incline_pushup",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "horizontal_upper_push",
      equipmentRequired: ["chair"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.4 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_db_press: [
    {
      altExerciseId: "str_pushup",
      reasonsAllowed: ["equipment"],
      preservedQuality: "horizontal_upper_push",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_oh_press: [
    // Perd la composante overhead (honnete : preservedQuality le nomme comme
    // un push haut du corps generique, jamais "overhead") -- equivalent=false
    // en sortie de select.ts car relativeDifficulty="easier".
    {
      altExerciseId: "str_pushup",
      reasonsAllowed: ["equipment", "no_partner"],
      preservedQuality: "upper_push_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3, note: "Perd l'angle overhead : travail push horizontal a la place." },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_landmine_press: [
    {
      altExerciseId: "str_pushup",
      reasonsAllowed: ["equipment"],
      preservedQuality: "upper_push_strength",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_machine_chest_press: [
    {
      altExerciseId: "str_pushup",
      reasonsAllowed: ["equipment"],
      preservedQuality: "horizontal_upper_push",
      equipmentRequired: [],
      // Original charge (machine, heavy_upper) -> alternative poids du corps
      // pur : jamais "similar" (voir contract.ts checkHeavyToLightDifficulty).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.3 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_row: [
    {
      altExerciseId: "str_inverted_row",
      reasonsAllowed: ["equipment"],
      preservedQuality: "horizontal_upper_pull",
      equipmentRequired: [],
      // Original charge (barre, heavy_upper) -> alternative poids du corps
      // pur : jamais "similar" (voir contract.ts checkHeavyToLightDifficulty).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_pullup: [
    {
      altExerciseId: "str_inverted_row",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "vertical_to_horizontal_upper_pull",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.4, note: "Passe d'un tirage vertical a horizontal : plus accessible." },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
    {
      altExerciseId: "str_pullup_assisted_band",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "vertical_upper_pull",
      equipmentRequired: ["home_small"],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  str_lat_pulldown: [
    {
      altExerciseId: "str_inverted_row",
      reasonsAllowed: ["equipment"],
      preservedQuality: "upper_pull_strength",
      equipmentRequired: [],
      // Original charge (machine, heavy_upper) -> alternative poids du corps
      // pur : jamais "similar" (voir contract.ts checkHeavyToLightDifficulty).
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U13",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],

  // ----------------------------------------------------------------------------
  // RUN -- sprints / accelerations / tempo
  // ----------------------------------------------------------------------------
  sprint_accel_20m: [
    {
      altExerciseId: "sprint_accel_10m",
      reasonsAllowed: ["space"],
      preservedQuality: "acceleration_technique",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { setsDelta: 1, note: "Distance reduite : une serie de plus pour un volume equivalent." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  sprint_flying_20m: [
    {
      altExerciseId: "sprint_accel_15m",
      reasonsAllowed: ["space", "too_difficult"],
      preservedQuality: "max_velocity_technique",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { setsDelta: 1, note: "Passe de la vitesse lancee a l'acceleration : distance plus courte." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  sprint_falling_start_10m: [
    {
      altExerciseId: "sprint_accel_10m",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "acceleration_technique",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  sprint_hill_8_10s: [
    {
      altExerciseId: "sprint_accel_10m",
      reasonsAllowed: ["equipment", "space"],
      preservedQuality: "acceleration_power",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { setsDelta: 1, note: "Pas de cote disponible : acceleration a plat, une serie de plus." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  run_intervals_8x200: [
    {
      altExerciseId: "tempo_20_30",
      reasonsAllowed: ["too_difficult", "fatigue"],
      preservedQuality: "high_intensity_running_capacity",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { durationFactor: 1, note: "Passe d'intervalles a un tempo continu : moins anaerobie." },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: false,
    },
  ],
  run_hills_10x10s: [
    {
      altExerciseId: "sprint_accel_10m",
      reasonsAllowed: ["equipment", "space"],
      preservedQuality: "acceleration_power",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { setsDelta: 1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  run_easy_20: [
    // Alternative cardio classique en cas de douleur d'impact (course) :
    // le velo est non porteur de poids, aucun tag de risque articulaire.
    {
      altExerciseId: "bike_easy_25_35",
      // Uniquement "pain" : un footing facile n'est jamais bloque par un
      // manque de materiel (il est deja bodyweight) -- le velo est ici le
      // substitut classique sans impact, pas une reponse a "equipment".
      reasonsAllowed: ["pain"],
      preservedQuality: "aerobic_base_low_impact",
      equipmentRequired: ["gym_full"],
      relativeDifficulty: "similar",
      prescriptionAdapter: { durationFactor: 1.2, note: "Cardio sans impact : duree legerement allongee pour un stimulus equivalent." },
      minAge: null,
      painSafe: true,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  run_strides: [
    {
      altExerciseId: "run_build_up_20_30m",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "running_technique_speed",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: false,
    },
  ],

  // ----------------------------------------------------------------------------
  // PLYO -- sauts / bonds
  // ----------------------------------------------------------------------------
  plyo_box_low: [
    {
      altExerciseId: "plyo_squat_jump_stick",
      reasonsAllowed: ["equipment", "too_difficult"],
      preservedQuality: "vertical_plyo_power",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  plyo_broad_jump_stick: [
    {
      altExerciseId: "plyo_cmj_stick",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "plyo_power",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1, note: "Passe d'un saut horizontal a un saut vertical, volume identique." },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  plyo_lateral_bound_stick: [
    {
      altExerciseId: "plyo_line_hops_lateral",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "lateral_plyo_power",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  plyo_single_leg_hop_stick: [
    {
      altExerciseId: "plyo_single_leg_hop_in_place_stick",
      reasonsAllowed: ["too_difficult", "space"],
      preservedQuality: "unilateral_plyo_power",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.1 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  plyo_cmj_stick: [
    {
      altExerciseId: "plyo_squat_jump_stick",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "vertical_plyo_power",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  // plyo_depth_jumps : INTENTIONNELLEMENT NON COUVERT -- voir buildCoverageReport
  // (reactivite/depth jump exige une hauteur de chute + impact reel ; toute
  // regression bodyweight change la qualite physique elle-meme, ce n'est plus
  // le meme geste sportif).

  // ----------------------------------------------------------------------------
  // COD -- changements de direction
  // ----------------------------------------------------------------------------
  cod_505: [
    {
      altExerciseId: "cod_45_cut_tech",
      reasonsAllowed: ["too_difficult", "space"],
      preservedQuality: "change_of_direction_technique",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  cod_t_drill: [
    {
      altExerciseId: "cod_cone_drills_low",
      reasonsAllowed: ["too_difficult", "equipment"],
      preservedQuality: "change_of_direction_technique",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      // reason="equipment" (manque de plots) : la reponse produit reste un
      // vrai drill COD, jamais un abandon de la qualite -- voir
      // contract.ts checkEquipmentConeNote qui exige cette note des qu'une
      // alternative "plots" est proposee pour un manque de materiel.
      prescriptionAdapter: {
        repsFactor: 1.2,
        note: "Remplace les plots par des repères improvisés (bouteilles, chaussures) : mêmes trajectoires, même lecture des appuis.",
      },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  cod_shuffle_to_sprint_5_10m: [
    {
      altExerciseId: "cod_decel_to_stick",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "deceleration_control",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.1 },
      minAge: "U15",
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  cod_90_cut_tech: [
    {
      altExerciseId: "cod_45_cut_tech",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "change_of_direction_technique",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  cod_stop_go_3m: [
    {
      altExerciseId: "cod_45_cut_tech",
      reasonsAllowed: ["space"],
      preservedQuality: "change_of_direction_technique",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  cod_zigzag_cones: [
    {
      altExerciseId: "cod_cone_drills_low",
      reasonsAllowed: ["equipment"],
      preservedQuality: "change_of_direction_technique",
      equipmentRequired: [],
      relativeDifficulty: "similar",
      // reason="equipment" (manque de plots) : voir contract.ts
      // checkEquipmentConeNote -- une alternative "plots" proposee pour un
      // manque de materiel DOIT porter cette note d'improvisation.
      prescriptionAdapter: {
        repsFactor: 1,
        note: "Remplace les plots par des repères improvisés (bouteilles, chaussures) : même slalom, mêmes angles.",
      },
      minAge: null,
      painSafe: false,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],

  // ----------------------------------------------------------------------------
  // CORE -- exercices principaux
  // ----------------------------------------------------------------------------
  core_ab_wheel_rollout: [
    {
      altExerciseId: "core_deadbug",
      reasonsAllowed: ["equipment", "too_difficult", "pain"],
      preservedQuality: "anti_extension_core",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { repsFactor: 1.2 },
      minAge: null,
      painSafe: true,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  core_copenhagen_side_plank: [
    {
      altExerciseId: "core_side_plank",
      reasonsAllowed: ["pain", "too_difficult", "equipment"],
      preservedQuality: "lateral_core_stability",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { durationFactor: 1 },
      minAge: null,
      painSafe: true,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  core_hollow_rocks: [
    {
      altExerciseId: "core_hollow_hold",
      reasonsAllowed: ["too_difficult"],
      preservedQuality: "anti_extension_core",
      equipmentRequired: [],
      relativeDifficulty: "easier",
      prescriptionAdapter: { durationFactor: 1 },
      minAge: null,
      painSafe: true,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
  core_band_chop: [
    {
      altExerciseId: "core_pallof",
      reasonsAllowed: ["too_difficult", "equipment"],
      preservedQuality: "anti_rotation_core",
      equipmentRequired: ["home_small"],
      relativeDifficulty: "similar",
      prescriptionAdapter: { repsFactor: 1 },
      minAge: null,
      painSafe: true,
      soloOk: true,
      compactSpaceOk: true,
    },
  ],
};

// ----------------------------------------------------------------------------
// Exercices "importants" (travail principal) et couverture
// ----------------------------------------------------------------------------

/**
 * Exercices consideres "importants" (travail principal) pour ce lot :
 * familles str_* (force bas/haut, souleve, squat, fente, pousse, tire),
 * run_* / sprint_* (sprints, accelerations, tempo), plyo_* (sauts/bonds),
 * cod_* (changements de direction), core_* principaux. Deux ids sont
 * volontairement laisses SANS alternative (voir buildCoverageReport) : la
 * qualite sportive centrale ne peut pas etre preservee par une regression
 * raisonnable.
 */
export const IMPORTANT_EXERCISE_IDS: string[] = [
  // Force bas du corps
  "str_back_squat",
  "str_front_squat",
  "str_leg_press",
  "str_deadlift_heavy",
  "str_trapbar_deadlift",
  "str_rdl",
  "str_bulgarian_split",
  "str_forward_lunge",
  "str_step_up",
  "str_db_split_squat",
  "str_nordic",
  "str_bb_hip_thrust",
  // Force haut du corps
  "str_bench_press",
  "str_db_press",
  "str_oh_press",
  "str_landmine_press",
  "str_machine_chest_press",
  "str_row",
  "str_pullup",
  "str_lat_pulldown",
  // Run / sprint / tempo
  "sprint_accel_20m",
  "sprint_flying_20m",
  "sprint_flying_30m",
  "sprint_falling_start_10m",
  "sprint_hill_8_10s",
  "run_intervals_8x200",
  "run_hills_10x10s",
  "run_easy_20",
  "run_strides",
  // Plyo
  "plyo_box_low",
  "plyo_broad_jump_stick",
  "plyo_lateral_bound_stick",
  "plyo_single_leg_hop_stick",
  "plyo_cmj_stick",
  "plyo_depth_jumps",
  // COD
  "cod_505",
  "cod_t_drill",
  "cod_shuffle_to_sprint_5_10m",
  "cod_90_cut_tech",
  "cod_stop_go_3m",
  "cod_zigzag_cones",
  // Core principaux
  "core_ab_wheel_rollout",
  "core_copenhagen_side_plank",
  "core_hollow_rocks",
  "core_band_chop",
];

/** Raisons honnetes pour les ids importants sans alternative dans le registre. */
const UNCOVERED_REASONS: Record<string, string> = {
  plyo_depth_jumps:
    "Aucune alternative poids du corps sans hauteur de chute ne preserve la qualite reactive/depth-jump : reduire l'impact change la nature meme du geste (devient un CMJ), ce n'est plus une regression de la meme qualite.",
  sprint_flying_30m:
    "Aucune alternative ne preserve la vitesse maximale lancee sans un espace degage de 40m et plus : toute reduction de distance change la qualite physique visee (acceleration plutot que vitesse maximale).",
};

export type CoverageReport = {
  importantCount: number;
  coveredCount: number;
  uncoveredIds: string[];
  reasons: Record<string, string>;
};

/**
 * Rapport de couverture du registre sur les exercices "importants". Pur,
 * deterministe, sans dependance externe -- reutilisable en CI (contract.ts
 * n'en depend pas directement mais un futur script de garde-fou le peut).
 */
export function buildCoverageReport(): CoverageReport {
  const uncoveredIds: string[] = [];
  const reasons: Record<string, string> = {};

  for (const id of IMPORTANT_EXERCISE_IDS) {
    const entries = REPLACEMENT_REGISTRY[id];
    if (!entries || entries.length === 0) {
      uncoveredIds.push(id);
      reasons[id] = UNCOVERED_REASONS[id] ?? "Aucune alternative validee sportivement pour cet exercice a ce jour.";
    }
  }

  return {
    importantCount: IMPORTANT_EXERCISE_IDS.length,
    coveredCount: IMPORTANT_EXERCISE_IDS.length - uncoveredIds.length,
    uncoveredIds,
    reasons,
  };
}

// Re-export pratique pour contract.ts (evite un second import direct de la banque).
export const EXERCISE_BY_ID_REF = EXERCISE_BY_ID;

// ----------------------------------------------------------------------------
// Fallback par pools cures (P0 -- remplace l'ancien fallback "meme modality")
// ----------------------------------------------------------------------------
// PROBLEME CORRIGE : l'ancien fallback de select.ts filtrait par
// modality+focus, mais `focus` n'est renseigne QUE pour les stubs generes
// depuis BACKEND_EXERCISE_IDS -- aucune entree de BASE_EXERCISE_BANK n'en a.
// Le filtre se reduisait donc a "meme modality", et un tri alphabetique
// choisissait TOUJOURS le meme perdant ("easy_jog_20_30" pour tout ce qui est
// modality=run, "str_air_squat" pour tout ce qui est modality=strength) --
// une acceleration devenait un footing, un souleve de terre/tirage/pousse
// devenait systematiquement un squat. Trahison de la qualite centrale.
//
// FIX : le fallback n'est plus jamais "meme modality au sens large". Il passe
// par une FAMILLE FINE curee a la main (FAMILY_BY_ID) puis un pool
// d'alternatives explicitement verifiees pour cette famille
// (FALLBACK_POOLS). Si l'id n'a pas de famille assignee -> null honnete
// (mieux vaut ne rien proposer que trahir la qualite). Chaque pool ne
// contient QUE des exercices qui preservent reellement la qualite de la
// famille (un pool sprint ne contient que du sprint/acceleration, jamais du
// footing ; un pool upper_push ne contient que de la pousse haut du corps).
//
// Tous les membres de pool sont volontairement poids du corps pur
// (equipmentRequired: [] cote select.ts) : pas besoin d'une liste
// EQUIPMENT_BY_ID separee pour ce lot -- si un jour un pool a besoin d'un
// membre non poids-du-corps, ajouter cette liste a ce moment-la plutot que
// maintenant (pas de complexite non testee).

/**
 * Famille sportive FINE d'un id (original ET/OU membre de pool). Utilisee
 * UNIQUEMENT par le fallback de select.ts -- le registre (REPLACEMENT_REGISTRY)
 * reste la source de verite prioritaire et n'en depend pas. Un id absent de
 * cette map => aucun fallback ne lui sera jamais propose (honnete par defaut).
 * Volontairement PAS de famille pour str_nordic (aucune regression poids du
 * corps ne preserve l'excentrique ischios sans ancrage/partenaire) ni pour
 * core_band_chop (aucun pool poids-du-corps propre pour l'anti-rotation) --
 * ni pour les 2 ids deja assumes non couverts par le registre
 * (plyo_depth_jumps, sprint_flying_30m, voir UNCOVERED_REASONS ci-dessus).
 */
export const FAMILY_BY_ID: Record<string, string> = {
  // Sprint / acceleration courte (0-20m, technique de demarrage)
  sprint_accel_5m: "sprint_accel",
  sprint_accel_10m: "sprint_accel",
  sprint_accel_15m: "sprint_accel",
  sprint_accel_20m: "sprint_accel",
  sprint_falling_start_10m: "sprint_accel",
  sprint_hill_8_10s: "sprint_accel", // perd la cote, garde l'acceleration (meme logique que l'entree registre existante)
  run_hills_10x10s: "sprint_accel", // idem
  run_build_up_20_30m: "sprint_accel",
  run_strides_10_15s: "sprint_accel",
  run_strides: "sprint_accel",

  // Vitesse maximale lancee (flying sprints)
  sprint_flying_20m: "sprint_maxvel",
  sprint_flying_10m: "sprint_maxvel",

  // Course haute intensite (intervalles/seuil)
  run_intervals_8x200: "run_high_intensity",
  tempo_20_30: "run_high_intensity",

  // Footing facile / base aerobie
  run_easy_20: "run_easy_aerobic",
  easy_jog_20_30: "run_easy_aerobic",

  // Plyo vertical (double appui)
  plyo_box_low: "jump_vertical",
  plyo_cmj_stick: "jump_vertical",
  plyo_squat_jump_stick: "jump_vertical",

  // Plyo horizontal
  plyo_broad_jump_stick: "jump_horizontal",
  plyo_line_hops_fwd_back: "jump_horizontal",

  // Plyo lateral
  plyo_lateral_bound_stick: "jump_lateral",
  plyo_line_hops_lateral: "jump_lateral",

  // Plyo unilateral
  plyo_single_leg_hop_stick: "jump_unilateral",
  plyo_single_leg_hop_in_place_stick: "jump_unilateral",

  // COD -- coupes technique (angles nets, freinage + relance)
  cod_505: "cod_cut_technique",
  cod_90_cut_tech: "cod_cut_technique",
  cod_stop_go_3m: "cod_cut_technique",
  cod_45_cut_tech: "cod_cut_technique",

  // COD -- slalom / multi-direction (drills a plots)
  cod_t_drill: "cod_shuttle",
  cod_zigzag_cones: "cod_shuttle",
  cod_cone_drills_low: "cod_shuttle",

  // COD -- deceleration / transition lateral->sprint
  cod_shuffle_to_sprint_5_10m: "cod_deceleration",
  cod_decel_to_stick: "cod_deceleration",

  // Force bas -- squat bilateral (quadriceps + fessiers)
  str_back_squat: "strength_lower_squat",
  str_front_squat: "strength_lower_squat",
  str_leg_press: "strength_lower_squat",
  str_air_squat: "strength_lower_squat",
  str_air_squat_pause_2s: "strength_lower_squat",
  str_air_squat_tempo_3s: "strength_lower_squat",

  // Force bas -- unilateral (fente / split squat / step-up)
  str_bulgarian_split: "strength_lower_unilateral",
  str_forward_lunge: "strength_lower_unilateral",
  str_step_up: "strength_lower_unilateral",
  str_db_split_squat: "strength_lower_unilateral",
  str_reverse_lunge: "strength_lower_unilateral",
  str_split_squat_iso_hold: "strength_lower_unilateral",

  // Force bas -- charniere de hanche (souleve de terre / RDL)
  str_deadlift_heavy: "strength_lower_hinge",
  str_trapbar_deadlift: "strength_lower_hinge",
  str_rdl: "strength_lower_hinge",
  str_single_leg_rdl: "strength_lower_hinge",

  // Force bas -- extension de hanche (hip thrust / bridge)
  str_bb_hip_thrust: "strength_hip_extension",
  str_glute_bridge: "strength_hip_extension",
  str_single_leg_bridge: "strength_hip_extension",

  // Force haut -- poussee (bench/press/machine -> pompes)
  str_bench_press: "strength_upper_push",
  str_db_press: "strength_upper_push",
  str_oh_press: "strength_upper_push",
  str_landmine_press: "strength_upper_push",
  str_machine_chest_press: "strength_upper_push",
  str_pushup: "strength_upper_push",
  str_incline_pushup: "strength_upper_push",

  // Force haut -- tirage (row/pullup/lat pulldown -> row inverse)
  str_row: "strength_upper_pull",
  str_pullup: "strength_upper_pull",
  str_lat_pulldown: "strength_upper_pull",
  str_inverted_row: "strength_upper_pull",

  // Core -- anti-extension (ab wheel / hollow rocks)
  core_ab_wheel_rollout: "core_anti_extension",
  core_hollow_rocks: "core_anti_extension",
  core_deadbug: "core_anti_extension",
  core_hollow_hold: "core_anti_extension",

  // Core -- stabilite laterale (copenhagen / side plank)
  core_copenhagen_side_plank: "core_lateral_stability",
  core_side_plank: "core_lateral_stability",
};

/**
 * Pool d'alternatives (poids du corps pur) par famille. Chaque id du pool est
 * verifie a la main : il preserve reellement la qualite de la famille (voir
 * commentaire de tete de fichier). Une famille absente d'ici alors que
 * FAMILY_BY_ID y fait reference serait un bug de configuration -- verifie par
 * validateFallbackPoolsIntegrity() dans contract.ts.
 */
export const FALLBACK_POOLS: Record<string, string[]> = {
  sprint_accel: [
    "sprint_accel_5m",
    "sprint_accel_10m",
    "sprint_accel_15m",
    "sprint_accel_20m",
    "sprint_falling_start_10m",
    "run_build_up_20_30m",
    "run_strides_10_15s",
    "run_strides",
  ],
  sprint_maxvel: ["sprint_flying_10m"],
  run_high_intensity: ["tempo_20_30"],
  run_easy_aerobic: ["easy_jog_20_30"],
  jump_vertical: ["plyo_squat_jump_stick", "plyo_cmj_stick"],
  jump_horizontal: ["plyo_line_hops_fwd_back"],
  jump_lateral: ["plyo_line_hops_lateral"],
  jump_unilateral: ["plyo_single_leg_hop_in_place_stick"],
  cod_cut_technique: ["cod_45_cut_tech"],
  cod_shuttle: ["cod_cone_drills_low"],
  cod_deceleration: ["cod_decel_to_stick"],
  strength_lower_squat: ["str_air_squat", "str_air_squat_pause_2s", "str_air_squat_tempo_3s"],
  strength_lower_unilateral: ["str_reverse_lunge", "str_forward_lunge", "str_split_squat_iso_hold"],
  strength_lower_hinge: ["str_single_leg_rdl"],
  strength_hip_extension: ["str_glute_bridge", "str_single_leg_bridge"],
  strength_upper_push: ["str_pushup", "str_incline_pushup", "str_pushup_wide", "str_pushup_close_grip"],
  strength_upper_pull: ["str_inverted_row"],
  core_anti_extension: ["core_deadbug", "core_hollow_hold"],
  core_lateral_stability: ["core_side_plank"],
};
