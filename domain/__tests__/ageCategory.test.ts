// domain/__tests__/ageCategory.test.ts
// Normalisation de la catégorie d'âge (FKS Club) — fonction pure, aucune dépendance.

import { normalizeAgeCategory, AGE_CATEGORIES } from "../types";

describe("normalizeAgeCategory", () => {
  test("accepte toutes les catégories valides telles quelles", () => {
    for (const c of AGE_CATEGORIES) {
      expect(normalizeAgeCategory(c)).toBe(c);
    }
  });

  test("tolère les espaces autour de la valeur", () => {
    expect(normalizeAgeCategory("  U15 ")).toBe("U15");
  });

  test("retourne null si la valeur est absente (ancien profil)", () => {
    expect(normalizeAgeCategory(undefined)).toBeNull();
    expect(normalizeAgeCategory(null)).toBeNull();
  });

  test("retourne null pour une valeur invalide (n'invente jamais de catégorie)", () => {
    expect(normalizeAgeCategory("U11")).toBeNull();
    expect(normalizeAgeCategory("senior")).toBeNull(); // sensible à la casse
    expect(normalizeAgeCategory(15)).toBeNull();
    expect(normalizeAgeCategory("")).toBeNull();
  });
});
