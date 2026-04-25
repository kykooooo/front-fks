import {
  getTauForLevel,
  getTsbZone,
  getTsbLabel,
  getTsbColor,
  getTsbIcon,
  getFootballLabel,
  getFootballStatus,
  getFootballMessage,
  TAU_BY_LEVEL,
} from "../trainingDefaults";

// ─── getTauForLevel ─────────────────────────────────────────────────
describe("getTauForLevel", () => {
  it("maps Loisir to debutant tau (7/21)", () => {
    expect(getTauForLevel("Loisir")).toEqual(TAU_BY_LEVEL.debutant);
  });

  it("maps Competition to intermediaire tau (10/28)", () => {
    expect(getTauForLevel("Compétition")).toEqual(TAU_BY_LEVEL.intermediaire);
  });

  it("maps Haut niveau to confirme tau (14/35)", () => {
    expect(getTauForLevel("Haut niveau")).toEqual(TAU_BY_LEVEL.confirme);
  });

  it("maps legacy Amateur to debutant", () => {
    expect(getTauForLevel("Amateur")).toEqual(TAU_BY_LEVEL.debutant);
  });

  it("maps legacy Semi-pro to confirme", () => {
    expect(getTauForLevel("Semi-pro")).toEqual(TAU_BY_LEVEL.confirme);
  });

  it("falls back to intermediaire for unknown level", () => {
    expect(getTauForLevel("unknown")).toEqual(TAU_BY_LEVEL.intermediaire);
  });

  it("falls back to intermediaire for null", () => {
    expect(getTauForLevel(null)).toEqual(TAU_BY_LEVEL.intermediaire);
  });

  it("falls back to intermediaire for undefined", () => {
    expect(getTauForLevel(undefined)).toEqual(TAU_BY_LEVEL.intermediaire);
  });
});

// ─── getTsbZone ─────────────────────────────────────────────────────
describe("getTsbZone", () => {
  it("returns OVERTRAINED for TSB <= -20", () => {
    expect(getTsbZone(-25)).toBe("OVERTRAINED");
    expect(getTsbZone(-20)).toBe("OVERTRAINED");
  });

  it("returns OVERREACHING for -20 < TSB <= -10", () => {
    expect(getTsbZone(-19)).toBe("OVERREACHING");
    expect(getTsbZone(-10)).toBe("OVERREACHING");
  });

  it("returns LOADED for -10 < TSB <= -5", () => {
    expect(getTsbZone(-9)).toBe("LOADED");
    expect(getTsbZone(-5)).toBe("LOADED");
  });

  it("returns OPTIMAL for -5 < TSB <= 5", () => {
    expect(getTsbZone(-4)).toBe("OPTIMAL");
    expect(getTsbZone(0)).toBe("OPTIMAL");
    expect(getTsbZone(5)).toBe("OPTIMAL");
  });

  it("returns FRESH for 5 < TSB <= 15", () => {
    expect(getTsbZone(6)).toBe("FRESH");
    expect(getTsbZone(15)).toBe("FRESH");
  });

  it("returns DETRAINING for TSB > 15", () => {
    expect(getTsbZone(16)).toBe("DETRAINING");
    expect(getTsbZone(30)).toBe("DETRAINING");
  });
});

// ─── getTsbLabel / getTsbColor / getTsbIcon ─────────────────────────
describe("getTsbLabel", () => {
  it("returns correct labels for each zone", () => {
    expect(getTsbLabel(-25)).toBe("Surentraînement");
    expect(getTsbLabel(-15)).toBe("Surcharge");
    expect(getTsbLabel(-7)).toBe("Chargé");
    expect(getTsbLabel(0)).toBe("Optimal");
    expect(getTsbLabel(10)).toBe("Frais");
    expect(getTsbLabel(20)).toBe("Désentraîné");
  });
});

describe("getTsbColor", () => {
  it("returns hex color for each zone", () => {
    expect(getTsbColor(0)).toBe("#22c55e"); // OPTIMAL = green
    expect(getTsbColor(-25)).toBe("#dc2626"); // OVERTRAINED = red
  });
});

describe("getTsbIcon", () => {
  it("returns icon name for each zone", () => {
    expect(getTsbIcon(0)).toBe("checkmark-circle"); // OPTIMAL
    expect(getTsbIcon(10)).toBe("battery-full"); // FRESH
  });
});

// ─── Football labels ────────────────────────────────────────────────
describe("getFootballLabel", () => {
  it("returns full label object for OPTIMAL zone", () => {
    const label = getFootballLabel(0);
    expect(label.label).toBe("En forme");
    expect(label.emoji).toBe("🟢");
    expect(label.color).toBe("#22c55e");
  });

  it("returns Crame for extreme negative TSB", () => {
    expect(getFootballLabel(-25).label).toBe("Cramé");
  });

  it("returns Rouille for high positive TSB", () => {
    expect(getFootballLabel(20).label).toBe("Rouillé");
  });
});

describe("getFootballStatus", () => {
  it("returns short label string", () => {
    expect(getFootballStatus(0)).toBe("En forme");
    expect(getFootballStatus(-15)).toBe("Cuit");
    expect(getFootballStatus(10)).toBe("Frais");
  });
});

describe("getFootballMessage", () => {
  it("returns motivational message", () => {
    const msg = getFootballMessage(0);
    expect(msg.length).toBeGreaterThan(10);
  });
});
