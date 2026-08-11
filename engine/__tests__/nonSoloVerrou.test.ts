// engine/__tests__/nonSoloVerrou.test.ts
//
// FILET « JOUEUR SEUL » — verrou d'inventaire (vérification du 11/08/2026,
// rapport RAPPORT_NON_SOLO.md).
//
// Ce que ce fichier verrouille : la LISTE EXACTE des surfaces front où un
// exercice à 2+ peut exister aujourd'hui. Le moteur backend ferme la classe
// « fiche partenaire servie à un joueur seul » depuis le lot A2 (10/08/2026,
// fks/src/catalog/catalogSafety.ts isCatalogSoloSafe + shared/
// participationGuard.ts — mesuré : 0 service sur 44 550 profils × 2 graines).
// Côté front, l'exposition restante est celle figée ici : elle ne doit ni
// grandir en silence, ni changer de forme sans relire la fiche V2.

import { EXERCISE_BY_ID } from "../exerciseBank";
import { BACKEND_EXERCISE_IDS } from "../backendExerciseIds";
import { EXERCISE_INSTRUCTIONS } from "../exerciseInstructions";
import { selectReplacement } from "../../domain/tracking/replacements";
import {
  DEVIATION_REASON_ORDER,
  DEVIATION_REASON_LABELS,
} from "../../components/session/liveTrackingHelpers";
import type { ReplacementRequest } from "../../domain/tracking/types";
import {
  NON_SOLO_IDS_FRONT,
  NON_SOLO_GROUPE_IDS_FRONT,
  NON_SOLO_IDS_BACKEND_ONLY,
} from "./nonSoloIds.fixture";

describe("inventaire non-solo — surfaces front", () => {
  test("la bibliothèque (EXERCISE_BY_ID) expose les 12 fiches non-solo : 5 partenaire + 7 jeux réduits", () => {
    // EXERCISE_BANK complète BASE_EXERCISE_BANK par un stub auto-généré pour
    // CHAQUE id backend absent localement (buildExerciseFromBackendId,
    // engine/exerciseBank.ts:921) — rsa_reaction_sprint_10m et les 7
    // rsa_ssg_* entrent donc en bibliothèque par ce chemin, sans fiche
    // rédigée.
    const enBanque = NON_SOLO_IDS_FRONT.filter((id) => Boolean(EXERCISE_BY_ID[id]));
    expect([...enBanque].sort()).toEqual([...NON_SOLO_IDS_FRONT].sort());
  });

  test("rsa_reaction_sprint_10m n'existe qu'en STUB : nom fabriqué depuis l'id, aucune consigne « Comment faire »", () => {
    const stub = EXERCISE_BY_ID["rsa_reaction_sprint_10m"];
    expect(stub).toBeDefined();
    // Nom issu de fallbackName/titleize (aucun préfixe rsa_ géré) — pas d'un
    // rédacteur : si ce test casse parce qu'un nom rédigé apparaît, vérifier
    // qu'il porte la mention « à 2 » (cf. nonSoloBibliotheque.test.ts).
    expect(stub.name.toLowerCase()).toMatch(/reaction[_ ]sprint/);
    expect(EXERCISE_INSTRUCTIONS["rsa_reaction_sprint_10m"]).toBeUndefined();
  });

  test("les 7 jeux réduits (4 à 12 joueurs, coach requis côté V2) sont des stubs mal catégorisés « strength », sans consigne", () => {
    for (const id of NON_SOLO_GROUPE_IDS_FRONT) {
      const stub = EXERCISE_BY_ID[id];
      expect(stub).toBeDefined();
      // inferModality ne connaît pas rsa_ssg_* → retombe sur strength : un
      // 5c5 est présenté comme du renforcement. Constat figé (P1 du rapport).
      expect(stub.modality).toBe("strength");
      expect(EXERCISE_INSTRUCTIONS[id]).toBeUndefined();
    }
  });

  test("BACKEND_EXERCISE_IDS liste aujourd'hui les 12 ids non-solo (constat figé — la protection est côté moteur)", () => {
    const proposes = BACKEND_EXERCISE_IDS.filter((id) =>
      (NON_SOLO_IDS_FRONT as readonly string[]).includes(id)
    );
    expect([...proposes].sort()).toEqual([...NON_SOLO_IDS_FRONT].sort());
  });

  test("sentinelle : aucun id non-solo backend-only (fks_* partenaire, nordic_curl_partner) n'entre côté front", () => {
    for (const id of NON_SOLO_IDS_BACKEND_ONLY) {
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
      expect(BACKEND_EXERCISE_IDS).not.toContain(id);
      expect(EXERCISE_INSTRUCTIONS[id]).toBeUndefined();
    }
  });
});

describe("boucle de suivi — le chemin « Partenaire indisponible » reste câblé", () => {
  const requete = (exerciseId: string): ReplacementRequest => ({
    exerciseId,
    reason: "no_partner",
    context: {
      equipmentAvailable: ["home_small"],
      ageCategory: "Senior",
      activePains: [],
      matchSoon: false,
      highFatigue: false,
      solo: true,
      excludeIds: [],
    },
  });

  test("no_partner est une raison d'écart proposée en séance, libellée en clair", () => {
    expect(DEVIATION_REASON_ORDER).toContain("no_partner");
    expect(DEVIATION_REASON_LABELS.no_partner).toBe("Partenaire indisponible");
  });

  test("str_nordic + no_partner propose une alternative qui n'est JAMAIS elle-même un exo à 2", () => {
    const proposition = selectReplacement(requete("str_nordic"));
    expect(proposition).not.toBeNull();
    expect(proposition!.exerciseId).toBe("str_nordic_assisted_band");
    expect(NON_SOLO_IDS_FRONT as readonly string[]).not.toContain(proposition!.exerciseId);
  });
});
