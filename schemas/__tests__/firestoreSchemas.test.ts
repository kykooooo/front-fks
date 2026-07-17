// schemas/__tests__/firestoreSchemas.test.ts
// Vérifie que userProfileSchema gère ageCategory sans casser les anciens profils.

import { userProfileSchema } from "../firestoreSchemas";

describe("userProfileSchema · ageCategory", () => {
  test("accepte une catégorie valide", () => {
    const parsed = userProfileSchema.parse({ firstName: "Kylian", ageCategory: "U17" });
    expect(parsed.ageCategory).toBe("U17");
  });

  test("accepte l'absence de ageCategory (ancien profil) sans erreur", () => {
    const parsed = userProfileSchema.parse({ firstName: "Kylian" });
    // optionnel → undefined, jamais une exception
    expect(parsed.ageCategory ?? null).toBeNull();
  });

  test("une catégorie invalide retombe sur null (catch), pas de crash", () => {
    const parsed = userProfileSchema.parse({ firstName: "Kylian", ageCategory: "U11" });
    expect(parsed.ageCategory).toBeNull();
  });

  test("safeParse réussit toujours même avec un profil quasi vide", () => {
    const res = userProfileSchema.safeParse({});
    expect(res.success).toBe(true);
  });
});

describe("userProfileSchema · parentalConsent", () => {
  test("absent (profil legacy) → pas d'erreur, valeur nulle", () => {
    const parsed = userProfileSchema.parse({ firstName: "Léa", ageCategory: "U15" });
    expect(parsed.parentalConsent ?? null).toBeNull();
  });

  test("preuve valide conservée telle quelle", () => {
    const consent = {
      accepted: true,
      acceptedAt: "2026-07-17T10:00:00.000Z",
      ageCategoryAtConsent: "U15",
    };
    const parsed = userProfileSchema.parse({ parentalConsent: consent });
    expect(parsed.parentalConsent).toEqual(consent);
  });

  test("valeur malformée → null (catch), jamais de crash", () => {
    const parsed = userProfileSchema.parse({ parentalConsent: "oui" });
    expect(parsed.parentalConsent ?? null).toBeNull();
  });

  test("safeParse réussit sur un profil U15 legacy sans le champ", () => {
    const res = userProfileSchema.safeParse({
      firstName: "Léa",
      ageCategory: "U15",
      clubTrainingDays: ["mon"],
      clubTrainingsPerWeek: 2,
      matchesPerWeek: 1,
    });
    expect(res.success).toBe(true);
  });
});
