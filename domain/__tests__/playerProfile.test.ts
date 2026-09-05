// domain/__tests__/playerProfile.test.ts
//
// « CE PROFIL PEUT-IL FAIRE TOURNER LE MOTEUR ? »
//
// Le drapeau `profileCompleted` ne répond plus à cette question depuis qu'il
// veut dire deux choses : `createClubAsCoach` le pose à `true` sans écrire un
// seul champ joueur (repositories/clubsRepo). Un coach qui active « Je
// m'entraîne aussi » entrait donc dans l'app joueur avec ni catégorie, ni
// poste, ni niveau — et le moteur dosait SANS AUCUN plafond d'âge
// (`getAgeCategoryCaps(null)` rend `null` côté backend : audit d'inscription
// 2026-09, P1-04 + erratum 4).

import { CHAMPS_PROFIL_JOUEUR, isPlayerProfileComplete } from "../playerProfile";

const complet = { ageCategory: "U17", position: "Milieu", level: "Regional" };

describe("isPlayerProfileComplete", () => {
  test("les trois champs de dosage présents = complet", () => {
    expect(isPlayerProfileComplete(complet)).toBe(true);
  });

  test("chacun des trois manquants suffit à dire « pas prêt »", () => {
    for (const champ of CHAMPS_PROFIL_JOUEUR) {
      expect(isPlayerProfileComplete({ ...complet, [champ]: undefined })).toBe(false);
      expect(isPlayerProfileComplete({ ...complet, [champ]: null })).toBe(false);
      // Une chaîne d'espaces n'est pas une réponse.
      expect(isPlayerProfileComplete({ ...complet, [champ]: "   " })).toBe(false);
    }
  });

  test("le compte fraîchement créé par la création de club n'est PAS complet", () => {
    // Exactement ce que `createClubAsCoach` écrit : le drapeau, et rien du
    // joueur. C'est le cas qui a motivé cette fonction.
    expect(
      isPlayerProfileComplete({ uid: "u1", clubId: "c1", profileCompleted: true }),
    ).toBe(false);
  });

  test("aucun champ hors dosage n'est exigé : prénom et pied fort ne bloquent pas", () => {
    // Le questionnaire les demande (validateStep) mais ils ne changent AUCUN
    // calcul : les exiger ici renverrait au setup des comptes qui marchent.
    expect(isPlayerProfileComplete(complet)).toBe(true);
    expect(isPlayerProfileComplete({ ...complet, firstName: "", dominantFoot: "" })).toBe(true);
  });

  test("une catégorie héritée que le sélecteur ne propose plus reste une catégorie", () => {
    // On constate la PRÉSENCE, on ne juge pas la valeur : le questionnaire, lui,
    // refusera U13 au premier passage. Juger deux fois, c'est se contredire.
    expect(isPlayerProfileComplete({ ...complet, ageCategory: "U13" })).toBe(true);
  });

  test("document absent, vide ou d'un autre type = pas complet (deny-first)", () => {
    for (const valeur of [undefined, null, {}, "U17", 42, []]) {
      expect(isPlayerProfileComplete(valeur)).toBe(false);
    }
  });
});
