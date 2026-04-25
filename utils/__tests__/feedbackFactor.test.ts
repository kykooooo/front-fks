import { computeAdaptiveFactors } from "../feedbackFactor";

describe("computeAdaptiveFactors", () => {
  // ─── Fatigue factor ─────────────────────────────────────────────
  it("returns factor ~1.0 for neutral fatigue (3)", () => {
    const r = computeAdaptiveFactors({ fatigue: 3 });
    expect(r.fatigueFactor).toBeCloseTo(1.0, 2);
  });

  it("returns factor ~0.92 for minimum fatigue (1)", () => {
    // Fatigue 1 = very fresh -> load reduction (0.92)
    const r = computeAdaptiveFactors({ fatigue: 1 });
    expect(r.fatigueFactor).toBeCloseTo(0.92, 1);
    expect(r.fatigueFactor).toBeLessThan(1.0);
  });

  it("returns factor ~1.08 for maximum fatigue (5)", () => {
    // Fatigue 5 = very tired -> load amplification (1.08)
    const r = computeAdaptiveFactors({ fatigue: 5 });
    expect(r.fatigueFactor).toBeCloseTo(1.08, 1);
    expect(r.fatigueFactor).toBeGreaterThan(1.0);
  });

  it("returns factor between 0.92 and 1.0 for fatigue 2", () => {
    const r = computeAdaptiveFactors({ fatigue: 2 });
    expect(r.fatigueFactor).toBeGreaterThanOrEqual(0.92);
    expect(r.fatigueFactor).toBeLessThan(1.0);
  });

  // ─── Pain factor ────────────────────────────────────────────────
  // ─── Pain factor (échelle EVA 0-10, threshold 6 = milieu) ─────
  it("returns painFactor 1.0 when no pain", () => {
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 0 });
    expect(r.painFactor).toBe(1.0);
  });

  it("returns painFactor 1.0 for pain below threshold (< 6)", () => {
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 4 });
    expect(r.painFactor).toBe(1.0);
  });

  it("returns painFactor 1.0 at pain threshold (6) since reduction starts from 6", () => {
    // pain=6 is the threshold start: t = (6-6)/(10-6) = 0, reduction = 0
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 6 });
    expect(r.painFactor).toBe(1.0);
  });

  it("returns painFactor < 1.0 for pain > 6", () => {
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 8 });
    expect(r.painFactor).toBeLessThan(1.0);
  });

  it("returns painFactor ~0.95 for maximum pain (10)", () => {
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 10 });
    expect(r.painFactor).toBeCloseTo(0.95, 2);
  });

  // ─── Combined factor ────────────────────────────────────────────
  it("combined = fatigueFactor * painFactor", () => {
    // fatigue 5 (max) + pain 10 (max EVA) = stress maximal
    const r = computeAdaptiveFactors({ fatigue: 5, pain: 10 });
    expect(r.combined).toBeCloseTo(r.fatigueFactor * r.painFactor, 3);
  });

  it("combined is 1.0 for perfectly neutral input", () => {
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 0 });
    expect(r.combined).toBeCloseTo(1.0, 2);
  });

  // ─── EMA smoothing ─────────────────────────────────────────────
  it("uses prevFatigueSmoothed for EMA", () => {
    // With prev=1 and current=5, EMA should be between 1 and 5
    const r = computeAdaptiveFactors({ fatigue: 5, prevFatigueSmoothed: 1 });
    expect(r.fatigueSmoothed).toBeGreaterThan(1);
    expect(r.fatigueSmoothed).toBeLessThan(5);
  });

  it("seeds EMA at 3 when no prev value", () => {
    // First entry with fatigue=5, EMA should blend with seed=3
    const r = computeAdaptiveFactors({ fatigue: 5, prevFatigueSmoothed: null });
    expect(r.fatigueSmoothed).toBeGreaterThan(3);
    expect(r.fatigueSmoothed).toBeLessThan(5);
  });
});
