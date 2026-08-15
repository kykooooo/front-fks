// screens/__tests__/registerPrenom.test.ts
//
// LE PRÉNOM NE VIENT PLUS JAMAIS DE L'EMAIL.
//
// P1-04 inventaire clubs (15/08) : prénom laissé vide à l'inscription →
// l'app écrivait la partie locale de l'email (« kyky76700 ») comme
// firstName/displayName en base, re-préaffichée au joueur au setup et
// montrée au coach dans son effectif. Valeur de remplissage interdite par
// la règle 12 : donnée absente = null.

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "RegisterScreen.tsx"),
  "utf8"
);

describe("Register — prénom absent = null, jamais un morceau d'email", () => {
  test("plus aucun repli sur la partie locale de l'email", () => {
    expect(source).not.toContain('split("@")');
    expect(source).not.toContain("split('@')");
  });

  test("le doc écrit null quand le prénom est vide", () => {
    expect(source).toMatch(/displayName: cleanName \|\| null/);
    expect(source).toMatch(/firstName: cleanName \|\| null/);
  });

  test("updateProfile auth reste conditionné au prénom réellement saisi", () => {
    expect(source).toMatch(/if \(cleanName\) \{\s*await updateProfile/);
  });
});
