// screens/newSession/__tests__/transform.test.ts
//
// DOCTRINE (Option C, 31/07/2026) : v2ToLocalSession ne répare plus jamais
// une séance en silence. Cette suite grandit point par point (voir
// docs/CONTRAT_ERREUR_FRONT.md) :
// - POINT 1 : un bloc avec 1 item légitime sert 1 item, plus de complétion
//   artificielle à 2 via ensureMinItems.
// - POINT 2 : un exercise_id dupliqué fait échouer la transformation avec le
//   même corps typé que screens/newSession/api.ts (SESSION_SCHEMA_INVALID),
//   au lieu d'être remplacé en silence par un exercice de secours.

import type { Session } from "../../../domain/types";
import { lireEchecGeneration } from "../echecGeneration";
import { v2ToLocalSession } from "../transform";
import type { FKS_Block, FKS_NextSessionV2 } from "../types";

const PHASE: Session["phase"] = "Playlist";
const DATE = "2026-07-31";

function v2Avec(blocks: FKS_Block[]): FKS_NextSessionV2 {
  return {
    version: "v2",
    title: "Séance test",
    intensity: "moderate",
    focusPrimary: "strength",
    durationMin: 30,
    rpeTarget: 6,
    blocks,
  };
}

/** Vérifie qu'une erreur levée par la transformation est bien le corps typé
 * du contrat (docs/CONTRAT_ERREUR_FRONT.md §2.1), lu comme SESSION_SCHEMA_INVALID
 * — même mécanique que api.ts, aucune seconde table de codes. */
function verifierRefusType(erreur: unknown) {
  const echec = lireEchecGeneration(erreur);
  expect(echec.source).toBe("contrat");
  expect(echec.code).toBe("SESSION_SCHEMA_INVALID");
  expect(echec.categorie).toBe("technique");
  expect(echec.retryable).toBe(false);
  expect(echec.messageJoueur.length).toBeGreaterThan(0);
}

describe("v2ToLocalSession — un bloc avec 1 item legitime sert 1 item", () => {
  test("bloc >= 6 min avec 1 seul item (ex: protocole VMA 6x800m) : pas de complement fabrique a 2", () => {
    const v2 = v2Avec([
      {
        id: "block_vma",
        type: "run",
        goal: "VMA",
        intensity: "hard",
        durationMin: 20,
        items: [{ name: "VMA 6x800m", sets: 6, workS: 180, restS: 90 }],
      },
    ]);

    const session = v2ToLocalSession(v2, PHASE, DATE);

    expect(session.exercises).toHaveLength(1);
    // "VMA 6x800m" n'est pas un slug (espaces) : prettifyName ne le retouche
    // pas au-delà de la casse initiale (déjà majuscule ici).
    expect(session.exercises[0].name).toBe("VMA 6x800m");
  });

  test("bloc < 6 min avec 1 seul item : toujours 1 item (comportement deja correct, non regresse)", () => {
    const v2 = v2Avec([
      {
        id: "block_core",
        type: "core",
        goal: "Gainage",
        intensity: "moderate",
        durationMin: 4,
        items: [{ name: "Planche", sets: 3, workS: 30, restS: 30 }],
      },
    ]);

    const session = v2ToLocalSession(v2, PHASE, DATE);

    expect(session.exercises).toHaveLength(1);
  });
});

describe("v2ToLocalSession — exercise_id duplique : refus type, rien fabrique", () => {
  test("deux items avec le meme exercise_id dans la meme seance font echouer la transformation", () => {
    const v2 = v2Avec([
      {
        id: "block_force",
        type: "strength",
        goal: "Force bas du corps",
        intensity: "hard",
        durationMin: 15,
        items: [
          { exerciseId: "ex_squat", name: "Squat", sets: 3, reps: 8 },
          { exerciseId: "ex_squat", name: "Squat bis", sets: 3, reps: 8 },
        ],
      },
    ]);

    let capturee: unknown;
    try {
      v2ToLocalSession(v2, PHASE, DATE);
    } catch (err) {
      capturee = err;
    }

    expect(capturee).toBeDefined();
    verifierRefusType(capturee);
  });

  test("deux items avec le meme exercise_id dans deux blocs differents font aussi echouer", () => {
    const v2 = v2Avec([
      {
        id: "block_1",
        type: "strength",
        goal: "Force",
        intensity: "hard",
        durationMin: 10,
        items: [{ exerciseId: "ex_fente", name: "Fentes", sets: 3, reps: 10 }],
      },
      {
        id: "block_2",
        type: "strength",
        goal: "Force",
        intensity: "hard",
        durationMin: 10,
        items: [{ exerciseId: "ex_fente", name: "Fentes", sets: 3, reps: 10 }],
      },
    ]);

    expect(() => v2ToLocalSession(v2, PHASE, DATE)).toThrow();
  });

  test("des exercise_id differents ne declenchent aucun refus (comportement normal preserve)", () => {
    const v2 = v2Avec([
      {
        id: "block_force",
        type: "strength",
        goal: "Force",
        intensity: "hard",
        durationMin: 15,
        items: [
          { exerciseId: "ex_squat", name: "Squat", sets: 3, reps: 8 },
          { exerciseId: "ex_fente", name: "Fentes", sets: 3, reps: 10 },
        ],
      },
    ]);

    const session = v2ToLocalSession(v2, PHASE, DATE);

    expect(session.exercises).toHaveLength(2);
  });
});
