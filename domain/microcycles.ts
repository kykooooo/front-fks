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
  /** Analogie football pour aider le joueur à comprendre */
  footballTip?: string;
  /** Cycles recommandés après celui-ci */
  suggestedNext?: MicrocycleId[];
};

export const MICROCYCLES: Record<MicrocycleId, MicrocycleDef> = {
  fondation: {
    id: "fondation",
    label: "Pr\u00eat pour la reprise",
    subtitle: "Construis ta base \u2022 \u00e9vite les blessures",
    description:
      "Pose les fondations pour ne pas te blesser d\u00e8s les premiers matchs. Tu renforces tes appuis, tes tendons et ton cardio de base.",
    icon: "shield-checkmark-outline",
    highlights: ["Anti-blessure", "Cardio de base", "Solidit\u00e9"],
    allowedLocations: ["home", "pitch", "gym"],
    locationDescriptions: {
      gym: "Renforcement progressif + pr\u00e9vention",
      pitch: "Course facile + appuis + technique",
      home: "Renforcement l\u00e9ger + pr\u00e9vention",
    },
    footballTip: "C'est la pr\u00e9-saison : tu poses les bases pour encha\u00eener les matchs sans p\u00e9pin.",
    suggestedNext: ["force", "endurance"],
  },
  force: {
    id: "force",
    label: "Duels & puissance",
    subtitle: "Gagne tes duels \u2022 frappe plus fort",
    description:
      "Deviens plus solide dans les contacts, gagne tes duels et frappe plus fort. Le renforcement qui fait la diff\u00e9rence sur le terrain.",
    icon: "barbell-outline",
    highlights: ["Duels", "Frappes", "Solidit\u00e9"],
    allowedLocations: ["gym", "home"],
    locationDescriptions: {
      gym: "Renforcement avec charges + machines",
      home: "Renforcement au poids du corps",
    },
    footballTip: "Plus de force = duels gagn\u00e9s, frappes plus puissantes, moins de blessures.",
    suggestedNext: ["explosivite", "explosif", "endurance"],
  },
  endurance: {
    id: "endurance",
    label: "Tenir 90 minutes",
    subtitle: "Ne plus mourir en 2e mi-temps",
    description:
      "Arr\u00eate de subir en fin de match. Tu construis le cardio pour presser, replacer et encha\u00eener les efforts pendant 90 minutes.",
    icon: "pulse-outline",
    highlights: ["Fin de match", "R\u00e9cup rapide", "Endurance"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Courses + intervalles sur terrain",
      gym: "Tapis, v\u00e9lo ou rameur + intervalles",
      home: "Circuits cardio courts",
    },
    footballTip: "C'est ce qui te permet de presser \u00e0 la 85e comme \u00e0 la 5e.",
    suggestedNext: ["rsa", "explosivite", "saison"],
  },
  explosivite: {
    id: "explosivite",
    label: "Premiers m\u00e8tres",
    subtitle: "Prends de vitesse ton adversaire",
    description:
      "Travaille ta vitesse de d\u00e9marrage et tes changements de direction. Les 3 premiers m\u00e8tres font la diff\u00e9rence sur un appel ou un pressing.",
    icon: "flash-outline",
    highlights: ["D\u00e9marrages", "Appuis", "Vitesse"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Sprints courts + changements de direction",
      gym: "Travail de vitesse + coordination",
      home: "Coordination + r\u00e9activit\u00e9",
    },
    footballTip: "Les premiers m\u00e8tres font la diff\u00e9rence sur un appel de balle ou un pressing.",
    suggestedNext: ["explosif", "rsa", "saison"],
  },
  explosif: {
    id: "explosif",
    label: "Puissance & d\u00e9tente",
    subtitle: "Domine dans les airs \u2022 acc\u00e9l\u00e8re plus vite",
    description:
      "D\u00e9veloppe ta d\u00e9tente et ta puissance pour dominer dans les duels a\u00e9riens, les d\u00e9marrages et les changements de rythme.",
    icon: "rocket-outline",
    highlights: ["D\u00e9tente", "Acc\u00e9l\u00e9ration", "Puissance"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Sprint + sauts + puissance",
      gym: "Charges explosives + sauts",
      home: "Sauts + puissance l\u00e9g\u00e8re",
    },
    footballTip: "La puissance, c'est ce qui fait la diff\u00e9rence dans les duels a\u00e9riens et les d\u00e9marrages.",
    suggestedNext: ["rsa", "saison", "endurance"],
  },
  rsa: {
    id: "rsa",
    label: "Encha\u00eener les sprints",
    subtitle: "Sprint, r\u00e9cup, sprint \u2022 sans flancher",
    description:
      "Apprends \u00e0 encha\u00eener les efforts intenses avec tr\u00e8s peu de r\u00e9cup. Id\u00e9al pour les matchs \u00e0 haute intensit\u00e9.",
    icon: "repeat-outline",
    highlights: ["Sprints r\u00e9p\u00e9t\u00e9s", "R\u00e9cup express", "Intensit\u00e9 match"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Sprints r\u00e9p\u00e9t\u00e9s + navettes",
      gym: "Intervalles courts haute intensit\u00e9",
      home: "Circuits courts explosifs",
    },
    footballTip: "Un milieu fait en moyenne 30 sprints par match. Ce programme, c'est pour les encha\u00eener sans flancher.",
    suggestedNext: ["saison", "endurance"],
  },
  saison: {
    id: "saison",
    label: "Rester frais pour les matchs",
    subtitle: "Performe le week-end \u2022 sans te cramer",
    description:
      "En pleine saison, l'objectif c'est rester frais et performant pour les matchs. Pas de surcharge, juste ce qu'il faut.",
    icon: "leaf-outline",
    highlights: ["Fra\u00eecheur", "Pr\u00e9vention", "R\u00e9gularit\u00e9"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Maintien + fra\u00eecheur terrain",
      gym: "Entretien sans fatigue",
      home: "Pr\u00e9vention + r\u00e9cup",
    },
    footballTip: "En pleine saison, l'objectif c'est rester frais pour les matchs, pas se d\u00e9foncer \u00e0 l'entra\u00eenement.",
    suggestedNext: ["force", "endurance", "offseason"],
  },
  offseason: {
    id: "offseason",
    label: "Coupure intelligente",
    subtitle: "Recharge les batteries \u2022 repars plus fort",
    description:
      "Apr\u00e8s la saison, r\u00e9cup\u00e8re bien pour repartir plus fort. L\u00e9ger, progressif, sans pression.",
    icon: "calendar-outline",
    highlights: ["R\u00e9cup\u00e9ration", "Repos actif", "Recharge"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Retour progressif terrain",
      gym: "Entretien l\u00e9ger",
      home: "R\u00e9cup active + souplesse",
    },
    footballTip: "Les pros prennent 2-3 semaines de coupure. Toi aussi, recharge les batteries avant de repartir.",
    suggestedNext: ["fondation", "force"],
  },
};

