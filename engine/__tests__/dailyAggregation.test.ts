import { diffDays, clampDailyLoad } from "../dailyAggregation";

// ─── diffDays ───────────────────────────────────────────────────────
describe("diffDays", () => {
  it("returns 0 for same day", () => {
    expect(diffDays("2025-04-11", "2025-04-11")).toBe(0);
  });

  it("returns 1 for next day", () => {
    expect(diffDays("2025-04-11", "2025-04-12")).toBe(1);
  });

  it("returns -1 for previous day", () => {
    expect(diffDays("2025-04-12", "2025-04-11")).toBe(-1);
  });

  it("returns correct count for multi-day span", () => {
    expect(diffDays("2025-04-01", "2025-04-11")).toBe(10);
  });

  it("handles month boundaries", () => {
    expect(diffDays("2025-03-31", "2025-04-01")).toBe(1);
  });

  it("handles year boundaries", () => {
    expect(diffDays("2024-12-31", "2025-01-01")).toBe(1);
  });

  it("returns 0 for invalid input", () => {
    expect(diffDays("", "2025-04-11")).toBe(0);
  });
});

// ─── clampDailyLoad ─────────────────────────────────────────────────
describe("clampDailyLoad", () => {
  it("passes through values well below cap", () => {
    // tanh(x/k) ≈ x/k for small x, so result ≈ x
    const result = clampDailyLoad(10, 200);
    expect(result).toBeCloseTo(10, 0);
  });

  it("soft-caps values near the cap", () => {
    // At x = cap, tanh(1) ≈ 0.76, so result ≈ 0.76 * cap
    const result = clampDailyLoad(200, 200);
    expect(result).toBeLessThan(200);
    expect(result).toBeGreaterThan(100);
  });

  it("asymptotes to cap for very large values", () => {
    // tanh(large) → 1, so result → cap (may equal cap in float)
    const result = clampDailyLoad(10000, 200);
    expect(result).toBeLessThanOrEqual(200);
    expect(result).toBeGreaterThan(190);
  });

  it("returns 0 for zero input", () => {
    expect(clampDailyLoad(0, 200)).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(clampDailyLoad(-50, 200)).toBe(0);
  });

  it("uses default cap of 190 when not specified", () => {
    const result = clampDailyLoad(100);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(190);
  });

  it("enforces minimum cap of 60", () => {
    // Even with cap=10, the guard-fou sets k=60
    const result = clampDailyLoad(100, 10);
    expect(result).toBeLessThanOrEqual(60);
    expect(result).toBeGreaterThan(0);
  });
});
