// screens/__tests__/cycleModalHorsLigne.test.ts
//
// « DÉMARRER CE CYCLE » HORS-LIGNE N'EST PLUS UN BOUTON MORT.
//
// P1-25 inventaire clubs (15/08) : aucun état de chargement dans tout
// CycleModalScreen et un setDoc qui pend indéfiniment hors-ligne — le tap ne
// produisait RIEN (pas de toast, pas de spinner, pas de navigation), le toast
// d'erreur était inatteignable. Tests-source du triple verrou : délai de
// garde, état persisting sur les boutons, message réseau dédié.

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "CycleModalScreen.tsx"),
  "utf8"
);

describe("CycleModal — écritures bornées et boutons vivants", () => {
  test("persistCycle passe par withTimeout (les 3 écritures du modal)", () => {
    expect(source).toMatch(/withTimeout\(\s*setDoc\(/);
    expect((source.match(/persistCycle\(/g) ?? []).length).toBeGreaterThanOrEqual(4); // déf + 3 appels
  });

  test("l'état persisting existe et pilote les CTA", () => {
    expect(source).toMatch(/const \[persisting, setPersisting\] = useState\(false\)/);
    expect(source).toMatch(/label=\{persisting \? "Enregistrement…" : "Démarrer ce cycle"\}/);
    expect(source).toMatch(/disabled=\{persisting\}/);
  });

  test("persisting est relâché même en échec (finally)", () => {
    const bloc = source.slice(
      source.indexOf("setPersisting(true)"),
      source.indexOf("const toastEchecCycle")
    );
    expect(bloc).toContain("finally");
    expect(bloc).toContain("setPersisting(false)");
  });

  test("le hors-ligne a son message dédié, distinct de l'erreur générique", () => {
    expect(source).toMatch(/e instanceof TimeoutError/);
    expect(source).toContain("Vérifie ta connexion et réessaie.");
  });
});
