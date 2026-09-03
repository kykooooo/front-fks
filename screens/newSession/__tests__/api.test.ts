// screens/newSession/__tests__/api.test.ts
// fetchV2 — résilience au cold start Render : un fetch qui échoue en
// "Network request failed"/"Failed to fetch" (coupure système iOS ~60s,
// AVANT notre AbortController à 90s) doit retenter une fois, comme pour
// ETIMEDOUT. Sans ce fix, le retry ne se déclenchait que sur ETIMEDOUT
// (screens/newSession/api.ts:191 avant correctif) et un cold start iOS
// tombait directement en fallback.

import {
  fetchV2,
  hashContext,
  prepareBackendContext,
  getSessionCache,
  setSessionCache,
  clearSessionCache,
} from "../api";
import { lireEchecGeneration } from "../echecGeneration";

const originalFetch = global.fetch;

// v2 minimal mais VALIDE (title/duration_min non-defaut, blocks non-vide) :
// ces tests de retry testent le mecanisme reseau, pas la validation Zod —
// un v2 vide ({}) declencherait desormais le refus "reparation detectee"
// (lot 3) et masquerait ce que ces tests verifient reellement.
const V2_MINIMAL_VALIDE = {
  title: "Seance de test",
  duration_min: 42,
  blocks: [
    {
      id: "b1",
      type: "run",
      goal: "endurance",
      intensity: "moderate",
      duration_min: 10,
      items: [{ name: "Footing continu" }],
    },
  ],
};

describe("fetchV2 — reveil serveur (cold start)", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("un 1er echec reseau (Failed to fetch) declenche un retry qui reussit, sans throw", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: V2_MINIMAL_VALIDE }),
      });
    }) as any;

    const onRetry = jest.fn();
    const { v2 } = await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith("network");
    expect(v2).toBeTruthy();
  });

  test("un 1er echec reseau (Network request failed, message RN) retry aussi", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error("Network request failed"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: V2_MINIMAL_VALIDE }),
      });
    }) as any;

    const onRetry = jest.fn();
    await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledWith("network");
  });

  test("comportement existant conserve : un timeout (AbortError) retente aussi", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        return Promise.reject(abortError);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: V2_MINIMAL_VALIDE }),
      });
    }) as any;

    const onRetry = jest.fn();
    await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledWith("timeout");
  });

  test("une erreur non reseau/non timeout (ex: 400) ne retente pas", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "bad payload",
        headers: { get: () => null },
      });
    }) as any;

    await expect(fetchV2({ some: "ctx" })).rejects.toMatchObject({ status: 400 });
    expect(callCount).toBe(1);
  });

  test("si les 2 essais echouent en reseau, l'erreur reseau remonte telle quelle : l'appelant decide, aucune seance n'est fabriquee ici", async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(new TypeError("Failed to fetch"))) as any;

    await expect(fetchV2({ some: "ctx" })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// FIX contrat — cache séance : nowISO/devNowISO rendaient le hash instable
// (il changeait à chaque milliseconde), donc le cache ne matchait JAMAIS et
// chaque re-génération repayait un appel LLM.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// En-tête User-Agent applicatif ("FKS/<version> (<platform>)") : permet à la
// métrique de compatibilité serveur de ventiler par version d'app.
// ---------------------------------------------------------------------------

describe("fetchV2 — en-tête User-Agent applicatif", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("le header User-Agent est envoyé au format FKS/<version> (<platform>)", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    global.fetch = jest.fn().mockImplementation((_url: string, opts: any) => {
      capturedHeaders = opts?.headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: V2_MINIMAL_VALIDE }),
      });
    }) as any;

    await fetchV2({ some: "ctx" });

    expect(capturedHeaders?.["User-Agent"]).toBeDefined();
    expect(capturedHeaders?.["User-Agent"]).toMatch(/^FKS\/\S+ \(\S+\)$/);
  });
});

