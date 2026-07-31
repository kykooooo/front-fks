// domain/__tests__/recommendedLocation.test.ts
// Recommandation de lieu par cycle (écran de choix du lieu) — fonction pure.

import { getRecommendedLocation, MICROCYCLES, type MicrocycleId } from "../microcycles";

describe("getRecommendedLocation", () => {
  test("force recommande la salle", () => {
    const reco = getRecommendedLocation("force");
    expect(reco).not.toBeNull();
    expect(reco?.location).toBe("gym");
    expect(typeof reco?.reason).toBe("string");
    expect(reco?.reason.length).toBeGreaterThan(0);
  });

  test("endurance recommande le terrain", () => {
    expect(getRecommendedLocation("endurance")?.location).toBe("pitch");
  });

  test("explosivite recommande le terrain", () => {
    expect(getRecommendedLocation("explosivite")?.location).toBe("pitch");
  });

  test("fondation recommande la maison (simplicité de reprise)", () => {
    expect(getRecommendedLocation("fondation")?.location).toBe("home");
  });

  test("saison n'a aucune recommandation (partout = l'idée du cycle)", () => {
    expect(getRecommendedLocation("saison")).toBeNull();
  });

  test("le lieu recommandé fait toujours partie des lieux autorisés du cycle", () => {
    (Object.keys(MICROCYCLES) as MicrocycleId[]).forEach((id) => {
      const reco = getRecommendedLocation(id);
      if (!reco) return;
      expect(MICROCYCLES[id].allowedLocations).toContain(reco.location);
    });
  });
});
