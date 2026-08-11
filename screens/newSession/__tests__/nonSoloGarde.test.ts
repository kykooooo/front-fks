// screens/newSession/__tests__/nonSoloGarde.test.ts
//
// FILET « JOUEUR SEUL » — la génération (vérification du 11/08/2026,
// rapport RAPPORT_NON_SOLO.md).
//
// Le moteur backend ferme la classe « fiche partenaire servie à un joueur
// seul » (lot A2, 10/08/2026 : sélection ET réparation lisent
// participation.{soloEligible,minPlayers}). CE FICHIER fige ce que fait le
// FRONT en face : aujourd'hui il n'a AUCUNE défense propre — si une vieille
// séance planifiée (Firestore d'avant le fix), un cache local, ou une
// régression moteur renvoie un exo à 2, il est affiché tel quel, sans
// mention partenaire.
//
// Deux tests se répondent, par paire :
//  - le CONSTAT (vert) fige le comportement ACTUEL — le jour où quelqu'un
//    ajoute la garde, ce test casse exprès, pour être supprimé en même temps
//    que le marqueur .failing d'en dessous ;
//  - le SOUHAITÉ (test.failing) décrit la garde attendue — il est compté
//    « passé » tant qu'elle n'existe pas, et vire au rouge le jour où elle
//    existe : signal qu'il faut retirer le marqueur .failing.
// AUCUN comportement d'app n'est modifié par ce fichier (décision Kyllian
// requise avant tout correctif — voir P1/P2 du rapport).

import { v2ToLocalSession } from "../transform";
import { buildAllowedExercisesPayload } from "../api";
import type { FKS_NextSessionV2 } from "../types";
import type { Session } from "../../../domain/types";
import { NON_SOLO_IDS_FRONT } from "../../../engine/__tests__/nonSoloIds.fixture";

const PHASE = "in_season" as Session["phase"];

const v2AvecExoPartenaire = (exerciseId: string): FKS_NextSessionV2 =>
  ({
    title: "Séance test",
    durationMin: 40,
    intensity: "moderate",
    focusPrimary: "strength",
    blocks: [
      {
        id: "b1",
        type: "strength",
        goal: "posterior",
        intensity: "moderate",
        durationMin: 12,
        items: [{ exerciseId, name: null, sets: 3, reps: 5 }],
      },
    ],
  } as unknown as FKS_NextSessionV2);

describe("génération — un exo à 2 reçu du serveur", () => {
  test("CONSTAT (P1 ouvert) : v2ToLocalSession sert un exo minPlayers=2 tel quel, sans garde ni marquage", () => {
    const session = v2ToLocalSession(
      v2AvecExoPartenaire("str_eccentric_nordic_3s"),
      PHASE,
      "2026-08-11"
    );
    const ids = session.exercises.map((e) => e.id);
    expect(ids).toContain("str_eccentric_nordic_3s");
  });

  test.failing("SOUHAITÉ (P1) : un exo minPlayers>=2 est refusé (refus typé, comme item_sans_charge) ou marqué « à 2 » avant l'écran", () => {
    expect(() =>
      v2ToLocalSession(v2AvecExoPartenaire("str_eccentric_nordic_3s"), PHASE, "2026-08-11")
    ).toThrow();
  });
});

describe("génération — ce que le front PROPOSE au backend (allowed_exercises)", () => {
  test("CONSTAT (P2 ouvert) : le payload propose encore les 12 exos non-solo au backend (le moteur les refuse depuis le lot A2)", () => {
    // Les 12 (5 partenaire + 7 jeux réduits), car la banque stub-e tout id
    // backend absent localement (engine/exerciseBank.ts:921) :
    // rsa_reaction_sprint_10m et les rsa_ssg_* passent donc aussi le
    // .filter(Boolean) de buildAllowedExercisesPayload.
    const ids = buildAllowedExercisesPayload().map((ex) => ex.id);
    const nonSolo = ids.filter((id) =>
      (NON_SOLO_IDS_FRONT as readonly string[]).includes(id)
    );
    expect(nonSolo.sort()).toEqual([...NON_SOLO_IDS_FRONT].sort());
  });

  test.failing("SOUHAITÉ (P2) : allowed_exercises ne propose plus aucun exo à 2 au backend", () => {
    const ids = buildAllowedExercisesPayload().map((ex) => ex.id);
    expect(
      ids.some((id) => (NON_SOLO_IDS_FRONT as readonly string[]).includes(id))
    ).toBe(false);
  });
});
