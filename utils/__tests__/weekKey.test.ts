// utils/__tests__/weekKey.test.ts
// weekKeyOf : clé de semaine stable = lundi "YYYY-MM-DD". Fonction pure.
// NB : 2026-06-01 est un lundi.

import { weekKeyOf } from "../dateHelpers";

describe("weekKeyOf", () => {
  test("un mercredi renvoie le lundi de sa semaine", () => {
    expect(weekKeyOf("2026-06-03")).toBe("2026-06-01");
  });

  test("le lundi renvoie lui-même", () => {
    expect(weekKeyOf("2026-06-01")).toBe("2026-06-01");
  });

  test("le dimanche reste dans la même semaine (lundi précédent)", () => {
    expect(weekKeyOf("2026-06-07")).toBe("2026-06-01");
  });

  test("le lundi suivant change de clé", () => {
    expect(weekKeyOf("2026-06-08")).toBe("2026-06-08");
  });

  test("tous les jours d'une même semaine donnent la même clé", () => {
    const keys = ["2026-06-01", "2026-06-02", "2026-06-04", "2026-06-07"].map((d) => weekKeyOf(d));
    expect(new Set(keys).size).toBe(1);
  });

  test("la clé est toujours un lundi", () => {
    for (const d of ["2026-01-01", "2026-12-25", "2026-03-18"]) {
      const k = weekKeyOf(d);
      expect(new Date(`${k}T12:00:00`).getDay()).toBe(1); // 1 = lundi
    }
  });

  test("idempotent (clé stable)", () => {
    const k = weekKeyOf("2026-06-03");
    expect(weekKeyOf(k)).toBe(k);
  });
});
