// screens/newSession/__tests__/fusionValiderGenerer.test.ts
//
// Verrou de SOURCE pour la fusion "valider le contexte" + "générer"
// (SPEC_DA_ACCUEIL_SEANCE.md §3.6) : `setupDone` a disparu, le verrou anti
// double-appui est toujours là, et `fetchV2` n'est appelé qu'à un seul endroit
// (aucun deuxième chemin de génération payante n'a été introduit au passage).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..", "..");
const generation = readFileSync(resolve(racine, "screens/NewSessionScreen.tsx"), "utf8");

describe("fusion valider+générer : setupDone a disparu proprement", () => {
  test("aucune trace de setupDone dans NewSessionScreen.tsx", () => {
    expect(generation).not.toContain("setupDone");
    expect(generation).not.toContain("setSetupDone");
  });

  test("le verrou anti double-appui est toujours pris dans handleGenerate", () => {
    const bloc = generation.slice(generation.indexOf("const handleGenerate"));
    expect(bloc.slice(0, 400)).toContain("verrouRef.current.prendre()");
  });

  test("fetchV2 n'est appelé qu'à un seul endroit (un seul chemin de génération payante)", () => {
    const occurrences = generation.match(/fetchV2\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  test("EquipmentSelector n'est plus appelé avec onValidateContext ni setupDone", () => {
    expect(generation).not.toContain("onValidateContext");
  });
});

describe("ordre du rendu : la carte d'échec est EN BAS du contenu (spec §3.3/§3.8)", () => {
  // REWORK orchestrateur : la carte vivait AU-DESSUS du formulaire alors que
  // `scrollToEnd()` se déclenche à son apparition — l'écran défilait donc en
  // s'ÉLOIGNANT d'elle. Elle doit être le dernier élément de contenu (hors
  // bloc debug __DEV__), juste avant </ScrollView>.
  test("<CarteEchecGeneration vient APRÈS <EquipmentSelector et <CurrentSessionCard", () => {
    const iEquipment = generation.indexOf("<EquipmentSelector");
    const iCurrentSession = generation.indexOf("<CurrentSessionCard");
    const iEchec = generation.indexOf("<CarteEchecGeneration");

    expect(iEquipment).toBeGreaterThan(-1);
    expect(iCurrentSession).toBeGreaterThan(-1);
    expect(iEchec).toBeGreaterThan(-1);
    expect(iEchec).toBeGreaterThan(iEquipment);
    expect(iEchec).toBeGreaterThan(iCurrentSession);
  });

  test("<CarteEchecGeneration reste DANS le ScrollView, avant sa fermeture", () => {
    const iEchec = generation.indexOf("<CarteEchecGeneration");
    const iScrollClose = generation.indexOf("</ScrollView>");
    expect(iScrollClose).toBeGreaterThan(-1);
    expect(iEchec).toBeLessThan(iScrollClose);
  });
});
