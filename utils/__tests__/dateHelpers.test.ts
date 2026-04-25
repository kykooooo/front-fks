import { toDateKey, isSameDay, frToKey, dayKeyToDow, isClubDay, lastNDates } from "../dateHelpers";

// ─── toDateKey ──────────────────────────────────────────────────────
describe("toDateKey", () => {
  it("returns empty string for null/undefined", () => {
    expect(toDateKey(null)).toBe("");
    expect(toDateKey(undefined)).toBe("");
    expect(toDateKey("")).toBe("");
  });

  it("returns bare YYYY-MM-DD as-is", () => {
    expect(toDateKey("2025-04-11")).toBe("2025-04-11");
    expect(toDateKey("2026-01-01")).toBe("2026-01-01");
  });

  it("converts Date object to local date key", () => {
    const d = new Date(2025, 3, 11); // April 11, 2025 local
    expect(toDateKey(d)).toBe("2025-04-11");
  });

  it("converts ISO string with time to local date key", () => {
    // Midday UTC should be same day in most timezones
    const result = toDateKey("2025-06-15T12:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("extracts leading date from malformed string", () => {
    expect(toDateKey("2025-04-11T_garbage")).toBe("2025-04-11");
  });

  it("returns empty for totally invalid string", () => {
    expect(toDateKey("not-a-date")).toBe("");
  });
});

// ─── isSameDay ──────────────────────────────────────────────────────
describe("isSameDay", () => {
  it("returns true for same day", () => {
    const a = new Date(2025, 3, 11, 10, 0);
    const b = new Date(2025, 3, 11, 22, 30);
    expect(isSameDay(a, b)).toBe(true);
  });

  it("returns false for different days", () => {
    const a = new Date(2025, 3, 11);
    const b = new Date(2025, 3, 12);
    expect(isSameDay(a, b)).toBe(false);
  });

  it("returns false for same day different month", () => {
    const a = new Date(2025, 2, 11); // March
    const b = new Date(2025, 3, 11); // April
    expect(isSameDay(a, b)).toBe(false);
  });
});

// ─── frToKey ────────────────────────────────────────────────────────
describe("frToKey", () => {
  it("maps all French day abbreviations", () => {
    expect(frToKey["lun"]).toBe("mon");
    expect(frToKey["mar"]).toBe("tue");
    expect(frToKey["mer"]).toBe("wed");
    expect(frToKey["jeu"]).toBe("thu");
    expect(frToKey["ven"]).toBe("fri");
    expect(frToKey["sam"]).toBe("sat");
    expect(frToKey["dim"]).toBe("sun");
  });

  it("returns undefined for unknown key", () => {
    expect(frToKey["xyz"]).toBeUndefined();
  });
});

// ─── dayKeyToDow ────────────────────────────────────────────────────
describe("dayKeyToDow", () => {
  it("returns correct day of week", () => {
    // 2025-04-11 is a Friday
    expect(dayKeyToDow("2025-04-11")).toBe("fri");
    // 2025-04-12 is a Saturday
    expect(dayKeyToDow("2025-04-12")).toBe("sat");
    // 2025-04-13 is a Sunday
    expect(dayKeyToDow("2025-04-13")).toBe("sun");
    // 2025-04-14 is a Monday
    expect(dayKeyToDow("2025-04-14")).toBe("mon");
  });
});

// ─── isClubDay ──────────────────────────────────────────────────────
describe("isClubDay", () => {
  it("returns true when day matches club schedule", () => {
    // 2025-04-14 is Monday
    expect(isClubDay("2025-04-14", ["mon", "wed", "fri"])).toBe(true);
  });

  it("returns false when day does not match", () => {
    // 2025-04-12 is Saturday
    expect(isClubDay("2025-04-12", ["mon", "wed", "fri"])).toBe(false);
  });

  it("returns false for empty club days", () => {
    expect(isClubDay("2025-04-14", [])).toBe(false);
    expect(isClubDay("2025-04-14")).toBe(false);
  });
});

// ─── lastNDates ─────────────────────────────────────────────────────
describe("lastNDates", () => {
  it("returns N date keys going backwards", () => {
    const result = lastNDates("2025-04-11", 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("2025-04-11");
    expect(result[1]).toBe("2025-04-10");
    expect(result[2]).toBe("2025-04-09");
  });

  it("returns empty array for n=0", () => {
    expect(lastNDates("2025-04-11", 0)).toEqual([]);
  });
});
