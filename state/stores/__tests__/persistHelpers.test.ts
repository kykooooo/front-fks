// state/stores/__tests__/persistHelpers.test.ts
//
// Verifie que la persistance Firestore inclut bien les champs critiques pour
// reactiver computeFeedbackAdjustments + detectFatigueTrend cote backend
// (../fks/src/fksOrchestrator.ts:328-376 et ../fks/src/fksUtils.ts:62-120).
//
// Sans ces champs persistes, les sessions rechargees au prochain login perdraient
// les signaux fatigue/RPE et le pont front->backend retomberait muet.

import { buildCompletedSessionFirestorePayload } from "../persistHelpers";
import type { Session, SessionFeedback } from "../../../domain/types";

const baseFeedback: SessionFeedback = {
  rpe: 8,
  fatigue: 4,
  sleep: 3,
  pain: 3,
  createdAt: "2026-04-20T18:30:00.000Z",
} as SessionFeedback;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? "sess_test",
    dateISO: "2026-04-20T00:00:00.000Z",
    date: "2026-04-20",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: true,
    rpe: 8,
    ...overrides,
  } as Session;
}

describe("buildCompletedSessionFirestorePayload", () => {
  test("inclut metrics.atl/ctl/tsb (snapshot charge au feedback)", () => {
    const s = makeSession({
      feedback: baseFeedback,
      metrics: { atl: 320, ctl: 290, tsb: -30 },
    });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect(payload.metrics).toEqual({ atl: 320, ctl: 290, tsb: -30 });
  });

  test("inclut aiV2 (porte rpeTarget pour le backend)", () => {
    const aiV2 = { rpeTarget: 7, title: "Force bas du corps" };
    const s = makeSession({ feedback: baseFeedback, aiV2 });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect(payload.aiV2).toEqual(aiV2);
  });

  test("inclut feedback.rpe (et pas seulement session.rpe)", () => {
    const s = makeSession({ feedback: { ...baseFeedback, rpe: 9 } as SessionFeedback });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect((payload.feedback as Record<string, unknown>)?.rpe).toBe(9);
  });

  test("inclut feedback.createdAt et durationMin si presents", () => {
    const s = makeSession({
      feedback: {
        ...baseFeedback,
        createdAt: "2026-04-20T19:00:00.000Z",
        durationMin: 48,
      } as SessionFeedback,
    });
    const fb = buildCompletedSessionFirestorePayload(s).feedback as Record<string, unknown>;
    expect(fb.createdAt).toBe("2026-04-20T19:00:00.000Z");
    expect(fb.durationMin).toBe(48);
  });

  test("session sans metrics ne plante pas (rétrocompat sessions legacy)", () => {
    const s = makeSession({ feedback: baseFeedback, metrics: undefined });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect(payload.metrics).toBeUndefined();
    expect(payload.feedback).toBeDefined();
  });

  test("session sans aiV2 ne plante pas", () => {
    const s = makeSession({ feedback: baseFeedback, aiV2: undefined });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect(payload.aiV2).toBeUndefined();
  });

  test("session sans feedback (incompléte) ne plante pas", () => {
    const s = makeSession({ feedback: undefined });
    const payload = buildCompletedSessionFirestorePayload(s);
    expect(payload.feedback).toBeUndefined();
    expect(payload.exercises).toBeDefined();
  });

  test("metrics partielles (NaN ignore) — aucun champ NaN persiste", () => {
    const s = makeSession({
      feedback: baseFeedback,
      metrics: { atl: 200, ctl: Number.NaN as unknown as number, tsb: 5 },
    });
    const m = buildCompletedSessionFirestorePayload(s).metrics as Record<string, unknown>;
    expect(m).toEqual({ atl: 200, tsb: 5 });
  });

  test("payload integral exemple : pont front->back operationnel", () => {
    const s = makeSession({
      feedback: { ...baseFeedback, rpe: 9, pain: 4 } as SessionFeedback,
      metrics: { atl: 350, ctl: 280, tsb: -70 },
      aiV2: { rpeTarget: 7, title: "Duels & puissance" },
    });
    const p = buildCompletedSessionFirestorePayload(s);

    // 3 signaux critiques presents apres reload Firestore :
    expect((p.feedback as Record<string, unknown>).rpe).toBe(9);
    expect((p.feedback as Record<string, unknown>).pain).toBe(4); // echelle 0-5 conservée à la persistance
    expect((p.metrics as Record<string, unknown>).tsb).toBe(-70);
    expect((p.aiV2 as Record<string, unknown>).rpeTarget).toBe(7);
  });
});
