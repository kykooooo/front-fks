import {
  capByContextSessionsOnly,
  externalLoadForDay,
  computeInterveningOffDays,
  pruneDailyAppliedWindow,
  type ExternalLoadLike,
} from "../computeDailyApplied";

// ─── capByContextSessionsOnly ───────────────────────────────────────
describe("capByContextSessionsOnly", () => {
  it("caps at 110 for recovery RPE (<=3)", () => {
    expect(capByContextSessionsOnly(200, 2)).toBeLessThanOrEqual(110);
    expect(capByContextSessionsOnly(200, 3)).toBeLessThanOrEqual(110);
  });

  it("caps at 140 for easy RPE (<=5)", () => {
    expect(capByContextSessionsOnly(200, 4)).toBeLessThanOrEqual(140);
    expect(capByContextSessionsOnly(200, 5)).toBeLessThanOrEqual(140);
  });

  it("caps at 170 for moderate RPE (<=7)", () => {
    expect(capByContextSessionsOnly(200, 6)).toBeLessThanOrEqual(170);
    expect(capByContextSessionsOnly(200, 7)).toBeLessThanOrEqual(170);
  });

  it("caps at 200 for intense RPE (<=9)", () => {
    expect(capByContextSessionsOnly(250, 8)).toBeLessThanOrEqual(200);
    expect(capByContextSessionsOnly(250, 9)).toBeLessThanOrEqual(200);
  });

  it("caps at 220 for max RPE (10)", () => {
    expect(capByContextSessionsOnly(300, 10)).toBeLessThanOrEqual(220);
  });

  it("passes through values below cap", () => {
    expect(capByContextSessionsOnly(50, 7)).toBe(50);
    expect(capByContextSessionsOnly(100, 10)).toBe(100);
  });

  it("reduces cap by 8 per pain point", () => {
    // RPE 7 -> cap 170, pain 3 -> cap 170-24=146
    expect(capByContextSessionsOnly(200, 7, 3)).toBeLessThanOrEqual(146);
  });

  it("enforces minimum cap of 70 even with high pain", () => {
    // RPE 3 -> cap 110, pain 5 -> cap 110-40=70 (clamped)
    expect(capByContextSessionsOnly(200, 3, 5)).toBeLessThanOrEqual(70);
    expect(capByContextSessionsOnly(200, 3, 5)).toBeGreaterThanOrEqual(0);
  });

  it("handles zero sessions load", () => {
    expect(capByContextSessionsOnly(0, 7)).toBe(0);
  });
});

// ─── externalLoadForDay ─────────────────────────────────────────────
describe("externalLoadForDay", () => {
  const makeExternal = (source: "club" | "match" | "other", rpe: number, dur: number, date: string): ExternalLoadLike => ({
    source,
    dateISO: date,
    rpe,
    durationMin: dur,
  });

  it("weights match load at 0.80", () => {
    const ext = [makeExternal("match", 8, 90, "2025-04-11")];
    const result = externalLoadForDay(ext, "2025-04-11");
    expect(result).toBeCloseTo(0.80 * 8 * 90, 0);
  });

  it("weights club load at 0.70", () => {
    const ext = [makeExternal("club", 6, 60, "2025-04-11")];
    const result = externalLoadForDay(ext, "2025-04-11");
    expect(result).toBeCloseTo(0.70 * 6 * 60, 0);
  });

  it("weights other load at 0.60", () => {
    const ext = [makeExternal("other", 5, 45, "2025-04-11")];
    const result = externalLoadForDay(ext, "2025-04-11");
    expect(result).toBeCloseTo(0.60 * 5 * 45, 0);
  });

  it("returns 0 for empty list", () => {
    expect(externalLoadForDay([], "2025-04-11")).toBe(0);
  });

  it("returns 0 when no loads match the day", () => {
    const ext = [makeExternal("club", 6, 60, "2025-04-10")];
    expect(externalLoadForDay(ext, "2025-04-11")).toBe(0);
  });

  it("sums multiple loads on same day", () => {
    const ext = [
      makeExternal("club", 6, 60, "2025-04-11"),
      makeExternal("match", 8, 90, "2025-04-11"),
    ];
    const result = externalLoadForDay(ext, "2025-04-11");
    expect(result).toBeCloseTo(0.70 * 6 * 60 + 0.80 * 8 * 90, 0);
  });
});

// ─── computeInterveningOffDays ──────────────────────────────────────
describe("computeInterveningOffDays", () => {
  it("returns 0 for null lastLoadDayKey", () => {
    expect(computeInterveningOffDays(null, "2025-04-11")).toBe(0);
  });

  it("returns 0 for consecutive days", () => {
    expect(computeInterveningOffDays("2025-04-10", "2025-04-11")).toBe(0);
  });

  it("returns 1 for one day gap", () => {
    expect(computeInterveningOffDays("2025-04-10", "2025-04-12")).toBe(1);
  });

  it("returns 4 for 5-day span", () => {
    expect(computeInterveningOffDays("2025-04-06", "2025-04-11")).toBe(4);
  });

  it("returns 0 for same day", () => {
    expect(computeInterveningOffDays("2025-04-11", "2025-04-11")).toBe(0);
  });
});

// ─── pruneDailyAppliedWindow ────────────────────────────────────────
describe("pruneDailyAppliedWindow", () => {
  const daily = {
    "2025-04-06": 100,
    "2025-04-07": 120,
    "2025-04-08": 80,
    "2025-04-09": 150,
    "2025-04-10": 90,
    "2025-04-11": 110,
  };

  it("keeps entries within the window", () => {
    const result = pruneDailyAppliedWindow(daily, 3, "2025-04-11");
    expect(result["2025-04-11"]).toBe(110);
    expect(result["2025-04-10"]).toBe(90);
    expect(result["2025-04-09"]).toBe(150);
    expect(result["2025-04-08"]).toBe(80);
  });

  it("drops entries outside the window", () => {
    const result = pruneDailyAppliedWindow(daily, 2, "2025-04-11");
    expect(result["2025-04-06"]).toBeUndefined();
    expect(result["2025-04-07"]).toBeUndefined();
    expect(result["2025-04-08"]).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(pruneDailyAppliedWindow({}, 7, "2025-04-11")).toEqual({});
  });
});
