// screens/videoLibrary/__tests__/nonSoloBibliotheque.test.ts
//
// FILET « JOUEUR SEUL » — la bibliothèque (vérification du 11/08/2026,
// rapport RAPPORT_NON_SOLO.md).
//
// La bibliothèque a LE DROIT de montrer des exos à 2 (choix produit) — à
// condition de le dire. Aujourd'hui elle ne le dit nulle part : ni le nom,
// ni la description, ni « Comment faire » ne mentionnent le partenaire, et
// le détail affiche même la puce « Sans matériel » (inferEquipment retombe
// sur bodyweight), alors que la fiche V2 canonique déclare
// equipment ["bodyweight","partner"]. Pire : les 7 jeux réduits collectifs
// (rsa_ssg_*, 4 à 12 joueurs) apparaissent en stubs absurdes (« Rsa Ssg
// 2v2 », catégorie Renforcement, « Sans matériel »).
//
// Même mécanique de paires que nonSoloGarde.test.ts : CONSTAT vert qui fige
// l'état actuel, SOUHAITÉ en test.failing qui décrit l'état attendu. Aucun
// comportement d'app modifié par ce fichier.

import { EXERCISE_BANK, EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../../../engine/exerciseInstructions";
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
  test("les 12 fiches non-solo passent le filtre ballon et restent visibles en bibliothèque", () => {
    const visibles = EXERCISE_BANK.filter((item) => !isBallExercise(item)).map(
      (item) => item.id
    );
    for (const id of NON_SOLO_IDS_FRONT) {
      expect(visibles).toContain(id);
    }
  });

  test("CONSTAT (P1 ouvert) : aucune des 5 fiches partenaire ne mentionne le partenaire (nom, description, consignes)", () => {
    for (const id of NON_SOLO_PARTENAIRE_IDS_FRONT) {
      expect(texteAffiche(id)).not.toMatch(MARQUEUR_A_DEUX);
    }
  });

  test("CONSTAT (P1 ouvert) : le détail des 12 affiche la puce « Sans matériel » — trompeur pour un exo à 2+ (V2 : partner/football)", () => {
    for (const id of NON_SOLO_IDS_FRONT) {
      const puces = inferEquipment(EXERCISE_BY_ID[id]).map(
        (cle) => EQUIPMENT_LABELS[cle]
      );
      expect(puces).toEqual(["Sans matériel"]);
    }
  });

  test.failing("SOUHAITÉ (P1) : toute fiche partenaire visible en bibliothèque porte un marqueur « à deux / partenaire »", () => {
    for (const id of NON_SOLO_PARTENAIRE_IDS_FRONT) {
      expect(texteAffiche(id)).toMatch(MARQUEUR_A_DEUX);
    }
  });

  test.failing("SOUHAITÉ (P1) : plus aucun jeu réduit collectif (rsa_ssg_*, 4 à 12 joueurs) dans la bibliothèque du joueur solo", () => {
    for (const id of NON_SOLO_GROUPE_IDS_FRONT) {
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
    }
  });
});
