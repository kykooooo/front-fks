// screens/videoLibrary/videoLibraryConfig.ts
import type { ExerciseDef, ExerciseTag, BankModality, BankIntensity } from "../../engine/exerciseBank";

export type CategoryView = BankModality | "favorites";
export type SortMode = "favorites" | "alpha" | "recent";

export type EquipmentKey =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "band"
  | "machine"
  | "kettlebell"
  | "box"
  | "bench"
  | "trx"
  | "bike"
  | "rower";

export const MODALITY_LABELS: Record<BankModality, string> = {
  run: "Course",
  circuit: "Circuit",
  strength: "Force",
  plyo: "Plyo",
  cod: "Agilité",
  core: "Core",
  mobility: "Mobilité",
};

export const MODALITY_DESCRIPTIONS: Record<BankModality, string> = {
  run: "Endurance, tempo, vitesse.",
  circuit: "Full body, cardio + force.",
  strength: "Force et prévention.",
  plyo: "Explosivité et appuis.",
  cod: "Agilité et changements.",
  core: "Gainage et stabilité.",
  mobility: "Amplitude et récupération.",
};

export const MODALITY_CONFIG: Record<
  BankModality | "favorites",
  { icon: string; tint: string; tintSoft: string }
> = {
  favorites: { icon: "star", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.12)" },
  run: { icon: "footsteps-outline", tint: "#2563eb", tintSoft: "rgba(37,99,235,0.10)" },
  circuit: { icon: "flash-outline", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.10)" },
  strength: { icon: "barbell-outline", tint: "#ef4444", tintSoft: "rgba(239,68,68,0.10)" },
  plyo: { icon: "rocket-outline", tint: "#8b5cf6", tintSoft: "rgba(139,92,246,0.10)" },
  cod: { icon: "git-branch-outline", tint: "#16a34a", tintSoft: "rgba(22,163,74,0.10)" },
  core: { icon: "shield-outline", tint: "#06b6d4", tintSoft: "rgba(6,182,212,0.10)" },
  mobility: { icon: "body-outline", tint: "#14b8a6", tintSoft: "rgba(20,184,166,0.10)" },
};

export const INTENSITY_LABELS: Record<BankIntensity, string> = {
  low: "Facile",
  moderate: "Modéré",
  high: "Élevé",
};

export const SORT_LABELS: Record<SortMode, string> = {
  favorites: "Favoris",
  alpha: "A-Z",
  recent: "Récents",
};

export const TAG_LABELS: Record<ExerciseTag, string> = {
  sprint: "Vitesse",
  plyo: "Plyo",
  heavy_lower: "Force bas",
  heavy_upper: "Force haut",
  overhead: "Overhead",
  cuts: "Changements",
  impact: "Impact",
  knee_stress: "Genou",
  ankle_stress: "Cheville",
  hamstring_load: "Ischios",
  quad_load: "Quadris",
  calf_load: "Mollets",
  hip_load: "Hanches",
  shoulder_load: "Épaules",
  spine_load: "Colonne",
  jump: "Sauts",
  tempo: "Tempo",
  technique: "Technique",
  mobility: "Mobilité",
};

export const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
  bodyweight: "Sans matériel",
  dumbbell: "Haltère",
  barbell: "Barre",
  band: "Élastique",
  machine: "Machine",
  kettlebell: "Kettlebell",
  box: "Box",
  bench: "Banc",
  trx: "TRX",
  bike: "Vélo",
  rower: "Rameur",
};

export const EQUIPMENT_ORDER: EquipmentKey[] = [
  "bodyweight", "dumbbell", "barbell", "kettlebell", "band",
  "machine", "box", "bench", "trx", "bike", "rower",
];

export const MODALITY_ORDER: BankModality[] = [
  "run", "plyo", "strength", "cod", "circuit", "core", "mobility",
];

export const TAG_ORDER: ExerciseTag[] = [
  "sprint", "plyo", "jump", "tempo", "technique",
  "heavy_lower", "heavy_upper", "cuts", "impact",
  "knee_stress", "ankle_stress", "hamstring_load", "quad_load",
  "calf_load", "hip_load", "shoulder_load", "spine_load", "mobility",
];

// ─── Pure helpers ───

export const intensityTone = (intensity: BankIntensity) => {
  if (intensity === "high") return "danger";
  if (intensity === "moderate") return "warn";
  return "ok";
};

export const inferEquipment = (item: ExerciseDef): EquipmentKey[] => {
  const id = item.id.toLowerCase();
  const equip = new Set<EquipmentKey>();
  if (id.includes("db_") || id.includes("_db")) equip.add("dumbbell");
  if (
    id.includes("bb_") || id.includes("_bb") || id.includes("bench_press") ||
    id.includes("back_squat") || id.includes("front_squat") ||
    id.includes("deadlift") || id.includes("rdl_bar")
  ) equip.add("barbell");
  if (id.includes("kb_") || id.includes("_kb")) equip.add("kettlebell");
  if (id.includes("band") || id.includes("elastic")) equip.add("band");
  if (id.includes("machine") || id.includes("cable") || id.includes("pulldown")) equip.add("machine");
  if (id.includes("trx")) equip.add("trx");
  if (id.includes("box") || id.includes("step_up") || id.includes("step_down")) equip.add("box");
  if (id.includes("bench") || id.includes("floor_press")) equip.add("bench");
  if (id.startsWith("bike_")) equip.add("bike");
  if (id.startsWith("row_")) equip.add("rower");
  if (equip.size === 0) equip.add("bodyweight");
  return Array.from(equip);
};

export const isBallExercise = (item: ExerciseDef) => {
  const id = item.id.toLowerCase();
  return (
    id.includes("football") ||
    id.includes("medball") ||
    id.startsWith("mb_") ||
    id.includes("swiss_ball") ||
    id.includes("fitball") ||
    id.includes("medicine_ball")
  );
};

export const formatDefaults = (item: ExerciseDef) => {
  const parts: string[] = [];
  if (item.defaultSets) parts.push(`${item.defaultSets} séries`);
  if (item.defaultDurationMin) parts.push(`${item.defaultDurationMin} min`);
  return parts.join(" · ");
};
