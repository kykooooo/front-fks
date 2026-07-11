// services/__tests__/painConstraints.test.ts
//
// FIX INTÉGRITÉ SÉCURITÉ — blessure déclarée → constraints.pains.
//
// Avant ce fix, aiContext.ts lisait `feedback.pains ?? painZones` (champs que
// rien n'écrit) : `constraints.pains` partait TOUJOURS vide et les gates
// douleur du backend (okByContra fksFilters.ts:371, gates archétype
// fksOrchestrator.ts:1543, caps injury_max_severity :1878) tournaient à vide.
//
// On vérifie ici :
// 1. La fenêtre d'activité (7 jours, la déclaration la plus récente par zone
//    fait foi, severity 0 explicite = levée, injury:null ne lève PAS).
// 2. L'intégration réelle : une blessure cheville déclarée au feedback d'HIER
//    (via useFeedbackStore.setInjury, exactement ce que fait useFeedbackSave)
//    → le contexte de génération d'AUJOURD'HUI contient "ankle_pain".
// 3. Le flux complet buildAIPromptContext → constraints.pains + injury_max_severity.

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

import {
  collectActivePainConstraints,
  normalizePainEntry,
  INJURY_ACTIVE_WINDOW_DAYS,
} from "../aiContextHelpers";
import { buildAIPromptContext } from "../aiContext";
import { useFeedbackStore } from "../../state/stores/useFeedbackStore";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { toDateKey, lastNDates } from "../../utils/dateHelpers";
import type { InjuryRecord, DayState } from "../../domain/types";

const TODAY = "2026-07-11";
// lastNDates(TODAY, n) → [J0, J-1, J-2, ...]
const DAYS = lastNDates(TODAY, INJURY_ACTIVE_WINDOW_DAYS + 2);

function makeInjury(overrides: Partial<InjuryRecord> = {}): InjuryRecord {
  return {
    area: "cheville",
    severity: 2,
    type: "aigu",
    restrictions: {},
    startDate: `${TODAY}T08:00:00.000Z`,
    lastConfirm: `${TODAY}T08:00:00.000Z`,
    ...overrides,
  };
}

function dayWithInjury(date: string, injury: InjuryRecord | null): DayState {
  return {
    date,
    feedback: { fatigue: 3, injury, timestamp: `${date}T20:00:00.000Z` },
    adaptive: { fatigueFactor: 1, painFactor: 1, combined: 1, fatigueSmoothed: 3 },
  };
}

describe("collectActivePainConstraints — fenêtre d'activité", () => {
  test("blessure déclarée AUJOURD'HUI → token + sévérité", () => {
    const dayStates = { [DAYS[0]]: dayWithInjury(DAYS[0], makeInjury()) };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: ["ankle_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("blessure déclarée HIER → contraint encore aujourd'hui (pas d'évaporation à minuit)", () => {
    const dayStates = { [DAYS[1]]: dayWithInjury(DAYS[1], makeInjury({ area: "genou", severity: 3 })) };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: ["knee_pain"],
      injuryMaxSeverity: 3,
    });
  });

  test("déclaration au dernier jour de la fenêtre (J-6) → encore active", () => {
    const edge = DAYS[INJURY_ACTIVE_WINDOW_DAYS - 1];
    const dayStates = { [edge]: dayWithInjury(edge, makeInjury({ area: "ischio" })) };
    expect(collectActivePainConstraints(dayStates, TODAY).pains).toEqual(["hamstring_acute"]);
  });

  test("déclaration hors fenêtre (J-7) → expirée", () => {
    const past = DAYS[INJURY_ACTIVE_WINDOW_DAYS];
    const dayStates = { [past]: dayWithInjury(past, makeInjury()) };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: [],
      injuryMaxSeverity: 0,
    });
  });

  test("severity 0 explicite ('OK') plus récente lève la contrainte pour la zone", () => {
    const dayStates = {
      [DAYS[3]]: dayWithInjury(DAYS[3], makeInjury({ severity: 2 })),
      [DAYS[1]]: dayWithInjury(DAYS[1], makeInjury({ severity: 0 })),
    };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: [],
      injuryMaxSeverity: 0,
    });
  });

  test("feedback ultérieur SANS blessure (injury: null) ne lève PAS — dans le doute on transmet", () => {
    const dayStates = {
      [DAYS[3]]: dayWithInjury(DAYS[3], makeInjury({ severity: 2 })),
      [DAYS[1]]: dayWithInjury(DAYS[1], null),
    };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: ["ankle_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("la déclaration la plus récente par zone fait foi (re-déclaration moins sévère)", () => {
    const dayStates = {
      [DAYS[4]]: dayWithInjury(DAYS[4], makeInjury({ area: "genou", severity: 3 })),
      [DAYS[1]]: dayWithInjury(DAYS[1], makeInjury({ area: "genou", severity: 1 })),
    };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: ["knee_pain"],
      injuryMaxSeverity: 1,
    });
  });

  test("zone 'autre' → aucun token mais injury_max_severity alimenté (cap backend sans zone)", () => {
    const dayStates = { [DAYS[0]]: dayWithInjury(DAYS[0], makeInjury({ area: "autre", severity: 3 })) };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: [],
      injuryMaxSeverity: 3,
    });
  });

  test("plusieurs zones actives → tokens cumulés, sévérité max", () => {
    const dayStates = {
      [DAYS[2]]: dayWithInjury(DAYS[2], makeInjury({ area: "mollet", severity: 1 })),
      [DAYS[0]]: dayWithInjury(DAYS[0], makeInjury({ area: "dos", severity: 2 })),
    };
    expect(collectActivePainConstraints(dayStates, TODAY)).toEqual({
      pains: ["back_pain", "calf_pain"],
      injuryMaxSeverity: 2,
    });
  });

  test("champs legacy pains/painZones (si jamais écrits) restent pris en compte", () => {
    const day: DayState = {
      date: DAYS[0],
      feedback: {
        fatigue: 3,
        timestamp: `${DAYS[0]}T20:00:00.000Z`,
        // legacy : zone fr + token déjà backend + inconnu (droppé)
        pains: ["cheville", "knee_pain", "mystere"],
      } as any,
      adaptive: { fatigueFactor: 1, painFactor: 1, combined: 1, fatigueSmoothed: 3 },
    };
    expect(collectActivePainConstraints({ [DAYS[0]]: day }, TODAY)).toEqual({
      pains: ["ankle_pain", "knee_pain"],
      injuryMaxSeverity: 0,
    });
  });

  test("aucun dayState → aucune contrainte", () => {
    expect(collectActivePainConstraints({}, TODAY)).toEqual({ pains: [], injuryMaxSeverity: 0 });
    expect(collectActivePainConstraints(undefined, TODAY)).toEqual({ pains: [], injuryMaxSeverity: 0 });
  });
});

