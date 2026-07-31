// screens/newSession/__tests__/transform.test.ts
//
// DOCTRINE (Option C, 31/07/2026) : v2ToLocalSession ne répare plus jamais
// une séance en silence. Cette suite grandit point par point (voir
// docs/CONTRAT_ERREUR_FRONT.md) — POINT 1 ici : un bloc avec 1 item légitime
// sert 1 item, plus de complétion artificielle à 2 via ensureMinItems.

import type { Session } from "../../../domain/types";
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
