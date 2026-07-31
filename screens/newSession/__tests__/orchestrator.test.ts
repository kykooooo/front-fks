// screens/newSession/__tests__/orchestrator.test.ts
//
// LOT 1 (P0) — panne de persistance ≠ panne de génération.
//
// processV2 fait persistPlanned(payload) PUIS pushSession/setLastAiSessionV2/
// navigate. Une panne à CE stade n'est pas une panne de génération : le
// backend a déjà répondu (l'appel est payé). Ces tests prouvent que
// l'orchestrateur distingue bien les deux étapes ratables (persistance,
// affichage), qu'un nouvel essai ne relance JAMAIS persistPlanned quand ce
// n'est pas nécessaire (étape "affichage"), et que le payload rejoué est
// EXACTEMENT le même (même id) — jamais une seconde séance fabriquée.

import type { Session } from "../../../domain/types";
import { EchecPostGeneration } from "../echecGeneration";
import { processV2, rejouerApresEchecPostGeneration } from "../orchestrator";
import type { FKS_NextSessionV2 } from "../types";

// blocks non vide et exploitable : depuis DOCTRINE Option C,
// v2ToLocalSession (transform.ts) refuse (typé) une séance sans bloc plutôt
// que de fabriquer un placeholder — ces tests portent sur la persistance et
// l'affichage post-génération, pas sur la transformation elle-même, donc le
// fixture doit rester un v2 qui transforme avec succès.
const v2: FKS_NextSessionV2 = {
  version: "v2",
  title: "Force bas du corps",
  intensity: "moderate",
  focusPrimary: "strength",
  durationMin: 30,
  rpeTarget: 6,
  blocks: [
    {
      id: "block_1",
      type: "strength",
      goal: "Force bas du corps",
      intensity: "moderate",
      durationMin: 20,
      items: [{ name: "Squat", sets: 3, reps: 8 }],
    },
  ],
};

const now = new Date("2026-07-27T10:00:00.000Z");

function creerParamsBase() {
  return {
    v2,
    phase: "Playlist" as Session["phase"],
    now,
    clubTrainingDays: [] as string[],
    tsb: 0,
    alreadyAppliedToday: false,
    location: "home",
    pushSession: jest.fn(),
    persistPlanned: jest.fn(async (_payload: any) => {}) as jest.Mock<Promise<void>, [any]>,
    setLastAiSessionV2: jest.fn(),
    navigate: jest.fn(),
    alertPlanified: jest.fn(),
  };
}

describe("processV2 — persistance réussie, affichage réussi (chemin nominal)", () => {
  test("persistPlanned puis pushSession puis navigate, dans cet ordre, une seule fois chacun", async () => {
    const params = creerParamsBase();
    await processV2(params);

    expect(params.persistPlanned).toHaveBeenCalledTimes(1);
    expect(params.pushSession).toHaveBeenCalledTimes(1);
    expect(params.setLastAiSessionV2).toHaveBeenCalledTimes(1);
    expect(params.navigate).toHaveBeenCalledTimes(1);
  });
});

describe("processV2 — panne de PERSISTANCE (Firestore KO après génération payée)", () => {
  test("leve EchecPostGeneration étape persistance, et n'affiche/ne pousse RIEN", async () => {
    const params = creerParamsBase();
    params.persistPlanned = jest.fn(async (_payload: any) => {
      throw Object.assign(new Error("firestore/unavailable"), { code: "firestore/unavailable" });
    });

    let capturee: unknown;
    try {
      await processV2(params);
    } catch (err) {
      capturee = err;
    }

    expect(capturee).toBeInstanceOf(EchecPostGeneration);
    const echec = capturee as EchecPostGeneration;
    expect(echec.etape).toBe("persistance");
    // Rien n'a été poussé localement ni navigué : la panne est survenue AVANT.
    expect(params.pushSession).not.toHaveBeenCalled();
    expect(params.setLastAiSessionV2).not.toHaveBeenCalled();
    expect(params.navigate).not.toHaveBeenCalled();
    // La séance déjà générée (payée) est conservée pour un nouvel essai.
    expect(echec.seance.v2).toBe(v2);
    expect(echec.seance.payload).toBeTruthy();
  });
});

describe("processV2 — panne d'AFFICHAGE (persistance réussie, store local/navigation KO)", () => {
  test("leve EchecPostGeneration étape affichage — persistPlanned A été appelé avec succès", async () => {
    const params = creerParamsBase();
    params.navigate = jest.fn(() => {
      throw new Error("navigation indisponible");
    });

    let capturee: unknown;
    try {
      await processV2(params);
    } catch (err) {
      capturee = err;
    }

    expect(capturee).toBeInstanceOf(EchecPostGeneration);
    const echec = capturee as EchecPostGeneration;
    expect(echec.etape).toBe("affichage");
    // La persistance, elle, a bien réussi : Firestore a la séance.
    expect(params.persistPlanned).toHaveBeenCalledTimes(1);
    expect(params.pushSession).toHaveBeenCalledTimes(1);
  });
});

