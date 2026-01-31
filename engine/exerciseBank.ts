// engine/exerciseBank.ts
// Banque d'exos autonome (pas d'import domain/* pour éviter les cycles)

import { BACKEND_EXERCISE_IDS } from "./backendExerciseIds";

export type ExerciseTag =
  | 'sprint'
  | 'plyo'
  | 'heavy_lower'
  | 'heavy_upper'
  | 'overhead'
  | 'cuts'
  | 'impact'
  | 'knee_stress'
  | 'ankle_stress'
  | 'hamstring_load'
  | 'quad_load'
  | 'calf_load'
  | 'hip_load'
  | 'shoulder_load'
  | 'spine_load'
  | 'jump'
  | 'tempo'
  | 'technique'
  | 'mobility';

export type BankModality = 'run' | 'circuit' | 'strength' | 'plyo' | 'cod' | 'core' | 'mobility';
export type BankIntensity = 'low' | 'moderate' | 'high';
export type ExerciseFocus =
  | 'upper_push'
  | 'upper_pull'
  | 'lower'
  | 'hinge'
  | 'core'
  | 'run'
  | 'plyo'
  | 'cod'
  | 'mobility'
  | 'ankle'
  | 'frontal';

export interface ExerciseDef {
  id: string;
  name: string;
  description: string;
  modality: BankModality;
  intensity: BankIntensity;
  tags: ExerciseTag[];
  defaultDurationMin?: number;
  defaultSets?: number;
  focus?: ExerciseFocus;
  variants?: string[];
}

export type Exercise = ExerciseDef;

const rangeLabel = (a: number, b: number, unit: "min" | "m" | "s") => {
  const sep = "–";
  if (unit === "min") return `${a}${sep}${b}′`;
  if (unit === "s") return `${a}${sep}${b}″`;
  return `${a}${sep}${b}m`;
};

const seconds = (v: number) => `${v}″`;
const minutes = (v: number) => `${v}′`;

const stripPrefix = (id: string) =>
  id
    .replace(/^run_engine_/, "")
    .replace(/^treadmill_engine_/, "")
    .replace(/^bike_engine_/, "")
    .replace(/^row_engine_/, "")
    .replace(/^run_/, "")
    .replace(/^treadmill_/, "")
    .replace(/^bike_/, "")
    .replace(/^rower_/, "")
    .replace(/^row_/, "")
    .replace(/^spd_/, "")
    .replace(/^speed_/, "")
    .replace(/^sprint_/, "")
    .replace(/^cod_/, "")
    .replace(/^plyo_/, "")
    .replace(/^core_/, "")
    .replace(/^mob_/, "")
    .replace(/^generic_/, "")
    .replace(/^upper_/, "")
    .replace(/^mb_/, "")
    .replace(/^str_/, "");

const titleize = (id: string) => {
  const base = stripPrefix(id);
  const raw = base
    .replace(/_/g, " ")
    .replace(/\b(vma)\b/gi, "VMA")
    .replace(/\b(cod)\b/gi, "COD")
    .replace(/\b(spd)\b/gi, "SPD")
    .replace(/\b(rdl)\b/gi, "RDL")
    .replace(/\b(emom)\b/gi, "EMOM")
    .replace(/\b(z2)\b/gi, "Z2")
    .replace(/\b(db)\b/gi, "DB")
    .replace(/\b(kb)\b/gi, "KB")
    .replace(/\b(bb)\b/gi, "BB")
    .replace(/\b(rfess)\b/gi, "RFESS")
    .replace(/\b(trx)\b/gi, "TRX")
    .replace(/\b(t spine)\b/gi, "T-spine")
    .trim();

  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.match(/^[A-Z0-9-]+$/) ? w : w[0]?.toUpperCase() + w.slice(1)))
    .join(" ");
};

const inferModality = (id: string): BankModality => {
  if (id.startsWith("cod_")) return "cod";
  if (id.startsWith("plyo_")) return "plyo";
  if (id === "str_pogo_hops_low") return "plyo";
  if (id.startsWith("core_")) return "core";
  if (id.startsWith("mob_") || id.startsWith("generic_")) return "mobility";
  if (id.startsWith("circuit_") || id === "circuit_mix" || id === "prowler_push") return "circuit";
  if (
    id.startsWith("run_") ||
    id.startsWith("vma_") ||
    id.startsWith("tempo_") ||
    id.startsWith("easy_jog_") ||
    id.startsWith("match_") ||
    id.startsWith("bike_") ||
    id.startsWith("row_") ||
    id.startsWith("rower_") ||
    id.startsWith("treadmill_") ||
    id.startsWith("speed_") ||
    id.startsWith("sprint_") ||
    id.startsWith("spd_")
  )
    return "run";
  if (id.startsWith("str_") || id.startsWith("upper_") || id.startsWith("mb_")) return "strength";
  return "strength";
};

const inferIntensity = (id: string): BankIntensity => {
  const k = id.toLowerCase();
  const lowHints = ["easy", "z2", "recovery", "walk", "mob", "stretch", "breathing", "hold", "iso"];
  const highHints = ["sprint", "accel", "vma_short", "intervals", "flying", "hill", "depth", "jump", "hi", "power"];
  if (highHints.some((h) => k.includes(h))) return "high";
  if (lowHints.some((h) => k.includes(h))) return "low";
  if (k.includes("tempo") || k.includes("threshold") || k.includes("cruise") || k.includes("mod")) return "moderate";
  return "moderate";
};

const inferTags = (id: string, modality: BankModality): ExerciseTag[] => {
  const k = id.toLowerCase();
  const tags = new Set<ExerciseTag>();
  if (modality === "mobility") tags.add("mobility");
  if (k.includes("tempo") || k.includes("z2") || k.includes("engine")) tags.add("tempo");
  if (k.includes("sprint") || k.includes("accel") || k.startsWith("spd_") || k.startsWith("speed_")) tags.add("sprint");
  if (modality === "plyo") {
    tags.add("plyo");
    tags.add("jump");
  }
  if (modality === "cod") {
    tags.add("cuts");
    tags.add("technique");
  }
  if (k.includes("tech") || k.includes("drill") || k.includes("skip") || k.includes("stride")) tags.add("technique");
  return Array.from(tags);
};

const inferDefaultDurationMin = (id: string): number | undefined => {
  const m = id.match(/_(\d{2})_(\d{2})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const guess = Math.round((a + b) / 2);
    return Number.isFinite(guess) ? guess : undefined;
  }
  const m2 = id.match(/_(\d{2})_(\d{2})[a-z]?$/);
  if (m2) {
    const a = Number(m2[1]);
    const b = Number(m2[2]);
    const guess = Math.round((a + b) / 2);
    return Number.isFinite(guess) ? guess : undefined;
  }
  const anyMin = id.match(/_(\d{2})_(\d{2})m$/);
  if (anyMin) return undefined;
  const solo = id.match(/_(\d{2})$/);
  if (solo) {
    const v = Number(solo[1]);
    if (Number.isFinite(v) && v >= 10 && v <= 90) return v;
  }
  return undefined;
};

const uniq = (list: string[]) => Array.from(new Set(list.filter(Boolean)));

