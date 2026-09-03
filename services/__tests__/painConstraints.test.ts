// services/__tests__/painConstraints.test.ts
//
// LE PAYLOAD DOULEUR EST PILOTE PAR LE STATUT, PLUS PAR UNE FENETRE (D12).
//
// Historique de ce fichier. Il est ne d'un fix d'integrite : `aiContext.ts`
// lisait `feedback.pains ?? painZones`, deux champs que rien n'ecrivait, donc
// `constraints.pains` partait TOUJOURS vide et les gates douleur du backend
// (okByContra, gates archetype, caps injury_max_severity) tournaient a vide.
// Il verifiait ensuite la fenetre glissante de 7 jours.
//
// CE QUI CHANGE AVEC « MON CORPS » (decision D12, DESIGN_MON_CORPS.md §7) :
// la fenetre disparait. Une gene ne cesse de contraindre que si le JOUEUR dit
// qu'elle est passee. Ce fichier verifie donc desormais la table de traduction
// statut -> payload, et surtout qu'une gene ancienne SANS REPONSE est toujours
// transmise (sentinelle #7 du plan : « pas d'expiration silencieuse »).

// Mocks firebase spécifiques : buildAIPromptContext a besoin d'un user connecté
// et d'un getDoc fonctionnel (profil vide → défauts Zod). Ils remplacent les
// mocks génériques de jest.setup.js pour ce fichier uniquement.
jest.mock("firebase/auth", () => {
  const overrides: Record<string, unknown> = {
    __esModule: true,
    getAuth: () => ({ currentUser: { uid: "test-user" } }),
    initializeAuth: () => ({ currentUser: { uid: "test-user" } }),
    getReactNativePersistence: () => ({}),
    onAuthStateChanged: () => () => {},
  };
  return new Proxy(overrides, {
    get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
  });
});

jest.mock("firebase/firestore", () => {
  const overrides: Record<string, unknown> = {
    __esModule: true,
    getFirestore: () => ({}),
    initializeFirestore: () => ({}),
    connectFirestoreEmulator: () => {},
    onSnapshot: () => () => {},
    doc: jest.fn(() => ({})),
    // Profil Firestore vide → userProfileSchema applique ses défauts.
    getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
  };
  return new Proxy(overrides, {
    get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
  });
});

import { collectActivePainConstraints } from "../aiContextHelpers";
import { buildAIPromptContext } from "../aiContext";
import { useBodyStore, getBodyDefaults } from "../../state/stores/useBodyStore";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import type { BodyArea, BodyInjury, BodyInjurySeverity, BodyInjuryStatus } from "../../domain/types";

const TODAY = "2026-07-11";

function gene(
  zone: BodyArea,
  gravite: BodyInjurySeverity,
  statut: BodyInjuryStatus,
  declaredAtJour = TODAY
): BodyInjury {
  return {
    id: `t_${zone}_${statut}_${declaredAtJour}`,
    zone,
    gravite,
    statut,
    source: "manual",
    declaredAt: `${declaredAtJour}T12:00:00.000Z`,
    updatedAt: `${declaredAtJour}T12:00:00.000Z`,
  };
}

