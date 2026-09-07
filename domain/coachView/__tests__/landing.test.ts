// domain/coachView/__tests__/landing.test.ts
//
// CE QUE CES TESTS PROTÈGENT.
//
//  1. LE DÉFAUT DE TERRAIN. Un club sans joueur ouvrait sur « Aujourd'hui »,
//     c'est-à-dire sur une carte d'état vide et rien d'autre. Il ouvre
//     maintenant sur « Semaine ».
//  2. ON NE CONCLUT PAS SANS RÉPONSE. Tant que l'effectif n'a pas répondu, la
//     fonction renvoie `null` — l'appelant attend. Rendre « Aujourd'hui » ici
//     ferait clignoter l'écran une fois la réponse arrivée.
//  3. UN VIDE QU'ON N'A PAS LU N'EST PAS UN VIDE. Effectif illisible, club
//     illisible, compte sans club : aucun n'autorise à dévier. On retombe sur
//     le comportement actuel.

import {
  COACH_LANDING_DEFAULT_TAB,
  chooseCoachLandingTab,
  type CoachLandingInput,
} from "../landing";

/** Club lu, effectif lu et abouti : la seule base sur laquelle on décide. */
function base(over: Partial<CoachLandingInput> = {}): CoachLandingInput {
  return {
    clubStatus: "ready",
    rosterStatus: "ready",
    rosterAnswered: true,
    memberCount: 3,
    ...over,
  };
}

describe("onglet d'atterrissage coach", () => {
  test("effectif vide et lu : on ouvre sur Semaine", () => {
    expect(chooseCoachLandingTab(base({ memberCount: 0 }))).toBe("CoachWeek");
  });

  test("au moins un membre : comportement inchangé, on ouvre sur Aujourd'hui", () => {
    expect(chooseCoachLandingTab(base({ memberCount: 1 }))).toBe("CoachToday");
    expect(chooseCoachLandingTab(base({ memberCount: 24 }))).toBe("CoachToday");
    expect(COACH_LANDING_DEFAULT_TAB).toBe("CoachToday");
  });

  describe("tant qu'on ne sait pas, on ne décide pas", () => {
    test("lecture du club en cours", () => {
      expect(chooseCoachLandingTab(base({ clubStatus: "loading" }))).toBeNull();
    });

    test("lecture de l'effectif en cours", () => {
      expect(chooseCoachLandingTab(base({ rosterStatus: "loading", rosterAnswered: false })))
        .toBeNull();
    });

    // LA FENÊTRE DE RENDU QUI PIÈGE. `useCoachRoster` monte avec `clubId = null`
    // (le club n'est pas encore résolu) : il se déclare alors « ready » avec 0
    // membre. Ce zéro ne mesure rien. Sans `rosterAnswered`, le club le plus
    // fourni atterrirait sur Semaine.
    test("effectif « prêt » mais qui n'a jamais abouti : ce zéro ne mesure rien", () => {
      expect(
        chooseCoachLandingTab(base({ rosterAnswered: false, memberCount: 0 })),
      ).toBeNull();
    });
  });

  describe("lecture en échec : on retombe sur le comportement actuel", () => {
    test("effectif illisible : un vide non lu n'est pas un vide", () => {
      expect(
        chooseCoachLandingTab(
          base({ rosterStatus: "unavailable", rosterAnswered: false, memberCount: 0 }),
        ),
      ).toBe("CoachToday");
    });

    test("lecture du club refusée", () => {
      expect(
        chooseCoachLandingTab(base({ clubStatus: "error", rosterAnswered: false, memberCount: 0 })),
      ).toBe("CoachToday");
    });

    test("compte sans club : l'écran Aujourd'hui porte déjà l'état dédié", () => {
      expect(
        chooseCoachLandingTab(
          base({ clubStatus: "notInClub", rosterAnswered: false, memberCount: 0 }),
        ),
      ).toBe("CoachToday");
    });
  });

  describe("délai de garde", () => {
    test("il débloque l'attente sur le comportement actuel", () => {
      const enAttente = base({ clubStatus: "loading", rosterAnswered: false, memberCount: 0 });
      expect(chooseCoachLandingTab(enAttente)).toBeNull();
      expect(chooseCoachLandingTab({ ...enAttente, timedOut: true })).toBe("CoachToday");
    });

    test("il ne prime JAMAIS sur une réponse réelle", () => {
      // Une lecture lente qui finit par aboutir sur un club vide doit toujours
      // donner Semaine : le délai ouvre l'espace, il ne le verrouille pas.
      expect(chooseCoachLandingTab(base({ memberCount: 0, timedOut: true }))).toBe("CoachWeek");
    });
  });
});
