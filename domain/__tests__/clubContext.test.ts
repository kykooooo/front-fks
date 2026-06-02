// domain/__tests__/clubContext.test.ts
// Normalisation des valeurs du contexte de semaine club (fonctions pures).

import {
  normalizeClubTrainingIntensity,
  normalizeClubWeekGoal,
  CLUB_TRAINING_INTENSITIES,
  CLUB_WEEK_GOALS,
} from "../types";

describe("normalizeClubTrainingIntensity", () => {
  test("accepte les valeurs valides", () => {
    for (const v of CLUB_TRAINING_INTENSITIES) expect(normalizeClubTrainingIntensity(v)).toBe(v);
  });
  test("tolère les espaces", () => {
    expect(normalizeClubTrainingIntensity("  heavy ")).toBe("heavy");
  });
  test("rejette l'invalide / l'absent", () => {
    expect(normalizeClubTrainingIntensity("brutal")).toBeNull();
    expect(normalizeClubTrainingIntensity(undefined)).toBeNull();
    expect(normalizeClubTrainingIntensity(3)).toBeNull();
  });
});

describe("normalizeClubWeekGoal", () => {
  test("accepte les valeurs valides", () => {
    for (const v of CLUB_WEEK_GOALS) expect(normalizeClubWeekGoal(v)).toBe(v);
  });
  test("rejette l'invalide / l'absent", () => {
    expect(normalizeClubWeekGoal("muscu")).toBeNull();
    expect(normalizeClubWeekGoal(null)).toBeNull();
  });
});
