// domain/coachView/__tests__/dates.test.ts
// Arithmétique de dates : la base de TOUT le relatif au présent côté coach.

import {
  addDaysToKey,
  compareDateKeysDesc,
  diffDaysBetweenKeys,
  elapsedLabel,
  isValidDateKey,
  keyToUtcMs,
} from "../dates";

describe("isValidDateKey", () => {
  test("accepte une vraie date calendaire", () => {
    expect(isValidDateKey("2026-07-27")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true); // année bissextile
  });

  test("refuse les dates impossibles et les formats libres", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-06-31")).toBe(false);
    expect(isValidDateKey("27/07/2026")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
    expect(isValidDateKey(20260727)).toBe(false);
  });
});

describe("diffDaysBetweenKeys", () => {
  test("écart positif vers le futur, négatif vers le passé", () => {
    expect(diffDaysBetweenKeys("2026-07-20", "2026-07-27")).toBe(7);
    expect(diffDaysBetweenKeys("2026-07-27", "2026-07-20")).toBe(-7);
    expect(diffDaysBetweenKeys("2026-07-27", "2026-07-27")).toBe(0);
  });

  test("traverse les mois et les années", () => {
    expect(diffDaysBetweenKeys("2026-06-29", "2026-07-05")).toBe(6);
    expect(diffDaysBetweenKeys("2025-12-31", "2026-01-01")).toBe(1);
  });

  test("date invalide → null (un écart inconnu n'est pas un écart nul)", () => {
    expect(diffDaysBetweenKeys("nope", "2026-07-27")).toBeNull();
    expect(diffDaysBetweenKeys("2026-07-27", "2026-02-30")).toBeNull();
  });
});

describe("addDaysToKey", () => {
  test("avance et recule, y compris à cheval sur deux mois", () => {
    expect(addDaysToKey("2026-07-27", 5)).toBe("2026-08-01");
    expect(addDaysToKey("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToKey("2026-07-27", 0)).toBe("2026-07-27");
  });

  test("clé invalide → null", () => {
    expect(addDaysToKey("hier", 1)).toBeNull();
  });
});

describe("keyToUtcMs / compareDateKeysDesc", () => {
  test("lit la clé à midi UTC (insensible aux fuseaux)", () => {
    expect(keyToUtcMs("2026-07-27")).toBe(Date.parse("2026-07-27T12:00:00.000Z"));
    expect(keyToUtcMs("2026-02-30")).toBeNull();
  });

  test("trie du plus récent au plus ancien", () => {
    const keys = ["2026-07-01", "2026-07-27", "2026-06-30"];
    expect(keys.slice().sort(compareDateKeysDesc)).toEqual([
      "2026-07-27",
      "2026-07-01",
      "2026-06-30",
    ]);
  });
});

describe("elapsedLabel", () => {
  test("langage terrain", () => {
    expect(elapsedLabel(0)).toBe("Aujourd'hui");
    expect(elapsedLabel(1)).toBe("Hier");
    expect(elapsedLabel(9)).toBe("Il y a 9 jours");
  });

  test("une date future s'annonce au futur, jamais au passé", () => {
    expect(elapsedLabel(-1)).toBe("Demain");
    expect(elapsedLabel(-3)).toBe("Dans 3 jours");
  });

  test("valeur non finie → libellé honnête", () => {
    expect(elapsedLabel(Number.NaN)).toBe("Date inconnue");
  });
});