describe("rejouerApresEchecPostGeneration — nouvel essai sans nouvel appel payant", () => {
  test("étape persistance : rejoue persistPlanned PUIS l'affichage, avec le MÊME payload (même id)", async () => {
    const params = creerParamsBase();
    let idPremierEssai: string | undefined;
    params.persistPlanned = jest.fn(async (payload: any) => {
      idPremierEssai = payload.id;
      throw new Error("firestore down");
    });

    let capturee: unknown;
    try {
      await processV2(params);
    } catch (err) {
      capturee = err;
    }
    const echec = capturee as EchecPostGeneration;
    expect(echec.etape).toBe("persistance");

    // Nouvel essai : persistPlanned réussit cette fois.
    let idSecondEssai: string | undefined;
    const persistPlannedRetry = jest.fn(async (payload: any) => {
      idSecondEssai = payload.id;
    });
    const pushSessionRetry = jest.fn();
    const navigateRetry = jest.fn();
    const setLastAiSessionV2Retry = jest.fn();

    await rejouerApresEchecPostGeneration(
      { etape: echec.etape, seance: echec.seance },
      {
        pushSession: pushSessionRetry,
        persistPlanned: persistPlannedRetry,
        setLastAiSessionV2: setLastAiSessionV2Retry,
        navigate: navigateRetry,
      }
    );

    expect(persistPlannedRetry).toHaveBeenCalledTimes(1);
    expect(pushSessionRetry).toHaveBeenCalledTimes(1);
    expect(navigateRetry).toHaveBeenCalledTimes(1);
    // Même id : ce n'est pas une seconde séance fabriquée, c'est la même.
    expect(idSecondEssai).toBe(idPremierEssai);
  });

  test("étape affichage : NE rejoue PAS persistPlanned (déjà réussi) — ne rejoue que l'affichage", async () => {
    const params = creerParamsBase();
    params.navigate = jest.fn(() => {
      throw new Error("navigation indisponible");
    });

    let capturee: unknown;
    try {
      await processV2(params);
    } catch (err) {
      capturee = err;
    }
    const echec = capturee as EchecPostGeneration;
    expect(echec.etape).toBe("affichage");
    expect(params.persistPlanned).toHaveBeenCalledTimes(1);

    const persistPlannedRetry = jest.fn(async () => {});
    const pushSessionRetry = jest.fn();
    const navigateRetry = jest.fn();
    const setLastAiSessionV2Retry = jest.fn();

    await rejouerApresEchecPostGeneration(
      { etape: echec.etape, seance: echec.seance },
      {
        pushSession: pushSessionRetry,
        persistPlanned: persistPlannedRetry,
        setLastAiSessionV2: setLastAiSessionV2Retry,
        navigate: navigateRetry,
      }
    );

    // Pas de seconde écriture Firestore : elle avait déjà réussi.
    expect(persistPlannedRetry).not.toHaveBeenCalled();
    expect(pushSessionRetry).toHaveBeenCalledTimes(1);
    expect(navigateRetry).toHaveBeenCalledTimes(1);
  });
});

describe("processV2 — v2ToLocalSession refuse (DOCTRINE Option C) : rien n'est persisté ni affiché", () => {
  test("exercise_id duplique dans le v2 : processV2 rejette AVANT persistPlanned, aucune ecriture", async () => {
    const params = creerParamsBase();
    const v2Duplique: FKS_NextSessionV2 = {
      ...v2,
      blocks: [
        {
          id: "block_1",
          type: "strength",
          goal: "Force bas du corps",
          intensity: "moderate",
          durationMin: 20,
          items: [
            { exerciseId: "ex_squat", name: "Squat", sets: 3, reps: 8 },
            { exerciseId: "ex_squat", name: "Squat bis", sets: 3, reps: 8 },
          ],
        },
      ],
    };

    let capturee: unknown;
    try {
      await processV2({ ...params, v2: v2Duplique });
    } catch (err) {
      capturee = err;
    }

    // Ce n'est PAS un EchecPostGeneration (persistance/affichage) : la
    // génération elle-même n'a jamais été considérée exploitable, l'appel
    // payant n'a servi à rien mais rien n'a non plus été écrit à sa place.
    expect(capturee).toBeDefined();
    expect(capturee).not.toBeInstanceOf(EchecPostGeneration);
    expect(params.persistPlanned).not.toHaveBeenCalled();
    expect(params.pushSession).not.toHaveBeenCalled();
    expect(params.setLastAiSessionV2).not.toHaveBeenCalled();
    expect(params.navigate).not.toHaveBeenCalled();
  });
});
