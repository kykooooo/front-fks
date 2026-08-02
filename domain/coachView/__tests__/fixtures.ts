// domain/coachView/__tests__/fixtures.ts
// Fabriques de test partagées (pas un fichier de test : aucun `describe` ici).

import type { CoachPlayerSummary } from "../../coachSummary";
import type { CoachPlayerView } from "../types";
import { toCoachPlayerView } from "../fromSummary";

/**
 * Projection MINIMALE telle qu'elle existe AUJOURD'HUI : aucun champ v2.
 * C'est le cas NOMINAL tant que la boucle de suivi joueur n'est pas mergée.
 */
export function makeSummary(overrides: Partial<CoachPlayerSummary> = {}): CoachPlayerSummary {
  return {
    playerUid: "u1",
    firstName: "Anna",
    ageCategory: "U15",
    position: "Milieu",
    level: "Regional",
    profileComplete: true,
    latestSession: null,
    lastActivity: null,
    adaptation: { adapted: false, labels: [] },
    activity: null,
    lastPlanned: null,
    lastDone: null,
    execution: null,
    ...overrides,
  };
}

export function makeView(
  overrides: Partial<CoachPlayerSummary> = {},
  todayKey = "2026-07-27",
): CoachPlayerView {
  return toCoachPlayerView(makeSummary(overrides), todayKey);
}
