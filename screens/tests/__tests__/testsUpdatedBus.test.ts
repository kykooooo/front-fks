// screens/tests/__tests__/testsUpdatedBus.test.ts
//
// UNE BATTERIE ENREGISTRÉE EXISTE-T-ELLE POUR LES ÉCRANS DÉJÀ MONTÉS ?
//
// P1-19 inventaire clubs (15/08) : les onglets restent montés (tab bar) — une
// batterie sauvegardée sur l'écran Tests n'existait ni pour le Home ni pour le
// Profil de toute la session d'app (« zéro test » affiché après les tests).
// Correctif : bus DeviceEventEmitter (même mécanique que le bus de toast) —
// chaque écriture émet, chaque lecteur se re-lit.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  emitTestsUpdated,
  onTestsUpdated,
} from "../hooks/useTestsStorage";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("le bus « tests mis à jour » — exécuté", () => {
  test("émettre réveille les abonnés, se désabonner les endort", () => {
    let appels = 0;
    const off = onTestsUpdated(() => { appels += 1; });
    emitTestsUpdated();
    emitTestsUpdated();
    expect(appels).toBe(2);
    off();
    emitTestsUpdated();
    expect(appels).toBe(2);
  });

  test("plusieurs lecteurs entendent la même écriture (Home + Profil + Tests)", () => {
    const recus: string[] = [];
    const offs = ["home", "profil", "tests"].map((qui) =>
      onTestsUpdated(() => recus.push(qui))
    );
    emitTestsUpdated();
    expect(recus.sort()).toEqual(["home", "profil", "tests"]);
    offs.forEach((off) => off());
  });
});

describe("le câblage — source", () => {
  test("persistEntries émet APRÈS l'écriture AsyncStorage", () => {
    const source = lire("screens/tests/hooks/useTestsStorage.ts");
    const bloc = source.slice(source.indexOf("const persistEntries"));
    const idxSetItem = bloc.indexOf("AsyncStorage.setItem");
    const idxEmit = bloc.indexOf("emitTestsUpdated()");
    expect(idxSetItem).toBeGreaterThan(-1);
    expect(idxEmit).toBeGreaterThan(idxSetItem);
  });

  test("le hook se re-lit sur l'événement (version dans les deps du load)", () => {
    const source = lire("screens/tests/hooks/useTestsStorage.ts");
    expect(source).toMatch(/onTestsUpdated\(\(\) => setVersion/);
    expect(source).toMatch(/\}, \[version\]\);/);
  });

  test("le Profil (lecture brute séparée) est abonné lui aussi", () => {
    const source = lire("screens/ProfileScreen.tsx");
    expect(source).toMatch(/onTestsUpdated\(\(\) => setTestsVersion/);
    expect(source).toMatch(/\[devNowISO, testsVersion\]/);
  });
});
