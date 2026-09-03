// state/__tests__/blessuresSelectors.test.ts
//
// LA RELANCE POSE UNE QUESTION, ELLE N'EXPIRE RIEN (decision D5).
//
// L'ancien defaut n'etait pas d'oublier trop tard, c'etait d'oublier TOUT SEUL :
// au 8e jour, la contrainte disparaissait sans un mot et le joueur recevait une
// seance normale, sprints compris. Ici, au 7e jour, on demande — et tant que le
// joueur n'a pas repondu, la gene reste ACTIVE et continue de partir au moteur.

import {
  JOURS_AVANT_RELANCE,
  geneDeclareeLeJour,
  geneLaPlusMarquante,
  genesARelancer,
  genesEnCours,
  genesPassees,
} from "../selectors/blessures";
import { collectActivePainConstraints } from "../../services/aiContextHelpers";
import { lastNDates } from "../../utils/dateHelpers";
import type { BodyArea, BodyInjury, BodyInjurySeverity, BodyInjuryStatus } from "../../domain/types";

const AUJOURD_HUI = "2026-07-11";
const JOURS = lastNDates(AUJOURD_HUI, 40);

function gene(
  id: string,
  zone: BodyArea,
  statut: BodyInjuryStatus,
  updatedAtJour: string,
  gravite: BodyInjurySeverity = 2
): BodyInjury {
  return {
    id,
    zone,
    gravite,
    statut,
    source: "manual",
    declaredAt: `${updatedAtJour}T12:00:00.000Z`,
    updatedAt: `${updatedAtJour}T12:00:00.000Z`,
  };
}

describe("relance à 7 jours — la frontière exacte", () => {
  test("le chiffre est bien 7, et il est déclaré une seule fois", () => {
    expect(JOURS_AVANT_RELANCE).toBe(7);
  });

  test("touchée il y a 6 jours → AUCUNE relance", () => {
    const g = gene("g1", "genou", "active", JOURS[6]);
    expect(genesARelancer([g], AUJOURD_HUI)).toEqual([]);
  });

  test("touchée il y a 7 jours → relance", () => {
    const g = gene("g1", "genou", "active", JOURS[7]);
    expect(genesARelancer([g], AUJOURD_HUI).map((b) => b.id)).toEqual(["g1"]);
  });

  test("une gêne EN REPRISE se relance aussi", () => {
    const g = gene("g1", "genou", "recovering", JOURS[10]);
    expect(genesARelancer([g], AUJOURD_HUI).map((b) => b.id)).toEqual(["g1"]);
  });

  test("une gêne GUÉRIE ne se relance jamais", () => {
    const g = gene("g1", "genou", "healed", JOURS[30]);
    expect(genesARelancer([g], AUJOURD_HUI)).toEqual([]);
  });

  test("sans réponse à la relance, la gêne reste transmise au moteur", () => {
    const g = gene("g1", "genou", "active", JOURS[30]);
    expect(genesARelancer([g], AUJOURD_HUI)).toHaveLength(1);
    // Et pourtant elle est TOUJOURS dans le payload : la relance questionne,
    // elle n'expire pas.
    expect(collectActivePainConstraints([g])).toEqual({
      pains: ["knee_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("une date de mise à jour dans le futur ne déclenche rien", () => {
    const g = gene("g1", "genou", "active", "2026-08-01");
    expect(genesARelancer([g], AUJOURD_HUI)).toEqual([]);
  });
});

describe("tri et sélection", () => {
  test("genesEnCours garde active + recovering, jamais healed", () => {
    const liste = [
      gene("a", "genou", "active", AUJOURD_HUI),
      gene("b", "dos", "recovering", AUJOURD_HUI),
      gene("c", "mollet", "healed", AUJOURD_HUI),
    ];
    expect(genesEnCours(liste).map((b) => b.id)).toEqual(["a", "b"]);
    expect(genesPassees(liste).map((b) => b.id)).toEqual(["c"]);
  });

  test("geneLaPlusMarquante : la plus grave d'abord, puis la plus récemment touchée", () => {
    const liste = [
      gene("legere", "mollet", "active", AUJOURD_HUI, 1),
      gene("grave", "genou", "active", JOURS[5], 3),
    ];
    expect(geneLaPlusMarquante(liste)?.id).toBe("grave");
  });

  test("geneLaPlusMarquante renvoie null quand il n'y a rien — jamais un objet vide", () => {
    expect(geneLaPlusMarquante([])).toBeNull();
    expect(geneLaPlusMarquante([gene("a", "genou", "healed", AUJOURD_HUI)])).toBeNull();
  });

  test("geneDeclareeLeJour compare des jours locaux, pas des millisecondes", () => {
    const liste = [gene("a", "genou", "active", JOURS[3])];
    expect(geneDeclareeLeJour(liste, JOURS[3])).toBe(true);
    expect(geneDeclareeLeJour(liste, JOURS[2])).toBe(false);
    expect(geneDeclareeLeJour(liste, "")).toBe(false);
  });
});
