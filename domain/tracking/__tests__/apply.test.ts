// domain/tracking/__tests__/apply.test.ts
import { applyDecisionToContext } from "../apply";
import { TRACKING_CONFIG } from "../config";
import type { TrackingDecision, TrackingDecisionKind } from "../types";
import type { FKS_AiContext } from "../../../services/aiContext";

const NOW_ISO = "2026-07-25T12:00:00.000Z";

const ALL_KINDS: TrackingDecisionKind[] = [
  "continue_planned",
  "hold_dose",
  "reduce_volume_light",
  "reduce_intensity_light",
  "suggest_variant",
  "prefer_replacement",
  "resume_mode",
  "keep_despite_time",
  "block_increase_pain",
  "standard_insufficient_data",
];

function makeContext(overrides: Partial<FKS_AiContext> = {}): FKS_AiContext {
  return {
    version: "fks_context_v1",
    profile: {
      first_name: "Kyllian",
      level: "amateur",
      position: "milieu",
      dominant_foot: "right",
      age_category: null,
      club_trainings_per_week: 3,
      matches_per_week: 1,
      target_fks_sessions_per_week: 3,
      main_objective: "performance",
      goal: "force",
      microcycle_goal: "force",
    },
    goal: "force",
    available_time_min: 60,
    phase: "progression",
    constraints: {
      equipment: ["dumbbell", "bench"],
      pains: [],
    },
    metrics: { atl: 40, ctl: 35, tsb: -5 },
    recent_fks_sessions: [],
    equipment_available: ["dumbbell", "bench", "pull_up_bar"],
    ...overrides,
  };
}

function makeDecision(
  kind: TrackingDecisionKind,
  targets: string[] = [],
  gapDays: number | null = null
): TrackingDecision {
  return {
    version: 1,
    rulesVersion: TRACKING_CONFIG.rulesVersion,
    decidedAtISO: NOW_ISO,
    kind,
    targets,
    explanation: "",
    signalsDigest: {
      completionRateAvg: null,
      rpeDeltaAvg: null,
      painActive: false,
      gapDays,
      dataQuality: "ok",
    },
    mode: "shadow",
  };
}

describe("applyDecisionToContext -- reduce_volume_light", () => {
  it("reduit available_time_min du facteur configure et le trace dans applied", () => {
    const context = makeContext({ available_time_min: 60 });
    const { context: next, applied } = applyDecisionToContext(context, makeDecision("reduce_volume_light"));
    expect(next.available_time_min).toBe(Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor));
    expect(applied).toEqual(["reduce_volume_light"]);
  });

  it("ne fait rien si available_time_min est absent (pas d'invention de valeur)", () => {
    const context = makeContext({ available_time_min: null });
    const { context: next, applied } = applyDecisionToContext(context, makeDecision("reduce_volume_light"));
    expect(next.available_time_min).toBeNull();
    expect(applied).toEqual([]);
  });
});

