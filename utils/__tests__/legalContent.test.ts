// utils/__tests__/legalContent.test.ts
// Garde-fou : la politique de confidentialité doit contenir la section mineurs
// (< 15 ans, consentement parental) — exigée par la conformité RGPD et affichée
// dans la modal du setup profil U15.

import { PRIVACY_POLICY } from "../legalContent";

describe("PRIVACY_POLICY · section mineurs", () => {
  const section = PRIVACY_POLICY.find((s) => s.title.toLowerCase().includes("mineur"));

  test("la section mineurs existe", () => {
    expect(section).toBeDefined();
  });

  test("elle mentionne le seuil des 15 ans et le responsable légal", () => {
    const body = (section?.body ?? []).join(" ");
    expect(body).toContain("15 ans");
    expect(body).toContain("responsable légal");
  });

  test("elle indique le contact existant pour exercer les droits (aucune info inventée)", () => {
    const body = (section?.body ?? []).join(" ");
    expect(body).toContain("kyllian@fks-app.com");
  });
});
