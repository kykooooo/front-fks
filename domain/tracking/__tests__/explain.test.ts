// domain/tracking/__tests__/explain.test.ts
import { buildDecisionExplanation, decorateDecision } from "../explain";
import { TRACKING_CONFIG } from "../config";
import type { TrackingDecision, TrackingSignals } from "../types";

const NOW_ISO = "2026-07-25T12:00:00.000Z";

function baseSignals(overrides: Partial<TrackingSignals> = {}): TrackingSignals {
  return {
    dataQuality: "ok",
    sessionsAnalyzed: 3,
    completionRateAvg: 100,
    rpeDeltaAvg: 0,
    rpeDeltaCount: 3,
    durationRatioAvg: 1,
    timeConstrainedIncomplete: false,
    painSignal: { active: false, source: null, occurrences: 0 },
    repeatedDifficulty: { exerciseIds: [], families: [] },
    durableEquipmentIssues: [],
    gapDays: 2,
    streakOkSessions: 3,
    ...overrides,
  };
}

function baseDecision(kind: TrackingDecision["kind"], targets: string[] = []): TrackingDecision {
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
      gapDays: null,
      dataQuality: "ok",
    },
    mode: "shadow",
  };
}

describe("buildDecisionExplanation -- un gabarit par decision, instancie avec des donnees reelles", () => {
  it("continue_planned (defaut, regle 11) mentionne le nombre reel de seances", () => {
    const signals = baseSignals({ sessionsAnalyzed: 4 });
    const phrase = buildDecisionExplanation(baseDecision("continue_planned"), signals);
    expect(phrase).toContain("4");
    expect(phrase.toLowerCase()).toContain("progression");
  });

  it("continue_planned (marge, regle 10) mentionne l'ecart reel et parle de petit pas", () => {
    const signals = baseSignals({
      sessionsAnalyzed: 3,
      rpeDeltaAvg: TRACKING_CONFIG.rpe.lowDelta,
      rpeDeltaCount: 3,
      streakOkSessions: TRACKING_CONFIG.progression.minStreakForSmallStep,
      completionRateAvg: TRACKING_CONFIG.completion.fullPct,
    });
    const phrase = buildDecisionExplanation(baseDecision("continue_planned"), signals);
    expect(phrase).toContain("3");
    expect(phrase).toContain(String(TRACKING_CONFIG.rpe.lowDelta));
    expect(phrase.toLowerCase()).toContain("petit pas");
  });

  it("hold_dose evoque un cas isole, sans inventer de raison", () => {
    const phrase = buildDecisionExplanation(baseDecision("hold_dose"), baseSignals());
    expect(phrase.toLowerCase()).toContain("cas isolé");
  });

  it("reduce_intensity_light/reduce_volume_light instancient le delta rpe reel et le nombre de seances", () => {
    const signals = baseSignals({ rpeDeltaAvg: 2.5, rpeDeltaCount: 4 });
    const intensity = buildDecisionExplanation(baseDecision("reduce_intensity_light"), signals);
    const volume = buildDecisionExplanation(baseDecision("reduce_volume_light"), signals);
    expect(intensity).toContain("2.5");
    expect(intensity).toContain("4");
    expect(volume).toContain("2.5");
    expect(volume).toContain("4");
  });

  it("reduce_* reste honnete si le delta est absent (jamais de raison inventee)", () => {
    const phrase = buildDecisionExplanation(baseDecision("reduce_volume_light"), baseSignals({ rpeDeltaAvg: null }));
    expect(phrase).not.toContain("null");
    expect(phrase.length).toBeGreaterThan(0);
  });

  it("suggest_variant mentionne l'exercice cible reel et le seuil configure", () => {
    const signals = baseSignals({ repeatedDifficulty: { exerciseIds: ["plyo_box_jump"], families: ["plyo"] } });
    const phrase = buildDecisionExplanation(baseDecision("suggest_variant", ["plyo_box_jump"]), signals);
    expect(phrase).toContain("plyo_box_jump");
    expect(phrase).toContain(String(TRACKING_CONFIG.difficulty.repeatThreshold));
  });

  it("prefer_replacement mentionne l'exercice cible reel et le seuil configure", () => {
    const signals = baseSignals({ durableEquipmentIssues: ["str_bench"] });
    const phrase = buildDecisionExplanation(baseDecision("prefer_replacement", ["str_bench"]), signals);
    expect(phrase).toContain("str_bench");
    expect(phrase).toContain(String(TRACKING_CONFIG.equipment.durableThreshold));
  });

  it("resume_mode (soft) mentionne le nombre de jours reel sans parler de fondations", () => {
    const signals = baseSignals({ gapDays: 15 });
    const phrase = buildDecisionExplanation(baseDecision("resume_mode"), signals);
    expect(phrase).toContain("15");
    expect(phrase.toLowerCase()).not.toContain("fondation");
  });

  it("resume_mode (hard) mentionne le nombre de jours reel et les fondations", () => {
    const signals = baseSignals({ gapDays: 30 });
    const phrase = buildDecisionExplanation(baseDecision("resume_mode"), signals);
    expect(phrase).toContain("30");
    expect(phrase.toLowerCase()).toContain("fondation");
  });

  it("keep_despite_time parle de manque de temps, jamais d'incapacite physique", () => {
    const phrase = buildDecisionExplanation(baseDecision("keep_despite_time"), baseSignals());
    expect(phrase.toLowerCase()).toContain("temps");
    expect(phrase.toLowerCase()).not.toContain("incapacite");
  });

  it("block_increase_pain mentionne le nombre reel d'occurrences si connu", () => {
    const signals = baseSignals({ painSignal: { active: true, source: "feedback", occurrences: 2 } });
    const phrase = buildDecisionExplanation(baseDecision("block_increase_pain"), signals);
    expect(phrase).toContain("2");
    expect(phrase.toLowerCase()).toContain("gêne");
  });

  it("standard_insufficient_data (insufficient) dit honnetement qu'il manque de donnees", () => {
    const phrase = buildDecisionExplanation(
      baseDecision("standard_insufficient_data"),
      baseSignals({ dataQuality: "insufficient" })
    );
    expect(phrase.toLowerCase()).toContain("pas encore assez");
  });

  it("standard_insufficient_data (inconsistent) dit honnetement que les donnees semblent incoherentes", () => {
    const phrase = buildDecisionExplanation(
      baseDecision("standard_insufficient_data"),
      baseSignals({ dataQuality: "inconsistent" })
    );
    expect(phrase.toLowerCase()).toContain("incohérentes");
  });
});

describe("decorateDecision", () => {
  it("retourne la decision avec l'explanation remplie, sans muter l'original", () => {
    const decision = baseDecision("hold_dose");
    const decorated = decorateDecision(decision, baseSignals());
    expect(decision.explanation).toBe("");
    expect(decorated.explanation.length).toBeGreaterThan(0);
    expect(decorated.kind).toBe(decision.kind);
    expect(decorated.rulesVersion).toBe(decision.rulesVersion);
  });
});