describe("hashContext — stabilité du cache", () => {
  const baseCtx = {
    goal: "force",
    phase: "playlist",
    constraints: { equipment: ["gym_full"], pains: [] },
  };

  test("deux contextes identiques à l'horloge près donnent le MÊME hash", () => {
    const h1 = hashContext({ ...baseCtx, nowISO: "2026-07-17T10:00:00.000Z", devNowISO: null });
    const h2 = hashContext({ ...baseCtx, nowISO: "2026-07-17T10:00:00.937Z", devNowISO: null });
    expect(h1).toBe(h2);
  });

  test("devNowISO (horloge virtuelle dev) est exclu aussi", () => {
    const h1 = hashContext({ ...baseCtx, devNowISO: "2026-07-17T10:00:00.000Z" });
    const h2 = hashContext({ ...baseCtx, devNowISO: "2026-07-18T08:30:00.000Z" });
    expect(h1).toBe(h2);
  });

  test("un vrai changement de contexte change bien le hash", () => {
    const h1 = hashContext({ ...baseCtx, nowISO: "2026-07-17T10:00:00.000Z" });
    const h2 = hashContext({ ...baseCtx, goal: "endurance", nowISO: "2026-07-17T10:00:00.000Z" });
    expect(h1).not.toBe(h2);
  });

  test("comportement conservé : allowed_exercises et flags debug restent exclus", () => {
    const h1 = hashContext({ ...baseCtx, allowed_exercises: [{ id: "a" }], debug: true });
    const h2 = hashContext({ ...baseCtx, allowed_exercises: [{ id: "b" }], debug: false });
    expect(h1).toBe(h2);
  });

  test("bout en bout : un cache posé à T est retrouvé à T+quelques secondes", async () => {
    await clearSessionCache();
    const response = { v2: { title: "Séance force" } as any, debug: {} };
    await setSessionCache({ ...baseCtx, nowISO: "2026-07-17T10:00:00.000Z" }, response);
    const hit = await getSessionCache({ ...baseCtx, nowISO: "2026-07-17T10:00:03.421Z" });
    expect(hit).not.toBeNull();
    expect(hit!.v2).toEqual(response.v2);
    await clearSessionCache();
  });
});

// ---------------------------------------------------------------------------
// FIX contrat — salle appauvrie : l'UI promet « Équipement standard inclus par
// défaut » mais le payload ne portait que la sélection explicite (souvent
// ["barbell"] forcé par le hook) → le backend, qui filtre strictement,
// excluait bancs/haltères/machines. gym_full doit TOUJOURS être présent
// quand l'environnement est la salle.
// ---------------------------------------------------------------------------

describe("prepareBackendContext — gym_full toujours présent en salle", () => {
  const minimalCtx = {
    version: "fks_context_v1",
    profile: { goal: "force" },
    goal: "force",
    constraints: { equipment: [], pains: [] },
  } as any;

  test("salle + sélection partielle : gym_full ajouté aux sélections explicites", () => {
    const { context } = prepareBackendContext(minimalCtx, ["power_sled"], ["gym"]);
    expect(context.equipment_available).toEqual(
      expect.arrayContaining(["gym_full", "bodyweight", "power_sled"])
    );
    expect(context.equipment_used).toEqual(expect.arrayContaining(["gym_full"]));
    expect((context.constraints as any).equipment).toEqual(
      expect.arrayContaining(["gym_full"])
    );
  });

  test("salle + sélection vide : gym_full présent quand même", () => {
    const { context } = prepareBackendContext(minimalCtx, [], ["gym"]);
    expect(context.equipment_available).toEqual(
      expect.arrayContaining(["gym_full", "bodyweight"])
    );
  });

  test("pas de doublon si gym_full déjà sélectionné", () => {
    const { context } = prepareBackendContext(minimalCtx, ["gym_full", "bodyweight"], ["gym"]);
    const list = context.equipment_available as string[];
    expect(list.filter((id) => id === "gym_full")).toHaveLength(1);
  });

  test("hors salle : gym_full n'est PAS injecté", () => {
    const { context } = prepareBackendContext(minimalCtx, ["home_small"], ["home"]);
    expect(context.equipment_available).not.toContain("gym_full");
    const { context: pitchCtx } = prepareBackendContext(minimalCtx, ["cones"], ["pitch"]);
    expect(pitchCtx.equipment_available).not.toContain("gym_full");
  });

  test("zéro ballon : gym_full n'entraîne aucun id ballon dans le payload", () => {
    const { context } = prepareBackendContext(minimalCtx, [], ["gym"]);
    const list = context.equipment_available as string[];
    for (const banned of ["medball", "medicine_ball", "swiss_ball", "fitball"]) {
      expect(list).not.toContain(banned);
    }
  });
});

