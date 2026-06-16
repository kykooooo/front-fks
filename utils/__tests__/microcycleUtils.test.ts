// utils/__tests__/microcycleUtils.test.ts
// Fonctions pures de dérivation de la phase d'affichage du microcycle.
// Bornes attendues (cycle de 12) : 1-4 base, 5-8 build_1, 9-11 build_2, 12 deload.

import {
  getMicrocyclePhase,
  phaseKeyForSession,
  getMicrocyclePhaseRanges,
  MICROCYCLE_PHASES,
} from "../microcycleUtils";

describe("phaseKeyForSession (cycle de 12)", () => {
  test("séances 1 → 4 = base", () => {
    for (const n of [1, 2, 3, 4]) expect(phaseKeyForSession(n, 12)).toBe("base");
  });
  test("séances 5 → 8 = build_1", () => {
    for (const n of [5, 6, 7, 8]) expect(phaseKeyForSession(n, 12)).toBe("build_1");
  });
  test("séances 9 → 11 = build_2", () => {
    for (const n of [9, 10, 11]) expect(phaseKeyForSession(n, 12)).toBe("build_2");
  });
  test("séance 12 = deload", () => {
    expect(phaseKeyForSession(12, 12)).toBe("deload");
  });
  test("entrées hors bornes restent valides (clamp)", () => {
    expect(phaseKeyForSession(0, 12)).toBe("base");
    expect(phaseKeyForSession(99, 12)).toBe("deload");
    expect(phaseKeyForSession(NaN as any, 12)).toBe("base");
  });
});

describe("getMicrocyclePhase (index 0-based → séance courante = index + 1)", () => {
  test("index 0 → séance 1, Fondations", () => {
    const p = getMicrocyclePhase(0, 12);
    expect(p.sessionNumber).toBe(1);
    expect(p.key).toBe("base");
    expect(p.label).toBe("Fondations");
  });
  test("index 5 → séance 6, Montée en puissance", () => {
    const p = getMicrocyclePhase(5, 12);
    expect(p.sessionNumber).toBe(6);
    expect(p.key).toBe("build_1");
    expect(p.label).toBe("Montée en puissance");
  });
  test("index 9 → séance 10, Pic de forme", () => {
    const p = getMicrocyclePhase(9, 12);
    expect(p.sessionNumber).toBe(10);
    expect(p.key).toBe("build_2");
    expect(p.label).toBe("Pic de forme");
  });
  test("index 11 → séance 12, Relâche", () => {
    const p = getMicrocyclePhase(11, 12);
    expect(p.sessionNumber).toBe(12);
    expect(p.key).toBe("deload");
    expect(p.label).toBe("Relâche");
  });
  test("cycle terminé (index >= total) → borné à la dernière séance", () => {
    const p = getMicrocyclePhase(12, 12);
    expect(p.sessionNumber).toBe(12);
    expect(p.key).toBe("deload");
  });
  test("aucun libellé ne contient de jargon technique", () => {
    for (const meta of Object.values(MICROCYCLE_PHASES)) {
      expect(meta.label).not.toMatch(/build|deload|base|ATL|CTL|TSB/i);
      expect(meta.meaning.length).toBeGreaterThan(0);
    }
  });
});

describe("getMicrocyclePhaseRanges (cycle de 12)", () => {
  test("4 blocs contigus couvrant 1 → 12", () => {
    const ranges = getMicrocyclePhaseRanges(12);
    expect(ranges.map((r) => r.key)).toEqual(["base", "build_1", "build_2", "deload"]);
    expect(ranges.map((r) => [r.start, r.end])).toEqual([
      [1, 4],
      [5, 8],
      [9, 11],
      [12, 12],
    ]);
    expect(ranges.reduce((sum, r) => sum + r.count, 0)).toBe(12);
  });
});