describe("applyDecisionToContext -- reduce_intensity_light (persistance >= 2 fenetres)", () => {
  it("premier declenchement (pas d'historique fourni) : ne change rien au contexte, trace seulement le declenchement", () => {
    const context = makeContext();
    const { context: next, applied } = applyDecisionToContext(context, makeDecision("reduce_intensity_light"));
    expect(next).toEqual(context);
    expect(applied).toEqual(["reduce_intensity_light_noted"]);
  });

  it("decision precedente la plus recente = reduce_intensity_light -> reduction de duree (persistance)", () => {
    const context = makeContext({ available_time_min: 60 });
    const previous = makeDecision("reduce_intensity_light");
    const { context: next, applied } = applyDecisionToContext(
      context,
      makeDecision("reduce_intensity_light"),
      TRACKING_CONFIG,
      [],
      { previousDecisions: [previous] }
    );
    expect(next.available_time_min).toBe(Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor));
    expect(applied).toEqual(["reduce_intensity_persistent_time_reduced"]);
  });

  it("decision precedente la plus recente = reduce_volume_light compte aussi comme persistance", () => {
    const context = makeContext({ available_time_min: 60 });
    const previous = makeDecision("reduce_volume_light");
    const { context: next, applied } = applyDecisionToContext(
      context,
      makeDecision("reduce_intensity_light"),
      TRACKING_CONFIG,
      [],
      { previousDecisions: [previous] }
    );
    expect(next.available_time_min).toBe(Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor));
    expect(applied).toContain("reduce_intensity_persistent_time_reduced");
  });

  it("decision precedente d'un autre type -> pas de persistance, no-op comme au premier declenchement", () => {
    const context = makeContext({ available_time_min: 60 });
    const previous = makeDecision("continue_planned");
    const { context: next, applied } = applyDecisionToContext(
      context,
      makeDecision("reduce_intensity_light"),
      TRACKING_CONFIG,
      [],
      { previousDecisions: [previous] }
    );
    expect(next).toEqual(context);
    expect(applied).toEqual(["reduce_intensity_light_noted"]);
  });

  it("ne cumule jamais deux facteurs de reduction dans un seul appel (un seul facteur, pas au carre)", () => {
    const context = makeContext({ available_time_min: 60 });
    const previous = makeDecision("reduce_intensity_light");
    const { context: next } = applyDecisionToContext(
      context,
      makeDecision("reduce_intensity_light"),
      TRACKING_CONFIG,
      [],
      { previousDecisions: [previous] }
    );
    const singleFactor = Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor);
    const doubleFactor = Math.round(
      60 * TRACKING_CONFIG.apply.volumeReductionFactor * TRACKING_CONFIG.apply.volumeReductionFactor
    );
    expect(next.available_time_min).toBe(singleFactor);
    expect(next.available_time_min).not.toBe(doubleFactor);
  });
});

describe("applyDecisionToContext -- resume_mode (severite lue depuis signalsDigest.gapDays)", () => {
  it("gapDays >= gapDaysHard (reprise dure, regle 2) : recommend_fondation + duree reduite, goal/phase jamais switches silencieusement", () => {
    const context = makeContext({ goal: "force", phase: "progression", available_time_min: 60 });
    const decision = makeDecision("resume_mode", [], TRACKING_CONFIG.resumption.gapDaysHard);
    const { context: next, applied } = applyDecisionToContext(context, decision);
    expect(next.goal).toBe("force");
    expect(next.phase).toBe("progression");
    expect(next.profile.microcycle_goal).toBe("force");
    expect(applied).toContain("recommend_fondation");
    expect(applied).toContain("resume_hard_time_reduced");
    expect(next.available_time_min).toBe(Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor));
  });

  it("gapDays < gapDaysHard (reprise douce, regle 3) : cycle CONSERVE (pas de recommend_fondation), seulement duree reduite", () => {
    const context = makeContext({ goal: "force", phase: "progression", available_time_min: 60 });
    const decision = makeDecision("resume_mode", [], TRACKING_CONFIG.resumption.gapDaysSoft);
    const { context: next, applied } = applyDecisionToContext(context, decision);
    expect(next.goal).toBe("force");
    expect(next.phase).toBe("progression");
    expect(applied).not.toContain("recommend_fondation");
    expect(applied).toEqual(["resume_soft_time_reduced"]);
    expect(next.available_time_min).toBe(Math.round(60 * TRACKING_CONFIG.apply.volumeReductionFactor));
  });

  it("gapDays absent (null) dans le digest : pass-through prudent, aucun ajustement", () => {
    const context = makeContext({ available_time_min: 60 });
    const decision = makeDecision("resume_mode", [], null);
    const { context: next, applied } = applyDecisionToContext(context, decision);
    expect(next).toEqual(context);
    expect(applied).toEqual([]);
  });
});

