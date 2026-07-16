// screens/tests/__tests__/testHelpers.test.ts
// Conversion min:sec du 1 km (stockage en secondes, saisie/affichage en min:sec)
// + helpers d'affichage — fonctions pures.

import {
  secondsToMinSec,
  minSecToSeconds,
  formatMinSec,
  formatEntryValue,
  formatStatValueForField,
  shouldHideUnitSuffix,
  pickFieldSamples,
  fieldKeysWithData,
} from "../testHelpers";
import type { TestEntry } from "../testConfig";

describe("secondsToMinSec / minSecToSeconds", () => {
  test("round-trip simple", () => {
    expect(secondsToMinSec(992)).toEqual({ minutes: 16, seconds: 32 });
    expect(minSecToSeconds(16, 32)).toBe(992);
  });

  test("secondes exactes (pas de reste)", () => {
    expect(secondsToMinSec(300)).toEqual({ minutes: 5, seconds: 0 });
    expect(minSecToSeconds(5, 0)).toBe(300);
  });

  test("valeurs invalides -> 0", () => {
    expect(secondsToMinSec(-10)).toEqual({ minutes: 0, seconds: 0 });
    expect(secondsToMinSec(Number.NaN)).toEqual({ minutes: 0, seconds: 0 });
    expect(minSecToSeconds(Number.NaN, Number.NaN)).toBe(0);
    expect(minSecToSeconds(-2, -5)).toBe(0);
  });

  test("arrondit les secondes non entières", () => {
    expect(secondsToMinSec(90.6)).toEqual({ minutes: 1, seconds: 31 });
  });
});

describe("formatMinSec", () => {
  test("formate avec secondes paddées à 2 chiffres", () => {
    expect(formatMinSec(992)).toBe("16:32");
    expect(formatMinSec(65)).toBe("1:05");
    expect(formatMinSec(300)).toBe("5:00");
  });

  test("retourne '--' pour une valeur invalide", () => {
    expect(formatMinSec(0)).toBe("--");
    expect(formatMinSec(-5)).toBe("--");
    expect(formatMinSec(Number.NaN)).toBe("--");
  });
});

describe("formatEntryValue", () => {
  test("le 1 km s'affiche en min:sec", () => {
    expect(formatEntryValue("run1km_s", 992)).toBe("16:32");
  });

  test("les autres champs s'affichent bruts", () => {
    expect(formatEntryValue("broadJumpCm", 245)).toBe("245");
    expect(formatEntryValue("sprint10s", 1.87)).toBe("1.87");
  });

  test("valeur vide -> chaîne vide", () => {
    expect(formatEntryValue("broadJumpCm", undefined)).toBe("");
    expect(formatEntryValue("broadJumpCm", null)).toBe("");
    expect(formatEntryValue("broadJumpCm", "")).toBe("");
  });
});

describe("formatStatValueForField", () => {
  test("le 1 km (moyenne/meilleur) s'affiche en min:sec", () => {
    expect(formatStatValueForField("run1km_s", 992)).toBe("16:32");
  });

  test("les autres champs suivent formatStatValue (decimales pour 's', arrondi sinon)", () => {
    expect(formatStatValueForField("sprint10s", 1.874)).toBe("1.87");
    expect(formatStatValueForField("broadJumpCm", 245)).toBe("245");
    expect(formatStatValueForField("broadJumpCm", 245.4)).toBe("245.4");
  });
});

describe("shouldHideUnitSuffix", () => {
  test("masque le suffixe uniquement pour le 1 km (mm:ss auto-descriptif)", () => {
    expect(shouldHideUnitSuffix("run1km_s")).toBe(true);
    expect(shouldHideUnitSuffix("sprint10s")).toBe(false);
    expect(shouldHideUnitSuffix("broadJumpCm")).toBe(false);
  });
});

// ─────────────────────── Historique unifié (Phase C) ───────────────────────
// Avant : les entrées étaient filtrées par playlist, ce qui "cachait" les
// valeurs des autres cycles. Ces tests vérifient que pickFieldSamples /
// fieldKeysWithData lisent bien TOUTES les entrées, quel que soit leur champ
// `playlist` (fondation, force, ou même absent).

describe("pickFieldSamples", () => {
  const entries: TestEntry[] = [
    { ts: 300, playlist: "force", broadJumpCm: 250 },
    { ts: 200, playlist: "fondation", sprint10s: 1.9 },
    { ts: 100, playlist: "endurance", broadJumpCm: 230, sprint10s: 2.0 },
  ];

  test("retourne les valeurs les plus récentes par champ, indépendamment de la playlist stockée", () => {
    const samples = pickFieldSamples(entries, ["broadJumpCm", "sprint10s"], 2);
    expect(samples.broadJumpCm).toEqual([
      { value: 250, ts: 300 },
      { value: 230, ts: 100 },
    ]);
    expect(samples.sprint10s).toEqual([
      { value: 1.9, ts: 200 },
      { value: 2.0, ts: 100 },
    ]);
  });

  test("n'entre pas les entrées non triées en entrée (trie lui-même)", () => {
    const shuffled = [entries[1], entries[2], entries[0]];
    const samples = pickFieldSamples(shuffled, ["broadJumpCm"], 1);
    expect(samples.broadJumpCm).toEqual([{ value: 250, ts: 300 }]);
  });

  test("respecte la limite demandée", () => {
    const samples = pickFieldSamples(entries, ["broadJumpCm"], 1);
    expect(samples.broadJumpCm).toEqual([{ value: 250, ts: 300 }]);
  });

  test("clé jamais renseignée -> absente du résultat", () => {
    const samples = pickFieldSamples(entries, ["cmjCm"], 2);
    expect(samples.cmjCm).toBeUndefined();
  });

  test("liste vide -> objet vide", () => {
    expect(pickFieldSamples([], ["broadJumpCm"], 2)).toEqual({});
  });
});

describe("fieldKeysWithData", () => {
  test("retourne uniquement les clés ayant au moins une valeur, tous cycles confondus", () => {
    const entries: TestEntry[] = [
      { ts: 200, playlist: "force", gobletKg: 40 },
      { ts: 100, playlist: "fondation", broadJumpCm: 230 },
    ];
    const keys = fieldKeysWithData(entries);
    expect(keys).toEqual(expect.arrayContaining(["broadJumpCm", "gobletKg"]));
    expect(keys).not.toContain("sprint10s");
  });

  test("liste vide -> aucune clé", () => {
    expect(fieldKeysWithData([])).toEqual([]);
  });
});
