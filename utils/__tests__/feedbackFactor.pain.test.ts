// utils/__tests__/feedbackFactor.pain.test.ts
//
// Tests dédiés au `painFactor` sur l'échelle EVA 0-10 unifiée
// (fix critique MVP blessures — voir INJURY_IA_CHARTER.md règle 5).
//
// Ces tests couvrent le rescalage `PAIN_THRESHOLDS.smallEffectFrom: 3 → 6`
// et `FEEDBACK_LIMITS.painMax: 5 → 10`. Ils sont isolés des tests fatigue/EMA
// qui vivent dans `feedbackFactor.test.ts` (fichier séparé, non couvert par
// cette session).

import { computeAdaptiveFactors } from "../feedbackFactor";

describe("computeAdaptiveFactors — painFactor (échelle EVA 0-10, threshold 6)", () => {
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
    // pain=10 is the maximum: t = (10-6)/(10-6) = 1, reduction = maxReduction (5%)
    const r = computeAdaptiveFactors({ fatigue: 3, pain: 10 });
    expect(r.painFactor).toBeCloseTo(0.95, 2);
  });
});