describe("collectActivePainConstraints — le payload reflète le STATUT", () => {
  test("active → jeton de la zone + gravité déclarée", () => {
    expect(collectActivePainConstraints([gene("cheville", 2, "active")])).toEqual({
      pains: ["ankle_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("en reprise → jeton de la zone CONSERVÉ, gravité ramenée à 1", () => {
    // La zone reste écartée des exercices qui la sollicitent ; elle ne plafonne
    // plus l'intensité de toute la séance. C'est ce que veut dire « je reprends ».
    expect(collectActivePainConstraints([gene("genou", 3, "recovering")])).toEqual({
      pains: ["knee_pain"],
      injuryMaxSeverity: 1,
    });
  });

  test("guérie → rien du tout", () => {
    expect(collectActivePainConstraints([gene("genou", 3, "healed")])).toEqual({
      pains: [],
      injuryMaxSeverity: 0,
    });
  });

  test("PAS D'EXPIRATION SILENCIEUSE : une gêne de 30 jours sans réponse est toujours transmise", () => {
    // C'est le coeur du changement. Avant, au 8e jour, la contrainte
    // disparaissait sans un mot et le joueur recevait des sprints.
    const vieille = gene("ischio", 2, "active", "2026-06-11");
    expect(collectActivePainConstraints([vieille])).toEqual({
      pains: ["hamstring_acute"],
      injuryMaxSeverity: 2,
    });
  });

  test("plusieurs zones → jetons cumulés et triés, gravité MAX", () => {
    expect(
      collectActivePainConstraints([
        gene("mollet", 1, "active"),
        gene("dos", 3, "active"),
        gene("épaule", 2, "healed"),
      ])
    ).toEqual({ pains: ["back_pain", "calf_pain"], injuryMaxSeverity: 3 });
  });

  test("la gravité max ignore les guéries et compte 'en reprise' pour 1", () => {
    expect(
      collectActivePainConstraints([
        gene("genou", 3, "recovering"),
        gene("cheville", 2, "active"),
      ])
    ).toEqual({ pains: ["ankle_pain", "knee_pain"], injuryMaxSeverity: 2 });
  });

  test("zone 'autre' → aucun jeton mais injury_max_severity alimenté (cap backend sans zone)", () => {
    expect(collectActivePainConstraints([gene("autre", 3, "active")])).toEqual({
      pains: [],
      injuryMaxSeverity: 3,
    });
  });

  test("zone 'aine' → groin_pain (D11 : jeton déjà connu du moteur)", () => {
    expect(collectActivePainConstraints([gene("aine", 2, "active")])).toEqual({
      pains: ["groin_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("aucune gêne → aucune contrainte, et jamais un objet de remplissage", () => {
    expect(collectActivePainConstraints([])).toEqual({ pains: [], injuryMaxSeverity: 0 });
    expect(collectActivePainConstraints(null)).toEqual({ pains: [], injuryMaxSeverity: 0 });
    expect(collectActivePainConstraints(undefined)).toEqual({ pains: [], injuryMaxSeverity: 0 });
  });
});

describe("intégration : Mon corps → contexte de génération", () => {
  beforeEach(() => {
    useBodyStore.setState({ ...getBodyDefaults() } as any);
    useLoadStore.setState({ atl: 50, ctl: 60, tsb: 10 } as any);
    useSessionsStore.setState({ sessions: [], microcycleGoal: "fondation", microcycleSessionIndex: 0 } as any);
    useDebugStore.setState({ devNowISO: null } as any);
  });

  test("gêne cheville déclarée dans Mon corps → le contexte contient ankle_pain", async () => {
    useBodyStore.getState().ajouterBlessure({
      zone: "cheville",
      gravite: 2,
      source: "manual",
      nowISO: "2026-07-10T20:00:00.000Z",
    });

    const ctx = await buildAIPromptContext();
    expect(ctx.constraints?.pains).toEqual(["ankle_pain"]);
    expect(ctx.constraints?.injury_max_severity).toBe(2);
  });

  test("marquée guérie → la contrainte disparaît du contexte", async () => {
    const blessure = useBodyStore.getState().ajouterBlessure({
      zone: "cheville",
      gravite: 2,
      source: "manual",
      nowISO: "2026-07-10T20:00:00.000Z",
    });
    useBodyStore.getState().changerStatut(blessure.id, "healed", "2026-07-11T09:00:00.000Z");

    const ctx = await buildAIPromptContext();
    expect(ctx.constraints?.pains).toEqual([]);
    expect(ctx.constraints?.injury_max_severity).toBeUndefined();
  });

  test("aucune gêne déclarée → pains vide et pas d'injury_max_severity", async () => {
    const ctx = await buildAIPromptContext();
    expect(ctx.constraints?.pains).toEqual([]);
    expect(ctx.constraints?.injury_max_severity).toBeUndefined();
  });
});
