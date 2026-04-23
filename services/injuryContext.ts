// services/injuryContext.ts
//
// Helpers purs pour la sérialisation des zones sensibles vers le contexte
// IA. Extrait de `aiContext.ts` pour être testable unitairement sans
// dépendre de `firebase/auth` (qui plante Jest sans setup spécifique).
//
// Ces fonctions sont consommées par `aiContext.ts:buildAIPromptContext`
// pour construire `constraints.pains[]` et `constraints.injury_max_severity`.

import type { InjuryRecord } from "../domain/types";
import type { ActiveInjuryParsed } from "../schemas/firestoreSchemas";
import { mapAreaToPain } from "../shared/injuryMapping";
import { lastNDates } from "../utils/dateHelpers";

/**
 * Sérialise les blessures actives du profil vers les contraindications
 * backend attendues. N'inclut que les entrées avec `severity >= 1`.
 */
export function collectProfileInjuryPains(
  activeInjuries: ActiveInjuryParsed[] | undefined,
): string[] {
  if (!Array.isArray(activeInjuries) || activeInjuries.length === 0) return [];
  const set = new Set<string>();
  for (const inj of activeInjuries) {
    if (!inj) continue;
    const severity = Number(inj.severity ?? 0);
    if (!Number.isFinite(severity) || severity < 1) continue;
    const mapped = mapAreaToPain(inj.area);
    if (mapped) set.add(mapped);
  }
  return Array.from(set);
}

/**
 * Construit la liste des contraindications backend à partir des `injury`
 * saisies via le feedback post-séance sur les N derniers jours.
 *
 * Utilisé comme FALLBACK pour les joueurs qui ont déclaré via FeedbackScreen
 * avant la release MVP (avant que `profile.activeInjuries` n'existe).
 * N'inclut que les blessures avec `severity >= 1` (0 = "Pas de gêne").
 */
export function collectRecentInjuryPains(
  dayStates: Record<string, { feedback?: { injury?: InjuryRecord | null } }> | undefined,
  todayKey: string,
  windowDays: number,
): string[] {
  if (!dayStates) return [];
  const set = new Set<string>();
  const days = lastNDates(todayKey, windowDays);
  for (const key of days) {
    const injury = dayStates[key]?.feedback?.injury;
    if (!injury) continue;
    const severity = Number(injury.severity ?? 0);
    if (!Number.isFinite(severity) || severity < 1) continue;
    const mapped = mapAreaToPain(injury.area);
    if (mapped) set.add(mapped);
  }
  return Array.from(set);
}

/**
 * Max sévérité (0..3) unifié à partir des 2 sources de déclaration :
 *   1. `profile.activeInjuries` (déclaré à l'inscription étape 4 ou via
 *      la section "Zones sensibles" du profil).
 *   2. `dayStates[*].feedback.injury` des N derniers jours (feedback
 *      post-séance via PainInjuryRow — flow historique pré-MVP).
 *
 * Pourquoi unifier les 2 sources (fix P1 audit pré-Jour 4) :
 *   - `collectRecentInjuryPains` lit déjà les 2 sources pour construire
 *     `constraints.pains[]`. Si on ne faisait que `activeInjuries` ici,
 *     les déclarations via PainInjuryRow alimentaient `pains[]` (donc
 *     filtrage exos côté back) MAIS PAS `injury_max_severity` → bouton
 *     "Je préfère me reposer", disclaimer bas de séance, règle
 *     `injury_progress_detected`, cap easy severity 3 ne se déclenchaient
 *     JAMAIS pour ce flow. Cohérence rétablie ici.
 *
 * Retourne 0 si aucune blessure active ou sévérités invalides.
 * Borné à [0, 3] (l'échelle InjurySeverity).
 */
export function computeInjuryMaxSeverityFromAllSources(
  activeInjuries: ActiveInjuryParsed[] | undefined,
  dayStates: Record<string, { feedback?: { injury?: InjuryRecord | null } }> | undefined,
  todayKey: string,
  windowDays: number = 7,
): number {
  let max = 0;

  // Source 1 : profil activeInjuries.
  if (Array.isArray(activeInjuries)) {
    for (const inj of activeInjuries) {
      const s = Number(inj?.severity ?? 0);
      if (Number.isFinite(s) && s > max) max = s;
    }
  }

  // Source 2 : dayStates des `windowDays` derniers jours (fallback
  // PainInjuryRow post-séance).
  if (dayStates) {
    const days = lastNDates(todayKey, windowDays);
    for (const key of days) {
      const injury = dayStates[key]?.feedback?.injury;
      if (!injury) continue;
      const s = Number(injury.severity ?? 0);
      if (Number.isFinite(s) && s > max) max = s;
    }
  }

  return Math.min(3, Math.max(0, max));
}
