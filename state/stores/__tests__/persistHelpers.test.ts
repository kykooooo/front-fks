// state/stores/__tests__/persistHelpers.test.ts
//
// Verifie que la persistance Firestore inclut bien les champs critiques pour
// reactiver computeFeedbackAdjustments + detectFatigueTrend cote backend
// (../fks/src/fksOrchestrator.ts:328-376 et ../fks/src/fksUtils.ts:62-120).
//
// Sans ces champs persistes, les sessions rechargees au prochain login perdraient
// les signaux fatigue/RPE et le pont front->backend retomberait muet.

import {
  buildCompletedSessionFirestorePayload,
  computePlannedClientGuardrails,
  resolvePlannedPersistGuardrails,
  buildPlannedSessionFirestorePayload,
} from "../persistHelpers";
import type { Session, SessionFeedback } from "../../../domain/types";

describe("buildPlannedSessionFirestorePayload — blueprint IA conservé", () => {
  const resolved = { intensity: "moderate", plannedLoad: 30, clientTokens: ["client:club_proximity_reduction"] };
  const baseRest = {
    id: "sess_1",
    dateISO: "2026-06-03",
    phase: "Construction",
    focus: "strength",
    exercises: [],
  };

  test("aiV2 mais pas ai → le doc contient `ai` (blueprint non perdu)", () => {
    const v2 = { title: "Force bas du corps", durationMin: 45, blocks: [{}, {}, {}], guardrails_applied: ["age:U15_duration_cap"] };
    const out = buildPlannedSessionFirestorePayload({ ...baseRest, aiV2: v2 }, resolved);
    expect(out.ai).toBe(v2);
    expect((out.ai as any).blocks).toHaveLength(3); // blockCount lisible côté Coach Visibility
    expect((out.ai as any).title).toBe("Force bas du corps");
  });

  test("`ai` prioritaire sur `aiV2`", () => {
    const ai = { title: "AI prioritaire" };
    const aiV2 = { title: "aiV2 secondaire" };
    const out = buildPlannedSessionFirestorePayload({ ...baseRest, ai, aiV2 }, resolved);
    expect(out.ai).toBe(ai);
  });

  test("top-level utiles persistés (title/durationMin/rpeTarget/location/badges)", () => {
    const out = buildPlannedSessionFirestorePayload(
      { ...baseRest, title: "Séance Force", durationMin: 50, rpeTarget: 7, location: "gym", badges: ["force"] },
      resolved,
    );
    expect(out.title).toBe("Séance Force");
    expect(out.durationMin).toBe(50);
    expect(out.rpeTarget).toBe(7);
    expect(out.location).toBe("gym");
    expect(out.badges).toEqual(["force"]);
  });

  test("tokens backend + client persistés", () => {
    const out = buildPlannedSessionFirestorePayload(
      { ...baseRest, guardrailsApplied: ["club:heavy_week_adjustment"] },
      resolved,
    );
    expect(out.guardrailsApplied).toEqual(["club:heavy_week_adjustment"]);
    expect(out.clientGuardrailsApplied).toEqual(["client:club_proximity_reduction"]);
  });

  test("legacy sans ai/aiV2 → fallback propre (pas de clé `ai`, doc valide)", () => {
    const out = buildPlannedSessionFirestorePayload(baseRest, { intensity: "easy", plannedLoad: 20, clientTokens: [] });
    expect(out.ai).toBeUndefined();
    expect(out.clientGuardrailsApplied).toBeUndefined();
    expect(out.intensity).toBe("easy");
    expect(out.plannedLoad).toBe(20);
    expect(out.date).toBe("2026-06-03");
  });

  test("ne persiste pas de durée/title vides", () => {
    const out = buildPlannedSessionFirestorePayload({ ...baseRest, title: "  ", durationMin: NaN as any }, resolved);
    expect(out.title).toBeUndefined();
    expect(out.durationMin).toBeUndefined();
  });
});

