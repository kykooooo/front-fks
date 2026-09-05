// domain/__tests__/recommendMicrocycleMapping.test.ts
//
// LE MAPPING OBJECTIF DU SETUP → CYCLE AUTO-ASSIGNÉ, FIGÉ.
//
// Bug d'ordre relevé à l'inventaire clubs (15/08, P1-09, prouvé par
// exécution) : « Etre en forme toute la saison » contient « saison », la
// branche générique saison/maintien le capturait avant la branche spécifique
// écrite pour lui (code mort). Un nouveau joueur démarrait sur « Saison /
// Maintien » (rester frais) au lieu de Fondation, notre cycle d'entrée.
// Décision Kyllian 15/08 : un nouveau joueur qui dit « être en forme toute la
// saison » démarre par la base — Fondation.
//
// Ce test fige le mapping des 4 objectifs RÉELS du setup (valeurs persistées,
// sans accents par convention) et vérifie que le wording du setup n'a pas
// dérivé sans que ce test le voie.

import { readFileSync } from "fs";
import { resolve } from "path";
import { recommendMicrocycle } from "../recommendMicrocycle";
import { OBJECTIF_ENCAISSER, OBJECTIF_ENCAISSER_LEGACY } from "../mainObjective";

// Les 4 valeurs EXACTES persistées par l'étape Objectif du setup.
const OBJECTIFS_SETUP: Array<[string, string]> = [
  ["Etre en forme toute la saison", "fondation"],
  ["Gagner en vitesse / explosivite", "explosivite"],
  // Désaccentué à l'écriture depuis le 05/09 (domain/mainObjective, P2-05) ;
  // l'ancienne forme reste en base pour les profils antérieurs et tombe sur le
  // même cycle — le matching cherche « encaisser », identique dans les deux.
  [OBJECTIF_ENCAISSER, "endurance"],
  [OBJECTIF_ENCAISSER_LEGACY, "endurance"],
  ["Reprendre apres une blessure", "fondation"],
];

describe("mapping objectif setup → cycle (décision 15/08)", () => {
  test.each(OBJECTIFS_SETUP)("« %s » → %s", (objectif, cycleAttendu) => {
    const reco = recommendMicrocycle({ mainObjective: objectif });
    expect(reco.id).toBe(cycleAttendu);
  });

  test("le wording du setup n'a pas dérivé sans mise à jour de ce test", () => {
    const source = readFileSync(
      resolve(__dirname, "..", "..", "screens", "ProfileSetupScreen.tsx"),
      "utf8"
    );
    const domaine = readFileSync(resolve(__dirname, "..", "mainObjective.ts"), "utf8");
    for (const [objectif] of OBJECTIFS_SETUP) {
      // L'objectif « encaisser » a quitté la liste littérale du questionnaire
      // pour domain/mainObjective (une seule implémentation de la valeur ET de
      // sa forme historique accentuée) : on le cherche là où il vit désormais.
      expect(source.includes(`"${objectif}"`) || domaine.includes(`"${objectif}"`)).toBe(true);
    }
  });

  test("un objectif explicitement maintien/saison va toujours vers saison", () => {
    // La branche générique reste vivante pour les entrées qui la visent
    // vraiment — seule la priorité a changé.
    expect(recommendMicrocycle({ mainObjective: "maintien" }).id).toBe("saison");
    expect(recommendMicrocycle({ mainObjective: "rester frais en saison" }).id).toBe("saison");
  });

  test("le spécifique bat le générique — la régression exacte du bug", () => {
    // Avant le correctif, cette entrée rendait "saison".
    expect(
      recommendMicrocycle({ mainObjective: "Etre en forme toute la saison" }).id
    ).toBe("fondation");
  });
});
