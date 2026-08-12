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
import { EXERCISE_CONTENT_V2 } from "../generated/exerciseContentV2";
import { selectReplacement } from "../../domain/tracking/replacements";
import {
  DEVIATION_REASON_ORDER,
  DEVIATION_REASON_LABELS,
} from "../../components/session/liveTrackingHelpers";
import type { ReplacementRequest } from "../../domain/tracking/types";
import {
  NON_SOLO_IDS_FRONT,
  NON_SOLO_PARTENAIRE_IDS_FRONT,
  NON_SOLO_GROUPE_IDS_FRONT,
  NON_SOLO_IDS_BACKEND_ONLY,
} from "./nonSoloIds.fixture";

describe("inventaire non-solo — surfaces front", () => {
  test("la bibliothèque n'expose plus que les 4 fiches partenaire rédigées (nordic ×3 + razor) — badgées « À deux »", () => {
    // Avant le remède 3 (GO 11/08), EXERCISE_BANK stub-ait AUSSI tout id
    // backend absent localement : rsa_reaction_sprint_10m et les 7 rsa_ssg_*
    // entraient en bibliothèque en fiches fantômes. L'assemblage filtre
    // désormais estExerciceNonSolo (engine/exerciseBank.ts).
    const enBanque = NON_SOLO_IDS_FRONT.filter((id) => Boolean(EXERCISE_BY_ID[id]));
    expect([...enBanque].sort()).toEqual([
      "str_eccentric_nordic_3s",
      "str_nordic",
      "str_nordic_hamstring_eccentric",
      "str_razor_curl",
    ]);
  });

  test("purge : plus aucun stub auto-généré non-solo en banque (rsa_reaction_sprint_10m + les 7 rsa_ssg_*)", () => {
    for (const id of ["rsa_reaction_sprint_10m", ...NON_SOLO_GROUPE_IDS_FRONT]) {
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
      expect(EXERCISE_INSTRUCTIONS[id]).toBeUndefined();
    }
  });

  test("contrat d'ids connus, changé au merge : les 5 ids partenaire restent listés, les 7 jeux réduits n'existent plus nulle part (et le payload n'en propose aucun, cf. nonSoloGarde)", () => {
    // CONTRAT CHANGÉ, PAS RELÂCHÉ (12/08). Avant le merge, les 12 ids vivaient
    // dans BACKEND_EXERCISE_IDS et seuls l'affichage et le payload les
    // masquaient. fix/bibliotheque-precision a fait la purge STRUCTURELLE :
    // les 7 rsa_ssg_* sont retirés de la source. Le verrou devient donc plus
    // exigeant sur ces 7 (absence de TOUTES les surfaces) et inchangé sur
    // les 5 fiches partenaire, qui restent des ids connus du backend.
    const partenaireListes = BACKEND_EXERCISE_IDS.filter((id) =>
      (NON_SOLO_PARTENAIRE_IDS_FRONT as readonly string[]).includes(id)
    );
    expect([...partenaireListes].sort()).toEqual([...NON_SOLO_PARTENAIRE_IDS_FRONT].sort());

    for (const id of NON_SOLO_GROUPE_IDS_FRONT) {
      expect(BACKEND_EXERCISE_IDS).not.toContain(id);
      expect(EXERCISE_BY_ID[id]).toBeUndefined();
      expect(EXERCISE_INSTRUCTIONS[id]).toBeUndefined();
      expect(EXERCISE_CONTENT_V2[id]).toBeUndefined();
    }
    // Reste connu hors surface : engine/exerciseBenefits.ts garde 3 entrées
    // rsa_ssg_* orphelines. Table de lookup par id, injoignable — l'id n'entre
    // plus ni en banque ni dans un payload, et la garde solo le rattraperait
    // si le serveur en renvoyait un. Nettoyage = chantier à part, pas une
    // couture de merge.
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
