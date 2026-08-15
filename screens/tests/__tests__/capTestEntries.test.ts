// screens/tests/__tests__/capTestEntries.test.ts
//
// LA 31e SAUVEGARDE DÉTRUIT-ELLE ENCORE LE RECORD ?
//
// P0-5 de l'audit Profil (confirmé et re-scopé à l'inventaire clubs 15/08) :
// `[cleanEntry, ...entries].slice(0, 30)` réécrivait AsyncStorage sans la 31e
// entrée la plus ancienne — records de début de saison perdus, sans copie
// Firestore, sans avertissement. Ces tests EXÉCUTENT la borne réelle.

import {
  capTestEntries,
  TESTS_MAX_ENTRIES,
} from "../hooks/useTestsStorage";

type Entry = { ts: number; verticalJump?: number };

const makeEntries = (n: number): Entry[] =>
  // Le plus récent en tête, comme dans le stockage réel (ts décroissant).
  Array.from({ length: n }, (_, i) => ({ ts: 1_000_000 - i }));

describe("capTestEntries — la borne protège, elle ne détruit plus", () => {
  test("LA régression d'origine : 31 entrées survivent toutes", () => {
    // Avant le correctif, ce scénario perdait l'entrée la plus ancienne
    // (le record du jour 1) à la sauvegarde de la 31e.
    const record: Entry = { ts: 1, verticalJump: 250 };
    const next = capTestEntries([...makeEntries(30), record]);
    expect(next).toHaveLength(31);
    expect(next[next.length - 1]).toEqual(record);
  });

  test("une saison assidue complète tient sous la borne", () => {
    // ~13 entrées par journée de tests × 2 journées/cycle × ~8 cycles ≈ 208.
    const saison = makeEntries(208);
    expect(capTestEntries(saison)).toHaveLength(208);
  });

  test("la borne existe toujours (garde-fou stockage, pas une fenêtre)", () => {
    expect(TESTS_MAX_ENTRIES).toBeGreaterThanOrEqual(500);
    const next = capTestEntries(makeEntries(TESTS_MAX_ENTRIES + 1));
    expect(next).toHaveLength(TESTS_MAX_ENTRIES);
    // C'est bien la QUEUE (le plus ancien) qui sort, jamais la tête.
    expect(next[0].ts).toBe(1_000_000);
  });

  test("l'ordre n'est pas réordonné par la borne", () => {
    const next = capTestEntries(makeEntries(5));
    expect(next.map((e) => e.ts)).toEqual([1_000_000, 999_999, 999_998, 999_997, 999_996]);
  });
});

describe("plus aucun slice(0, 30) destructeur dans les deux fichiers", () => {
  const { readFileSync } = require("fs") as typeof import("fs");
  const { resolve } = require("path") as typeof import("path");
  const racine = resolve(__dirname, "..", "..", "..");

  test.each([
    ["screens/TestsScreen.tsx"],
    ["screens/tests/hooks/useTestsStorage.ts"],
  ])("%s", (rel) => {
    const source = readFileSync(resolve(racine, rel), "utf8");
    expect(source).not.toMatch(/slice\(0,\s*30\)/);
  });

  test("l'écriture passe par capTestEntries", () => {
    const source = readFileSync(resolve(racine, "screens/TestsScreen.tsx"), "utf8");
    expect(source).toMatch(/capTestEntries\(\[cleanEntry, \.\.\.entries\]\)/);
  });
});
