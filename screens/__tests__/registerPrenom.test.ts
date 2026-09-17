// screens/__tests__/registerPrenom.test.ts
//
// LE PRÉNOM NE VIENT PLUS JAMAIS DE L'EMAIL.
//
// P1-04 inventaire clubs (15/08) : prénom laissé vide à l'inscription →
// l'app écrivait la partie locale de l'email (« kyky76700 ») comme
// firstName/displayName en base, re-préaffichée au joueur au setup. Valeur de
// remplissage interdite par la règle 12 : donnée absente = ABSENTE.
//
// Depuis 2026-09, la création de compte vit dans services/registerAccount et
// se teste EN EXÉCUTION : un prénom vide n'écrit plus `null` (qui, arrivé tard,
// aurait pu effacer un prénom saisi au questionnaire) — la clé est omise.

import { readFileSync } from "fs";
import { resolve } from "path";
import { registerAccount, type RegisterDeps } from "../../services/registerAccount";

const source = readFileSync(resolve(__dirname, "..", "RegisterScreen.tsx"), "utf8");

function deps(journal: string[], docs: Array<Record<string, unknown>>): RegisterDeps {
  return {
    createUser: async (email) => ({ uid: "uid-1", email, raw: {} }),
    updateDisplayName: async (_u, nom) => void journal.push(`updateDisplayName:${nom}`),
    writeStartDoc: async (_uid, data) => void docs.push(data),
    markOnboardingStart: async () => undefined,
    serverTimestamp: () => "TS",
  };
}

describe("Register — prénom absent = absent, jamais un morceau d'email", () => {
  test("plus aucun repli sur la partie locale de l'email", () => {
    expect(source).not.toContain('split("@")');
    expect(source).not.toContain("split('@')");
  });

  test("l'écran passe par le service testé", () => {
    expect(source).toContain('from "../services/registerAccount"');
    expect(source).toContain("registerAccount(");
  });

  test("prénom vide : ni firstName ni displayName dans le document, et pas d'updateProfile", async () => {
    const journal: string[] = [];
    const docs: Array<Record<string, unknown>> = [];
    await registerAccount(deps(journal, docs), { email: "kyky76700@example.com", password: "xxxxxx", firstName: "  " });
    expect("firstName" in docs[0]).toBe(false);
    expect("displayName" in docs[0]).toBe(false);
    expect(JSON.stringify(docs[0])).not.toContain("\"kyky76700\"");
    expect(journal).toEqual([]);
  });

  test("prénom saisi : écrit tel quel (espaces retirés), et posé sur le compte", async () => {
    const journal: string[] = [];
    const docs: Array<Record<string, unknown>> = [];
    await registerAccount(deps(journal, docs), { email: "a@b.fr", password: "xxxxxx", firstName: " Lina " });
    expect(docs[0].firstName).toBe("Lina");
    expect(docs[0].displayName).toBe("Lina");
    expect(journal).toEqual(["updateDisplayName:Lina"]);
  });
});
