// services/__tests__/aiContext.test.ts
//
// Tests cibles du pont front -> backend pour computeFeedbackAdjustments
// et detectFatigueTrend (cf. ../../fks/src/fksOrchestrator.ts:328-376
// et ../../fks/src/fksUtils.ts:77-120).
//
// On verifie que :
// 1. La douleur app (0-5) est correctement normalisee vers l'echelle backend (0-10).
// 2. Les metriques ATL/CTL/TSB par session sont bien extraites quand presentes.
// 3. Le rpe_target est lu depuis aiV2 (camelCase ou snake_case).
// 4. Le payload limite a 8 sessions et porte feedback / metrics / ai.rpe_target.
// 5. Les anciennes sessions sans metrics / sans feedback ne plantent pas.
// 6. Boucle de suivi (Lot 6) : le point d'intégration mode Application dans
//    buildAIPromptContext est pass-through par défaut (apply=false) et ajuste
//    bien le contexte quand apply=true (cf. describe tout en bas du fichier).

// On importe depuis le module pur `aiContextHelpers` plutot que `aiContext`
// pour eviter que jest charge la dependance firebase ESM (mocker firebase ici
// serait du bruit qui n'a rien a voir avec la logique testee) -- SAUF dans le
// describe "mode Application" tout en bas, qui a besoin du flux complet et
// mocke firebase localement (mêmes mocks que services/__tests__/painConstraints.test.ts).
import {
  buildRecentFksSessionSummary,
  buildRecentFksSessionsPayload,
  normalizeFeedbackPainForBackend,
  readSessionMetrics,
  readSessionRpeTarget,
} from "../aiContextHelpers";
import type { Session, SessionFeedback } from "../../domain/types";

const baseFeedback: SessionFeedback = {
  rpe: 7,
  fatigue: 3,
  sleep: 3,
  pain: 3,
  createdAt: "2026-04-20T18:00:00.000Z",
} as SessionFeedback;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? `s_${Math.random().toString(36).slice(2, 8)}`,
    dateISO: "2026-04-20T00:00:00.000Z",
    date: "2026-04-20",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 45,
    exercises: [],
    ...overrides,
  } as Session;
}

describe("normalizeFeedbackPainForBackend (pain 0-5 -> 0-10)", () => {
  test("pain=0 reste 0", () => {
    expect(normalizeFeedbackPainForBackend(0)).toBe(0);
  });
  test("pain=3 (gene marquee app) -> 6 backend (seuil pain_high)", () => {
    expect(normalizeFeedbackPainForBackend(3)).toBe(6);
  });
  test("pain=5 (max app) -> 10 backend", () => {
    expect(normalizeFeedbackPainForBackend(5)).toBe(10);
  });
  test("pain negatif est clampe a 0", () => {
    expect(normalizeFeedbackPainForBackend(-2)).toBe(0);
  });
  test("pain > 5 (deja en echelle backend) est conserve, clampe a 10", () => {
    expect(normalizeFeedbackPainForBackend(7)).toBe(7);
    expect(normalizeFeedbackPainForBackend(15)).toBe(10);
  });
});

describe("readSessionMetrics", () => {
  test("extrait atl/ctl/tsb depuis session.metrics", () => {
    const s = makeSession({
      metrics: { atl: 320, ctl: 290, tsb: -30 },
    });
    expect(readSessionMetrics(s)).toEqual({ atl: 320, ctl: 290, tsb: -30 });
  });

  test("retourne undefined si aucune metrique presente (session legacy)", () => {
    const s = makeSession({ metrics: undefined });
    expect(readSessionMetrics(s)).toBeUndefined();
  });

  test("ne renvoie que les champs presents (rejette NaN)", () => {
    const s = makeSession({
      metrics: { atl: 100, ctl: Number.NaN as unknown as number, tsb: 5 },
    });
    expect(readSessionMetrics(s)).toEqual({ atl: 100, tsb: 5 });
  });
});

