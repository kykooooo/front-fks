// screens/tests/testTiming.ts
//
// Logique pure : "c'est le bon moment pour tester ?" — dérivée de la position
// dans le cycle actif (microcycleSessionIndex, 0-based, déjà utilisé partout
// ailleurs dans l'app pour afficher "Séance N/12", cf. utils/microcycleUtils.ts).
//
// Aucune UI ici volontairement : testable unitairement, consommé par TestsScreen.

import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";

export type TestTimingTone = "start" | "end";

export type TestTimingBanner = {
  tone: TestTimingTone;
  message: string;
};

/**
 * Bandeau contextuel pour l'écran Tests terrain :
 *  - début de cycle (0 ou 1 séance faite) -> "prends tes mesures de départ"
 *  - fin de cycle (avant-dernière ou dernière séance) -> "re-teste et compare"
 *  - sinon (milieu de cycle, ou pas de cycle actif) -> pas de bandeau (pas de bruit)
 */
export function getTestTimingBanner(
  microcycleSessionIndex: number | null | undefined,
  hasActiveCycle: boolean,
  total: number = MICROCYCLE_TOTAL_SESSIONS_DEFAULT
): TestTimingBanner | null {
  if (!hasActiveCycle) return null;

  const safeTotal = Number.isFinite(total) && total > 0 ? Math.trunc(total) : MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const idx =
    typeof microcycleSessionIndex === "number" && Number.isFinite(microcycleSessionIndex)
      ? Math.max(0, Math.trunc(microcycleSessionIndex))
      : 0;

  if (idx <= 1) {
    return {
      tone: "start",
      message: "Moment idéal : prends tes mesures de début de cycle.",
    };
  }

  if (idx >= safeTotal - 1) {
    return {
      tone: "end",
      message: "Cycle presque bouclé : re-teste et compare avec ton départ.",
    };
  }

  return null;
}