// ---------------------------------------------------------------------------
// FIX contrat — setup sans matériel : le moteur gère nativement le poids du
// corps, donc "aucun matériel coché" ne doit plus jamais bloquer une
// génération ni partir en payload vide (cf. EquipmentSelector, plus de
// toast "Matériel requis"). "bodyweight" est le filet de sécurité minimal.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// LOT 3 (P1) — détection de réparation Zod au point de validation : une
// réponse malformée réparée en séance plausible par les .catch() du schéma
// (titre "Séance", 30 min, blocs vides) ne doit jamais être servie telle
// quelle. Au-delà du seuil (screens/../schemas/sessionSchema.ts), fetchV2
// refuse via le même corps d'erreur typé que le reste (docs/CONTRAT_ERREUR_FRONT.md §2).
// ---------------------------------------------------------------------------

describe("fetchV2 — reparation Zod detectee au-dela du seuil (lot 3)", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("blocks vide : rejette avec un corps type SESSION_SCHEMA_INVALID, jamais servi tel quel", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ v2: { blocks: [] } }),
    }) as any;

    expect.assertions(4);
    try {
      await fetchV2({ some: "ctx" });
    } catch (err: any) {
      expect(err.status).toBe(422);
      const corps = JSON.parse(err.message);
      expect(corps.code).toBe("SESSION_SCHEMA_INVALID");
      expect(corps.retryable).toBe(false);
      expect(corps.category).toBe("technique");
    }
  });

  test("titre ET duree par defaut simultanement (seuil atteint), meme avec des blocs : rejette aussi", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        v2: {
          blocks: [
            {
              id: "b1",
              type: "run",
              goal: "endurance",
              intensity: "moderate",
              duration_min: 10,
              items: [{ name: "Footing continu" }],
            },
          ],
          // ni title ni duration_min : les deux tombent sur leur .catch()
        },
      }),
    }) as any;

    expect.assertions(2);
    try {
      await fetchV2({ some: "ctx" });
    } catch (err: any) {
      expect(err.status).toBe(422);
      expect(JSON.parse(err.message).code).toBe("SESSION_SCHEMA_INVALID");
    }
  });

  test("UN SEUL champ par defaut (sous le seuil) : n'est PAS rejete, la seance passe", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        v2: {
          title: "Ma vraie séance du jour",
          // duration_min absent : tombe sur 30 (une seule sentinelle)
          blocks: [
            {
              id: "b1",
              type: "run",
              goal: "endurance",
              intensity: "moderate",
              duration_min: 10,
              items: [{ name: "Footing continu" }],
            },
          ],
        },
      }),
    }) as any;

    const { v2 } = await fetchV2({ some: "ctx" });
    expect(v2.title).toBe("Ma vraie séance du jour");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Transport du refus de sécurité (422) — P0 du 01/09/2026
 *
 * Le refus de sécurité voyage dans le CORPS d'une réponse 422. Trois choses
 * doivent survivre au transport, sinon le message de sécurité n'atteint
 * jamais le joueur : le corps JSON entier (dont `safety_flags`), le statut,
 * et l'absence de tout ré-essai automatique — une relance silencieuse
 * repaierait un appel pour se faire refuser à l'identique.
 * ═══════════════════════════════════════════════════════════════════════ */

