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
  /** Niveau d'intensité affiché (tag UI, non utilisé par le moteur) */
  intensity?: string;
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
    label: "Reprise & bases",
    subtitle: "Reprendre proprement et poser les bases",
    description:
      "Tu reprends en douceur et tu construis une base solide : contr\u00f4le, appuis, gainage et cardio l\u00e9ger. De quoi encha\u00eener les semaines sereinement.",
    icon: "shield-checkmark-outline",
    highlights: ["Appuis & contr\u00f4le", "Gainage", "Cardio l\u00e9ger"],
    intensity: "Intensit\u00e9 douce",
    allowedLocations: ["home", "pitch", "gym"],
    locationDescriptions: {
      gym: "Renforcement progressif",
      pitch: "Course facile + appuis + technique",
      home: "Renforcement l\u00e9ger + gainage",
    },
    footballTip: "La pr\u00e9-saison : on construit la base avant de monter en intensit\u00e9.",
    suggestedNext: ["force", "endurance"],
  },
  force: {
    id: "force",
    label: "Duels & puissance",
    subtitle: "Plus solide dans les duels, plus de puissance utile",
    description:
      "Tu gagnes en force utile : tenir les duels, rester stable sur tes appuis, frapper plus fort. Du renforcement qui se voit sur le terrain.",
    icon: "barbell-outline",
    highlights: ["Duels", "Stabilit\u00e9", "Puissance"],
    intensity: "Intensit\u00e9 \u00e9lev\u00e9e",
    allowedLocations: ["gym", "home"],
    locationDescriptions: {
      gym: "Renforcement avec charges + machines",
      home: "Renforcement au poids du corps",
    },
    footballTip: "Plus de force = duels gagn\u00e9s et frappes plus franches.",
    suggestedNext: ["explosivite", "endurance"],
  },
  endurance: {
    id: "endurance",
    label: "Tenir tout le match",
    subtitle: "Tenir les efforts r\u00e9p\u00e9t\u00e9s, sans baisser en fin de match",
    description:
      "Tu construis le moteur pour r\u00e9p\u00e9ter les courses et les sprints, presser et te replacer pendant tout le match.",
    icon: "pulse-outline",
    highlights: ["Fin de match", "Sprints r\u00e9p\u00e9t\u00e9s", "R\u00e9cup rapide"],
    intensity: "Intensit\u00e9 mod\u00e9r\u00e9e \u00e0 \u00e9lev\u00e9e",
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Courses + intervalles + sprints r\u00e9p\u00e9t\u00e9s",
      gym: "Tapis, v\u00e9lo ou rameur + intervalles",
      home: "Circuits cardio courts",
    },
    footballTip: "Pour presser en fin de match comme au d\u00e9but.",
    suggestedNext: ["explosivite", "saison"],
  },
  explosivite: {
    id: "explosivite",
    label: "Vitesse & d\u00e9tente",
    subtitle: "Appuis, acc\u00e9l\u00e9rations, changements de rythme",
    description:
      "Tu travailles la vitesse de d\u00e9marrage, les changements de direction et la d\u00e9tente. Les premiers m\u00e8tres et le saut font la diff\u00e9rence.",
    icon: "flash-outline",
    highlights: ["D\u00e9marrages", "Appuis", "D\u00e9tente"],
    intensity: "Intensit\u00e9 \u00e9lev\u00e9e",
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Sprints courts + sauts + changements de direction",
      gym: "Vitesse + charges explosives + sauts",
      home: "Coordination + sauts + r\u00e9activit\u00e9",
    },
    footballTip: "Les premiers appuis font la diff sur un appel ou un duel a\u00e9rien.",
    suggestedNext: ["endurance", "saison"],
  },
  saison: {
    id: "saison",
    label: "Rester frais pour les matchs",
    subtitle: "Performer le week-end en restant frais",
    description:
      "En pleine saison, l'objectif c'est rester performant le jour du match : juste ce qu'il faut \u00e0 l'entra\u00eenement, pas plus.",
    icon: "leaf-outline",
    highlights: ["Fra\u00eecheur", "Entretien", "R\u00e9gularit\u00e9"],
    intensity: "Intensit\u00e9 ma\u00eetris\u00e9e",
    allowedLocations: ["pitch", "gym", "home"],
    locationDescriptions: {
      pitch: "Maintien + fra\u00eecheur terrain",
      gym: "Entretien sans fatigue",
      home: "Mobilit\u00e9 + r\u00e9cup",
    },
    footballTip: "En saison, on entretient sans se vider \u00e0 l'entra\u00eenement.",
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
      "Reste performant pour les matchs du week-end en g\u00e9rant ta fatigue d'entra\u00eenement.",
    icon: "shield-checkmark-outline",
    sequence: ["saison", "endurance", "saison"],
    forWhom:
      "Tu joues tous les week-ends et tu veux rester au top sans accumuler la fatigue.",
  },
  {
    id: "reprise",
    label: "Retour apr\u00e8s coupure",
    description:
      "Reprends en douceur apr\u00e8s l'inter-saison ou une coupure, sans griller les \u00e9tapes.",
    icon: "refresh-outline",
    sequence: ["fondation", "force", "endurance", "saison"],
    forWhom:
      "Tu reviens d'une pause (inter-saison, arr\u00eat long) et tu veux repartir progressivement.",
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
