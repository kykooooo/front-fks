// repositories/__tests__/clubsRepo.test.ts
// Tests des helpers purs de gestion des codes club (pas d'accès Firestore).
// On mocke services/firebase pour éviter l'initialisation de l'app Firebase en test.

jest.mock("../../services/firebase", () => ({ db: {}, auth: {} }));

import { normalizeInviteCode, generateInviteCode } from "../clubsRepo";

describe("normalizeInviteCode", () => {
  test("met en majuscules et retire les espaces", () => {
    expect(normalizeInviteCode("  fksf-1234 ")).toBe("FKSF-1234");
    expect(normalizeInviteCode("ab cd 12")).toBe("ABCD12");
  });

  test("retire les caractères non alphanumériques (hors tiret)", () => {
    expect(normalizeInviteCode("fk@s#f_1234!")).toBe("FKSF1234");
    expect(normalizeInviteCode("ABC-123")).toBe("ABC-123");
  });

  test("chaîne vide ou invalide → vide", () => {
    expect(normalizeInviteCode("")).toBe("");
    expect(normalizeInviteCode("   ")).toBe("");
  });
});

describe("generateInviteCode", () => {
  test("respecte le format PREFIX-DDDD", () => {
    const code = generateInviteCode("FC Exemple");
    expect(code).toMatch(/^[A-Z]{1,4}-\d{4}$/);
  });

  test("utilise le début du nom du club comme préfixe quand possible", () => {
    const code = generateInviteCode("Lille");
    expect(code.startsWith("LILL-")).toBe(true);
  });

  test("génère un préfixe de secours si le nom est trop court", () => {
    const code = generateInviteCode("FC");
    expect(code).toMatch(/^[A-Z]{4}-\d{4}$/);
  });
});
