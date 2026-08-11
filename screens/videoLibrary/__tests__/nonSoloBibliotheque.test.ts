// screens/videoLibrary/__tests__/nonSoloBibliotheque.test.ts
//
// FILET « JOUEUR SEUL » — la bibliothèque (11/08/2026, RAPPORT_NON_SOLO.md §4).
//
// Historique assumé : la première version figeait les trous (fiches à 2 sans
// aucune mention, « Sans matériel » menteur, stubs collectifs). Le GO Kyllian
// du 11/08 a retourné les paires :
//  - le badge « À deux » existe (porté par estExerciceNonSolo — preuve de
//    rendu dans nonSoloBadge.test.tsx) ;
//  - la ligne matériel dit « Partenaire » (inferEquipment) ;
//  - les TEXTES des fiches (description, « Comment faire ») ne mentionnent
//    toujours pas le partenaire : c'est VOULU ici — les contenus
//    exerciseBank/exerciseInstructions sont le chantier parallèle
//    fix/bibliotheque-precision, on ne les touche pas (constat documenté,
//    pas un trou de garde : le badge porte l'information).
//  - reste .failing : la purge des stubs collectifs (remède 3).

import { EXERCISE_BANK, EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../../../engine/exerciseInstructions";
import { estExerciceNonSolo } from "../../../engine/nonSoloExercises";
import {
  EQUIPMENT_LABELS,
  inferEquipment,
  isBallExercise,
} from "../videoLibraryConfig";
import {
  MARQUEUR_A_DEUX,
  NON_SOLO_IDS_FRONT,
  NON_SOLO_PARTENAIRE_IDS_FRONT,
  NON_SOLO_GROUPE_IDS_FRONT,
} from "../../../engine/__tests__/nonSoloIds.fixture";

const texteAffiche = (id: string): string => {
  const ex = EXERCISE_BY_ID[id];
  const instr = EXERCISE_INSTRUCTIONS[id];
  return [ex.name, ex.description, instr?.howTo, ...(instr?.cues ?? [])]
    .filter(Boolean)
    .join(" | ");
};

describe("bibliothèque — fiches non-solo", () => {
  test("le prédicat du badge couvre exactement les ids non-solo de la fixture", () => {
    for (const id of NON_SOLO_IDS_FRONT) {
      expect(estExerciceNonSolo(id)).toBe(true);
    }
    expect(estExerciceNonSolo("str_air_squat")).toBe(false);
    expect(estExerciceNonSolo("str_nordic_assisted_band")).toBe(false);
  });

  test("la ligne matériel ne ment plus : chaque fiche non-solo en banque porte « Partenaire », jamais « Sans matériel » seul", () => {
    const enBanque = NON_SOLO_IDS_FRONT.filter((id) => Boolean(EXERCISE_BY_ID[id]));
    expect(enBanque.length).toBeGreaterThan(0);
    for (const id of enBanque) {
      const puces = inferEquipment(EXERCISE_BY_ID[id]).map(
        (cle) => EQUIPMENT_LABELS[cle]
      );
      expect(puces).toContain("Partenaire");
      expect(puces).not.toEqual(["Sans matériel"]);
    }
  });

  test("les fiches partenaire rédigées restent visibles en bibliothèque (filtre ballon inchangé)", () => {
    const visibles = EXERCISE_BANK.filter((item) => !isBallExercise(item)).map(
      (item) => item.id
    );
    for (const id of ["str_nordic", "str_eccentric_nordic_3s", "str_nordic_hamstring_eccentric", "str_razor_curl"]) {
      expect(visibles).toContain(id);
    }
  });

  test("constat documenté : les TEXTES des fiches partenaire ne mentionnent pas encore le partenaire (contenus = chantier fix/bibliotheque-precision ; le badge porte l'info)", () => {
    const enBanque = NON_SOLO_PARTENAIRE_IDS_FRONT.filter((id) =>
      Boolean(EXERCISE_BY_ID[id])
    );
    for (const id of enBanque) {
      expect(texteAffiche(id)).not.toMatch(MARQUEUR_A_DEUX);
    }
  });

  test.failing("SOUHAITÉ (remède 3) : plus aucun jeu réduit collectif (rsa_ssg_*, 4 à 12 joueurs) dans la bibliothèque du joueur solo", () => {
    for (const id of NON_SOLO_GROUPE_IDS_FRONT) {
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
    }
  });
});
