// screens/tests/testConfig.ts
import { Ionicons } from "@expo/vector-icons";

export type GroupConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  tint: string;
};

export const GROUP_CONFIG: Record<string, GroupConfig> = {
  sauts: { icon: "rocket-outline", colors: ["#8b5cf6", "#a78bfa"], tint: "#8b5cf6" },
  vitesse: { icon: "flash-outline", colors: ["#ff7a1a", "#ff9a4a"], tint: "#ff7a1a" },
  endurance: { icon: "heart-outline", colors: ["#06b6d4", "#22d3ee"], tint: "#06b6d4" },
  force: { icon: "barbell-outline", colors: ["#ef4444", "#f87171"], tint: "#ef4444" },
  agilite: { icon: "git-branch-outline", colors: ["#16a34a", "#4ade80"], tint: "#16a34a" },
  power: { icon: "trending-up-outline", colors: ["#f59e0b", "#fbbf24"], tint: "#f59e0b" },
};

export const getGroupConfig = (group: string): GroupConfig =>
  GROUP_CONFIG[group] ?? { icon: "ellipse-outline", colors: ["#6b7280", "#9ca3af"], tint: "#6b7280" };

export type PlaylistId =
  | "fondation"
  | "force"
  | "explosivite"
  | "endurance"
  | "saison";

export type TestEntry = {
  ts: number;
  playlist?: PlaylistId;
  broadJumpCm?: number;
  tripleJumpCm?: number;
  cmjCm?: number;
  lateralBoundCm?: number;
  sprint10s?: number;
  sprint20s?: number;
  sprint30s?: number;
  tTest_s?: number;
  test505_s?: number;
  endurance6min_m?: number;
  yoYoIR1_m?: number;
  run1km_s?: number;
  gobletKg?: number;
  gobletReps?: number;
  splitKg?: number;
  splitReps?: number;
  trapbar3rmKg?: number;
  notes?: string;
};

export type FieldKey = keyof Omit<TestEntry, "ts" | "playlist">;

export type FieldConfig = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  unit: string;
  group: "sauts" | "vitesse" | "endurance" | "force" | "agilite" | "power";
  lowerIsBetter?: boolean;
  min?: number;
  max?: number;
  protocol: string;
};

export type Mode = "battery" | "entry";
export type StepId = FieldKey | "notes";

export const FIELD_DEFS: FieldConfig[] = [
  {
    key: "broadJumpCm",
    label: "Saut en longueur (cm)",
    unit: "cm",
    group: "sauts",
    min: 20,
    max: 500,
    protocol: "3 essais, meilleur saut. Bras libres, atterrissage stable.",
  },
  {
    key: "tripleJumpCm",
    label: "Triple bonds (cm)",
    unit: "cm",
    group: "sauts",
    min: 50,
    max: 1500,
    protocol: "3 essais, prise d'élan courte, note le meilleur.",
  },
  {
    key: "cmjCm",
    label: "Counter movement jump (cm)",
    unit: "cm",
    group: "power",
    min: 5,
    max: 200,
    protocol: "3 essais, mains sur hanches si possible. Note le meilleur.",
  },
  {
    key: "lateralBoundCm",
    label: "Saut latéral (cm)",
    unit: "cm",
    group: "sauts",
    min: 20,
    max: 400,
    protocol: "3 essais par côté, note la meilleure distance.",
  },
  {
    key: "sprint10s",
    label: "Sprint 10 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol: "2-3 essais, repos 2-3 min. Chrono manuel ok.",
  },
  {
    key: "sprint20s",
    label: "Sprint 20 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol: "2 essais, repos 3 min. Départ identique.",
  },
  {
    key: "sprint30s",
    label: "Sprint 30 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol: "2 essais, repos 3-4 min. Qualité max.",
  },
  {
    key: "tTest_s",
    label: "T-test (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol: "2 essais, repos 3 min. Technique propre.",
  },
  {
    key: "test505_s",
    label: "Test 505 (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol: "2 essais par côté, repos 2-3 min.",
  },
  {
    key: "endurance6min_m",
    label: "Endurance 6 min (m)",
    unit: "m",
    group: "endurance",
    min: 100,
    max: 3000,
    protocol: "Distance totale en 6 min. Allure stable.",
  },
  {
    key: "yoYoIR1_m",
    label: "Yo-Yo IR1 (m)",
    unit: "m",
    group: "endurance",
    min: 40,
    max: 5000,
    protocol: "Protocole Yo-Yo IR1, note la distance totale.",
  },
  {
    key: "run1km_s",
    label: "1 km (s)",
    unit: "s",
    group: "endurance",
    lowerIsBetter: true,
    min: 90,
    max: 3600,
    protocol: "1 km chrono, allure continue. Note le temps.",
  },
  {
    key: "gobletKg",
    label: "Goblet squat charge (kg)",
    unit: "kg",
    group: "force",
    min: 1,
    max: 150,
    protocol: "Charge pour 8-10 reps propres.",
  },
  {
    key: "gobletReps",
    label: "Goblet squat reps",
    unit: "",
    group: "force",
    min: 1,
    max: 100,
    protocol: "Reps avec la charge choisie, tempo contrôlé.",
  },
  {
    key: "splitKg",
    label: "Split squat charge (kg)",
    unit: "kg",
    group: "force",
    min: 1,
    max: 200,
    protocol: "Charge pour 6-8 reps / jambe, amplitude propre.",
  },
  {
    key: "splitReps",
    label: "Split squat reps",
    unit: "",
    group: "force",
    min: 1,
    max: 100,
    protocol: "Reps par jambe avec la charge choisie.",
  },
  {
    key: "trapbar3rmKg",
    label: "Trap bar 3RM (kg)",
    unit: "kg",
    group: "force",
    min: 10,
    max: 400,
    protocol: "Monte en 3-4 séries, 3RM propre, pas d'échec.",
  },
];

