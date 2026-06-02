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