// ═══════════════════════════════════════════
// PATHWAYS - Parcours recommandés selon l'objectif
// ═══════════════════════════════════════════

export type CyclePathway = {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Séquence ordonnée de cycles */
  sequence: MicrocycleId[];
  /** Pour qui c'est recommandé */
  forWhom: string;
};

export const CYCLE_PATHWAYS: CyclePathway[] = [
  {
    id: "debut",
    label: "Je reprends de z\u00e9ro",
    description:
      "Tu poses les bases pour ne pas te blesser, puis tu montes en puissance match apr\u00e8s match.",
    icon: "trending-up-outline",
    sequence: ["fondation", "force", "endurance", "explosivite"],
    forWhom:
      "T'as pas fait de pr\u00e9pa depuis longtemps, ou tu veux repartir sur de bonnes bases.",
  },
  {
    id: "performance",
    label: "Je veux passer un cap",
    description:
      "Deviens plus fort dans les duels, plus rapide sur les premiers m\u00e8tres, et tiens le rythme tout le match.",
    icon: "rocket-outline",
    sequence: ["force", "explosif", "rsa", "saison"],
    forWhom:
      "T'as d\u00e9j\u00e0 une bonne base physique et tu veux faire la diff\u00e9rence sur le terrain.",
  },
  {
    id: "saison_active",
    label: "En pleine saison",
    description:
      "Reste frais pour les matchs du week-end sans te cramer \u00e0 l'entra\u00eenement.",
    icon: "shield-checkmark-outline",
    sequence: ["saison", "endurance", "saison"],
    forWhom:
      "Tu joues tous les week-ends et tu veux rester au top sans accumuler la fatigue.",
  },
  {
    id: "reprise",
    label: "Retour apr\u00e8s coupure",
    description:
      "Reprends en douceur apr\u00e8s l'inter-saison ou une blessure, sans griller les \u00e9tapes.",
    icon: "refresh-outline",
    sequence: ["offseason", "fondation", "force", "endurance"],
    forWhom:
      "Tu reviens d'une pause (inter-saison, blessure, arr\u00eat long) et tu veux repartir sans risque.",
  },
];

/** Retourne un parcours par son ID */
export function getPathwayById(id: string): CyclePathway | null {
  return CYCLE_PATHWAYS.find((pw) => pw.id === id) ?? null;
}

/** Retourne le pathway et la position du joueur dans ce parcours */
export function suggestNextCycle(
  completedCycleId: MicrocycleId,
): { suggestedNext: MicrocycleId[]; tip: string } {
  const cycle = MICROCYCLES[completedCycleId];
  const next = cycle.suggestedNext ?? [];
  const tip = next.length > 0
    ? `Cycle termin\u00e9 ! Pour continuer \u00e0 progresser : ${next.map((id) => MICROCYCLES[id].label).join(" ou ")}.`
    : "Bien jou\u00e9 ! Choisis ton prochain programme selon ton objectif.";
  return { suggestedNext: next, tip };
}