describe("fetchV2 — refus de securite en 422 : corps preserve, aucun re-essai", () => {
  const CORPS_REFUS = {
    ok: false,
    code: "safety_no_session",
    error: "safety_no_session",
    message: "On ne te propose pas de séance aujourd'hui : tu as signalé une douleur importante.",
    disclaimer: "Si la douleur persiste, consulte un professionnel de santé.",
    safety_flags: ["RF1_pain_recent_high"],
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("un 422 n'est PAS retente, et son corps JSON arrive intact jusqu'a l'appelant", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        headers: { get: () => null },
        text: async () => JSON.stringify(CORPS_REFUS),
        json: async () => CORPS_REFUS,
      });
    }) as any;

    const onRetry = jest.fn();
    expect.assertions(6);
    try {
      await fetchV2({ some: "ctx" }, { onRetry });
    } catch (err: any) {
      // Un seul appel payant : le retry cold start ne couvre que
      // timeout/réseau, jamais une réponse HTTP qualifiée.
      expect(callCount).toBe(1);
      expect(onRetry).not.toHaveBeenCalled();
      expect(err.status).toBe(422);

      const corps = JSON.parse(err.message);
      expect(corps.code).toBe("safety_no_session");
      // Le champ le plus fragile : c'est lui qui décide de l'explication
      // affichée (douleur / blessure). Rien ne doit l'aplatir en route.
      expect(corps.safety_flags).toEqual(["RF1_pain_recent_high"]);
      expect(corps.disclaimer).toBe(CORPS_REFUS.disclaimer);
    }
  });

  test("bout en bout : le 422 transporte devient le message de securite du joueur", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      headers: { get: () => null },
      text: async () => JSON.stringify(CORPS_REFUS),
      json: async () => CORPS_REFUS,
    }) as any;

    expect.assertions(4);
    try {
      await fetchV2({ some: "ctx" });
    } catch (err: any) {
      const echec = lireEchecGeneration(err);
      expect(echec.categorie).toBe("securite");
      expect(echec.actions).toEqual(["retour_accueil"]);
      expect(echec.messageJoueur).toContain(
        "C'est la douleur que tu as indiquée à ton dernier feedback"
      );
      expect(echec.messageJoueur.toLowerCase()).not.toContain("indisponible");
    }
  });

  test("un refus de securite n'est jamais mis en cache (aucune reponse a cacher)", async () => {
    await clearSessionCache();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      headers: { get: () => null },
      text: async () => JSON.stringify(CORPS_REFUS),
      json: async () => CORPS_REFUS,
    }) as any;

    await expect(fetchV2({ some: "ctx" })).rejects.toBeTruthy();
    expect(await getSessionCache({ some: "ctx" })).toBeNull();
  });
});

describe("prepareBackendContext — sans matériel = bodyweight, jamais vide", () => {
  const minimalCtx = {
    version: "fks_context_v1",
    profile: { goal: "force" },
    goal: "force",
    constraints: { equipment: [], pains: [] },
  } as any;

  test("terrain sans sélection : equipment_available retombe sur ['bodyweight']", () => {
    const { context } = prepareBackendContext(minimalCtx, [], ["pitch"]);
    expect(context.equipment_available).toEqual(["bodyweight"]);
    expect(context.equipment_used).toEqual(["bodyweight"]);
  });

  test("maison sans sélection : equipment_available retombe sur ['bodyweight']", () => {
    const { context } = prepareBackendContext(minimalCtx, [], ["home"]);
    expect(context.equipment_available).toEqual(["bodyweight"]);
  });

  test("aucun lieu, aucune sélection : jamais un tableau vide", () => {
    const { context } = prepareBackendContext(minimalCtx, [], []);
    expect(context.equipment_available).toEqual(["bodyweight"]);
  });

  test("terrain avec sélection explicite : la sélection est conservée (pas écrasée par bodyweight)", () => {
    const { context } = prepareBackendContext(minimalCtx, ["cones"], ["pitch"]);
    expect(context.equipment_available).toEqual(["cones"]);
  });
});