describe("resolvePlannedPersistGuardrails — application UNIQUE (pas de double réduction)", () => {
  test("payload déjà calculé (orchestrator) → plannedLoad inchangé même si club/tsb présents", () => {
    const r = resolvePlannedPersistGuardrails({
      precomputed: true,
      intensity: "easy",
      plannedLoad: 27, // déjà réduit en amont (45 × 0.6)
      clientGuardrailsApplied: ["client:club_proximity_reduction", "client:load_high_forced_easy"],
      clubToday: true, // contexte qui DÉCLENCHERAIT une réduction si on recomputait
      clubTomorrow: false,
      tsb: -20,
    });
    expect(r.plannedLoad).toBe(27); // PAS 16 → pas de seconde réduction
    expect(r.intensity).toBe("easy");
    expect(r.clientTokens).toEqual(["client:club_proximity_reduction", "client:load_high_forced_easy"]);
  });

  test("payload legacy (sans flag) → sécurisé UNE fois", () => {
    const r = resolvePlannedPersistGuardrails({
      precomputed: false,
      intensity: "hard",
      plannedLoad: 45,
      clubToday: true,
      clubTomorrow: false,
      tsb: -20,
    });
    expect(r.plannedLoad).toBe(27); // 45 × 0.6, appliqué une seule fois
    expect(r.intensity).toBe("easy");
    expect(r.clientTokens).toEqual(["client:club_proximity_reduction", "client:load_high_forced_easy"]);
  });

  test("legacy sans clientGuardrailsApplied → fallback liste vide, pas de crash", () => {
    const r = resolvePlannedPersistGuardrails({
      precomputed: true,
      intensity: "moderate",
      plannedLoad: 40,
      clubToday: false,
      clubTomorrow: false,
      tsb: 5,
    });
    expect(r.clientTokens).toEqual([]);
    expect(r.plannedLoad).toBe(40);
  });

  test("double application explicite : orchestrator puis persist == une seule réduction", () => {
    // 1) orchestrator
    const g = computePlannedClientGuardrails({ clubToday: true, clubTomorrow: false, tsb: -20, intensity: "hard" });
    const afterOrchestrator = Math.max(1, Math.round(45 * g.guardFactor)); // 27
    // 2) persist (precomputed) ne doit pas re-réduire
    const r = resolvePlannedPersistGuardrails({
      precomputed: true,
      intensity: g.intensity,
      plannedLoad: afterOrchestrator,
      clientGuardrailsApplied: g.clientTokens,
      clubToday: true,
      clubTomorrow: false,
      tsb: -20,
    });
    expect(afterOrchestrator).toBe(27);
    expect(r.plannedLoad).toBe(27);
  });
});

describe("computePlannedClientGuardrails — tokens stables (pas de texte coach)", () => {
  test("proximité club : token + hard→moderate + facteur 0.75", () => {
    const r = computePlannedClientGuardrails({ clubToday: true, clubTomorrow: false, tsb: 5, intensity: "hard" });
    expect(r.clientTokens).toEqual(["client:club_proximity_reduction"]);
    expect(r.intensity).toBe("moderate");
    expect(r.guardFactor).toBeCloseTo(0.75, 5);
  });

  test("charge élevée (tsb < -10) : easy forcé + facteur 0.8, AUCUN texte 'TSB'", () => {
    const r = computePlannedClientGuardrails({ clubToday: false, clubTomorrow: false, tsb: -15, intensity: "hard" });
    expect(r.clientTokens).toContain("client:load_high_forced_easy");
    expect(r.intensity).toBe("easy");
    expect(r.guardFactor).toBeCloseTo(0.8, 5);
    // Garantie clé : on ne persiste jamais de TSB en clair.
    expect(r.clientTokens.join(" ")).not.toMatch(/tsb/i);
  });

  test("tsb négatif léger + hard → moderate (token dédié)", () => {
    const r = computePlannedClientGuardrails({ clubToday: false, clubTomorrow: false, tsb: -3, intensity: "hard" });
    expect(r.clientTokens).toEqual(["client:load_negative_intensity_reduced"]);
    expect(r.intensity).toBe("moderate");
  });

  test("contexte neutre : aucun token, intensité inchangée", () => {
    const r = computePlannedClientGuardrails({ clubToday: false, clubTomorrow: false, tsb: 10, intensity: "moderate" });
    expect(r.clientTokens).toEqual([]);
    expect(r.intensity).toBe("moderate");
    expect(r.guardFactor).toBe(1);
  });

  test("cumul club + charge : deux tokens, facteur combiné, aucun texte lisible", () => {
    const r = computePlannedClientGuardrails({ clubToday: true, clubTomorrow: false, tsb: -20, intensity: "hard" });
    expect(r.clientTokens).toEqual(["client:club_proximity_reduction", "client:load_high_forced_easy"]);
    expect(r.intensity).toBe("easy");
    expect(r.guardFactor).toBeCloseTo(0.6, 5);
    expect(r.clientTokens.every((t) => t.startsWith("client:"))).toBe(true);
  });
});

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
