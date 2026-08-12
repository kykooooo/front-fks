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
//  - les TEXTES des fiches disent désormais le partenaire — PAIRE RETOURNÉE
//    AU MERGE (12/08) : le constat « les textes ne le mentionnent pas encore,
//    le badge porte seul l'information » était l'attente du chantier parallèle
//    fix/bibliotheque-precision. Ce chantier a livré : les 4 fiches partenaire
//    sont servies en contenu V2 (mise en place + étapes + « À éviter ») qui
//    nomme le partenaire. Le test mesure donc le VOULU, plus le trou.
//  - les stubs collectifs (rsa_ssg_*) sont purgés de la banque (remède 3).

import { EXERCISE_BANK, EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { getExerciseContent } from "../../../engine/exerciseContent";
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

// Le texte RÉELLEMENT rendu par la fiche (ExerciseDetailModal) : nom +
// description de la banque, puis le contenu servi par getExerciseContent —
// seul point d'entrée des écrans (V2 d'abord, repli legacy sinon). Lire
// EXERCISE_INSTRUCTIONS en direct, comme avant le merge, mesurerait une
// surface qui n'est plus affichée pour ces ids.
const texteAffiche = (id: string): string => {
  const ex = EXERCISE_BY_ID[id];
  const contenu = getExerciseContent(id);
  return [
    ex.name,
    ex.description,
    contenu?.setup,
    ...(contenu?.steps ?? []),
    ...(contenu?.cues ?? []),
    ...(contenu?.avoid ?? []),
  ]
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

  test("les TEXTES des fiches partenaire disent le partenaire — paire retournée : le contenu V2 livré par fix/bibliotheque-precision comble le trou que le badge couvrait seul", () => {
    const enBanque = NON_SOLO_PARTENAIRE_IDS_FRONT.filter((id) =>
      Boolean(EXERCISE_BY_ID[id])
    );
    // Les 4 fiches partenaire rédigées (nordic ×3 + razor) ; la 5e
    // (rsa_reaction_sprint_10m) n'est pas en banque, cf. nonSoloVerrou.
    expect(enBanque.length).toBe(4);
    for (const id of enBanque) {
      // Le contenu V2 est bien la source servie : un repli legacy silencieux
      // (textes muets sur le partenaire) doit casser ici, pas passer.
      expect(getExerciseContent(id)?.source).toBe("v2");
      expect(texteAffiche(id)).toMatch(MARQUEUR_A_DEUX);
    }
  });

  test("plus aucun jeu réduit collectif (rsa_ssg_*, 4 à 12 joueurs) dans la bibliothèque du joueur solo", () => {
    for (const id of NON_SOLO_GROUPE_IDS_FRONT) {
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
    }
  });
});