describe("applyDecisionToContext -- prefer_replacement", () => {
  it("sans unavailableEquipment : aucun changement, applied vide", () => {
    const context = makeContext();
    const { context: next, applied } = applyDecisionToContext(context, makeDecision("prefer_replacement", ["str_bench"]));
    expect(next).toEqual(context);
    expect(applied).toEqual([]);
  });

  it("avec unavailableEquipment : retire le materiel de constraints.equipment ET equipment_available", () => {
    const context = makeContext({
      constraints: { equipment: ["dumbbell", "bench"], pains: [] },
      equipment_available: ["dumbbell", "bench", "pull_up_bar"],
    });
    const { context: next, applied } = applyDecisionToContext(
      context,
      makeDecision("prefer_replacement", ["str_bench"]),
      TRACKING_CONFIG,
      ["bench"]
    );
    expect(next.constraints?.equipment).toEqual(["dumbbell"]);
    expect(next.equipment_available).toEqual(["dumbbell", "pull_up_bar"]);
    expect(applied).toEqual(["prefer_replacement"]);
    // l'original n'est jamais mute
    expect(context.constraints?.equipment).toEqual(["dumbbell", "bench"]);
    expect(context.equipment_available).toEqual(["dumbbell", "bench", "pull_up_bar"]);
  });
});

describe("applyDecisionToContext -- block_increase_pain", () => {
  it("trace la verification sans ajouter de nouvelle donnee de douleur", () => {
    const context = makeContext({ constraints: { equipment: [], pains: ["genou"] } });
    const { context: next, applied } = applyDecisionToContext(context, makeDecision("block_increase_pain"));
    expect(next.constraints?.pains).toEqual(["genou"]);
    expect(applied).toEqual(["pain_guard_checked"]);
  });

  it("signale si pains est vide alors que la decision est block_increase_pain", () => {
    const context = makeContext({ constraints: { equipment: [], pains: [] } });
    const { applied } = applyDecisionToContext(context, makeDecision("block_increase_pain"));
    expect(applied).toContain("pain_guard_missing_pains");
  });
});

describe("applyDecisionToContext -- pass-through strict pour les autres decisions", () => {
  it.each(["continue_planned", "hold_dose", "keep_despite_time", "suggest_variant", "standard_insufficient_data"] as const)(
    "%s : copie identique, applied vide",
    (kind) => {
      const context = makeContext();
      const { context: next, applied } = applyDecisionToContext(context, makeDecision(kind));
      expect(next).toEqual(context);
      expect(next).not.toBe(context); // copie, pas la meme reference
      expect(applied).toEqual([]);
    }
  );
});

describe("applyDecisionToContext -- purete (pas de mutation de l'original)", () => {
  it.each(ALL_KINDS)("%s ne mute jamais le contexte passe en entree", (kind) => {
    const context = makeContext();
    const snapshot = JSON.parse(JSON.stringify(context));
    applyDecisionToContext(context, makeDecision(kind, ["str_bench"]), TRACKING_CONFIG, ["bench"]);
    expect(context).toEqual(snapshot);
  });
});

describe("applyDecisionToContext -- invariant neverIncreaseBeyondPlan", () => {
  it.each(ALL_KINDS)(
    "%s : ne produit jamais un available_time_min plus grand, ne retire jamais de pains, ne touche jamais phase/goal/metrics",
    (kind) => {
      const context = makeContext({
        available_time_min: 50,
        phase: "deload",
        constraints: { equipment: ["dumbbell"], pains: ["genou", "cheville"] },
      });
      const { context: next } = applyDecisionToContext(context, makeDecision(kind, ["str_bench"]), TRACKING_CONFIG, ["dumbbell"]);

      if (typeof next.available_time_min === "number" && typeof context.available_time_min === "number") {
        expect(next.available_time_min).toBeLessThanOrEqual(context.available_time_min);
      }
      // jamais de pain retire (l'ensemble original reste inclus)
      for (const pain of context.constraints?.pains ?? []) {
        expect(next.constraints?.pains ?? []).toContain(pain);
      }
      expect(next.phase).toBe(context.phase); // deload jamais retire
      expect(next.goal).toBe(context.goal);
      expect(next.profile).toEqual(context.profile);
      expect(next.metrics).toEqual(context.metrics);
    }
  );
});
