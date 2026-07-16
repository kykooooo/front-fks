// screens/tests/testConfig.ts
import { Ionicons } from "@expo/vector-icons";
import type { AgeCategory } from "../../domain/types";

// Meme pattern que BLOCK_CONFIG (components/session/blockConfig.ts) : icone + tint
// plein + tint "soft" pour le fond du cercle. Plus de paire de couleurs gradient
// (langage BlockCard = teintes plates, jamais de LinearGradient decoratif).
export type GroupConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSoft: string;
};

export const GROUP_CONFIG: Record<string, GroupConfig> = {
  sauts: { icon: "rocket-outline", tint: "#8b5cf6", tintSoft: "rgba(139,92,246,0.12)" },
  vitesse: { icon: "flash-outline", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.12)" },
  endurance: { icon: "heart-outline", tint: "#06b6d4", tintSoft: "rgba(6,182,212,0.12)" },
  force: { icon: "barbell-outline", tint: "#ef4444", tintSoft: "rgba(239,68,68,0.12)" },
  agilite: { icon: "git-branch-outline", tint: "#16a34a", tintSoft: "rgba(22,163,74,0.12)" },
  power: { icon: "trending-up-outline", tint: "#f59e0b", tintSoft: "rgba(245,158,11,0.12)" },
};

export const getGroupConfig = (group: string): GroupConfig =>
  GROUP_CONFIG[group] ?? { icon: "ellipse-outline", tint: "#6b7280", tintSoft: "rgba(107,114,128,0.12)" };

// Titres de section pour grouper des champs par famille (Overview + section
// "Aller plus loin"). Un seul endroit pour ce libellé (avant dupliqué inline).
export const GROUP_TITLES: Record<FieldConfig["group"], string> = {
  sauts: "Sauts / Explosivité",
  vitesse: "Vitesse linéaire",
  endurance: "Endurance aérobie",
  force: "Force repère",
  agilite: "Agilité / COD",
  power: "Puissance",
};

// PlaylistId reste utile uniquement pour taguer/lire le champ `playlist` d'une
// entrée historique (quel cycle était actif au moment du test) — CE N'EST PLUS
// UN FILTRE ni un sélecteur de batterie (Phase C : batterie unique pour tous).
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

// Label de provenance pour une entrée historique (cf. `TestEntry.playlist`) —
// affichage informatif seul (tag discret dans l'historique), plus un sélecteur.
export const PLAYLISTS: Record<PlaylistId, { label: string; subtitle: string }> = {
  fondation: { label: "Fondation", subtitle: "Base physique / S&C + endurance" },
  force: { label: "Force", subtitle: "Force max + charges lourdes" },
  explosivite: { label: "Explosivité", subtitle: "Vitesse + détente + puissance" },
  endurance: { label: "Endurance", subtitle: "Tenir 90 min + sprints répétés" },
  saison: { label: "Saison / Maintien", subtitle: "Maintenir la forme sans se cramer" },
};

// ─────────────────────────── Batterie unique (Phase C) ───────────────────────────
// Décision produit (juillet 2026) : les batteries PAR CYCLE créaient de la friction
// et fragmentaient l'historique (changer de cycle "cachait" les anciennes valeurs).
// Une seule batterie socle pour tous, quel que soit le cycle actif + une section
// "Aller plus loin" optionnelle pour le reste des tests existants.

/**
 * Le socle : 3 tests, identiques pour tous, ~15 min, mesurables sans matériel.
 * Ordre = ordre d'exécution conseillé (puissance/vitesse à froid, endurance en
 * dernier — le test aérobie fatigue et ne doit pas polluer les deux premiers).
 */
export const CORE_FIELD_KEYS = [
  "broadJumpCm",
  "sprint10s",
  "endurance6min_m",
] as const satisfies readonly FieldKey[];

/** Une ligne "pourquoi" par test socle — coach honnête, jamais de blabla. */
export const CORE_FIELD_WHY: Record<(typeof CORE_FIELD_KEYS)[number], string> = {
  broadJumpCm: "Ta puissance de jambes, mesurable sans le moindre matériel.",
  sprint10s: "Ta vitesse, la qualité n°1 en foot — ce chrono sert de référence dans tes séances.",
  endurance6min_m: "L'IA s'en sert pour calibrer les allures de course de tes séances (ta VMA).",
};

/** Déroulé conseillé du socle — fixe, identique pour tous (plus de variante par cycle). */
export const CORE_PLAN: string[] = [
  "Échauffement structuré (mobilité + activation + lignes droites) — 8-10 min",
  "Saut en longueur : 3 essais, garde le meilleur",
  "Sprint 10 m : 2-3 essais qualité, repos 2-3 min entre chaque",
  "Pause 5-6 min (hydratation, récupération)",
  "Endurance 6 min : allure la plus rapide et régulière que tu peux tenir",
];

/**
 * Section "Aller plus loin" : tous les autres tests, repliés par défaut. Le
 * Yo-Yo IR1 reste retiré (décision Phase A) — jamais proposé, même ici.
 */
export const OPTIONAL_FIELD_KEYS: FieldKey[] = [
  "sprint20s",
  "sprint30s",
  "cmjCm",
  "tripleJumpCm",
  "lateralBoundCm",
  "tTest_s",
  "test505_s",
  "run1km_s",
];

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

// Ajoutés SEULEMENT si le profil indique des charges disponibles (module salle
// optionnel, à l'intérieur de la section "Aller plus loin").
export const EQUIPMENT_OPTIONAL_FIELD_KEYS: FieldKey[] = [
  "gobletKg",
  "gobletReps",
  "splitKg",
  "splitReps",
];

// Ajoutés SEULEMENT si le profil indique des charges ET la catégorie Senior.
// Jamais U13/U15/U18, quel que soit le matériel déclaré (le moteur plafonne déjà
// la force jeune au poids du corps — cf. AGE_CATEGORY_CAPS backend) ; jamais non
// plus si la catégorie d'âge est inconnue (comportement conservateur).
export const SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS: FieldKey[] = ["trapbar3rmKg"];

export type OptionalFieldsOptions = {
  hasWeightsEquipment: boolean;
  ageCategory: AgeCategory | null;
};

/**
 * Compose la section "Aller plus loin" selon le matériel déclaré et l'âge.
 * Le socle (CORE_FIELD_KEYS) n'est JAMAIS affecté par ces options : il est
 * constant, quel que soit le profil ou le cycle actif.
 */
export function getOptionalFields(opts: OptionalFieldsOptions): FieldKey[] {
  const fields = [...OPTIONAL_FIELD_KEYS];
  if (opts.hasWeightsEquipment) {
    fields.push(...EQUIPMENT_OPTIONAL_FIELD_KEYS);
    if (opts.ageCategory === "Senior") {
      fields.push(...SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS);
    }
  }
  return fields;
}

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
