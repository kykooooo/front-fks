// screens/__tests__/recapHebdoNavigation.test.ts
//
// LA NOTIF « RÉCAP DE LA SEMAINE » ET L'ÉTAT COLLECTING (P1-17 / P1-18).
//
// P1-17 : la page Progression est volontairement inatteignable en états
// empty/collecting (verrou produit) — la notification du dimanche 20 h (ON
// par défaut) perçait ce verrou en semaine 1 pilote et ouvrait une page sans
// aucun bilan de semaine. Elle mène désormais au Home.
// P1-18 : en collecting, la page imprimait deux fois la même phrase (le fait
// « Avant d'afficher une tendance / Encore N séances » PUIS l'explication
// « Encore N séances avant d'afficher une tendance. ») — règle documentée et
// respectée par la carte du Home, violée par la page.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("P1-17 — le tap récap hebdo mène au Home", () => {
  const source = lire("hooks/useNotificationHandler.ts");

  test("weekly_recap navigue vers Tabs/Home, plus vers Progression", () => {
    const bloc = source.slice(
      source.indexOf('case "weekly_recap"'),
      source.indexOf('case "session_planned"')
    );
    expect(bloc).toContain('navigationRef.navigate("Tabs", { screen: "Home" })');
    expect(bloc).not.toContain('navigate("Progression")');
  });
});

describe("P1-18 — collecting n'imprime plus la même phrase deux fois", () => {
  test("la page ne rend plus l'explication en collecting (même règle que le Home)", () => {
    const source = lire("screens/ProgressScreen.tsx");
    const debut = source.indexOf('progression.state === "collecting"');
    expect(debut).toBeGreaterThan(-1);
    // « ready » existe aussi PLUS HAUT dans le fichier : borner la fin à la
    // première occurrence APRÈS le début du bloc collecting.
    const fin = source.indexOf('progression.state === "ready"', debut);
    expect(fin).toBeGreaterThan(debut);
    const bloc = source.slice(debut, fin);
    expect(bloc).not.toContain("tendanceIndisponible.explication");
    // Les faits, eux, restent rendus — c'est eux qui portent le « ce qui manque ».
    expect(bloc).toContain("progression.faits.map");
  });
});
