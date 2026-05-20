export type MicrocycleId =
  | "fondation"
  | "force"
  | "endurance"
  | "explosivite"
  | "saison";

export const MICROCYCLE_TOTAL_SESSIONS_DEFAULT = 12;

export const isMicrocycleId = (value: any): value is MicrocycleId =>
  value === "fondation" ||
  value === "force" ||
  value === "explosivite" ||
  value === "endurance" ||
  value === "saison";

/**
 * Normalise un identifiant de cycle vers sa forme canonique (5 cycles).
 * Remappe les anciens cycles supprimés et alias legacy :
 *  - "explosif" / "reactivite" -> "explosivite"
 *  - "rsa" -> "endurance"
 *  - "offseason" -> "fondation"
 * Retourne null si la valeur est vide ou non reconnue.
 */
export const canonicalizeMicrocycleGoal = (value: any): MicrocycleId | null => {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  const remap: Record<string, MicrocycleId> = {
    explosif: "explosivite",
    reactivite: "explosivite",
    rsa: "endurance",
    offseason: "fondation",
  };
  const mapped = remap[v] ?? v;
  return isMicrocycleId(mapped) ? mapped : null;
};

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
    suggestedNext: ["explosivite", "endurance"],
  },
  endurance: {
    id: "endurance",
    label: "Tenir 90 minutes",
    subtitle: "Ne plus mourir en 2e mi-temps",
    description:
      "Arr\u00eate de subir en fin de match. Tu construis le cardio pour presser, replacer et encha\u00eener les sprints pendant 90 minutes \u2014 sans flancher au sprint de la 85e.",
    icon: "pulse-outline",
    highlights: ["Fin de match", "Sprints r\u00e9p\u00e9t\u00e9s", "R\u00e9cup rapide"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Courses + intervalles + sprints r\u00e9p\u00e9t\u00e9s",
      gym: "Tapis, v\u00e9lo ou rameur + intervalles",
      home: "Circuits cardio courts",
    },
    footballTip: "C'est ce qui te permet de presser \u00e0 la 85e comme \u00e0 la 5e, et d'encha\u00eener les sprints sans tomber dans le rouge.",
    suggestedNext: ["explosivite", "saison"],
  },
  explosivite: {
    id: "explosivite",
    label: "Vitesse & d\u00e9tente",
    subtitle: "Explose au sol et dans les airs",
    description:
      "Travaille ta vitesse de d\u00e9marrage, tes changements de direction et ta d\u00e9tente. Les 3 premiers m\u00e8tres et la hauteur de saut font la diff\u00e9rence sur un appel, un pressing ou un duel a\u00e9rien.",
    icon: "flash-outline",
    highlights: ["D\u00e9marrages", "D\u00e9tente", "Puissance"],
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Sprints courts + sauts + changements de direction",
      gym: "Vitesse + charges explosives + sauts",
      home: "Coordination + sauts + r\u00e9activit\u00e9",
    },
    footballTip: "Les premiers m\u00e8tres font la diff sur un appel, la d\u00e9tente sur un coup de t\u00eate. Ce cycle muscle les deux.",
    suggestedNext: ["endurance", "saison"],
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
    suggestedNext: ["force", "endurance"],
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
    sequence: ["force", "explosivite", "endurance", "saison"],
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
    sequence: ["fondation", "force", "endurance", "saison"],
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