describe("readSessionRpeTarget", () => {
  test("lit aiV2.rpeTarget (camelCase, format frontend)", () => {
    const s = makeSession({ aiV2: { rpeTarget: 7 } });
    expect(readSessionRpeTarget(s)).toBe(7);
  });

  test("lit aiV2.rpe_target (snake_case, format backend brut)", () => {
    const s = makeSession({ aiV2: { rpe_target: 6 } });
    expect(readSessionRpeTarget(s)).toBe(6);
  });

  test("retourne null si pas de cible (session sans IA)", () => {
    const s = makeSession({ aiV2: undefined });
    expect(readSessionRpeTarget(s)).toBeNull();
  });
});

describe("buildRecentFksSessionSummary", () => {
  test("inclut feedback.pain normalise sur l'echelle backend (0-10)", () => {
    const session = makeSession({
      feedback: { ...baseFeedback, pain: 4 } as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.feedback?.pain).toBe(8); // 4 * 2
    expect(summary.feedback?.pain_scale).toBe("0-10");
    expect(summary.feedback?.rpe).toBe(7);
  });

  test("expose pain_level_after en 0-5 (legacy info-only)", () => {
    const session = makeSession({
      feedback: { ...baseFeedback, pain: 4 } as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.pain_level_after).toBe(4);
  });

  test("inclut metrics.tsb pour reactiver detectFatigueTrend cote backend", () => {
    const session = makeSession({
      metrics: { atl: 300, ctl: 280, tsb: -20 },
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.metrics?.tsb).toBe(-20);
    expect(summary.metrics?.atl).toBe(300);
    expect(summary.metrics?.ctl).toBe(280);
  });

  test("inclut ai.rpe_target pour reactiver computeFeedbackAdjustments", () => {
    const session = makeSession({
      aiV2: { rpeTarget: 7 },
      feedback: { ...baseFeedback, rpe: 9 } as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.ai?.rpe_target).toBe(7);
  });

  test("session legacy (sans feedback / metrics / aiV2) ne plante pas", () => {
    const session = makeSession({
      feedback: undefined,
      metrics: undefined,
      aiV2: undefined,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.feedback).toBeUndefined();
    expect(summary.metrics).toBeUndefined();
    expect(summary.ai).toBeUndefined();
    expect(summary.rpe).toBe(0);
  });

  test("phase de la session prevaut sur fallbackPhase quand presente", () => {
    const session = makeSession({ phase: "Performance" });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.phase).toBe("performance");
  });

  test("pain absent -> ne pas envoyer feedback.pain (silence > faux signal)", () => {
    const session = makeSession({
      feedback: { ...baseFeedback, pain: undefined } as unknown as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.feedback?.pain).toBeUndefined();
    expect(summary.pain_level_after).toBeUndefined();
  });

  test("feedback.recovery_perceived part bien si session.feedback.recoveryPerceived est renseigne (verrou anti-regression)", () => {
    // Verrouille la lecture cote aiContextHelpers : le bug historique (design doc
    // INDIVIDUALISATION_FINE_DESIGN.md §1.3) etait cote ecriture (useFeedbackSave.ts
    // n'ecrivait jamais recoveryPerceived sur session.feedback, seulement `sleep`) —
    // verrouille separement dans screens/feedback/__tests__/feedbackScales.test.ts.
    // Ce test verrouille que, une fois le champ present sur la session, il part bien
    // au format backend attendu.
    const session = makeSession({
      feedback: { ...baseFeedback, recoveryPerceived: 4 } as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.feedback?.recovery_perceived).toBe(4);
  });

  test("feedback.recovery_perceived absent si session.feedback.sleep seul est renseigne (le champ legacy ne suffit pas)", () => {
    const session = makeSession({
      feedback: { ...baseFeedback, sleep: 2, recoveryPerceived: undefined } as unknown as SessionFeedback,
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.feedback?.recovery_perceived).toBeUndefined();
  });

  test("cycle et archetype_id partent depuis aiV2 (memoire anti-repetition moins aveugle)", () => {
    const session = makeSession({
      aiV2: { archetypeId: "force_lower_A", playerContext: { cycleKey: "force" } },
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.cycle).toBe("force");
    expect(summary.archetype_id).toBe("force_lower_A");
  });

  test("cycle et archetype_id absents si non portes par la session (jamais invente)", () => {
    const session = makeSession({ aiV2: undefined });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.cycle).toBeUndefined();
    expect(summary.archetype_id).toBeUndefined();
  });

  test("cycle lit aussi le snake_case backend brut (aiV2.playerContext.cycle_key)", () => {
    const session = makeSession({
      aiV2: { playerContext: { cycle_key: "endurance" } },
    });
    const summary = buildRecentFksSessionSummary(session, "playlist");
    expect(summary.cycle).toBe("endurance");
  });
});

describe("buildRecentFksSessionsPayload (limite + integration)", () => {
  test("limite par defaut a 8 sessions (alignement backend slice(0,8))", () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSession({
        id: `sess_${i}`,
        dateISO: `2026-04-${String(20 - i).padStart(2, "0")}T00:00:00.000Z`,
      })
    );
    const payload = buildRecentFksSessionsPayload(sessions, "playlist");
    expect(payload).toHaveLength(8);
  });

  test("respecte une limite explicite plus petite (1)", () => {
    const sessions = [makeSession(), makeSession({ id: "s2" })];
    expect(buildRecentFksSessionsPayload(sessions, "playlist", 1)).toHaveLength(1);
  });

  test("input vide -> tableau vide (aucun crash)", () => {
    expect(buildRecentFksSessionsPayload([], "playlist")).toEqual([]);
    expect(
      buildRecentFksSessionsPayload(undefined as unknown as Session[], "playlist")
    ).toEqual([]);
  });

  // Doctrine : aucune seance fictive ne remonte au moteur. Les anciennes
  // "seances de secours" fabriquees par l'app (supprimees le 27/07/2026)
  // portent un id `fallback_*` et le garde-fou `fallback_safe`.
  test("aucun recent_fks_session fictif : les anciennes seances de secours sont ecartees", () => {
    const secours = makeSession({
      id: "fallback_2026-04-20_ab12",
      dateISO: "2026-04-20T00:00:00.000Z",
    });
    const vraie = makeSession({ id: "sess_reelle", dateISO: "2026-04-19T00:00:00.000Z" });

    const payload = buildRecentFksSessionsPayload([secours, vraie], "playlist");

    expect(payload).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("fallback_");
  });

  test("garde-fou fallback_safe sans prefixe d'id : ecarte aussi", () => {
    const camouflee = makeSession({ id: "sess_camouflee" }) as any;
    camouflee.guardrailsApplied = ["fallback_safe"];

    expect(buildRecentFksSessionsPayload([camouflee], "playlist")).toEqual([]);
  });

  test("payload integre 8 sessions avec feedback.pain + metrics.tsb + rpe_target", () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeSession({
        id: `sess_${i}`,
        dateISO: `2026-04-${String(20 - i).padStart(2, "0")}T00:00:00.000Z`,
        feedback: { ...baseFeedback, rpe: 8, pain: 3 } as SessionFeedback,
        metrics: { atl: 300 + i, ctl: 280, tsb: -20 + i },
        aiV2: { rpeTarget: 6 },
      })
    );
    const payload = buildRecentFksSessionsPayload(sessions, "playlist");
    expect(payload).toHaveLength(8);

    payload.forEach((s) => {
      expect(s.feedback?.pain).toBe(6); // 3 * 2 = seuil backend pain_high
      expect(s.feedback?.rpe).toBe(8);
      expect(typeof s.metrics?.tsb).toBe("number");
      expect(s.ai?.rpe_target).toBe(6);
    });

    // Avec ce payload, computeFeedbackAdjustments backend devrait :
    // - calculer un rpe_delta moyen = +2 (rpe 8 vs target 6) -> trigger duration ×0.9 + cap easy
    // - voir 8 sessions avec pain >= 6 -> trigger pain_high (seuil >= 3) -> cap easy
    // - detectFatigueTrend recoit 8 points TSB exploitables -> calcul slope OK.
    const rpeDelta =
      payload.reduce((acc, s) => acc + (s.feedback!.rpe! - s.ai!.rpe_target!), 0) /
      payload.length;
    expect(rpeDelta).toBeCloseTo(2, 6);
    const painHigh = payload.filter((s) => (s.feedback?.pain ?? 0) >= 6).length;
    expect(painHigh).toBe(8);
  });
});

// -----------------------------------------------------------------------------
// Boucle de suivi joueur (Lot 6) -- point d'intégration mode Application dans
// buildAIPromptContext. Nécessite le flux Firestore complet -> mocks locaux
// (identiques à services/__tests__/painConstraints.test.ts). `mockUserProfile`
// est référencée par le nom (préfixe "mock") à l'intérieur des factories
// jest.mock : c'est l'échappatoire documentée de babel-plugin-jest-hoist pour
// des mocks paramétrables par test (sinon "out-of-scope variable" au hoist).
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
    // Profil Firestore paramétrable par test via mockUserProfile (cf. beforeEach ci-dessous).
    getDoc: jest.fn(async () => ({ exists: () => true, data: () => mockUserProfile })),
  };
  return new Proxy(overrides, {
    get: (target, prop: string) => (prop in target ? target[prop] : jest.fn()),
  });
});

