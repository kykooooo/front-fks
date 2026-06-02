// services/__tests__/clubContext.test.ts
// buildClubContextPayload : transforme le doc weekContext brut en payload IA.
// Pur (pas de Firebase). Couvre "inclut quand présent / null quand absent".

import { buildClubContextPayload } from "../aiContextHelpers";

describe("buildClubContextPayload", () => {
  test("doc complet → payload complet (avec week_key)", () => {
    const payload = buildClubContextPayload(
      { trainingIntensity: "heavy", weekGoal: "freshness", note: "match dimanche" },
      "2026-06-01",
    );
    expect(payload).toEqual({
      training_intensity: "heavy",
      week_goal: "freshness",
      note: "match dimanche",
      week_key: "2026-06-01",
    });
  });

  test("seulement l'intensité → pas de week_goal", () => {
    const payload = buildClubContextPayload({ trainingIntensity: "light" }, "2026-06-01");
    expect(payload).toEqual({ training_intensity: "light", week_key: "2026-06-01" });
  });

  test("valeurs invalides → null (jamais d'invention)", () => {
    expect(buildClubContextPayload({ trainingIntensity: "brutal", weekGoal: "muscu" })).toBeNull();
  });

  test("doc absent → null (ne casse pas la génération)", () => {
    expect(buildClubContextPayload(null)).toBeNull();
    expect(buildClubContextPayload(undefined)).toBeNull();
  });

  test("note vide ignorée, note longue tronquée à 200", () => {
    const empty = buildClubContextPayload({ weekGoal: "speed", note: "   " });
    expect(empty).toEqual({ week_goal: "speed" });

    const long = buildClubContextPayload({ weekGoal: "speed", note: "x".repeat(500) });
    expect(long?.note?.length).toBe(200);
  });
});
