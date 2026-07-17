// domain/__tests__/parentalConsent.test.ts
// Consentement parental RGPD < 15 ans : logique pure consommée par
// ProfileSetupScreen (affichage conditionnel, blocage bouton, reset au
// changement de catégorie, objet persisté).

import {
  requiresParentalConsent,
  isParentalConsentBlocking,
  consentCheckedAfterCategoryChange,
  isStoredParentalConsent,
  buildParentalConsent,
} from "../parentalConsent";
import { AGE_CATEGORIES } from "../types";

describe("requiresParentalConsent", () => {
  test("U15 (13-14 ans) déclenche le consentement parental", () => {
    expect(requiresParentalConsent("U15")).toBe(true);
  });

  test("U13 reste couverte tant que la catégorie est sélectionnable (retrait en cours)", () => {
    expect(requiresParentalConsent("U13")).toBe(true);
  });

  test("U17 / U18 / Senior (≥ 15 ans) : jamais de consentement demandé", () => {
    expect(requiresParentalConsent("U17")).toBe(false);
    expect(requiresParentalConsent("U18")).toBe(false);
    expect(requiresParentalConsent("Senior")).toBe(false);
  });

  test("exhaustif sur AGE_CATEGORIES : seules les catégories < 15 ans déclenchent", () => {
    const triggering = AGE_CATEGORIES.filter((c) => requiresParentalConsent(c));
    expect(triggering).toEqual(AGE_CATEGORIES.filter((c) => c === "U13" || c === "U15"));
  });

  test("entrées douteuses → false (jamais de blocage injustifié)", () => {
    expect(requiresParentalConsent(null)).toBe(false);
    expect(requiresParentalConsent(undefined)).toBe(false);
    expect(requiresParentalConsent("")).toBe(false);
    expect(requiresParentalConsent("u15")).toBe(false); // sensible à la casse, comme normalizeAgeCategory
  });

  test("tolère les espaces parasites d'un doc Firestore", () => {
    expect(requiresParentalConsent(" U15 ")).toBe(true);
  });
});

describe("isParentalConsentBlocking (bouton Suivant + validation étape 1)", () => {
  test("U15 non cochée → bloqué", () => {
    expect(isParentalConsentBlocking("U15", false)).toBe(true);
  });

  test("U15 cochée → débloqué", () => {
    expect(isParentalConsentBlocking("U15", true)).toBe(false);
  });

  test("U17 / U18 / Senior : jamais bloqués, case cochée ou non (zéro friction)", () => {
    for (const cat of ["U17", "U18", "Senior"]) {
      expect(isParentalConsentBlocking(cat, false)).toBe(false);
      expect(isParentalConsentBlocking(cat, true)).toBe(false);
    }
  });

  test("catégorie pas encore choisie → pas de blocage", () => {
    expect(isParentalConsentBlocking("", false)).toBe(false);
    expect(isParentalConsentBlocking(null, false)).toBe(false);
  });
});

describe("consentCheckedAfterCategoryChange (pas de consentement fantôme)", () => {
  test("scénario complet : U15 cochée → U17 décoche → retour U15 impose de re-cocher", () => {
    // Le joueur sélectionne U15 et coche la case.
    let checked = true;
    expect(isParentalConsentBlocking("U15", checked)).toBe(false);

    // Il bascule sur U17 : la case est remise à zéro, et U17 n'est pas bloqué.
    checked = consentCheckedAfterCategoryChange("U17", checked);
    expect(checked).toBe(false);
    expect(isParentalConsentBlocking("U17", checked)).toBe(false);

    // Il revient sur U15 : aucun consentement fantôme, il doit re-cocher.
    checked = consentCheckedAfterCategoryChange("U15", checked);
    expect(checked).toBe(false);
    expect(isParentalConsentBlocking("U15", checked)).toBe(true);
  });

  test("rester en U15 conserve la case cochée", () => {
    expect(consentCheckedAfterCategoryChange("U15", true)).toBe(true);
  });

  test("catégorie ≥ 15 ans : la case est toujours remise à zéro", () => {
    expect(consentCheckedAfterCategoryChange("Senior", true)).toBe(false);
    expect(consentCheckedAfterCategoryChange("U18", true)).toBe(false);
  });
});

describe("isStoredParentalConsent (lecture tolérante du doc Firestore)", () => {
  const valid = { accepted: true, acceptedAt: "2026-07-17T10:00:00.000Z", ageCategoryAtConsent: "U15" };

  test("preuve valide reconnue", () => {
    expect(isStoredParentalConsent(valid)).toBe(true);
  });

  test("profil legacy (champ absent) → false, jamais d'erreur", () => {
    expect(isStoredParentalConsent(undefined)).toBe(false);
    expect(isStoredParentalConsent(null)).toBe(false);
  });

  test("objets malformés → false", () => {
    expect(isStoredParentalConsent({})).toBe(false);
    expect(isStoredParentalConsent("oui")).toBe(false);
    expect(isStoredParentalConsent({ ...valid, accepted: false })).toBe(false);
    expect(isStoredParentalConsent({ ...valid, acceptedAt: "" })).toBe(false);
    expect(isStoredParentalConsent({ accepted: true })).toBe(false);
  });
});

describe("buildParentalConsent (objet persisté dans users/{uid})", () => {
  test("construit une preuve complète avec timestamp ISO", () => {
    const consent = buildParentalConsent("U15", null);
    expect(consent.accepted).toBe(true);
    expect(consent.ageCategoryAtConsent).toBe("U15");
    // Timestamp ISO 8601 valide et re-sérialisable à l'identique.
    expect(new Date(consent.acceptedAt).toISOString()).toBe(consent.acceptedAt);
  });

  test("preuve existante pour la même catégorie : conservée telle quelle (acceptedAt d'origine)", () => {
    const existing = { accepted: true as const, acceptedAt: "2026-01-01T00:00:00.000Z", ageCategoryAtConsent: "U15" };
    expect(buildParentalConsent("U15", existing)).toEqual(existing);
  });

  test("preuve existante pour une autre catégorie : nouvelle preuve", () => {
    const existing = { accepted: true as const, acceptedAt: "2026-01-01T00:00:00.000Z", ageCategoryAtConsent: "U13" };
    const consent = buildParentalConsent("U15", existing);
    expect(consent.ageCategoryAtConsent).toBe("U15");
    expect(consent.acceptedAt).not.toBe(existing.acceptedAt);
  });

  test("preuve existante invalide : ignorée, nouvelle preuve", () => {
    const consent = buildParentalConsent("U15", { accepted: false });
    expect(consent.accepted).toBe(true);
    expect(consent.ageCategoryAtConsent).toBe("U15");
  });
});