// aiContext.ts require() ../services/analytics de façon différée (jamais en
// top-level, cf. commentaire dans aiContext.ts) uniquement quand le mode
// Application ajuste effectivement le contexte. On le mocke quand même ici :
// le vrai module entraîne @amplitude/analytics-react-native, qui embarque sa
// PROPRE copie imbriquée de @react-native-async-storage/async-storage que
// jest.setup.js ne peut pas mocker (résolution imbriquée, hors de portée du
// mock racine) -- exactement le problème documenté dans aiContext.ts.
jest.mock("../analytics", () => ({ __esModule: true, trackEvent: jest.fn() }));

import { buildAIPromptContext } from "../aiContext";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { useFeedbackStore } from "../../state/stores/useFeedbackStore";
import { useExecutionStore } from "../../state/stores/useExecutionStore";
import type { TrackingDecision } from "../../domain/tracking/types";

let mockUserProfile: Record<string, unknown> = {};

function makeReduceVolumeDecision(): TrackingDecision {
  return {
    version: 1,
    rulesVersion: "tracking-rules/1.0.0",
    decidedAtISO: "2026-07-20T10:00:00.000Z",
    kind: "reduce_volume_light",
    targets: [],
    explanation: "La dernière séance a été plus difficile que prévu.",
    signalsDigest: { completionRateAvg: 50, rpeDeltaAvg: null, painActive: false, gapDays: null, dataQuality: "ok" },
    mode: "shadow",
  };
}

