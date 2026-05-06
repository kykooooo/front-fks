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

// On importe depuis le module pur `aiContextHelpers` plutot que `aiContext`
// pour eviter que jest charge la dependance firebase ESM (mocker firebase ici
// serait du bruit qui n'a rien a voir avec la logique testee).
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
