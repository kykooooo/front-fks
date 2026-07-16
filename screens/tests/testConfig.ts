// screens/tests/testConfig.ts
import { Ionicons } from "@expo/vector-icons";
import type { AgeCategory } from "../../domain/types";

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
    protocol:
      "Trace une ligne de départ (scotch, trait, tee-shirt au sol). Pieds joints, prends de l'élan avec les bras et saute le plus loin possible. Mesure du talon le plus proche à la ligne. 3 essais, garde le meilleur, repos 1 min entre chaque.",
  },
  {
    key: "tripleJumpCm",
    label: "Triple bonds (cm)",
    unit: "cm",
    group: "sauts",
    min: 50,
    max: 1500,
    protocol:
      "Même ligne de départ que le saut en longueur. Enchaîne 3 bonds pieds joints sans t'arrêter, mesure la distance totale jusqu'au dernier appui. 3 essais, garde le meilleur, repos 1-2 min entre chaque.",
  },
  {
    key: "cmjCm",
    label: "Counter movement jump (cm)",
    unit: "cm",
    group: "power",
    min: 5,
    max: 200,
    protocol:
      "Debout, mains sur les hanches. Fléchis puis saute directement le plus haut possible (pas de temps d'arrêt en bas). Mesure avec une appli de saut au sol, ou une marque à la main tendue sur un mur avant/après. 3 essais, garde le meilleur, repos 1 min entre chaque.",
  },
  {
    key: "lateralBoundCm",
    label: "Saut latéral (cm)",
    unit: "cm",
    group: "sauts",
    min: 20,
    max: 400,
    protocol:
      "Départ sur un pied, élan, saute le plus loin possible sur le côté et réceptionne sur l'autre pied sans perdre l'équilibre. Mesure la distance. 3 essais par côté, garde la meilleure distance de chaque côté, repos 1 min entre essais.",
  },
  {
    key: "sprint10s",
    label: "Sprint 10 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol:
      "Pose deux repères à 10 m (sacs, plots, tee-shirts). Départ arrêté. Fais-toi chronométrer ou filme-toi. 2-3 essais, garde le meilleur, repos 2-3 min entre chaque.",
  },
  {
    key: "sprint20s",
    label: "Sprint 20 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol:
      "Pose deux repères à 20 m. Départ arrêté, chronométré ou filmé. 2 essais qualité max, repos 3 min entre chaque.",
  },
  {
    key: "sprint30s",
    label: "Sprint 30 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol:
      "Pose deux repères à 30 m. Départ arrêté, chronométré ou filmé. 2 essais qualité max, repos 3-4 min entre chaque.",
  },
  {
    key: "tTest_s",
    label: "T-test (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol:
      "Place 4 plots en T (5 m devant, 5 m de chaque côté). Sprint avant, pas chassés latéraux, recul en arrière. Chronomètre du 1er au dernier plot franchi. 2 essais, repos 3 min, technique propre avant vitesse.",
  },
  {
    key: "test505_s",
    label: "Test 505 (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    min: 0.5,
    max: 120,
    protocol:
      "Lance-toi sur 10 m, déclenche le chrono à 5 m de la ligne de demi-tour, change d'appui et reviens sur 5 m. Chronomètre l'aller-retour des 5 derniers mètres. 2 essais par côté, repos 2-3 min.",
  },
  {
    key: "endurance6min_m",
    label: "Endurance 6 min (m)",
    unit: "m",
    group: "endurance",
    min: 100,
    max: 3000,
    protocol:
      "Chronomètre 6 minutes. Cours à l'allure la plus rapide que tu peux tenir sur toute la durée (un rythme soutenu et régulier, pas un sprint qui s'effondre). Note la distance totale parcourue (terrain balisé, repères connus ou appli GPS).",
  },
  {
    key: "yoYoIR1_m",
    label: "Yo-Yo IR1 (m)",
    unit: "m",
    group: "endurance",
    min: 40,
    max: 5000,
    protocol:
      "Test avancé (club) : navettes de 20 m à vitesse croissante rythmées par un bip audio dédié, avec 10 s de récupération active entre chaque palier. Nécessite un fichier audio Yo-Yo IR1 et idéalement un partenaire pour garder le rythme. Note la distance totale parcourue avant l'arrêt.",
  },
  {
    key: "run1km_s",
    label: "1 km",
    unit: "s",
    group: "endurance",
    lowerIsBetter: true,
    min: 90,
    max: 3600,
    protocol:
      "Chronomètre 1 km sur un parcours plat et connu (piste, terrain, route calme). Allure continue du début à la fin, sans sprint final raté. Renseigne le temps en minutes et secondes.",
  },
  {
    key: "gobletKg",
    label: "Goblet squat charge (kg)",
    unit: "kg",
    group: "force",
    min: 1,
    max: 150,
    protocol:
      "Tiens une charge (haltère, kettlebell) contre la poitrine. Descends en squat complet, contrôlé, puis remonte. Choisis une charge que tu peux lever 8-10 fois avec une technique propre, sans t'effondrer sur les dernières reps.",
  },
  {
    key: "gobletReps",
    label: "Goblet squat reps",
    unit: "",
    group: "force",
    min: 1,
    max: 100,
    protocol:
      "Avec la charge choisie ci-dessus, fais un maximum de répétitions propres (amplitude complète, tempo contrôlé). Arrête dès que la technique se dégrade.",
  },
  {
    key: "splitKg",
    label: "Split squat charge (kg)",
    unit: "kg",
    group: "force",
    min: 1,
    max: 200,
    protocol:
      "Position fente avant (un pied devant, un pied derrière), charge tenue le long du corps ou sur les épaules. Descends jusqu'à ce que le genou arrière frôle le sol, remonte. Choisis une charge que tu peux lever 6-8 fois par jambe proprement.",
  },
  {
    key: "splitReps",
    label: "Split squat reps",
    unit: "",
    group: "force",
    min: 1,
    max: 100,
    protocol:
      "Avec la charge choisie, fais un maximum de répétitions propres par jambe (amplitude complète). Change de jambe seulement une fois la série terminée.",
  },
  {
    key: "trapbar3rmKg",
    label: "Trap bar 3RM (kg)",
    unit: "kg",
    group: "force",
    min: 10,
    max: 400,
    protocol:
      "Réservé aux séniors avec accès à une salle. Charge progressive sur 3-4 séries d'échauffement, puis trouve la charge maximale que tu peux soulever 3 fois avec une technique stricte, sans aide et sans t'effondrer. Arrête avant l'échec technique.",
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

// ─────────────────────────── Composition de batterie ───────────────────────────
// Socle "sans matériel" : mesurable avec un téléphone + un mètre/des repères.
// AUCUNE playlist ne doit imposer de matériel de salle par défaut (broadJump,
// sprints, endurance 6 min sont réalisables par n'importe quel joueur, partout).
// Chaque playlist garde sa coloration au-delà du socle (ex. explosivité ajoute
// CMJ + sprint 30 m ; endurance ajoute le 1 km ; saison ajoute le CMJ).
export const PLAYLIST_FIELDS_BASE: Record<PlaylistId, FieldKey[]> = {
  fondation: ["broadJumpCm", "sprint10s", "sprint20s", "endurance6min_m"],
  force: ["broadJumpCm", "sprint10s", "sprint20s", "endurance6min_m"],
  explosivite: ["broadJumpCm", "cmjCm", "sprint10s", "sprint30s", "endurance6min_m"],
  endurance: ["broadJumpCm", "sprint10s", "sprint20s", "endurance6min_m", "run1km_s"],
  saison: ["broadJumpCm", "sprint10s", "sprint20s", "endurance6min_m", "cmjCm"],
};

/**
 * IDs de matériel (cf. `gymEquipmentOptions` / `homeEquipmentOptions` dans
 * screens/ProfileSetupScreen.tsx) qui représentent une charge "portable" utilisable
 * pour un goblet squat ou un split squat chargé. Les machines (presse, poulies,
 * smith machine, rack seul, banc...) ne comptent PAS : elles ne donnent pas
 * directement une charge à tenir en main pour ces mouvements précis.
 */
export const WEIGHT_EQUIPMENT_IDS = [
  "barbell",
  "dumbbells_light",
  "dumbbells_medium",
  "dumbbells_heavy",
  "kettlebell",
  "home_dumbbells",
  "home_kettlebell",
  "sandbag",
] as const;

/** true si le profil (gymEquipment/homeEquipment) indique au moins une charge portable. */
export const hasWeightsEquipment = (
  gymEquipment?: string[] | null,
  homeEquipment?: string[] | null
): boolean => {
  const all = [...(gymEquipment ?? []), ...(homeEquipment ?? [])];
  return all.some((id) => (WEIGHT_EQUIPMENT_IDS as readonly string[]).includes(id));
};

// Ajoutés SEULEMENT si le profil indique des charges disponibles (module salle optionnel).
export const EQUIPMENT_FIELDS: Partial<Record<PlaylistId, FieldKey[]>> = {
  fondation: ["gobletKg", "gobletReps", "splitKg", "splitReps"],
  force: ["gobletKg", "gobletReps", "splitKg", "splitReps"],
  explosivite: ["splitKg", "splitReps"],
};

// Ajoutés SEULEMENT si le profil indique des charges ET la catégorie Senior.
// Jamais U13/U15/U18, quel que soit le matériel déclaré (le moteur plafonne déjà
// la force jeune au poids du corps — cf. AGE_CATEGORY_CAPS backend) ; jamais non
// plus si la catégorie d'âge est inconnue (comportement conservateur).
export const SENIOR_EQUIPMENT_FIELDS: Partial<Record<PlaylistId, FieldKey[]>> = {
  force: ["trapbar3rmKg"],
  explosivite: ["trapbar3rmKg"],
};

export type PlaylistFieldsOptions = {
  hasWeightsEquipment: boolean;
  ageCategory: AgeCategory | null;
};

/** Compose la batterie active d'une playlist selon le matériel déclaré et l'âge. */
export function getPlaylistFields(
  playlist: PlaylistId,
  opts: PlaylistFieldsOptions
): FieldKey[] {
  const fields = [...(PLAYLIST_FIELDS_BASE[playlist] ?? [])];
  if (opts.hasWeightsEquipment) {
    fields.push(...(EQUIPMENT_FIELDS[playlist] ?? []));
    if (opts.ageCategory === "Senior") {
      fields.push(...(SENIOR_EQUIPMENT_FIELDS[playlist] ?? []));
    }
  }
  return fields;
}

/**
 * Compat : batterie "par défaut" (sans matériel, âge inconnu) — pour les rares
 * call sites qui n'ont pas le contexte profil sous la main. Préférer
 * `getPlaylistFields()` partout où le profil (équipement/âge) est disponible.
 */
export const PLAYLIST_FIELDS: Record<PlaylistId, FieldKey[]> = PLAYLIST_FIELDS_BASE;

export const PLAYLIST_PLAN: Record<PlaylistId, string[]> = {
  fondation: [
    "Échauffement structuré (mobilité + activation + lignes droites)",
    "Sauts : saut en longueur arrêté",
    "Vitesse : 10-20 m",
    "Pause 5-8 min (hydratation)",
    "Endurance : 6 min",
    "Si tu as des charges chez toi ou en salle : goblet squat ou split squat en repère",
  ],
  force: [
    "Échauffement structuré (mobilité + activation + lignes droites)",
    "Sauts, vitesse et endurance : socle sans matériel (comme les autres playlists)",
    "Si tu as des charges : goblet/split squat en repère",
    "Si tu es sénior ET as accès à une salle : trap bar 3RM (test avancé, jamais chez les jeunes)",
  ],
  explosivite: [
    "Échauffement nerveux : gammes + 3 lignes droites",
    "Sauts : CMJ + saut en longueur arrêté",
    "Vitesse : 10-30 m (qualité max)",
    "Pause 6-8 min",
    "Si tu as des charges : split squat en repère (+ trap bar 3RM si sénior et salle)",
  ],
  endurance: [
    "Échauffement progressif 10-12 min",
    "Sauts, vitesse et 6 min : socle sans matériel",
    "Récupération 6-8 min",
    "Test principal : 1 km chrono (temps en min:sec)",
  ],
  saison: [
    "Échauffement progressif 8-10 min",
    "Test endurance : 6 min",
    "Pause 5-6 min",
    "Test vitesse : 10-20 m",
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
