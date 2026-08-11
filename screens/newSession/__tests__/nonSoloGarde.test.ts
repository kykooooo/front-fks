// screens/newSession/__tests__/nonSoloGarde.test.ts
//
// FILET « JOUEUR SEUL » — la génération (11/08/2026, RAPPORT_NON_SOLO.md §4).
//
// Historique assumé : la première version de ce fichier figeait le TROU
// (CONSTAT vert « l'exo à 2 est servi tel quel » + test.failing « SOUHAITÉ :
// refusé ou marqué »). Le GO Kyllian du 11/08 a retenu le remplacement/
// marquage plutôt que le refus : la paire est donc retournée en tests VERTS
// du comportement réel — aucune assertion relâchée, elles sont devenues plus
// exigeantes (id, nom, notes, dosage vérifiés).
//
// La garde (screens/newSession/soloGuard.ts, appelée par v2ToLocalSession) :
//  - équivalent solo fiable (moteur selectReplacement, raison no_partner) →
//    remplacement tracé dans les notes, dosage moteur conservé ;
//  - sinon (âge inconnu, matériel absent, pas d'alternative) → nom marqué
//    « (à 2) » + consigne vers la raison d'écart « Partenaire indisponible ».

import { v2ToLocalSession } from "../transform";
import { buildAllowedExercisesPayload } from "../api";
import type { FKS_NextSessionV2 } from "../types";
import type { Session } from "../../../domain/types";
import { NON_SOLO_IDS_FRONT } from "../../../engine/__tests__/nonSoloIds.fixture";

const PHASE = "in_season" as Session["phase"];

type ItemBrut = Record<string, unknown>;

const v2Avec = (items: ItemBrut[], equipmentAvailable: string[] = []): FKS_NextSessionV2 =>
  ({
    title: "Séance test",
    durationMin: 40,
    intensity: "moderate",
    focusPrimary: "strength",
    // Même champ que celui lu par SessionLiveScreen et par la garde solo.
    equipmentAvailable,
    blocks: [
      {
        id: "b1",
        type: "strength",
        goal: "posterior",
        intensity: "moderate",
        durationMin: 12,
        items,
      },
    ],
  } as unknown as FKS_NextSessionV2);

describe("garde solo — un exo à 2 reçu du serveur n'est jamais affiché nu", () => {
  test("équivalent solo disponible : str_nordic → Nordic assisté élastique, tracé dans les notes, dosage moteur conservé", () => {
    const session = v2ToLocalSession(
      v2Avec([{ exerciseId: "str_nordic", name: null, sets: 3, reps: 5 }], ["home_small"]),
      PHASE,
      "2026-08-11",
      { ageCategory: "U15" }
    );
    const [ex] = session.exercises;
    expect(ex.id).toBe("str_nordic_assisted_band");
    expect(ex.name).toBe("Nordic assisté élastique");
    // Dosage prescrit par le moteur conservé (même famille de mouvement).
    expect(ex.sets).toBe(3);
    expect(ex.reps).toBe(5);
    expect(ex.notes).toContain("à la place");
  });

  test("âge inconnu : jamais de swap à seuil d'âge (minAge U15 au registre) — marquage « (à 2) »", () => {
    const session = v2ToLocalSession(
      v2Avec([{ exerciseId: "str_nordic", name: null, sets: 3, reps: 5 }], ["home_small"]),
      PHASE,
      "2026-08-11"
    );
    const [ex] = session.exercises;
    expect(ex.id).toBe("str_nordic");
    expect(ex.name).toMatch(/\(à 2\)$/);
    expect(ex.notes).toContain("Partenaire indisponible");
  });

  test("sans équivalent solo au registre (razor curl) : marquage « (à 2) » + consigne d'écart", () => {
    const session = v2ToLocalSession(
      v2Avec([{ exerciseId: "str_razor_curl", name: null, sets: 3, reps: 6 }], ["home_small"]),
      PHASE,
      "2026-08-11",
      { ageCategory: "Senior" }
    );
    const [ex] = session.exercises;
    expect(ex.id).toBe("str_razor_curl");
    expect(ex.name).toMatch(/\(à 2\)$/);
    expect(ex.notes).toContain("Partenaire indisponible");
  });

  test("un remplacement ne crée jamais de doublon d'id dans la séance", () => {
    // L'alternative unique du nordic est déjà servie par le moteur : la garde
    // doit marquer le nordic, pas dupliquer str_nordic_assisted_band.
    const session = v2ToLocalSession(
      v2Avec(
        [
          { exerciseId: "str_nordic_assisted_band", name: null, sets: 3, reps: 8 },
          { exerciseId: "str_nordic", name: null, sets: 3, reps: 5 },
        ],
        ["home_small"]
      ),
      PHASE,
      "2026-08-11",
      { ageCategory: "Senior" }
    );
    const ids = session.exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(session.exercises[1].name).toMatch(/\(à 2\)$/);
  });

  test("un exo solo normal traverse intact (aucun effet de bord de la garde)", () => {
    const session = v2ToLocalSession(
      v2Avec([{ exerciseId: "str_air_squat", name: null, sets: 3, reps: 10 }]),
      PHASE,
      "2026-08-11",
      { ageCategory: "U15" }
    );
    const [ex] = session.exercises;
    expect(ex.id).toBe("str_air_squat");
    expect(ex.name).not.toMatch(/\(à 2\)/);
    expect(ex.notes).toBeUndefined();
  });
});

describe("garde solo — le front ne PROPOSE plus d'exo à 2 au backend", () => {
  test("allowed_exercises ne contient plus aucun id non-solo (avant le 11/08 : les 12 y étaient)", () => {
    const ids = buildAllowedExercisesPayload().map((ex) => ex.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => (NON_SOLO_IDS_FRONT as readonly string[]).includes(id))).toBe(false);
  });
});
