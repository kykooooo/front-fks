// utils/beginnerSafety.ts
// Warnings pour exercices risqués pour les débutants en début de cycle.
// Affichés dans BlockCard (SessionPreview) sous l'exercice concerné.

type PlayerLevel = string | null | undefined;

const BEGINNER_LEVELS = new Set(["Loisir", "debutant", "Amateur", "Regional"]);

/** 3 premières séances = "début de cycle". Au-delà, le joueur a déjà encaissé du volume. */
const EARLY_SESSION_THRESHOLD = 3;

/**
 * Retourne un warning en langage joueur si l'exercice est risqué pour ce profil,
 * null sinon. Utilisé dans BlockCard pour afficher un message ⚠️ sous l'exo.
 */
export function getBeginnerSafetyWarning(
  exerciseId: string | null | undefined,
  playerLevel: PlayerLevel,
  microcycleSessionIndex: number | null | undefined,
): string | null {
  if (!exerciseId) return null;

  const isBeginner = playerLevel != null && BEGINNER_LEVELS.has(playerLevel);
  const isEarlySession =
    typeof microcycleSessionIndex === "number" &&
    microcycleSessionIndex < EARLY_SESSION_THRESHOLD;

  if (!isBeginner || !isEarlySession) return null;

  // Nordic curl : excentrique ischios très exigeant, risque de courbatures sévères
  // voire micro-déchirure si mal dosé en début de cycle.
  if (exerciseId === "str_nordic") {
    return "Exercice très exigeant pour tes ischios. En débutant, fais-le à demi-amplitude (descends 30-45° max), 2 séries de 3 répétitions. Augmente progressivement sur les séances suivantes.";
  }

  return null;
}
