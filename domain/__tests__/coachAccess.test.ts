// domain/__tests__/coachAccess.test.ts
//
// Miroir FRONT de l'état serveur d'autorisation d'accès aux données de suivi.
//
// Deux choses sont verrouillées ici :
//  1. le front lit la MÊME décision que le serveur (default-deny identique) —
//     s'ils divergeaient, l'écran promettrait une donnée que la base refuse ;
//  2. la copie affichée reste dans un vocabulaire PRODUIT : aucune mention
//     juridique, médicale, ni d'un tiers, et jamais une phrase qui laisserait
//     croire que le joueur ne s'entraîne pas.

import {
  COACH_ACCESS_COPY,
  COACH_ACCESS_GRANTING_STATES,
  COACH_ACCESS_STATES,
  coachAccessRosterCopy,
  isCoachAccessGranted,
  normalizeCoachAccess,
} from "../coachAccess";

describe("isCoachAccessGranted — même décision que le serveur", () => {
  test("seuls approved et not_required ouvrent", () => {
    expect(COACH_ACCESS_STATES).toEqual(["pending", "approved", "revoked", "not_required"]);
    expect(COACH_ACCESS_GRANTING_STATES).toEqual(["approved", "not_required"]);
    expect(isCoachAccessGranted("approved")).toBe(true);
    expect(isCoachAccessGranted("not_required")).toBe(true);
    expect(isCoachAccessGranted("pending")).toBe(false);
    expect(isCoachAccessGranted("revoked")).toBe(false);
  });

  test("absent, vide, mal typé, mal orthographié → refus (membership ancien inclus)", () => {
    const refusees: unknown[] = [
      undefined, null, "", "   ", "APPROVED", "Approved", "ok", "granted",
      "not required", true, 1, {}, [], ["approved"],
    ];
    for (const v of refusees) expect(isCoachAccessGranted(v)).toBe(false);
  });

  test("normalize tolère les espaces mais jamais la casse", () => {
    expect(normalizeCoachAccess(" revoked ")).toBe("revoked");
    expect(normalizeCoachAccess("Revoked")).toBeNull();
  });
});

describe("copie affichée — neutre, et jamais un jugement sportif", () => {
  const interdits = [
    "consentement", "parental", "parent", "tuteur", "rgpd", "légal", "juridique",
    "mineur", "santé", "médical", "autorisation parentale",
  ];

  test("aucun mot juridique ou médical, au singulier comme au pluriel", () => {
    const textes = [
      COACH_ACCESS_COPY.titre,
      COACH_ACCESS_COPY.corps,
      coachAccessRosterCopy(1).titre,
      coachAccessRosterCopy(1).corps,
      coachAccessRosterCopy(4).titre,
      coachAccessRosterCopy(4).corps,
    ];
    for (const t of textes) {
      const bas = t.toLowerCase();
      for (const mot of interdits) expect(bas).not.toContain(mot);
    }
  });

  test("ne laisse jamais croire que le joueur ne s'entraîne pas", () => {
    expect(COACH_ACCESS_COPY.corps.toLowerCase()).toContain("peut s'entraîner normalement");
    expect(coachAccessRosterCopy(3).corps.toLowerCase()).toContain("peuvent s'entraîner normalement");
    // Pas d'alarme, pas de faute imputée au joueur.
    for (const mot of ["problème", "erreur", "bloqué", "refusé", "interdit"]) {
      expect(COACH_ACCESS_COPY.corps.toLowerCase()).not.toContain(mot);
    }
  });

  test("accord singulier/pluriel exact (un compteur faux se lit tout de suite)", () => {
    expect(coachAccessRosterCopy(1).titre).toBe("1 joueur non consultable");
    expect(coachAccessRosterCopy(2).titre).toBe("2 joueurs non consultables");
  });
});
