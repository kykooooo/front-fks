// engine/exerciseContent.ts
// Contenu éditorial unifié d'une fiche exercice : le catalogue V2 généré d'abord
// (étapes numérotées, bons gestes, « À éviter », matériel, mise en place), repli
// sur les instructions legacy sinon. SEUL point d'entrée des écrans pour le
// contenu pédagogique d'un exercice.

import { EXERCISE_CONTENT_V2 } from "./generated/exerciseContentV2";
import { getExerciseInstruction } from "./exerciseInstructions";

export type ExerciseContentSource = "v2" | "legacy";

export type ExerciseContent = {
  /** Mise en place (V2 uniquement). */
  setup?: string;
  /** Comment le faire — étapes à afficher numérotées. Legacy : une seule étape. */
  steps: string[];
  /** Un bon geste (points clés). */
  cues: string[];
  /** À éviter — vide en repli legacy (le champ n'existe pas côté legacy). */
  avoid: string[];
  /**
   * Matériel (clés EquipmentKey côté screens, qui les valident).
   * Absent en legacy : l'inférence par id s'applique.
   */
  equipment?: string[];
  source: ExerciseContentSource;
};

export const getExerciseContent = (exerciseId: string): ExerciseContent | null => {
  const v2 = EXERCISE_CONTENT_V2[exerciseId];
  if (v2) {
    return {
      setup: v2.setup,
      steps: v2.steps,
      cues: v2.cues,
      avoid: v2.avoid,
      equipment: v2.equipment,
      source: "v2",
    };
  }
  const legacy = getExerciseInstruction(exerciseId);
  if (!legacy) return null;
  return { steps: [legacy.howTo], cues: [...legacy.cues], avoid: [], source: "legacy" };
};
