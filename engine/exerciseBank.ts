// engine/exerciseBank.ts
// Banque d'exos autonome (pas d'import domain/* pour éviter les cycles)

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

export interface ExerciseDef {
  id: string;
  name: string;
  modality: BankModality;
  intensity: BankIntensity;
  tags: ExerciseTag[];
  defaultDurationMin?: number;
  defaultSets?: number;
}

export const EXERCISE_BANK: ExerciseDef[] = [
  // ---------------- RUN ----------------
  { id: 'run_easy_20', name: 'Footing facile 20′', modality: 'run', intensity: 'low', tags: ['tempo','technique'], defaultDurationMin: 20 },
  { id: 'run_mod_30', name: 'Endurance modérée 30′', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 30 },
  { id: 'run_tempo_2x8', name: 'Tempo 2×8′', modality: 'run', intensity: 'moderate', tags: ['tempo'], defaultDurationMin: 30 },
  { id: 'run_intervals_8x200', name: 'Intervalles 8×200m', modality: 'run', intensity: 'high', tags: ['sprint','hamstring_load','ankle_stress'] },
  { id: 'run_hills_10x10s', name: 'Côtes 10×10s', modality: 'run', intensity: 'high', tags: ['sprint','hamstring_load','calf_load'] },

  // ---------------- PLYO ----------------
  { id: 'plyo_low_skips', name: 'Skips basiques', modality: 'plyo', intensity: 'low', tags: ['plyo','jump','technique','ankle_stress'] },
  { id: 'plyo_box_low', name: 'Box step-ups sautés bas', modality: 'plyo', intensity: 'moderate', tags: ['plyo','jump','impact','knee_stress'] },
  { id: 'plyo_depth_jumps', name: 'Depth jumps', modality: 'plyo', intensity: 'high', tags: ['plyo','jump','impact','knee_stress','ankle_stress'] },

  // ---------------- STRENGTH ----------------
  { id: 'str_goblet_squat', name: 'Goblet squat', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','knee_stress'] },
  { id: 'str_rdl', name: 'RDL barre', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','hamstring_load','spine_load'] },
  { id: 'str_back_squat', name: 'Back squat lourd', modality: 'strength', intensity: 'high', tags: ['heavy_lower','knee_stress','spine_load'] },
  { id: 'str_leg_press', name: 'Presse à cuisses', modality: 'strength', intensity: 'moderate', tags: ['heavy_lower','quad_load'] },
  { id: 'str_bench_press', name: 'Développé couché', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','shoulder_load'] },
  { id: 'str_oh_press', name: 'Développé épaules (overhead)', modality: 'strength', intensity: 'moderate', tags: ['heavy_upper','overhead','shoulder_load'] },
  { id: 'str_deadlift_heavy', name: 'Soulevé de terre lourd', modality: 'strength', intensity: 'high', tags: ['heavy_lower','spine_load','hamstring_load'] },

  // ---------------- COD ----------------
  { id: 'cod_cone_drills_low', name: 'Drills plots basiques', modality: 'cod', intensity: 'low', tags: ['cuts','technique'] },
  { id: 'cod_t_drill', name: 'T-Drill', modality: 'cod', intensity: 'moderate', tags: ['cuts','impact'] },
  { id: 'cod_505', name: 'Test 5-0-5 (répétitions)', modality: 'cod', intensity: 'high', tags: ['cuts','impact','hamstring_load','ankle_stress'] },

  // ---------------- CORE ----------------
  { id: 'core_plank', name: 'Gainage planche', modality: 'core', intensity: 'low', tags: ['technique'] },
  { id: 'core_side_plank', name: 'Gainage latéral', modality: 'core', intensity: 'low', tags: ['technique'] },
  { id: 'core_pallof', name: 'Pallof press', modality: 'core', intensity: 'moderate', tags: ['technique'] },
  { id: 'core_deadbug', name: 'Dead bug', modality: 'core', intensity: 'low', tags: ['technique'] },

  // ---------------- MOBILITY ----------------
  { id: 'mob_hips', name: 'Mobilité hanches 10′', modality: 'mobility', intensity: 'low', tags: ['mobility','hip_load'], defaultDurationMin: 10 },
  { id: 'mob_ankle', name: 'Mobilité cheville 10′', modality: 'mobility', intensity: 'low', tags: ['mobility','ankle_stress'], defaultDurationMin: 10 },
  { id: 'mob_tspine', name: 'Mobilité T-spine 10′', modality: 'mobility', intensity: 'low', tags: ['mobility','spine_load'], defaultDurationMin: 10 },
  { id: 'mob_shoulder', name: 'Mobilité épaule 10′', modality: 'mobility', intensity: 'low', tags: ['mobility','shoulder_load'], defaultDurationMin: 10 },

  // ---------------- CIRCUIT ----------------
  { id: 'circuit_low_bodyweight', name: 'Circuit poids du corps (bas)', modality: 'circuit', intensity: 'low', tags: ['technique'] },
  { id: 'circuit_mod_mix', name: 'Circuit mix 20′', modality: 'circuit', intensity: 'moderate', tags: ['impact'] },
  { id: 'circuit_hi', name: 'Circuit HI modifié', modality: 'circuit', intensity: 'high', tags: ['impact','heavy_lower','heavy_upper'] },
];
