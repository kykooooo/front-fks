// screens/tests/__tests__/testTiming.test.ts
// Bandeau "bon moment pour tester" — fonction pure, aucune dépendance UI.

import { getTestTimingBanner } from "../testTiming";

describe("getTestTimingBanner", () => {
  test("pas de bandeau si aucun cycle actif, quelle que soit la position", () => {
    expect(getTestTimingBanner(0, false)).toBeNull();
    expect(getTestTimingBanner(6, false)).toBeNull();
    expect(getTestTimingBanner(12, false)).toBeNull();
  });

  test("début de cycle (0 ou 1 séance faite) -> bandeau 'start'", () => {
    expect(getTestTimingBanner(0, true)?.tone).toBe("start");
    expect(getTestTimingBanner(1, true)?.tone).toBe("start");
  });

  test("fin de cycle (11 ou 12 séances, total 12) -> bandeau 'end'", () => {
    expect(getTestTimingBanner(11, true)?.tone).toBe("end");
    expect(getTestTimingBanner(12, true)?.tone).toBe("end");
  });

  test("milieu de cycle -> pas de bandeau (pas de bruit)", () => {
    for (const idx of [2, 3, 5, 7, 9, 10]) {
      expect(getTestTimingBanner(idx, true)).toBeNull();
    }
  });

  test("index absent/invalide traité comme 0 (début de cycle)", () => {
    expect(getTestTimingBanner(null, true)?.tone).toBe("start");
    expect(getTestTimingBanner(undefined, true)?.tone).toBe("start");
    expect(getTestTimingBanner(Number.NaN, true)?.tone).toBe("start");
    expect(getTestTimingBanner(-3, true)?.tone).toBe("start");
  });

  test("respecte un total personnalisé", () => {
    expect(getTestTimingBanner(7, true, 8)?.tone).toBe("end"); // avant-dernière sur 8
    expect(getTestTimingBanner(5, true, 8)).toBeNull();
  });

  test("messages honnêtes, sans jargon ni promesse chiffrée", () => {
    expect(getTestTimingBanner(0, true)?.message).toBe(
      "Moment idéal : prends tes mesures de début de cycle."
    );
    expect(getTestTimingBanner(12, true)?.message).toBe(
      "Cycle presque bouclé : re-teste et compare avec ton départ."
    );
  });
});
