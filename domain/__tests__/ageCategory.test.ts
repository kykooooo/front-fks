// domain/__tests__/ageCategory.test.ts
// Normalisation de la catégorie d'âge (FKS Club) — fonction pure, aucune dépendance.

import { normalizeAgeCategory, AGE_CATEGORIES, SELECTABLE_AGE_CATEGORIES } from "../types";

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

// ─────────────────────────────────────────────────────────────────────────────
// Retrait U13 (décision produit 2026-07) — l'app ne PROPOSE plus U13 à la
// sélection, mais un profil déjà en U13 ne doit jamais perdre sa protection de
// dosage backend (AGE_CATEGORY_CAPS). Ces tests verrouillent la séparation
// "option affichée" (SELECTABLE_AGE_CATEGORIES) vs "donnée/défense" (AGE_CATEGORIES
// + normalizeAgeCategory), pour qu'un futur ménage ne les recombine pas par erreur.
// ─────────────────────────────────────────────────────────────────────────────
describe("Retrait U13 — option retirée, défense conservée", () => {
  test("U13 n'est PLUS une catégorie proposée à la sélection (ProfileSetupScreen)", () => {
    expect(SELECTABLE_AGE_CATEGORIES).not.toContain("U13");
    expect(SELECTABLE_AGE_CATEGORIES).toEqual(["U15", "U17", "U18", "Senior"]);
  });

  test("U13 reste une catégorie VALIDE côté donnée (AGE_CATEGORIES) — ne jamais la retirer d'ici", () => {
    expect(AGE_CATEGORIES).toContain("U13");
  });

  test("SELECTABLE_AGE_CATEGORIES est un sous-ensemble strict de AGE_CATEGORIES (aucune catégorie inventée)", () => {
    for (const c of SELECTABLE_AGE_CATEGORIES) {
      expect(AGE_CATEGORIES).toContain(c);
    }
    expect(SELECTABLE_AGE_CATEGORIES.length).toBe(AGE_CATEGORIES.length - 1);
  });

  test("un profil déjà en U13 continue de normaliser vers 'U13' (jamais null) — c'est ce qui alimente age_category côté backend et déclenche AGE_CATEGORY_CAPS", () => {
    // Si ce test échoue après une modif de normalizeAgeCategory/AGE_CATEGORIES,
    // un vrai joueur U13 déjà inscrit perdrait silencieusement sa protection de
    // dosage (services/aiContext.ts envoie normalizeAgeCategory(profil.ageCategory)
    // au backend ; age_category: null == aucun cap appliqué côté moteur).
    expect(normalizeAgeCategory("U13")).toBe("U13");
  });

  test("un profil legacy en U13 échoue la validation du sélecteur (comportement attendu : on lui redemande sa catégorie)", () => {
    // Reproduit exactement le check de ProfileSetupScreen (étape 0) : la valeur
    // stockée "U13" ne matche plus aucun chip proposé → l'utilisateur doit choisir
    // une nouvelle catégorie pour continuer. Ne crashe pas, ne bloque pas l'app :
    // seule l'étape "Catégorie" du profil redemande un choix explicite.
    const legacyValue = "U13";
    const canProceedWithoutRepicking = (SELECTABLE_AGE_CATEGORIES as readonly string[]).includes(legacyValue);
    expect(canProceedWithoutRepicking).toBe(false);
  });
});