const autoVariants = (id: string, modality: BankModality): string[] => {
  const k = id.toLowerCase();

  // Cardio / run equivalents
  if (modality === "run") {
    const base: string[] = [];

    const isSprintDrill =
      k.startsWith("speed_") ||
      k.startsWith("sprint_") ||
      k.startsWith("spd_") ||
      k.includes("strides") ||
      k.includes("build_up");
    if (isSprintDrill) {
      base.push(
        "run_build_up_20_30m",
        "run_strides_10_15s",
        "run_strides",
        "sprint_falling_start_10m",
        "sprint_flying_10m",
        "sprint_accel_10m",
        "speed_high_knees",
        "speed_b_skip",
        "speed_butt_kicks",
        "speed_straight_leg_run"
      );
    }

    // Cross-training swaps
    if (k.startsWith("treadmill_") || k.startsWith("treadmill_engine_")) {
      base.push("run_fartlek_easy_20", "easy_jog_20_30", "bike_easy_25_35", "row_easy_15_25");
    } else if (k.startsWith("bike_") || k.startsWith("bike_engine_")) {
      base.push("easy_jog_20_30", "run_fartlek_easy_20", "row_easy_15_25", "incline_walk_20_30");
    } else if (k.startsWith("row_") || k.startsWith("rower_") || k.startsWith("row_engine_")) {
      base.push("easy_jog_20_30", "run_fartlek_easy_20", "bike_easy_25_35", "incline_walk_20_30");
    }

    // Interval/tempo swaps
    if (k.includes("interval")) {
      base.push(
        "run_engine_intervals_30_30_2x10",
        "run_engine_intervals_15_15_2x12",
        "run_engine_threshold_2x10",
        "tempo_20_30"
      );
    }
    if (k.includes("tempo") || k.includes("threshold") || k.includes("cruise")) {
      base.push("tempo_20_30", "run_engine_tempo_continuous_18_25", "run_fartlek_easy_20", "easy_jog_20_30");
    }
    if (k.includes("z2") || k.includes("easy") || k.includes("recovery") || k.includes("walk")) {
      base.push("easy_jog_20_30", "incline_walk_20_30", "generic_walk_easy", "bike_easy_25_35");
    }
    if (k.startsWith("vma_")) {
      base.push("run_engine_intervals_30_30_2x10", "run_engine_intervals_4x1000", "run_engine_intervals_6x400");
    }

    // If someone can't run (impact), suggest low-impact alternatives too.
    base.push("bike_easy_25_35", "row_easy_15_25");

    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  // Strength swaps
  if (modality === "strength") {
    const base: string[] = [];
    if (k.includes("machine_chest_press")) base.push("str_bench_press", "str_db_press", "str_pushup", "str_incline_pushup");
    if (k.includes("bench_dip")) base.push("str_pushup_close_grip", "str_pushup", "upper_hand_release_pushup");
    if (k.includes("floor_press")) base.push("str_db_press", "str_pushup", "str_incline_pushup");
    if (k.includes("backpack")) base.push("str_db_rdl", "str_db_press", "str_row");
    if (k.includes("kb_")) base.push("str_db_rdl", "str_db_press", "str_row");
    if (k.includes("hip_thrust")) base.push("str_glute_bridge", "str_single_leg_bridge", "str_bb_hip_thrust");
    if (k.includes("pullup")) base.push("str_inverted_row", "str_trx_row", "str_band_row");
    if (k.includes("pushup")) base.push("str_pushup", "str_incline_pushup", "str_pushup_pause_2s");
    if (k.startsWith("mb_")) base.push("mb_chest_pass_wall", "mb_rotational_throw_wall", "mb_overhead_slam");
    if (k.includes("squat")) base.push("str_goblet_squat", "str_front_squat", "str_box_squat");
    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  // Plyo swaps
  if (modality === "plyo") {
    const base: string[] = [];
    if (k.includes("pogo") || k.includes("ankle")) base.push("plyo_ankle_bounces", "plyo_pogo_hops", "plyo_line_hops_fwd_back", "plyo_line_hops_lateral");
    if (k.includes("bounds") || k.includes("skater") || k.includes("lateral")) base.push("plyo_bounds", "plyo_lateral_bound_stick", "plyo_line_hops_lateral");
    if (k.includes("jump") || k.includes("cmj") || k.includes("broad")) base.push("plyo_cmj_stick", "plyo_broad_jump_stick", "plyo_squat_jump_stick");
    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  // COD swaps
  if (modality === "cod") {
    const base: string[] = ["cod_45_cut_tech", "cod_90_cut_tech", "cod_decel_to_stick", "cod_shuffle_to_sprint_5_10m", "cod_zigzag_cones"];
    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  // Core swaps
  if (modality === "core") {
    const base: string[] = [
      "core_plank",
      "core_rkc_plank",
      "core_deadbug",
      "core_hollow_hold",
      "core_side_plank",
      "core_pallof",
    ];
    if (k.includes("ab_wheel")) base.unshift("core_front_plank_reach", "core_plank_shoulder_taps");
    if (k.includes("hanging")) base.unshift("core_deadbug_loaded", "core_reverse_crunch");
    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  // Mobility swaps
  if (modality === "mobility") {
    const base: string[] = ["mob_ankle", "mob_hips", "mob_thoracic", "generic_spine_mobility", "generic_breathing_nasal", "mob_hamstring"];
    return uniq(base.filter((x) => x !== id)).slice(0, 6);
  }

  return [];
};

const fallbackName = (id: string) => {
  if (id.startsWith("bike_") || id.startsWith("bike_engine_")) return `Vélo ${titleize(id)}`;
  if (id.startsWith("row_") || id.startsWith("rower_") || id.startsWith("row_engine_")) return `Rameur ${titleize(id)}`;
  if (id.startsWith("treadmill_") || id.startsWith("treadmill_engine_")) return `Tapis ${titleize(id)}`;
  if (id.startsWith("cod_")) return `COD ${titleize(id)}`;
  if (id.startsWith("plyo_") || id === "str_pogo_hops_low") return `Plyo ${titleize(id)}`;
  if (id.startsWith("core_")) return `Core ${titleize(id)}`;
  if (id.startsWith("mob_") || id.startsWith("generic_")) return `Mobilité ${titleize(id)}`;
  if (id.startsWith("mb_")) return `Medball ${titleize(id)}`;
  if (id.startsWith("upper_")) return `${titleize(id)}`;
  if (id.startsWith("str_")) return `${titleize(id)}`;
  if (id.startsWith("vma_")) return `VMA ${titleize(id)}`;
  if (id.startsWith("run_") || id.startsWith("run_engine_")) return `${titleize(id)}`;
  return titleize(id);
};

const fallbackDescription = (modality: BankModality, intensity: BankIntensity) => {
  if (modality === "mobility") return "Mobilité douce : amplitude contrôlée, sans douleur, respiration calme.";
  if (modality === "core") return "Gainage : tronc gainé, bassin neutre, contrôle et respiration.";
  if (modality === "cod") return "Changements de direction : bassin bas, appuis sous le centre de masse, contrôle genou/cheville.";
  if (modality === "plyo") return "Plyométrie : contacts courts, réceptions douces, qualité avant volume.";
  if (modality === "circuit") return "Circuit : rythme régulier, exécution propre, adapte la récup si besoin.";
  if (modality === "run") {
    if (intensity === "high") return "Course intense : qualité avant volume, récup suffisante pour garder une technique propre.";
    if (intensity === "low") return "Course facile : aisance respiratoire, posture haute, relâchement.";
    return "Course modérée : rythme stable, respiration contrôlée, relâchement.";
  }
  if (intensity === "high") return "Renforcement intense : charge/effort élevé, technique stricte, récup suffisante.";
  if (intensity === "low") return "Renforcement léger : contrôle, amplitude sécurisée, focus technique.";
  return "Renforcement : exécution contrôlée, amplitude sécurisée, qualité avant volume.";
};

const autoNameAndDescription = (id: string, modality: BankModality, intensity: BankIntensity) => {
  const k = id.toLowerCase();

  if (id === "vma_short") {
    return {
      name: "VMA courte",
      description: "Intervalles courts à haute intensité, récup incomplète, focus qualité d’appuis.",
    };
  }
  if (id === "vma_long") {
    return {
      name: "VMA longue",
      description: "Intervalles longs (type 3–6′), intensité élevée, récup assez longue pour tenir la qualité.",
    };
  }
  if (id === "vma_long_1000") {
    return {
      name: "VMA longue 1000m",
      description: "Répétitions de 1000m, rythme élevé, récup 2–3′, cadence stable.",
    };
  }

  const run30 = id.match(/^run_engine_intervals_(\d+)_(\d+)_(\d+)x(\d+)$/);
  if (run30) {
    const workS = Number(run30[1]);
    const restS = Number(run30[2]);
    const sets = Number(run30[3]);
    const reps = Number(run30[4]);
    return {
      name: `Intervalles ${seconds(workS)}/${seconds(restS)} ${sets}×${reps}`,
      description:
        "Cardio haute intensité : alternance vite/lent. Récup 2–3′ entre séries, posture haute, relâchement.",
    };
  }

  const runMx = id.match(/^run_engine_intervals_(\d+)x(\d+)$/);
  if (runMx) {
    const reps = Number(runMx[1]);
    const meters = Number(runMx[2]);
    return {
      name: `Intervalles ${reps}×${meters}m`,
      description: "Répétitions sur distance, rythme élevé mais contrôlé, récup complète pour garder la technique.",
    };
  }

  const runCruise = id.match(/^run_engine_tempo_cruise_(\d+)x(\d+)$/);
  if (runCruise) {
    const sets = Number(runCruise[1]);
    const minutesPer = Number(runCruise[2]);
    return {
      name: `Tempo cruise ${sets}×${minutes(minutesPer)}`,
      description: "Tempo contrôlé, récup courte, cadence stable. Objectif : tenir un rythme régulier sans sprinter.",
    };
  }

  const runThreshold = id.match(/^run_engine_threshold_(\d+)x(\d+)$/);
  if (runThreshold) {
    const sets = Number(runThreshold[1]);
    const minutesPer = Number(runThreshold[2]);
    return {
      name: `Seuil ${sets}×${minutes(minutesPer)}`,
      description: "Rythme “dur mais tenable”, respiration forte, relâchement. Récup 2–3′ entre blocs.",
    };
  }

  const runTempoCont = id.match(/^run_engine_tempo_continuous_(\d+)_(\d+)$/);
  if (runTempoCont) {
    const a = Number(runTempoCont[1]);
    const b = Number(runTempoCont[2]);
    return {
      name: `Tempo continu ${rangeLabel(a, b, "min")}`,
      description: "Tempo continu, effort soutenu et stable. Garde une foulée efficace et un relâchement global.",
    };
  }

  const runZ2 = id.match(/^run_engine_z2_(\d+)_(\d+)$/);
  if (runZ2) {
    const a = Number(runZ2[1]);
    const b = Number(runZ2[2]);
    return {
      name: `Endurance Z2 ${rangeLabel(a, b, "min")}`,
      description: "Endurance fondamentale (Z2). Aisance respiratoire, rythme régulier, objectif volume sans fatigue.",
    };
  }
  if (id === "run_engine_z2_progressive_30") {
    return {
      name: "Endurance Z2 progressive 30′",
      description: "Course facile qui monte légèrement en rythme sur la fin, sans dépasser un effort modéré.",
    };
  }

  const treadmillIntervals = id.match(/^treadmill_engine_intervals_(\d+)x(\d+)_(\d+)$/);
  if (treadmillIntervals) {
    const reps = Number(treadmillIntervals[1]);
    const workS = Number(treadmillIntervals[2]);
    const restS = Number(treadmillIntervals[3]);
    return {
      name: `Tapis ${reps}×${seconds(workS)}/${seconds(restS)}`,
      description: "Intervalles sur tapis. Vise une foulée propre, cadence régulière, récup en marche/trot léger.",
    };
  }
  const treadmillTempo = id.match(/^treadmill_engine_tempo_(\d+)_(\d+)$/);
  if (treadmillTempo) {
    const a = Number(treadmillTempo[1]);
    const b = Number(treadmillTempo[2]);
    return {
      name: `Tapis tempo ${rangeLabel(a, b, "min")}`,
      description: "Tempo sur tapis. Rythme stable, posture haute, relâchement épaules/bras.",
    };
  }

  const bikeIntervals = id.match(/^bike_engine_intervals_(\d+)x(\d+)_(\d+)$/);
  if (bikeIntervals) {
    const reps = Number(bikeIntervals[1]);
    const workS = Number(bikeIntervals[2]);
    const restS = Number(bikeIntervals[3]);
    return {
      name: `Vélo ${reps}×${seconds(workS)}/${seconds(restS)}`,
      description: "Intervalles vélo. Résistance modérée, cadence élevée sur les phases rapides, récup très facile.",
    };
  }
  const bikeTempo = id.match(/^bike_engine_tempo_(\d+)_(\d+)$/);
  if (bikeTempo) {
    const a = Number(bikeTempo[1]);
    const b = Number(bikeTempo[2]);
    return {
      name: `Vélo tempo ${rangeLabel(a, b, "min")}`,
      description: "Tempo vélo. Rythme soutenu et stable, sans brûler les jambes.",
    };
  }

  const rowIntervals = id.match(/^row_engine_intervals_(\d+)x(\d+)$/);
  if (rowIntervals) {
    const reps = Number(rowIntervals[1]);
    const meters = Number(rowIntervals[2]);
    return {
      name: `Rameur ${reps}×${meters}m`,
      description: "Intervalles rameur. Tire fort mais propre, gainage solide, récup complète.",
    };
  }
  const rowTempo = id.match(/^row_engine_tempo_(\d+)_(\d+)$/);
  if (rowTempo) {
    const a = Number(rowTempo[1]);
    const b = Number(rowTempo[2]);
    return {
      name: `Rameur tempo ${rangeLabel(a, b, "min")}`,
      description: "Tempo rameur. Puissance régulière, technique propre (jambes → tronc → bras).",
    };
  }

  if (id === "generic_walk_easy") {
    return { name: "Marche facile", description: "Marche douce, récupération active, respiration calme." };
  }

  if (id === "spd_accel_10_20_30") {
    return {
      name: "Accélérations 10–20–30m",
      description: "Accélérations progressives sur 3 distances. Récup complète, qualité avant volume.",
    };
  }
  if (id === "spd_start_fall_forward") {
    return {
      name: "Départ falling start",
      description: "Départ en déséquilibre vers l’avant pour booster la projection. 4–8 reps, récup complète.",
    };
  }

  if (k.startsWith("speed_") || k.startsWith("sprint_") || k.startsWith("spd_")) {
    if (id === "speed_b_skip") return { name: "B-skip", description: "Drill technique : genou haut, extension jambe, appui réactif." };
    if (id === "speed_dribbles") return { name: "Dribbles", description: "Petits appuis rapides sous le bassin, cadence élevée, relâchement." };
    if (id === "speed_fast_leg_cycles") return { name: "Fast leg cycles", description: "Cycles de jambes rapides, posture haute, bassin stable." };
    if (id === "speed_high_knees") return { name: "High knees", description: "Montées de genoux, cadence, bras actifs, tronc gainé." };
    if (id === "speed_butt_kicks") return { name: "Butt kicks", description: "Talons-fesses contrôlés, cadence, posture." };
    if (id === "speed_straight_leg_run") return { name: "Straight leg run", description: "Jambes tendues, appuis sous le bassin, posture haute." };

    const sled = id.match(/^speed_sled_push_(light|heavy)_fast_(\d+)_(\d+)m$/);
    if (sled) {
      const load = sled[1] === "heavy" ? "lourd" : "léger";
      const a = Number(sled[2]);
      const b = Number(sled[3]);
      return {
        name: `Traîneau ${load} ${rangeLabel(a, b, "m")} (vitesse)`,
        description: "Poussée dynamique, buste gainé, appuis puissants. Récup complète.",
      };
    }
  }

  if (k.startsWith("cod_")) {
    if (id === "cod_backpedal_to_turn") return { name: "Backpedal → turn", description: "Reculer puis pivoter proprement, bassin bas, contrôle genou/cheville." };
    if (id === "cod_curve_run") return { name: "Course en courbe", description: "Course en courbe, inclinaison contrôlée, appuis sous le centre de masse." };
    const curveExit = id.match(/^cod_curve_exit_(\d+)_(\d+)$/);
    if (curveExit) {
      const a = Number(curveExit[1]);
      const b = Number(curveExit[2]);
      return {
        name: `Courbe + sortie ${a}m + ${b}m`,
        description: "Entre en courbe puis accélère en sortie. Contrôle inclinaison et relance.",
      };
    }
    if (id === "cod_crossover_step_tech") return { name: "Crossover step (tech)", description: "Pas croisé technique. Bassin bas, appuis rapides, contrôle." };
    if (id === "cod_pivot_180_tech") return { name: "Pivot 180° (tech)", description: "Pivot rapide 180°, bassin bas, relance propre, genou aligné." };
    if (id === "cod_decel_lateral_stick") return { name: "Décél latérale + stick", description: "Freinage latéral + blocage. Contrôle du genou, stabilité bassin." };
    if (id === "cod_stop_go_3m") return { name: "Stop & go 3m", description: "Stop net puis relance courte. Appuis sous le bassin, gainage." };
    if (id === "cod_wall_drill_a_skip") return { name: "Wall drill A-skip", description: "A-skip assisté au mur. Position sprint, tronc gainé, appui réactif." };
    if (id === "cod_wicket_drill_short") return { name: "Wicket drill (court)", description: "Drill rythme sur mini-haies/repères. Cadence, posture, appuis." };
    if (id === "cod_zigzag_cones") return { name: "Zigzag cônes", description: "Slalom. Contrôle des angles, regard haut, relance propre." };
  }

  if (k.startsWith("plyo_") || id === "str_pogo_hops_low") {
    if (id === "plyo_bounds") return { name: "Bounds", description: "Sauts bondissants. Distance contrôlée, stabilité, contacts courts." };
    if (id === "plyo_pogos" || id === "plyo_pogo_hops") return { name: "Pogos", description: "Petits sauts cheville. Contacts brefs, posture haute, rigidité cheville." };
    if (id === "str_pogo_hops_low") return { name: "Pogos bas", description: "Pogos bas (réactivité). Contacts doux, volume modéré." };
    if (id === "plyo_drop_to_broad_stick") return { name: "Drop → broad jump (stick)", description: "Drop contrôlé puis saut horizontal, réception stable (stick)." };
    if (id === "plyo_split_jump") return { name: "Split jump", description: "Fente sautée. Réceptions contrôlées, genou stable." };
    if (id === "plyo_split_jump_power") return { name: "Split jump (power)", description: "Fente sautée explosive. Volume bas, récup complète." };
    if (id === "plyo_squat_jump") return { name: "Squat jump", description: "Saut vertical depuis squat, extension explosive, réception douce." };
    if (id === "plyo_squat_jump_stick") return { name: "Squat jump (stick)", description: "Squat jump + réception stabilisée (stick)." };
  }

  if (k.startsWith("core_")) {
    if (id === "core_ab_wheel_rollout") return { name: "Ab wheel rollout", description: "Anti-extension. Gainage fort, bassin neutre, amplitude progressive." };
    if (id === "core_bear_crawl") return { name: "Bear crawl", description: "Quadrupédie dynamique. Tronc gainé, mouvement contrôlé." };
    if (id === "core_offset_front_rack_carry") return { name: "Carry front rack (offset)", description: "Carry asymétrique. Anti-rotation, posture haute." };
    if (id === "core_copenhagen_side_plank") return { name: "Copenhagen side plank", description: "Planche latérale adducteurs. Version adaptée selon niveau." };
    if (id === "core_deadbug_loaded") return { name: "Dead bug chargé", description: "Dead bug avec charge légère. Anti-extension, respiration contrôlée." };
    if (id === "core_front_plank_reach") return { name: "Planche + reach", description: "Planche avec reach bras. Anti-rotation, contrôle bassin." };
    if (id === "core_hanging_knee_raise") return { name: "Hanging knee raise", description: "Genoux suspendus. Gainage, contrôle sans balancer." };
    if (id === "core_hollow_rocks") return { name: "Hollow rocks", description: "Hollow + rocking. Anti-extension, tension continue." };
    if (id === "core_leg_lowering_90_90") return { name: "Leg lowering 90/90", description: "Descente jambes contrôlée. Lombaires collées, respiration." };
    if (id === "core_mcGill_curl_up") return { name: "McGill curl-up", description: "Curl-up McGill. Gainage, neutre lombaire." };
    if (id === "core_reverse_crunch") return { name: "Reverse crunch", description: "Relevé bassin contrôlé, pas d’élan." };
    if (id === "core_side_plank_reach_through") return { name: "Side plank reach-through", description: "Planche latérale + passage bras. Rotation contrôlée." };
    if (id === "core_side_plank_row") return { name: "Side plank row", description: "Planche latérale + row élastique. Anti-rotation." };
    if (id === "core_stir_pot") return { name: "Stir the pot", description: "Gainage dynamique (cercles). Version au sol ou swissball." };
  }

  if (k.startsWith("mob_") || k.startsWith("generic_")) {
    if (id === "generic_breathing_nasal") return { name: "Respiration nasale", description: "Respiration calme et contrôlée (nasale). Récup et focus." };
    if (id === "generic_spine_mobility") return { name: "Mobilité colonne", description: "Routine mobilité colonne (dos/thoracique) douce." };
    if (id === "mob_thoracic") return { name: "Mobilité thoracique", description: "Rotation/extension thoracique, amplitude contrôlée." };
    if (id === "mob_hamstring") return { name: "Mobilité ischios", description: "Mobilité/étirement ischios en douceur, sans douleur." };
  }

  if (k.startsWith("str_") || k.startsWith("upper_") || k.startsWith("mb_")) {
    if (id === "str_air_squat") return { name: "Air squat", description: "Squat poids du corps. Amplitude contrôlée, genoux alignés." };
    if (id === "str_air_squat_pause_2s") return { name: "Air squat pause 2s", description: "Air squat avec pause en bas. Contrôle + stabilité." };
    if (id === "str_air_squat_tempo_3s") return { name: "Air squat tempo 3s", description: "Air squat avec descente lente (3s). Technique et contrôle." };
    if (id === "str_rfess_db_power") return { name: "RFESS haltères (power)", description: "Fente bulgare explosive. Volume bas, qualité." };
    if (id === "str_machine_chest_press") return { name: "Chest press machine", description: "Presse poitrine machine. Épaules stables, amplitude contrôlée." };
    if (id === "str_bench_dip") return { name: "Dips sur banc", description: "Dips banc. Épaules basses, amplitude maîtrisée." };
    if (id === "upper_drop_pushup") return { name: "Pompes drop", description: "Pompes avec chute contrôlée. Réactivité et contrôle." };
    if (id === "str_floor_press_bottles") return { name: "Floor press (bouteilles)", description: "Développé couché au sol avec charge légère (bouteilles). Tronc gainé." };
    if (id === "str_backpack_front_squat") return { name: "Front squat (sac)", description: "Front squat avec sac. Tronc gainé, genoux alignés." };
    if (id === "str_kb_high_pull") return { name: "Kettlebell high pull", description: "Tirage explosif KB. Hanches puissantes, dos neutre." };
    if (id === "str_hip_thrust") return { name: "Hip thrust", description: "Extension hanches. Pause en haut, bassin neutre." };
    if (id === "str_jump_squat_light") return { name: "Jump squat léger", description: "Squat jump avec charge légère. Volume bas, récup complète." };
    if (id === "str_kb_swing") return { name: "Kettlebell swing", description: "Hip hinge explosif. Dos neutre, puissance hanches." };
    if (id === "str_kb_swing_one_arm") return { name: "KB swing 1 bras", description: "Swing unilatéral. Gainage anti-rotation, hanches explosives." };
    if (id === "mb_scoop_toss_forward") return { name: "Medball scoop toss (avant)", description: "Lancer avant. Extension hanches, tronc gainé." };
    if (id === "upper_explosive_pushup_to_hands_release") return { name: "Pompe explosive + hands release", description: "Pompe explosive avec relâchement mains. Qualité, volume bas." };
    if (id === "str_pushup_pause_2s") return { name: "Pompes pause 2s", description: "Pause en bas. Contrôle scapulaire, tronc gainé." };
    if (id === "upper_plyo_pushup") return { name: "Pompes plyo", description: "Pompes pliométriques. Contacts courts, récup complète." };
    if (id === "upper_wall_plyo_pushup") return { name: "Pompes plyo mur", description: "Pompes pliométriques au mur. Version facile, vitesse." };
    if (id === "upper_side_to_side_plyo_pushup") return { name: "Pompes plyo latérales", description: "Pompes plyo avec déplacement latéral. Gainage fort." };
    if (id === "upper_staggered_plyo_pushup") return { name: "Pompes plyo décalées", description: "Pompes plyo mains décalées. Stabilité épaules." };
    if (id === "str_pushup_wide") return { name: "Pompes prises larges", description: "Pompes larges. Épaules stables, amplitude contrôlée." };
    if (id === "str_pushup_close_grip") return { name: "Pompes prises serrées", description: "Pompes serrées. Triceps, gainage, coudes proches." };
    if (id === "str_pushup_tempo_3s") return { name: "Pompes tempo 3s", description: "Descente lente (3s). Contrôle scapulaire." };
    if (id === "str_prone_t_raise_bw") return { name: "Prone T raise (BW)", description: "T raise au sol. Scapulas, contrôle, amplitude." };
    if (id === "str_prone_w_raise_bw") return { name: "Prone W raise (BW)", description: "W raise au sol. Rotateurs, scapulas." };
    if (id === "str_prone_y_raise_bw") return { name: "Prone Y raise (BW)", description: "Y raise au sol. Bas trapèzes, contrôle." };
    if (id === "str_db_push_press_light") return { name: "DB push press (léger)", description: "Push press haltères léger. Drive jambes, contrôle épaules." };
    if (id === "str_kb_push_press") return { name: "KB push press", description: "Push press kettlebell. Drive jambes, gainage." };
    if (id === "str_backpack_rdl") return { name: "RDL (sac)", description: "Hip hinge avec sac. Dos neutre, ischios." };
    if (id === "str_backpack_row") return { name: "Row (sac)", description: "Tirage avec sac. Dos stable, omoplates." };
    if (id === "str_split_squat_jump_low") return { name: "Split squat jump (low)", description: "Fente sautée faible amplitude. Réceptions douces." };
    if (id === "str_step_up_power") return { name: "Step-up power", description: "Step-up explosif. Appui complet, genou stable." };
    if (id === "str_trapbar_deadlift_light") return { name: "Trap bar deadlift (léger)", description: "Soulevé trap bar léger. Technique propre, vitesse." };
    if (id === "str_trapbar_jump") return { name: "Trap bar jump", description: "Sauts trap bar. Puissance, volume bas, récup complète." };
  }

  if (id === "bike_intervals") return { name: "Vélo intervalles", description: "Intervalles vélo (format au choix). Intensité modulable." };
  if (id === "rower_intervals") return { name: "Rameur intervalles", description: "Intervalles rameur (format au choix). Gainage solide." };
  if (id === "circuit_mix") return { name: "Circuit mix", description: "Circuit mix cardio/force. Rythme régulier, technique propre." };
  if (id === "circuit_bodyweight_football") return { name: "Circuit PDC (football)", description: "Circuit poids du corps orienté football. Intensité modérée." };
  if (id === "circuit_emom_bodyweight") return { name: "EMOM poids du corps", description: "EMOM simple au poids du corps. Garde une exécution propre." };
  if (id === "prowler_push") return { name: "Prowler push", description: "Poussée prowler. Puissance jambes, tronc gainé, récup complète." };

  return { name: fallbackName(id), description: fallbackDescription(modality, intensity) };
};

const buildExerciseFromBackendId = (id: string): ExerciseDef => {
  const modality = inferModality(id);
  const intensity = inferIntensity(id);
  const tags = inferTags(id, modality);
  const { name, description } = autoNameAndDescription(id, modality, intensity);

  return {
    id,
    name,
    description,
    modality,
    intensity,
    tags,
    defaultDurationMin: inferDefaultDurationMin(id),
    variants: autoVariants(id, modality),
    focus:
      modality === "run"
        ? "run"
        : modality === "cod"
          ? "cod"
          : modality === "plyo"
            ? "plyo"
            : modality === "core"
              ? "core"
              : modality === "mobility"
                ? "mobility"
                : undefined,
  };
};

const BASE_EXERCISE_BANK: ExerciseDef[] = [
  // ---------------- RUN ----------------
  { id: 'run_easy_20', name: 'Footing facile 20′', description: 'Endurance facile, posture relâchée, respiration fluide.', modality: 'run', intensity: 'low', tags: ['tempo','technique'], defaultDurationMin: 20 },
  { id: 'run_mod_30', name: 'Endurance modérée 30′', description: 'Rythme stable, zone 2-3, foulée souple.', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 30 },
  { id: 'run_tempo_2x8', name: 'Tempo 2×8′', description: 'Bloc tempo, récup courte, cadence contrôlée.', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 30 },
  { id: 'run_intervals_8x200', name: 'Intervalles 8×200m', description: 'Vitesse, récup complète, focus qualité.', modality: 'run', intensity: 'high', tags: ['sprint','hamstring_load','ankle_stress'] },
  { id: 'run_hills_10x10s', name: 'Côtes 10×10s', description: 'Puissance + accélération, montées courtes intenses.', modality: 'run', intensity: 'high', tags: ['sprint','hamstring_load','calf_load'] },

  // ---------------- PLYO ----------------
  { id: 'plyo_low_skips', name: 'Skips basiques', description: 'Coordination, appuis réactifs, posture haute.', modality: 'plyo', intensity: 'low', tags: ['plyo','jump','technique','ankle_stress'] },
  { id: 'plyo_box_low', name: 'Box step-ups sautés bas', description: 'Sauts contrôlés, contacts doux, stabilité genou.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact','knee_stress'] },
  { id: 'plyo_depth_jumps', name: 'Depth jumps', description: 'Réactivité, contacts brefs, hauteur maîtrisée.', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact','knee_stress','ankle_stress'] },

  // ---------------- STRENGTH ----------------
  { id: 'str_goblet_squat', name: 'Goblet squat', description: 'Force basique, tronc gainé, amplitude complète.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_rdl', name: 'RDL barre', description: 'Chaîne postérieure, dos neutre, tempo contrôlé.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','hamstring_load','spine_load'] },
  { id: 'str_back_squat', name: 'Back squat lourd', description: 'Force max, descente contrôlée, remontée explosive.', modality: 'strength', intensity: 'high', tags: ['heavy_lower','knee_stress','spine_load'], variants: ['str_front_squat','str_box_squat','str_pause_squat','str_goblet_squat','str_goblet_box_squat','str_air_squat_box','str_spanish_squat_iso'] },
  { id: 'str_leg_press', name: 'Presse à cuisses', description: 'Volume quadris, stabilité, amplitude sécurisée.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','quad_load'] },
  { id: 'str_bench_press', name: 'Développé couché', description: 'Force haut du corps, épaules stables.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','shoulder_load'], variants: ['str_db_press','str_incline_db_press','str_floor_press_db','str_pushup','str_incline_pushup'] },
  { id: 'str_oh_press', name: 'Développé épaules (overhead)', description: 'Press vertical, gainage actif, coude aligné.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','overhead','shoulder_load'] },
  { id: 'str_deadlift_heavy', name: 'Soulevé de terre lourd', description: 'Force globale, technique stricte, tronc solide.', modality: 'strength', intensity: 'high', tags: ['heavy_lower','spine_load','hamstring_load'] },

  // ---------------- COD ----------------
  { id: 'cod_cone_drills_low', name: 'Drills plots basiques', description: 'Appuis légers, changements propres, regard haut.', modality: 'cod', intensity: 'low', tags: ['cuts','technique'] },
  { id: 'cod_t_drill', name: 'T-Drill', description: 'Agilité + freinage, trajectoires nettes.', modality: 'cod', intensity: 'moderate', tags: ['cuts','impact'] },
  { id: 'cod_505', name: 'Test 5-0-5 (répétitions)', description: 'Freinage + relance, intensité haute.', modality: 'cod', intensity: 'high', tags: ['cuts','impact','hamstring_load','ankle_stress'] },

  // ---------------- CORE ----------------
  { id: 'core_plank', name: 'Gainage planche', description: 'Stabilité tronc, respiration contrôlée.', modality: 'core', intensity: 'low', tags: ['technique'] },
  { id: 'core_side_plank', name: 'Gainage latéral', description: 'Obliques, alignement tête-bassin.', modality: 'core', intensity: 'low', tags: ['technique'] },
  { id: 'core_pallof', name: 'Pallof press', description: 'Anti-rotation, contrôle du bassin.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_deadbug', name: 'Dead bug', description: 'Coordination tronc-hanches, gainage actif.', modality: 'core', intensity: 'low', tags: ['technique'] },

  // ---------------- MOBILITY ----------------
  { id: 'mob_hips', name: 'Mobilité hanches 10′', description: 'Ouverture hanches, amplitude progressive.', modality: 'mobility', intensity: 'low', tags: ['mobility','hip_load'], defaultDurationMin: 10 },
  { id: 'mob_ankle', name: 'Mobilité cheville 10′', description: 'Dorsiflexion, contrôle et stabilité.', modality: 'mobility', intensity: 'low', tags: ['mobility','ankle_stress'], defaultDurationMin: 10 },
  { id: 'mob_tspine', name: 'Mobilité T-spine 10′', description: 'Rotation thoracique, mobilité douce.', modality: 'mobility', intensity: 'low', tags: ['mobility','spine_load'], defaultDurationMin: 10 },
  { id: 'mob_shoulder', name: 'Mobilité épaule 10′', description: 'Amplitude douce, scapulas actives.', modality: 'mobility', intensity: 'low', tags: ['mobility','shoulder_load'], defaultDurationMin: 10 },

  // ---------------- CIRCUIT ----------------
  { id: 'circuit_low_bodyweight', name: 'Circuit poids du corps (bas)', description: 'Endurance locale, technique propre.', modality: 'circuit', intensity: 'low', tags: ['technique'] },
  { id: 'circuit_mod_mix', name: 'Circuit mix 20′', description: 'Alternance cardio/force, rythme régulier.', modality: 'circuit', intensity: 'moderate', tags: ['impact'] },
  { id: 'circuit_hi', name: 'Circuit HI modifié', description: 'Intensité haute, récup contrôlée.', modality: 'circuit', intensity: 'high', tags: ['impact','heavy_lower','heavy_upper'] },

  // ---------------- RUN (extended) ----------------
  { id: 'easy_jog_20_30', name: 'Footing facile 20-30′', description: 'Footing continu, aisance respiratoire.', modality: 'run', intensity: 'low', tags: ['tempo','technique'], defaultDurationMin: 25 },
  { id: 'tempo_20_30', name: 'Tempo 20-30′', description: 'Rythme soutenu mais contrôlé.', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 25 },
  { id: 'run_strides', name: 'Strides progressifs', description: 'Accélérations courtes, technique propre.', modality: 'run', intensity: 'moderate', tags: ['sprint','technique'], variants: ['run_strides_10_15s','run_build_up_20_30m','sprint_flying_10m'] },
  { id: 'match_recovery_jog', name: 'Jog récup match', description: 'Récup active, relâchement.', modality: 'run', intensity: 'low', tags: ['tempo','technique'] },
  { id: 'run_walk_run_intervals_20', name: 'Alternance marche/course 20′', description: 'Progressif, facile à réguler.', modality: 'run', intensity: 'low', tags: ['tempo'], defaultDurationMin: 20 },
  { id: 'bike_easy_25_35', name: 'Vélo facile 25-35′', description: 'Cardio doux, sans impact.', modality: 'run', intensity: 'low', tags: ['tempo'], defaultDurationMin: 30 },
  { id: 'row_easy_15_25', name: 'Rameur facile 15-25′', description: 'Cardio doux, tronc gainé.', modality: 'run', intensity: 'low', tags: ['tempo'], defaultDurationMin: 20 },
  { id: 'incline_walk_20_30', name: 'Marche inclinée 20-30′', description: 'Cardio modéré, sans choc.', modality: 'run', intensity: 'low', tags: ['tempo'], defaultDurationMin: 25 },
  { id: 'run_fartlek_easy_20', name: 'Fartlek facile 20′', description: 'Variations légères, rythme libre.', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 20 },
  { id: 'run_strides_10_15s', name: 'Strides 10-15s', description: 'Accélérations courtes, posture propre.', modality: 'run', intensity: 'moderate', tags: ['sprint','technique'] },
  { id: 'run_build_up_20_30m', name: 'Build-up 20-30m', description: 'Montée en vitesse progressive.', modality: 'run', intensity: 'moderate', tags: ['sprint','technique'] },
  { id: 'sprint_accel_5m', name: 'Accélération 5m', description: 'Sortie explosive, premiers appuis.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_accel_10m', name: 'Accélération 10m', description: 'Projection + drive, technique propre.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_accel_15m', name: 'Accélération 15m', description: 'Transition vitesse, appuis rapides.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_accel_20m', name: 'Accélération 20m', description: 'Montée en vitesse, posture solide.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_falling_start_10m', name: 'Falling start 10m', description: 'Départ incliné, réactivité.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_hill_8_10s', name: 'Côtes sprint 8-10s', description: 'Puissance, poussée forte.', modality: 'run', intensity: 'high', tags: ['sprint','calf_load'] },
  { id: 'speed_wall_drill_hold', name: 'Wall drill hold', description: 'Position sprint, gainage actif.', modality: 'run', intensity: 'moderate', tags: ['technique'] },
  { id: 'speed_wall_drill_switches', name: 'Wall drill switches', description: 'Alternance appuis, rythme rapide.', modality: 'run', intensity: 'moderate', tags: ['technique'] },
  { id: 'speed_a_march', name: 'A-march', description: 'Coordination, montée de genou.', modality: 'run', intensity: 'low', tags: ['technique'] },
  { id: 'speed_a_skip', name: 'A-skip', description: 'Coordination, réactivité.', modality: 'run', intensity: 'moderate', tags: ['technique'] },
  { id: 'speed_dribbles', name: 'Dribbles', description: 'Appuis rapides, cheville active.', modality: 'run', intensity: 'moderate', tags: ['technique','ankle_stress'] },
  { id: 'speed_fast_leg_cycles', name: 'Fast leg cycles', description: 'Cyclage rapide, posture propre.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },
  { id: 'sprint_flying_10m', name: 'Flying 10m', description: 'Vitesse max, relâchement.', modality: 'run', intensity: 'high', tags: ['sprint','technique'] },

  // ---------------- PLYO (extended) ----------------
  { id: 'plyo_pogo_hops', name: 'Pogo hops', description: 'Contacts courts, cheville réactive.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','ankle_stress'] },
  { id: 'plyo_line_hops_lateral', name: 'Line hops latéraux', description: 'Appuis rapides, genou stable.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact'] },
  { id: 'plyo_line_hops_fwd_back', name: 'Line hops avant/arrière', description: 'Rythme, coordination et équilibre.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact'] },
  { id: 'plyo_ankle_bounces', name: 'Ankle bounces', description: 'Ressort cheville, posture haute.', modality: 'plyo', intensity: 'low', tags: ['plyo','jump','ankle_stress'] },
  { id: 'plyo_snapdown_stick', name: 'Snapdown + stick', description: 'Freinage propre, gainage actif.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','impact','technique'] },
  { id: 'plyo_jump_rope_easy', name: 'Corde à sauter facile', description: 'Coordination, rythme léger.', modality: 'plyo', intensity: 'low', tags: ['plyo','jump','ankle_stress'] },
  { id: 'plyo_cmj_stick', name: 'CMJ + stick', description: 'Saut vertical + réception propre.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact'], variants: ['plyo_squat_jump_stick','plyo_vertical_jump_reach','plyo_broad_jump_stick'] },
  { id: 'plyo_squat_jump_stick', name: 'Squat jump + stick', description: 'Puissance + réception contrôlée.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact'] },
  { id: 'plyo_vertical_jump_reach', name: 'Saut vertical (reach)', description: 'Puissance verticale, posture haute.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump'] },
  { id: 'plyo_broad_jump_stick', name: 'Broad jump + stick', description: 'Projection horizontale, réception stable.', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact'] },
  { id: 'plyo_jump_forward_step_stick', name: 'Saut avant + step + stick', description: 'Coordination + stabilité.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact'] },
  { id: 'plyo_single_leg_hop_stick', name: 'Saut jambe unique + stick', description: 'Stabilité, genou aligné.', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact','ankle_stress'] },
  { id: 'plyo_lateral_bound_stick', name: 'Lateral bound + stick', description: 'Puissance latérale, contrôle genou.', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact','knee_stress'] },
  { id: 'plyo_skater_jump_stick', name: 'Skater jump + stick', description: 'Latéral, appuis stables.', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact'] },
  { id: 'plyo_single_leg_hop_in_place_stick', name: 'Hop sur place + stick', description: 'Stabilité cheville/genou.', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','ankle_stress'] },

  // ---------------- STRENGTH (extended) ----------------
  { id: 'str_front_squat', name: 'Front squat', description: 'Force quadris, tronc gainé.', modality: 'strength', intensity: 'high', tags: ['heavy_lower','quad_load'], variants: ['str_back_squat','str_box_squat','str_goblet_squat'] },
  { id: 'str_box_squat', name: 'Box squat', description: 'Force bas du corps, contrôle amplitude.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_pause_squat', name: 'Pause squat', description: 'Contrôle en bas, stabilité.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_wall_sit', name: 'Wall sit', description: 'Isométrie quadris, tenue solide.', modality: 'strength', intensity: 'low', tags: ['quad_load','knee_stress'] },
  { id: 'str_hack_squat_machine', name: 'Hack squat machine', description: 'Quadris, amplitude guidée.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','quad_load'] },
  { id: 'str_belt_squat', name: 'Belt squat', description: 'Force bas sans charge dos.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','quad_load'] },
  { id: 'str_goblet_box_squat', name: 'Goblet box squat', description: 'Squat contrôlé, repère box.', modality: 'strength', intensity: 'low', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_air_squat_box', name: 'Air squat box', description: 'Technique squat, amplitude guidée.', modality: 'strength', intensity: 'low', tags: ['technique','knee_stress'] },
  { id: 'str_spanish_squat_iso', name: 'Spanish squat iso', description: 'Isométrie quadris, genou tolérant.', modality: 'strength', intensity: 'low', tags: ['quad_load','knee_stress'] },
  { id: 'str_sit_to_stand', name: 'Sit to stand', description: 'Force fonctionnelle, contrôle genou.', modality: 'strength', intensity: 'low', tags: ['technique','knee_stress'] },
  { id: 'str_trapbar_deadlift', name: 'Trap bar deadlift', description: 'Force globale, posture stable.', modality: 'strength', intensity: 'high', tags: ['heavy_lower','spine_load'], variants: ['str_bb_hip_thrust','str_db_hip_thrust','str_db_rdl','str_kb_deadlift'] },
  { id: 'str_rdl_bar', name: 'RDL barre', description: 'Charnière hanche, ischios.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','spine_load'] },
  { id: 'str_good_morning', name: 'Good morning', description: 'Charnière hanche, tronc solide.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','spine_load'] },
  { id: 'str_bb_hip_thrust', name: 'Hip thrust barre', description: 'Extension hanche, fessiers.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','heavy_lower'] },
  { id: 'str_db_hip_thrust', name: 'Hip thrust haltères', description: 'Extension hanche, contrôle amplitude.', modality: 'strength', intensity: 'moderate', tags: ['hip_load'] },
  { id: 'str_glute_bridge', name: 'Glute bridge', description: 'Activation fessiers, bassin stable.', modality: 'strength', intensity: 'low', tags: ['hip_load','technique'] },
  { id: 'str_single_leg_bridge', name: 'Glute bridge unilat', description: 'Stabilité bassin, fessier actif.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','technique'] },
  { id: 'str_single_leg_rdl', name: 'RDL unilat', description: 'Charnière hanche, équilibre.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','technique'] },
  { id: 'str_single_leg_rdl_reach', name: 'RDL unilat reach', description: 'Équilibre + chaîne postérieure.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','technique'] },
  { id: 'str_db_rdl', name: 'RDL haltères', description: 'Hanche, dos neutre.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','spine_load'] },
  { id: 'str_kb_deadlift', name: 'Deadlift kettlebell', description: 'Charnière simple, posture propre.', modality: 'strength', intensity: 'low', tags: ['hamstring_load','technique'] },
  { id: 'str_cable_pullthrough', name: 'Cable pull-through', description: 'Hanche, charge guidée.', modality: 'strength', intensity: 'moderate', tags: ['hip_load'] },
  { id: 'str_back_extension_45', name: 'Back extension 45°', description: 'Extension dos/hanche, contrôle.', modality: 'strength', intensity: 'moderate', tags: ['spine_load','hamstring_load'] },
  { id: 'str_hamstring_curl_machine', name: 'Hamstring curl machine', description: 'Ischios, amplitude contrôlée.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load'] },
  { id: 'str_swiss_ball_leg_curl', name: 'Leg curl swiss ball', description: 'Ischios + gainage.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','technique'] },
  { id: 'str_slider_leg_curl', name: 'Leg curl sliders', description: 'Ischios, contrôle excentrique.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load'] },
  { id: 'str_hip_thrust_iso_hold', name: 'Hip thrust iso hold', description: 'Isométrie fessiers, bassin stable.', modality: 'strength', intensity: 'low', tags: ['hip_load'] },
  { id: 'str_db_split_squat', name: 'Split squat haltères', description: 'Unilatéral, stabilité genou.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_bulgarian_split', name: 'Bulgarian split squat', description: 'Unilatéral, amplitude contrôlée.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_reverse_lunge', name: 'Fente arrière', description: 'Contrôle genou, stabilité.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_forward_lunge', name: 'Fente avant', description: 'Force unilat, contrôle appui.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_step_up', name: 'Step-up', description: 'Force unilat, poussée talon.', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_step_down', name: 'Step-down', description: 'Contrôle excentrique genou.', modality: 'strength', intensity: 'moderate', tags: ['knee_stress','technique'] },
  { id: 'str_db_hip_airplane', name: 'Hip airplane', description: 'Stabilité hanche, contrôle.', modality: 'strength', intensity: 'low', tags: ['hip_load','technique'] },
  { id: 'str_split_squat_iso_hold', name: 'Split squat iso hold', description: 'Isométrie, stabilité genou.', modality: 'strength', intensity: 'low', tags: ['knee_stress','quad_load'] },
  { id: 'str_single_leg_box_squat', name: 'Box squat unilat', description: 'Contrôle unilat, amplitude.', modality: 'strength', intensity: 'moderate', tags: ['knee_stress','technique'] },
  { id: 'str_lateral_step_up', name: 'Step-up latéral', description: 'Plan frontal, stabilité hanche.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','knee_stress'] },
  { id: 'str_skater_squat_to_box', name: 'Skater squat to box', description: 'Unilatéral, contrôle profond.', modality: 'strength', intensity: 'moderate', tags: ['knee_stress','technique'] },
  { id: 'str_nordic', name: 'Nordic hamstrings', description: 'Excentrique ischios, prévention.', modality: 'strength', intensity: 'high', tags: ['hamstring_load'] },
  { id: 'str_razor_curl', name: 'Razor curl', description: 'Ischios, contrôle excentrique.', modality: 'strength', intensity: 'high', tags: ['hamstring_load'] },
  { id: 'str_ham_walkout', name: 'Hamstring walkout', description: 'Ischios + gainage.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load','technique'] },
  { id: 'str_copenhagen', name: 'Copenhagen plank', description: 'Adducteurs, stabilité latérale.', modality: 'strength', intensity: 'high', tags: ['hip_load'] },
  { id: 'str_nordic_assisted_band', name: 'Nordic assisté élastique', description: 'Excentrique assisté, contrôle.', modality: 'strength', intensity: 'moderate', tags: ['hamstring_load'] },
  { id: 'str_eccentric_nordic_3s', name: 'Nordic excentrique 3s', description: 'Ischios, tempo lent.', modality: 'strength', intensity: 'high', tags: ['hamstring_load'] },
  { id: 'str_adductor_slide', name: 'Adductor slide', description: 'Adducteurs, contrôle latéral.', modality: 'strength', intensity: 'moderate', tags: ['hip_load'] },
  { id: 'str_adductor_squeeze_iso', name: 'Adductor squeeze iso', description: 'Isométrie adducteurs.', modality: 'strength', intensity: 'low', tags: ['hip_load'] },
  { id: 'str_copenhagen_short_lever', name: 'Copenhagen short lever', description: 'Adducteurs, version douce.', modality: 'strength', intensity: 'moderate', tags: ['hip_load'] },
  { id: 'str_db_press', name: 'Développé haltères', description: 'Force haut, trajectoire libre.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','shoulder_load'] },
  { id: 'str_incline_db_press', name: 'Développé incliné haltères', description: 'Haut pectoraux, stabilité.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','shoulder_load'] },
  { id: 'str_pushup', name: 'Pompes', description: 'Force haut, gainage actif.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','technique'] },
  { id: 'str_pushup_feet_elevated', name: 'Pompes pieds surélevés', description: 'Charge plus forte, gainage.', modality: 'strength', intensity: 'high', tags: ['heavy_upper'] },
  { id: 'str_landmine_press', name: 'Landmine press', description: 'Press diagonal, épaules stables.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','shoulder_load'] },
  { id: 'str_incline_pushup', name: 'Pompes inclinées', description: 'Version facile, technique propre.', modality: 'strength', intensity: 'low', tags: ['heavy_upper','technique'] },
  { id: 'str_floor_press_db', name: 'Floor press haltères', description: 'Press contrôlé, amplitude réduite.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_machine_chest_press', name: 'Chest press machine', description: 'Press guidé, volume.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_row', name: 'Row barre', description: 'Tirage dos, tronc gainé.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','spine_load'], variants: ['str_one_arm_row','str_chest_supported_row','str_cable_row','str_inverted_row','str_trx_row'] },
  { id: 'str_one_arm_row', name: 'Row unilat', description: 'Tirage, contrôle scapula.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_inverted_row', name: 'Row inversé', description: 'Tirage poids du corps.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_pullup', name: 'Tractions', description: 'Tirage vertical, gainage.', modality: 'strength', intensity: 'high', tags: ['heavy_upper'] },
  { id: 'str_band_row', name: 'Row élastique', description: 'Tirage léger, contrôle.', modality: 'strength', intensity: 'low', tags: ['heavy_upper','technique'] },
  { id: 'str_table_row', name: 'Row table', description: 'Tirage maison, gainage.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_lat_pulldown', name: 'Lat pulldown', description: 'Tirage vertical guidé.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_chest_supported_row', name: 'Row chest supported', description: 'Tirage dos sans contrainte lombaire.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_cable_row', name: 'Row poulie', description: 'Tirage horizontal, contrôle.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_trx_row', name: 'Row TRX', description: 'Tirage poids du corps.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_pullup_assisted_band', name: 'Tractions assistées', description: 'Tirage vertical assisté.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper'] },
  { id: 'str_face_pull', name: 'Face pull', description: 'Arrière d\'épaule, posture.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_band_pull_apart', name: 'Band pull-apart', description: 'Posture, scapulas actives.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_ytw_raise', name: 'YTW raise', description: 'Stabilité scapulaire.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_prone_ytw', name: 'Prone YTW', description: 'Posture, contrôle scapula.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_scap_pushup', name: 'Scap push-up', description: 'Serratus, contrôle épaules.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_wall_slide', name: 'Wall slide', description: 'Mobilité épaules, posture.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_band_external_rotation', name: 'Rotation externe élastique', description: 'Coiffe, contrôle.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_serratus_punch_band', name: 'Serratus punch', description: 'Stabilité scapulaire.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_prone_t_raise', name: 'Prone T raise', description: 'Arrière d\'épaule, posture.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_dead_hang', name: 'Dead hang', description: 'Décompression épaules, grip.', modality: 'strength', intensity: 'low', tags: ['shoulder_load'] },
  { id: 'str_scapular_pullup', name: 'Scapular pull-up', description: 'Contrôle scapula, tirage.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_low_trap_raise', name: 'Low trap raise', description: 'Stabilité scapulaire.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_band_w_external_rotation', name: 'Band W + rotation', description: 'Coiffe + posture.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_prone_cobra_hold', name: 'Prone cobra hold', description: 'Posture, gainage haut.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_wall_angels', name: 'Wall angels', description: 'Mobilité épaules, posture.', modality: 'strength', intensity: 'low', tags: ['shoulder_load','technique'] },
  { id: 'str_calf_raise', name: 'Mollets debout', description: 'Force mollets, tempo contrôlé.', modality: 'strength', intensity: 'moderate', tags: ['calf_load','ankle_stress'] },
  { id: 'str_calf_raise_bent_knee', name: 'Mollets genoux fléchis', description: 'Soleus, amplitude complète.', modality: 'strength', intensity: 'moderate', tags: ['calf_load','ankle_stress'] },
  { id: 'str_single_leg_calf_raise', name: 'Mollets unilat', description: 'Force cheville, stabilité.', modality: 'strength', intensity: 'moderate', tags: ['calf_load','ankle_stress'] },
  { id: 'str_tib_raise', name: 'Tibialis raise', description: 'Tibia, prévention.', modality: 'strength', intensity: 'moderate', tags: ['ankle_stress','technique'] },
  { id: 'str_ankle_dorsiflexion_band', name: 'Dorsiflexion élastique', description: 'Cheville, amplitude contrôlée.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','technique'] },
  { id: 'str_toe_walks', name: 'Toe walks', description: 'Stabilité cheville, endurance.', modality: 'strength', intensity: 'low', tags: ['ankle_stress'] },
  { id: 'str_heel_walks', name: 'Heel walks', description: 'Tibia, prévention.', modality: 'strength', intensity: 'low', tags: ['ankle_stress'] },
  { id: 'str_band_inversion_eversion', name: 'Inversion/éversion bande', description: 'Cheville, contrôle latéral.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','technique'] },
  { id: 'str_single_leg_balance_reach', name: 'Balance reach unilat', description: 'Stabilité cheville/hanche.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','hip_load'] },
  { id: 'str_lateral_step_down', name: 'Step-down latéral', description: 'Contrôle genou, plan frontal.', modality: 'strength', intensity: 'moderate', tags: ['knee_stress','hip_load'] },
  { id: 'str_side_shuffle_band', name: 'Side shuffle band', description: 'Plan frontal, hanches actives.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','technique'] },
  { id: 'str_seated_calf_raise', name: 'Mollets assis', description: 'Soleus, volume.', modality: 'strength', intensity: 'moderate', tags: ['calf_load'] },
  { id: 'str_soleus_iso_hold_wall', name: 'Soleus iso wall', description: 'Isométrie cheville.', modality: 'strength', intensity: 'low', tags: ['calf_load'] },
  { id: 'str_single_leg_soleus_iso', name: 'Soleus iso unilat', description: 'Isométrie mollet unilat.', modality: 'strength', intensity: 'moderate', tags: ['calf_load'] },
  { id: 'str_jump_rope_easy', name: 'Corde à sauter facile', description: 'Rythme léger, appuis doux.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','technique'] },
  { id: 'str_pogo_hops_low', name: 'Pogo hops low', description: 'Contacts courts, faible amplitude.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','jump'] },
  { id: 'str_short_foot', name: 'Short foot', description: 'Voûte plantaire, contrôle.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','technique'] },
  { id: 'str_toe_yoga', name: 'Toe yoga', description: 'Contrôle orteils, stabilité.', modality: 'strength', intensity: 'low', tags: ['ankle_stress','technique'] },
  { id: 'str_lateral_band_walk', name: 'Lateral band walk', description: 'Hanches, plan frontal.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','technique'] },
  { id: 'str_monster_walk', name: 'Monster walk', description: 'Hanches, posture stable.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','technique'] },
  { id: 'str_side_plank_hip_abduction', name: 'Side plank + abduction', description: 'Tronc + hanches, contrôle.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','technique'] },
  { id: 'str_lateral_lunge', name: 'Fente latérale', description: 'Plan frontal, adducteurs.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','knee_stress'] },
  { id: 'str_cossack', name: 'Cossack squat', description: 'Mobilité + force latérale.', modality: 'strength', intensity: 'moderate', tags: ['hip_load','mobility'] },

  // ---------------- CORE (extended) ----------------
  { id: 'core_rkc_plank', name: 'RKC plank', description: 'Gainage intense, tension totale.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_bird_dog', name: 'Bird dog', description: 'Stabilité tronc, contrôle.', modality: 'core', intensity: 'low', tags: ['technique'] },
  { id: 'core_suitcase_carry', name: 'Suitcase carry', description: 'Anti-inclinaison, gainage.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_farmer_carry', name: 'Farmer carry', description: 'Gainage + posture.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_band_chop', name: 'Band chop', description: 'Rotation contrôlée, tronc actif.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_pallof_iso_march', name: 'Pallof iso march', description: 'Anti-rotation dynamique.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_hollow_hold', name: 'Hollow hold', description: 'Gainage profond, posture.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_plank_shoulder_taps', name: 'Plank shoulder taps', description: 'Stabilité + contrôle.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_stir_the_pot_swissball', name: 'Stir the pot swissball', description: 'Gainage dynamique.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_half_kneeling_pallof', name: 'Half kneeling pallof', description: 'Anti-rotation, stabilité.', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_deadbug_band_resisted', name: 'Dead bug band', description: 'Gainage + résistance.', modality: 'core', intensity: 'moderate', tags: ['technique'] },

  // ---------------- COD (extended) ----------------
  { id: 'cod_decel_to_stick', name: 'Décélération + stick', description: 'Freinage propre, contrôle genou.', modality: 'cod', intensity: 'moderate', tags: ['cuts','impact','technique'] },
  { id: 'cod_45_cut_tech', name: 'Coupe 45° technique', description: 'Appuis propres, angles nets.', modality: 'cod', intensity: 'moderate', tags: ['cuts','technique'] },
  { id: 'cod_90_cut_tech', name: 'Coupe 90° technique', description: 'Freinage + relance, contrôle.', modality: 'cod', intensity: 'moderate', tags: ['cuts','impact'] },
  { id: 'cod_shuffle_to_sprint_5_10m', name: 'Shuffle + sprint 5-10m', description: 'Transition latéral → sprint.', modality: 'cod', intensity: 'high', tags: ['cuts','impact'] },
  { id: 'cod_lateral_shuffle_decel', name: 'Lateral shuffle + décél', description: 'Contrôle plan frontal.', modality: 'cod', intensity: 'moderate', tags: ['cuts','impact'] },

  // ---------------- POWER / UPPER (extended) ----------------
  { id: 'mb_chest_pass_wall', name: 'Medball chest pass', description: 'Puissance haut, projection rapide.', modality: 'strength', intensity: 'moderate', tags: ['impact','technique'] },
  { id: 'mb_rotational_throw_wall', name: 'Medball rotation wall', description: 'Puissance rotation, tronc actif.', modality: 'strength', intensity: 'moderate', tags: ['impact','technique'] },
  { id: 'mb_overhead_slam', name: 'Medball overhead slam', description: 'Puissance, tronc gainé.', modality: 'strength', intensity: 'moderate', tags: ['impact','technique'] },
  { id: 'upper_fast_pushup', name: 'Pompes explosives', description: 'Vitesse d\'exécution, contrôle.', modality: 'strength', intensity: 'high', tags: ['heavy_upper','technique'] },
  { id: 'upper_hand_release_pushup', name: 'Pompes hand-release', description: 'Amplitude complète, tronc stable.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','technique'] },
  { id: 'upper_incline_fast_pushup', name: 'Pompes explosives inclinées', description: 'Vitesse + technique propre.', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','technique'] },
];

// Aligne l'app sur la bibliothèque backend: si un id est manquant localement, on génère un stub.
const baseById = BASE_EXERCISE_BANK.reduce(
  (acc, ex) => {
    acc[ex.id] = ex;
    return acc;
  },
  {} as Record<string, ExerciseDef>
);

export const EXERCISE_BANK: ExerciseDef[] = [
  ...BASE_EXERCISE_BANK,
  ...BACKEND_EXERCISE_IDS.filter((id) => !baseById[id]).map((id) => buildExerciseFromBackendId(id)),
];

export const EXERCISE_BY_ID: Record<string, ExerciseDef> = EXERCISE_BANK.reduce(
  (acc, ex) => {
    acc[ex.id] = ex;
    return acc;
  },
  {} as Record<string, ExerciseDef>
);
