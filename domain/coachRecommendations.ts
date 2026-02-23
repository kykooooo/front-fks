// domain/coachRecommendations.ts
// Types et constantes pour les recommandations coach

export type RecommendationType =
  | "cycle_suggestion"    // Suggérer un cycle
  | "rest_advice"         // Conseiller du repos
  | "intensity_adjust"    // Adapter l'intensité
  | "custom";             // Message libre

export type CoachRecommendation = {
  id: string;
  coachId: string;
  coachName?: string;
  playerId: string;
  type: RecommendationType;
  message: string;
  suggestedCycleId?: string | null;
  createdAt: string;
  readAt?: string | null;
  dismissedAt?: string | null;
};

export const RECOMMENDATION_TYPES: { id: RecommendationType; label: string; icon: string }[] = [
  { id: "cycle_suggestion", label: "Suggérer un cycle", icon: "trophy-outline" },
  { id: "rest_advice", label: "Conseiller du repos", icon: "bed-outline" },
  { id: "intensity_adjust", label: "Adapter l'intensité", icon: "speedometer-outline" },
  { id: "custom", label: "Message libre", icon: "chatbubble-outline" },
];

export const RECOMMENDATION_TEMPLATES: Record<RecommendationType, string[]> = {
  cycle_suggestion: [
    "Je te conseille de commencer le cycle {cycle} pour travailler {focus}.",
    "Tu serais prêt pour le cycle {cycle}, c'est le bon moment.",
  ],
  rest_advice: [
    "Tu accumules de la fatigue. Prends 2-3 jours de repos avant de reprendre.",
    "Après cette grosse semaine, privilégie la récupération.",
  ],
  intensity_adjust: [
    "Cette semaine, reste sur des intensités légères à modérées.",
    "Tu peux monter en intensité, tu es en forme.",
  ],
  custom: [],
};
