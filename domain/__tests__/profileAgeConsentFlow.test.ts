// domain/__tests__/profileAgeConsentFlow.test.ts
// Test d'INTÉGRATION du parcours combiné des deux chantiers fusionnés :
//   feat/retrait-u13 (U13 retirée du sélecteur, défense backend conservée)
// + feat/consentement-parental-u15 (case RGPD < 15 ans conditionnelle).
//
// Il rejoue pas à pas le chemin de décision UNIQUE composé par
// ProfileSetupScreen (étape 0) avec exactement les mêmes primitives :
//   1. catégorie sélectionnable ? (SELECTABLE_AGE_CATEGORIES) — sinon blocage
//      "Choisis ta catégorie" et AUCUNE surface consentement (pas de soft-lock) ;
//   2. seulement ensuite, consentement parental si < 15 ans
//      (isParentalConsentBlocking) ;
//   3. au save, payload avec la preuve (buildParentalConsent) qui survit au
//      roundtrip schéma Firestore.
// Si la composition dans l'écran change, adapter ce fichier EN MÊME TEMPS.

import {
  AGE_CATEGORIES,
  SELECTABLE_AGE_CATEGORIES,
  normalizeAgeCategory,
} from "../types";
import {
  requiresParentalConsent,
  isParentalConsentBlocking,
  consentCheckedAfterCategoryChange,
  buildParentalConsent,
  isStoredParentalConsent,
} from "../parentalConsent";
import { userProfileSchema } from "../../schemas/firestoreSchemas";

/* ── Miroirs exacts de la composition de ProfileSetupScreen ── */

/** Étape 0 : la catégorie stockée matche-t-elle un chip proposé ? */
const isSelectable = (ageCategory: string) =>
  (SELECTABLE_AGE_CATEGORIES as readonly string[]).includes(ageCategory);

/**
 * Prédicat unique de la surface consentement (case affichée + bouton désactivé),
 * miroir de `showParentalConsent` dans ProfileSetupScreen : gaté sur SELECTABLE
 * pour qu'un legacy U13 (qui doit d'abord repick) ne voie ni case ni bouton mort.
 */
const showParentalConsent = (ageCategory: string) =>
  isSelectable(ageCategory) && requiresParentalConsent(ageCategory);

/**
 * Verdict de l'étape 0 sur l'axe catégorie/consentement, dans l'ordre exact de
 * validateStep : un seul chemin de décision, jamais deux gardes empilés.
 */
const step0Verdict = (
  ageCategory: string,
  consentChecked: boolean,
): "blocked_category" | "blocked_consent" | "ok" => {
  if (!isSelectable(ageCategory)) return "blocked_category";
  if (isParentalConsentBlocking(ageCategory, consentChecked)) return "blocked_consent";
  return "ok";
};

describe("Parcours combiné : legacy U13 → repick U15 → consentement → payload", () => {
  test("étape A — profil legacy 'U13' au chargement : bloqué sur la catégorie, AUCUNE surface consentement, défense backend intacte", () => {
    const stored = "U13";

    // Aucune case cochée au chargement d'un legacy U13 (jamais de consentement fantôme).
    expect(step0Verdict(stored, false)).toBe("blocked_category");

    // Pas de case parentale affichée ni de bouton "Suivant" désactivé pour lui :
    // le SEUL message qu'il doit voir est "Choisis ta catégorie". Sans ce gate,
    // isParentalConsentBlocking('U13', false) désactiverait le bouton alors que
    // la case serait cachée = soft-lock.
    expect(showParentalConsent(stored)).toBe(false);
    expect(isParentalConsentBlocking(stored, false)).toBe(true); // ← ce que le gate neutralise

    // GARDE-FOU CRITIQUE (chantier retrait-u13) : tant qu'il n'a pas validé un
    // nouveau choix, sa donnée stockée 'U13' normalise toujours vers 'U13' →
    // age_category part au backend → AGE_CATEGORY_CAPS s'applique.
    expect(normalizeAgeCategory(stored)).toBe("U13");
    expect(AGE_CATEGORIES).toContain("U13");
  });

  test("étape B — il repick 'U15' : la case parentale apparaît, décochée, et bloque l'étape", () => {
    const picked = "U15";

    // Le reset au changement de catégorie ne fabrique jamais un consentement :
    // qu'il ait touché la case avant ou non, arriver sur U15 exige un choix explicite.
    const checkedAfterRepick = consentCheckedAfterCategoryChange(picked, false);
    expect(checkedAfterRepick).toBe(false);

    expect(showParentalConsent(picked)).toBe(true);
    expect(step0Verdict(picked, checkedAfterRepick)).toBe("blocked_consent");
  });

  test("étape C — case cochée : l'étape passe, et le payload contient la preuve avec la BONNE catégorie", () => {
    const picked = "U15";
    expect(step0Verdict(picked, true)).toBe("ok");

    // Miroir du spread au save de ProfileSetupScreen : hors < 15 ans le champ
    // n'est pas touché, sinon on construit/conserve la preuve.
    const payload = {
      ageCategory: picked,
      ...(requiresParentalConsent(picked)
        ? { parentalConsent: buildParentalConsent(picked, null) }
        : {}),
    };

    expect(payload.parentalConsent).toBeDefined();
    expect(isStoredParentalConsent(payload.parentalConsent)).toBe(true);
    expect(payload.parentalConsent?.accepted).toBe(true);
    // La preuve porte la catégorie repick ('U15'), PAS l'ancienne valeur 'U13'.
    expect(payload.parentalConsent?.ageCategoryAtConsent).toBe("U15");
    expect(new Date(payload.parentalConsent!.acceptedAt).toString()).not.toBe("Invalid Date");

    // Roundtrip schéma Firestore : le profil persisté relu ne perd rien.
    const parsed = userProfileSchema.parse(payload);
    expect(parsed.ageCategory).toBe("U15");
    expect(parsed.parentalConsent).toEqual(payload.parentalConsent);
  });

  test("étape D — un adulte repick (Senior) : zéro friction, zéro champ consentement écrit", () => {
    const picked = "Senior";
    expect(showParentalConsent(picked)).toBe(false);
    expect(step0Verdict(picked, false)).toBe("ok");

    const payload = {
      ageCategory: picked,
      ...(requiresParentalConsent(picked)
        ? { parentalConsent: buildParentalConsent(picked, null) }
        : {}),
    } as { ageCategory: string; parentalConsent?: unknown };
    expect(payload.parentalConsent).toBeUndefined();
  });

  test("cohérence des deux chantiers : 'U13' dans la liste consentement = code mort inoffensif (défense en profondeur), pas une surface UI", () => {
    // Le chantier consentement garde "U13" dans sa liste interne (voulu : si un
    // jour U13 redevenait sélectionnable, la case redeviendrait obligatoire sans
    // qu'on y pense). Tant que U13 n'est pas sélectionnable, cette entrée ne doit
    // produire AUCUN effet visible : c'est exactement ce que vérifie ce test.
    expect(requiresParentalConsent("U13")).toBe(true); // l'entrée existe (défense)
    expect(isSelectable("U13")).toBe(false); // mais la catégorie n'est pas proposée
    expect(showParentalConsent("U13")).toBe(false); // → donc aucune surface UI
    // Et pour TOUTE catégorie non sélectionnable, aucune surface consentement :
    for (const c of AGE_CATEGORIES) {
      if (!isSelectable(c)) expect(showParentalConsent(c)).toBe(false);
    }
  });
});