describe("buildAIPromptContext — mode Application (boucle de suivi, Lot 6)", () => {
  beforeEach(() => {
    mockUserProfile = { available_time_min: 60 };
    useFeedbackStore.setState({ dayStates: {} } as any);
    useLoadStore.setState({ atl: 50, ctl: 60, tsb: 10 } as any);
    useSessionsStore.setState({ sessions: [], microcycleGoal: "fondation", microcycleSessionIndex: 0 } as any);
    useDebugStore.setState({ devNowISO: null } as any);
    useExecutionStore.setState({ lastDecision: null } as any);
  });

  test("pass-through par défaut (apply=false) : une décision stockée n'ajuste rien", async () => {
    useExecutionStore.setState({ lastDecision: makeReduceVolumeDecision() } as any);
    // mockUserProfile ne porte aucun trackingConfig -> défauts modes.ts (apply=false).
    const ctx = await buildAIPromptContext();
    expect(ctx.available_time_min).toBe(60);
  });

  test("apply=true + décision reduce_volume_light -> available_time_min réduit du facteur configuré (×0.9)", async () => {
    mockUserProfile = { available_time_min: 60, trackingConfig: { apply: true } };
    useExecutionStore.setState({ lastDecision: makeReduceVolumeDecision() } as any);
    const ctx = await buildAIPromptContext();
    expect(ctx.available_time_min).toBe(54);
  });

  test("apply=true mais aucune décision stockée -> pass-through (rien à appliquer)", async () => {
    mockUserProfile = { available_time_min: 60, trackingConfig: { apply: true } };
    const ctx = await buildAIPromptContext();
    expect(ctx.available_time_min).toBe(60);
  });
});
