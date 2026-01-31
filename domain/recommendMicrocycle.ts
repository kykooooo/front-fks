import { MICROCYCLES, type MicrocycleId } from "./microcycles";

type RecommendationConfidence = "high" | "medium" | "low";

export type MicrocycleRecommendation = {
  id: MicrocycleId;
  confidence: RecommendationConfidence;
  reasons: string[];
};

const normalize = (value: any) => String(value ?? "").trim().toLowerCase();

export function recommendMicrocycle(input: {
  mainObjective?: string | null;
  lastTestPlaylist?: MicrocycleId | null;
}): MicrocycleRecommendation {
  const objective = normalize(input.mainObjective);
  const testsPick = input.lastTestPlaylist ?? null;

  const scores: Record<MicrocycleId, number> = {
    fondation: 0,
    force: 0,
    explosivite: 0,
    endurance: 0,
    explosif: 0,
    rsa: 0,
    saison: 0,
    offseason: 0,
  };

  const reasons: string[] = [];

  // Objective → primary signal (profileSetup objectives).
  let objectivePick: MicrocycleId | null = null;
  if (objective) {
    if (objective.includes("bless")) objectivePick = "fondation";
    else if (objective.includes("force") || objective.includes("muscu")) objectivePick = "force";
    else if (objective.includes("vitesse") || objective.includes("technique")) objectivePick = "explosivite";
    else if (objective.includes("explos") || objective.includes("reactiv")) objectivePick = "explosivite";
    else if (objective.includes("encaisser") || objective.includes("charges") || objective.includes("encha")) objectivePick = "endurance";
    else if (objective.includes("saison") || objective.includes("maintien")) objectivePick = "saison";
    else if (objective.includes("toute la saison") || objective.includes("forme")) objectivePick = "fondation";
  }
  if (objectivePick) {
    scores[objectivePick] += 2;
    reasons.push(`Objectif : ${MICROCYCLES[objectivePick].label}.`);
  }

  // Tests → secondary signal (what the player measured most recently).
  if (testsPick) {
    scores[testsPick] += 1;
    reasons.push(`Derniers tests : ${MICROCYCLES[testsPick].label}.`);
  }

  const ordered = (Object.keys(scores) as MicrocycleId[]).sort((a, b) => scores[b] - scores[a]);
  const best = ordered[0] ?? "fondation";
  const bestScore = scores[best];
  const secondScore = scores[ordered[1] ?? best] ?? 0;

  const confidence: RecommendationConfidence =
    bestScore >= 3 && bestScore - secondScore >= 2
      ? "high"
      : bestScore >= 2
        ? "medium"
        : "low";

  if (reasons.length === 0) {
    reasons.push("Recommandation par défaut : Fondation (base solide).");
  }

  return { id: best, confidence, reasons };
}
