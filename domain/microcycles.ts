export type MicrocycleId =
  | "fondation"
  | "force"
  | "endurance"
  | "explosivite"
  | "explosif"
  | "rsa"
  | "saison"
  | "offseason";

export const MICROCYCLE_TOTAL_SESSIONS_DEFAULT = 12;

export const isMicrocycleId = (value: any): value is MicrocycleId =>
  value === "fondation" ||
  value === "force" ||
  value === "explosivite" ||
  value === "explosif" ||
  value === "rsa" ||
  value === "endurance" ||
  value === "saison" ||
  value === "offseason";

export type TrainingLocation = "gym" | "pitch" | "home";

export type MicrocycleDef = {
  id: MicrocycleId;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  highlights: string[];
  allowedLocations: TrainingLocation[];
  locationDescriptions?: Partial<Record<TrainingLocation, string>>;
};

export const MICROCYCLES: Record<MicrocycleId, MicrocycleDef> = {
  fondation: {
    id: "fondation",
    label: "Fondation",
    subtitle: "Base physique • force + run facile",
    description:
      "Construis une base solide (tendon, technique, volume) pour progresser ensuite sans te cramer.",
    icon: "shield-checkmark-outline",
    highlights: ["Renfo technique", "Endurance facile", "Régularité"],
    allowedLocations: ["home", "pitch", "gym"],
  },
  force: {
    id: "force",
    label: "Force",
    subtitle: "Renfo bas/haut • charges lourdes",
    description:
      "Renforcement bas/haut du corps avec une progression structurée. Idéal si tu as accès à du matériel.",
    icon: "barbell-outline",
    highlights: ["Force max", "Progression", "Stabilité"],
    allowedLocations: ["gym", "home"],
    locationDescriptions: { home: "Version light" },
  },
  endurance: {
    id: "endurance",
    label: "Endurance / Engine",
    subtitle: "Z2 • tempo • intervalles",
    description:
      "Capacité à répéter les efforts : tempo/intervals, respiration, économie de course et régularité.",
    icon: "pulse-outline",
    highlights: ["Tempo/VMA", "Répétitions", "Aérobie"],
    allowedLocations: ["pitch", "gym", "home"],
  },
  explosivite: {
    id: "explosivite",
    label: "Explosivité (vitesse & technique)",
    subtitle: "Vitesse • appuis • technique",
    description:
      "Vitesse, appuis et accélération avec une dose technique et des drills légers.",
    icon: "flash-outline",
    highlights: ["Vitesse", "Appuis", "Technique"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: { home: "Version light" },
  },
  explosif: {
    id: "explosif",
    label: "Explosif (puissance)",
    subtitle: "Sprint • power • plyo",
    description:
      "Cycle axé puissance : sprint, plyo, power. Intensité élevée mais contrôlée.",
    icon: "rocket-outline",
    highlights: ["Puissance", "Sprint", "Plyo"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: { home: "Version light" },
  },
  rsa: {
    id: "rsa",
    label: "RSA (Repeated Sprint Ability)",
    subtitle: "Sprints répétés • récup courte",
    description:
      "Répéter les sprints avec récup courte. Idéal pour la capacité à enchaîner les efforts.",
    icon: "repeat-outline",
    highlights: ["Sprints", "Récup", "Répétitions"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: { home: "Version light" },
  },
  saison: {
    id: "saison",
    label: "Saison / Maintien",
    subtitle: "Maintenir la forme sans se cramer",
    description:
      "Un cycle pour stabiliser la forme sur la durée, gérer la fatigue et rester performant sans surcharge.",
    icon: "leaf-outline",
    highlights: ["Maintien", "Régularité", "Prévention"],
    allowedLocations: ["pitch", "gym", "home"],
  },
  offseason: {
    id: "offseason",
    label: "Off‑Season / Transition",
    subtitle: "Récup active • maintien léger",
    description:
      "Phase de transition pour récupérer activement, garder une base légère et repartir frais.",
    icon: "calendar-outline",
    highlights: ["Récup", "Transition", "Léger"],
    allowedLocations: ["pitch", "gym", "home"],
  },
};
