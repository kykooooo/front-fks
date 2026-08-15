// screens/__tests__/labelsFrancais.test.ts
//
// PLUS DE TOKENS BACKEND NI DE DATES ISO SUR LE CHEMIN DE SÉANCE.
//
// P1-11/P1-12/P1-13/P1-14 inventaire clubs (15/08) : « hard »/« moderate » sur
// chaque carte de bloc (Preview ET Live), « Basées sur l'intensité moderate »,
// « Readiness » + « 2026-08-15 » sur le héro du feedback, « Séance planifiée
// pour le 2026-08-16. » en toast — la table frLabels et formatDayFR
// existaient, elles n'étaient juste pas branchées là.

import { readFileSync } from "fs";
import { resolve } from "path";
import { frIntensity } from "../../utils/frLabels";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("badges d'intensité — français partout (P1-12)", () => {
  test("EXÉCUTÉ : la table traduit les trois tokens du contrat", () => {
    expect(frIntensity("hard")).toBe("Intense");
    expect(frIntensity("moderate")).toBe("Modéré");
    expect(frIntensity("easy")).toBe("Facile");
  });

  test.each([
    ["screens/sessionPreview/components/BlockCard.tsx"],
    ["screens/SessionLiveScreen.tsx"],
  ])("%s : le badge de bloc passe par frIntensity", (rel) => {
    const source = lire(rel);
    expect(source).toMatch(/Badge label=\{frIntensity\(block\.intensity\)\}/);
    expect(source).not.toMatch(/Badge label=\{block\.intensity\}/);
  });
});

describe("feedback — plus d'anglais ni d'ISO (P1-13 / P1-14)", () => {
  test("le héro affiche « État du jour » et une date française", () => {
    const source = lire("screens/feedback/components/HeroReadinessCard.tsx");
    expect(source).toContain("État du jour");
    expect(source).not.toMatch(/>Readiness</);
    expect(source).toMatch(/formatDayFR\(todayKey\)/);
  });

  test("les suggestions traduisent l'intensité à la source", () => {
    expect(lire("screens/feedback/hooks/useSuggestions.ts")).toMatch(
      /intensityLabel: frIntensity\(intensity\)/
    );
    expect(lire("screens/feedback/components/SuggestionsCard.tsx")).toContain(
      "l'intensité prévue :"
    );
  });
});

describe("toast de planification — date française (P1-11)", () => {
  test("les 4 sites passent par formatDayFR, plus aucun ISO brut", () => {
    const source = lire("screens/NewSessionScreen.tsx");
    expect((source.match(/formatDayFR\(dateISO\)/g) ?? []).length).toBe(4);
    expect(source).not.toMatch(/planifiée pour le \$\{dateISO\}/);
  });
});