describe("normalizePainEntry", () => {
  test("token backend déjà valide → passe tel quel", () => {
    expect(normalizePainEntry("ankle_pain")).toBe("ankle_pain");
    expect(normalizePainEntry("groin_pain")).toBe("groin_pain");
  });
  test("zone fr → mappée", () => {
    expect(normalizePainEntry("épaule")).toBe("shoulder_pain");
  });
  test("inconnu / non-string → null", () => {
    expect(normalizePainEntry("xyz")).toBeNull();
    expect(normalizePainEntry(42)).toBeNull();
    expect(normalizePainEntry(null)).toBeNull();
  });
});

describe("intégration : déclaration feedback → dayStates → contexte de génération", () => {
  beforeEach(() => {
    useFeedbackStore.setState({ dayStates: {} } as any);
    useLoadStore.setState({ atl: 50, ctl: 60, tsb: 10 } as any);
    useSessionsStore.setState({ sessions: [], microcycleGoal: "fondation", microcycleSessionIndex: 0 } as any);
    useDebugStore.setState({ devNowISO: null } as any);
  });

  test("blessure cheville déclarée au feedback d'HIER → le contexte d'AUJOURD'HUI contient ankle_pain", async () => {
    const todayKey = toDateKey(new Date());
    const yesterdayKey = lastNDates(todayKey, 2)[1];

    // Exactement le chemin de useFeedbackSave.ts:178 : setInjury(dayKey, injury)
    useFeedbackStore.getState().setInjury(
      yesterdayKey,
      makeInjury({ area: "cheville", severity: 2, startDate: `${yesterdayKey}T20:00:00.000Z`, lastConfirm: `${yesterdayKey}T20:00:00.000Z` })
    );

    // La déclaration a bien atterri dans dayStates
    expect(useFeedbackStore.getState().dayStates[yesterdayKey]?.feedback?.injury?.area).toBe("cheville");

    // Flux complet : buildAIPromptContext (firebase mocké, stores réels)
    const ctx = await buildAIPromptContext();
    expect(ctx.constraints?.pains).toEqual(["ankle_pain"]);
    expect(ctx.constraints?.injury_max_severity).toBe(2);
  });

  test("aucune blessure déclarée → pains vide et pas d'injury_max_severity", async () => {
    const ctx = await buildAIPromptContext();
    expect(ctx.constraints?.pains).toEqual([]);
    expect(ctx.constraints?.injury_max_severity).toBeUndefined();
  });
});