export const FIELD_BY_KEY = FIELD_DEFS.reduce<Record<FieldKey, FieldConfig>>((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {} as Record<FieldKey, FieldConfig>);

export const PLAYLISTS: Record<PlaylistId, { label: string; subtitle: string }> = {
  fondation: { label: "Fondation", subtitle: "Base physique / S&C + endurance" },
  force: { label: "Force", subtitle: "Force max + charges lourdes" },
  explosivite: { label: "Explosivité", subtitle: "Vitesse + détente + puissance" },
  endurance: { label: "Endurance", subtitle: "Tenir 90 min + sprints répétés" },
  saison: { label: "Saison / Maintien", subtitle: "Maintenir la forme sans se cramer" },
};

export const PLAYLIST_FIELDS: Record<PlaylistId, FieldKey[]> = {
  fondation: [
    "broadJumpCm",
    "sprint10s",
    "sprint20s",
    "endurance6min_m",
    "gobletKg",
    "gobletReps",
    "splitKg",
    "splitReps",
  ],
  force: ["gobletKg", "gobletReps", "splitKg", "splitReps", "trapbar3rmKg"],
  explosivite: [
    "cmjCm",
    "broadJumpCm",
    "sprint10s",
    "sprint30s",
    "trapbar3rmKg",
    "splitKg",
  ],
  endurance: ["yoYoIR1_m", "endurance6min_m", "run1km_s"],
  saison: ["yoYoIR1_m", "endurance6min_m", "sprint10s", "cmjCm"],
};

export const PLAYLIST_PLAN: Record<PlaylistId, string[]> = {
  fondation: [
    "Échauffement structuré (mobilité + activation + lignes droites)",
    "Sauts : broad jump",
    "Vitesse : 10-20 m",
    "Pause 5-8 min (hydratation)",
    "Endurance : 6 min",
    "Force repère : goblet squat ou split squat",
  ],
  force: [
    "Échauffement force (mobilité + activation)",
    "Test principal : trap bar 3RM (ou charge lourde 3-5 reps)",
    "Repos 6-8 min",
    "Test secondaire : goblet/split squat (qualité technique)",
  ],
  explosivite: [
    "Échauffement nerveux : gammes + 3 lignes droites",
    "Sauts : CMJ + broad jump",
    "Vitesse : 10-30 m (qualité max)",
    "Pause 6-8 min",
    "Force/power : trap bar 3RM (ou charge lourde 3-5 reps)",
  ],
  endurance: [
    "Échauffement progressif 10-12 min",
    "Test principal : Yo-Yo IR1 ou 6 min",
    "Récupération 6-8 min",
    "Test secondaire : 1 km (temps)",
  ],
  saison: [
    "Échauffement progressif 8-10 min",
    "Test endurance : 6 min ou Yo-Yo IR1",
    "Pause 5-6 min",
    "Test vitesse : 10 m",
    "Test puissance : CMJ",
  ],
};

export const isPlaylistId = (value: any): value is PlaylistId =>
  value === "fondation" ||
  value === "force" ||
  value === "explosivite" ||
  value === "endurance" ||
  value === "saison";

export const SHORT_LABELS: Partial<Record<FieldKey, string>> = {
  broadJumpCm: "BJ",
  tripleJumpCm: "Triple",
  cmjCm: "CMJ",
  lateralBoundCm: "Lat",
  sprint10s: "10m",
  sprint20s: "20m",
  sprint30s: "30m",
  tTest_s: "T-test",
  test505_s: "505",
  endurance6min_m: "6' m",
  yoYoIR1_m: "YoYo",
  run1km_s: "1km",
  gobletKg: "Goblet",
  gobletReps: "Reps G",
  splitKg: "Split",
  splitReps: "Reps S",
  trapbar3rmKg: "TB 3RM",
};
