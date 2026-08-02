// navigation/__tests__/coachTabs.test.ts
//
// GARDE-FOU DE CÂBLAGE.
//
// La navigation de l'espace coach repose sur un contrat par CHAÎNES DE
// CARACTÈRES : `CoachTodayScreen` appelle `navigate("CoachRoster")` et
// `navigate("CoachWeek")`, et attrape l'exception pour afficher un message
// honnête si la route n'existe pas. Conséquence : renommer un onglet ne casse
// NI la compilation NI le rendu — ça casse silencieusement les liens de l'écran
// d'atterrissage, et personne ne le voit avant le terrain.
//
// Ce test relie les deux extrémités du contrat.

import { COACH_TAB_ORDER } from "../CoachTabs";
import { COACH_TODAY_ROUTES } from "../../screens/coach/CoachTodayScreen";

describe("câblage des onglets coach", () => {
  test("les onglets déclarés couvrent les routes visées par l'écran Aujourd'hui", () => {
    expect(COACH_TAB_ORDER).toContain(COACH_TODAY_ROUTES.roster);
    expect(COACH_TAB_ORDER).toContain(COACH_TODAY_ROUTES.week);
  });

  test("trois onglets, dans l'ordre Aujourd'hui / Effectif / Semaine", () => {
    // L'ordre porte du sens : c'est aussi celui du balayage latéral, et
    // « Aujourd'hui » doit rester l'écran d'atterrissage (premier onglet).
    expect(COACH_TAB_ORDER).toEqual(["CoachToday", "CoachRoster", "CoachWeek"]);
  });

  test("la fiche joueur n'est PAS un onglet (elle vit dans le stack)", () => {
    // Une fiche ouverte depuis une liste doit pouvoir être refermée ; en faire
    // un onglet la rendrait persistante et sans retour naturel.
    expect(COACH_TAB_ORDER).not.toContain(COACH_TODAY_ROUTES.playerDetail);
  });
});
