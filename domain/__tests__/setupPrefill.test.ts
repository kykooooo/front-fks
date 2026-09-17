// domain/__tests__/setupPrefill.test.ts
//
// QUI GAGNE ENTRE LA SAISIE, LE BROUILLON ET LE DOCUMENT DISTANT — et ce que
// le profil écrit donne ensuite au reste de l'app.

import {
  answersFromProfileDoc,
  profilDejaFinalise,
  profilSportifDepuisReponses,
  resoudrePrefill,
} from "../setupPrefill";
import { isPlayerProfileComplete } from "../playerProfile";
import { userProfileSchema } from "../../schemas/firestoreSchemas";

const aucunTouche = new Set<string>();

const profilComplet = {
  profileCompleted: true,
  firstName: "Lina",
  position: "Milieu",
  ageCategory: "U17",
  level: "Regional",
  dominantFoot: "Pied droit",
  mainObjective: "Etre en forme toute la saison",
  targetFksSessionsPerWeek: 2,
  hasClubTrainings: "oui",
  clubTrainingDays: ["tue", "thu"],
  matchDays: ["sat"],
  hasGymAccess: "regular",
};

describe("préremplissage tardif — la saisie en cours n'est jamais écrasée", () => {
  test("le document arrive APRÈS que le joueur a tapé son prénom et choisi son poste", () => {
    const res = resoudrePrefill({
      edition: false,
      serverDoc: { firstName: "kyky76700", position: "Gardien", level: "Amateur" },
      draft: null,
      touched: new Set(["firstName", "position"]),
      aNavigue: false,
    });
    expect(res.patch.firstName).toBeUndefined();
    expect(res.patch.position).toBeUndefined();
    // Les champs non touchés, eux, profitent du préremplissage.
    expect(res.patch.level).toBe("Amateur");
    expect(res.prenomDepuisSource).toBe(false);
  });

  test("prénom connu (inscription) : prérempli, signalé comme tel, et reste corrigeable", () => {
    const res = resoudrePrefill({ edition: false, serverDoc: null, fallbackFirstName: " Lina ", draft: null, touched: aucunTouche, aNavigue: false });
    expect(res.patch.firstName).toBe("Lina");
    expect(res.prenomDepuisSource).toBe(true);
  });

  test("aucune source : aucun champ, jamais une valeur inventée", () => {
    const res = resoudrePrefill({ edition: false, serverDoc: null, draft: null, touched: aucunTouche, aNavigue: false });
    expect(res.patch).toEqual({});
    expect(res.step).toBeNull();
  });
});

describe("brouillon — inscription initiale seulement", () => {
  const draft = { step: 2, answers: { firstName: "Lina", position: "Attaquant", clubTrainingDays: ["mon"] } };

  test("le brouillon l'emporte sur un document partiel, et l'étape est restaurée", () => {
    const res = resoudrePrefill({
      edition: false,
      serverDoc: { firstName: "L.", position: "Gardien", level: "Amateur" },
      draft,
      touched: aucunTouche,
      aNavigue: false,
    });
    expect(res.patch).toMatchObject({ firstName: "Lina", position: "Attaquant", level: "Amateur", clubTrainingDays: ["mon"] });
    expect(res.step).toBe(2);
    expect(res.supprimerBrouillon).toBe(false);
  });

  test("profil DÉJÀ finalisé : l'ancien brouillon est ignoré et doit être supprimé", () => {
    const res = resoudrePrefill({ edition: false, serverDoc: profilComplet, draft, touched: aucunTouche, aNavigue: false });
    expect(res.patch.position).toBe("Milieu"); // le serveur, pas le vieux brouillon
    expect(res.patch.clubTrainingDays).toEqual(["tue", "thu"]);
    expect(res.step).toBeNull();
    expect(res.supprimerBrouillon).toBe(true);
  });

  test("ÉDITION d'un profil existant : le brouillon n'existe pas pour cet écran", () => {
    const res = resoudrePrefill({ edition: true, serverDoc: profilComplet, draft, touched: aucunTouche, aNavigue: false });
    expect(res.patch.position).toBe("Milieu");
    expect(res.step).toBeNull();
    expect(res.supprimerBrouillon).toBe(false);
  });

  test("ancien compte coach (drapeau vrai, champs joueur absents) : pas « finalisé », le brouillon s'applique", () => {
    const ancienCoach = { profileCompleted: true, firstName: "Marc" };
    expect(profilDejaFinalise(ancienCoach)).toBe(false);
    const res = resoudrePrefill({ edition: false, serverDoc: ancienCoach, draft, touched: aucunTouche, aNavigue: false });
    expect(res.patch.position).toBe("Attaquant");
  });

  test("le joueur a déjà avancé ou saisi : on ne le téléporte pas à l'étape du brouillon", () => {
    expect(resoudrePrefill({ edition: false, serverDoc: null, draft, touched: aucunTouche, aNavigue: true }).step).toBeNull();
    expect(resoudrePrefill({ edition: false, serverDoc: null, draft, touched: new Set(["level"]), aNavigue: false }).step).toBeNull();
  });
});

