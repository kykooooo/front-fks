// hooks/__tests__/monCorpsViewModel.test.ts
//
// L'ETAT VIDE EST UN ETAT, PAS UN ZERO (CLAUDE.md regle 12).
//
// Et la passerelle du feedback se declenche a UN seuil, celui qui existait
// deja : 2/5 ne propose rien, 3/5 propose.

import { construireMonCorpsViewModel } from "../monCorps/useMonCorpsViewModel";
import {
  doitProposerMonCorps,
  SEUIL_DOULEUR_PASSERELLE,
} from "../../screens/feedback/passerelleMonCorps";
import { TRACKING_CONFIG } from "../../domain/tracking/config";
import { lastNDates } from "../../utils/dateHelpers";
import type { BodyArea, BodyInjury, BodyInjurySeverity, BodyInjuryStatus } from "../../domain/types";

const AUJOURD_HUI = "2026-07-11";
const JOURS = lastNDates(AUJOURD_HUI, 40);

function gene(
  id: string,
  zone: BodyArea,
  statut: BodyInjuryStatus,
  jour: string,
  gravite: BodyInjurySeverity = 2,
  note?: string
): BodyInjury {
  return {
    id,
    zone,
    gravite,
    statut,
    source: "feedback",
    declaredAt: `${jour}T12:00:00.000Z`,
    updatedAt: `${jour}T12:00:00.000Z`,
    ...(note ? { note } : {}),
  };
}

describe("ViewModel « Mon corps » — l'état vide", () => {
  test("aucune gêne → `vide` vrai, listes vides, AUCUN compteur", () => {
    const vm = construireMonCorpsViewModel([], AUJOURD_HUI);
    expect(vm).toEqual({ vide: true, enCours: [], passees: [], aRelancer: [] });
    // Le ViewModel n'expose aucun nombre : pas de champ `total`, `nombre`, etc.
    expect(Object.keys(vm).sort()).toEqual(["aRelancer", "enCours", "passees", "vide"]);
  });

  test("une gêne guérie ET rien en cours → l'écran n'est PAS vide (l'historique existe)", () => {
    const vm = construireMonCorpsViewModel([gene("a", "genou", "healed", JOURS[10])], AUJOURD_HUI);
    expect(vm.vide).toBe(false);
    expect(vm.enCours).toEqual([]);
    expect(vm.passees).toHaveLength(1);
  });
});

describe("ViewModel « Mon corps » — les lignes", () => {
  test("mots de joueur, date relative, source et note réaffichée", () => {
    const vm = construireMonCorpsViewModel(
      [gene("a", "genou", "active", JOURS[4], 2, "  ça tire à la descente  ")],
      AUJOURD_HUI
    );
    expect(vm.enCours[0]).toMatchObject({
      zoneLabel: "Genou",
      graviteLabel: "Douleur nette — je m'adapte",
      graviteLabelCourt: "Douleur nette",
      dateRelative: "il y a 4 jours",
      sourceLabel: "depuis un feedback",
      note: "ça tire à la descente",
      aRelancer: false,
    });
  });

  test("une note vide vaut `null`, jamais une chaîne vide affichée comme du contenu", () => {
    const vm = construireMonCorpsViewModel(
      [gene("a", "genou", "active", AUJOURD_HUI, 2, "   ")],
      AUJOURD_HUI
    );
    expect(vm.enCours[0].note).toBeNull();
  });

  test("« aine » s'affiche en toutes lettres", () => {
    const vm = construireMonCorpsViewModel([gene("a", "aine", "active", AUJOURD_HUI)], AUJOURD_HUI);
    expect(vm.enCours[0].zoneLabel).toBe("Aine / adducteurs");
  });

  test("à 7 jours, la ligne demande une réponse ; à 6 jours, non", () => {
    const sept = construireMonCorpsViewModel([gene("a", "genou", "active", JOURS[7])], AUJOURD_HUI);
    expect(sept.aRelancer.map((l) => l.id)).toEqual(["a"]);

    const six = construireMonCorpsViewModel([gene("a", "genou", "active", JOURS[6])], AUJOURD_HUI);
    expect(six.aRelancer).toEqual([]);
  });
});

describe("passerelle feedback → Mon corps (D3)", () => {
  test("le seuil est celui qui existait déjà, pas un chiffre neuf", () => {
    expect(SEUIL_DOULEUR_PASSERELLE).toBe(TRACKING_CONFIG.pain.feedbackThreshold);
    expect(SEUIL_DOULEUR_PASSERELLE).toBe(3);
  });

  test("2/5 → aucune proposition", () => {
    expect(doitProposerMonCorps(2)).toBe(false);
  });

  test("3/5 → proposition", () => {
    expect(doitProposerMonCorps(3)).toBe(true);
  });

  test("5/5 → proposition ; 0/5 et valeur absente → rien", () => {
    expect(doitProposerMonCorps(5)).toBe(true);
    expect(doitProposerMonCorps(0)).toBe(false);
    expect(doitProposerMonCorps(null)).toBe(false);
    expect(doitProposerMonCorps(undefined)).toBe(false);
    expect(doitProposerMonCorps(Number.NaN)).toBe(false);
  });
});