describe("lecture du document distant", () => {
  test("formes historiques : objectif accentué, matchDay seul, accès salle", () => {
    const a = answersFromProfileDoc({
      mainObjective: "Mieux encaisser les entraînements et les matchs",
      matchDay: "sun",
      hasGymAccess: "occasional",
      selfReportedGapDays: 21,
    });
    expect(a.mainObjective).toBe("Mieux encaisser les entrainements et les matchs");
    expect(a.matchDays).toEqual(["sun"]);
    expect(a.hasGymAccess).toBe("occasionnel");
    expect(a.selfReportedGapOption).toBe("2to4w");
  });
});

describe("enregistrement → accès au parcours joueur avec les bonnes données", () => {
  const reponses = {
    firstName: " Lina ",
    position: "Milieu",
    ageCategory: "U17",
    level: "Regional",
    dominantFoot: "Pied droit",
    mainObjective: "Etre en forme toute la saison",
    targetFksSessionsPerWeek: "3",
    selfReportedGapOption: "",
    hasClubTrainings: "oui",
    clubTrainingDays: ["tue", "thu"],
    matchDays: ["sat"],
    hasGymAccess: "occasionnel",
  };

  test("le profil écrit ouvre le portillon joueur (catégorie, poste, niveau présents)", () => {
    const ecrit = { ...profilSportifDepuisReponses(reponses), profileCompleted: true };
    expect(isPlayerProfileComplete(ecrit)).toBe(true);
    expect(profilDejaFinalise(ecrit)).toBe(true);
    expect(ecrit.firstName).toBe("Lina");
  });

  test("le contexte de génération lira les mêmes jours, fréquences, âge et accès salle", () => {
    const ecrit = profilSportifDepuisReponses(reponses);
    const lu = userProfileSchema.parse(ecrit);
    expect(lu.clubTrainingDays).toEqual(["tue", "thu"]);
    expect(lu.matchDays).toEqual(["sat"]);
    expect(lu.clubTrainingsPerWeek).toBe(2);
    expect(lu.matchesPerWeek).toBe(1);
    expect(lu.ageCategory).toBe("U17");
    expect(lu.hasGymAccess).toBe("occasional");
    expect(ecrit.targetFksSessionsPerWeek).toBe(3);
    expect(ecrit.selfReportedGapDays).toBeNull(); // facultatif non répondu = null, jamais 0
  });

  test("« non » aux entraînements collectifs : aucun jour fantôme n'est écrit", () => {
    const ecrit = profilSportifDepuisReponses({ ...reponses, hasClubTrainings: "non" });
    expect(ecrit.clubTrainingDays).toEqual([]);
    expect(ecrit.clubTrainingsPerWeek).toBe(0);
  });

  test("aller-retour : ce qui est écrit se relit à l'identique en édition", () => {
    const relu = answersFromProfileDoc(profilSportifDepuisReponses(reponses) as unknown as Record<string, unknown>);
    expect(relu).toMatchObject({ firstName: "Lina", position: "Milieu", targetFksSessionsPerWeek: "3", hasGymAccess: "occasionnel", hasClubTrainings: "oui" });
  });
});

describe("absent ≠ vidé — un effacement volontaire est une réponse", () => {
  const serveur = { matchDays: ["sat"], selfReportedGapDays: 21, clubTrainingDays: ["tue"], hasClubTrainings: "oui" };

  test("jours de match vidés dans le brouillon : conservés malgré une réponse serveur (même tardive)", () => {
    const draft = { step: 2, answers: { matchDays: [] as string[] } };
    // Le brouillon est arrivé d'abord…
    const avant = resoudrePrefill({ edition: false, serverDoc: null, draft, touched: aucunTouche, aNavigue: false });
    expect(avant.patch.matchDays).toEqual([]);
    // …puis le document distant, en retard, avec les anciens jours.
    const apres = resoudrePrefill({ edition: false, serverDoc: serveur, draft, touched: aucunTouche, aNavigue: false });
    expect(apres.patch.matchDays).toEqual([]);
    // Un champ ABSENT du brouillon, lui, profite bien du serveur.
    expect(apres.patch.clubTrainingDays).toEqual(["tue"]);
  });

  test("réponse facultative effacée (coupure d'entraînement) : elle ne revient pas", () => {
    const res = resoudrePrefill({
      edition: false,
      serverDoc: serveur,
      draft: { step: 1, answers: { selfReportedGapOption: "" } },
      touched: aucunTouche,
      aNavigue: false,
    });
    expect(res.patch.selfReportedGapOption).toBe("");
  });

  test("un vide venu du SERVEUR n'est pas une réponse : il n'entre pas dans le patch", () => {
    const res = resoudrePrefill({ edition: false, serverDoc: { matchDays: [], position: "" }, draft: null, touched: aucunTouche, aNavigue: false });
    expect(res.patch).toEqual({});
  });

  test("prénom vidé volontairement : restauré vide, et pas annoncé comme « déjà renseigné »", () => {
    const res = resoudrePrefill({
      edition: false,
      serverDoc: { firstName: "Lina" },
      draft: { step: 0, answers: { firstName: "" } },
      touched: aucunTouche,
      aNavigue: false,
    });
    expect(res.patch.firstName).toBe("");
    expect(res.prenomDepuisSource).toBe(false);
  });
});
