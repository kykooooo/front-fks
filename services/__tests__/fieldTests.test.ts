// services/__tests__/fieldTests.test.ts
//
// Construction du payload `field_tests` (chantier E3 individualisation, cf.
// INDIVIDUALISATION_FINE_DESIGN.md §7.1 : field_tests[] = [{key, value, unit, ts}],
// max 6, "dernier de chaque type <= 90 j"). Source : entrees brutes AsyncStorage
// (TestEntry[], screens/tests/hooks/useTestsStorage.ts), lues hors-hook.
//
// On verifie :
// 1. Donnees presentes -> champ + unite corrects.
// 2. Donnees absentes -> tableau vide, aucun crash.
// 3. Donnees anciennes (> 90 j) -> ignorees.
// 4. Deduplication : la valeur la plus recente par cle gagne.
// 5. Cap a 6 entrees (les plus recentes gagnent).

import {
  buildFieldTestsPayload,
  FIELD_TESTS_MAX_AGE_DAYS,
  FIELD_TESTS_MAX_ENTRIES,
} from "../aiContextHelpers";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-07-16T12:00:00.000Z").getTime();

describe("buildFieldTestsPayload", () => {
  test("donnees presentes -> construit {key, value, unit, ts}", () => {
    const entries = [{ ts: NOW - 5 * DAY_MS, endurance6min_m: 1450 }];
    const payload = buildFieldTestsPayload(entries, NOW);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ key: "endurance6min_m", value: 1450, unit: "m" });
    expect(typeof payload[0].ts).toBe("string");
    expect(new Date(payload[0].ts).getTime()).toBe(NOW - 5 * DAY_MS);
  });

  test("aucune entree -> tableau vide", () => {
    expect(buildFieldTestsPayload([], NOW)).toEqual([]);
    expect(buildFieldTestsPayload(null, NOW)).toEqual([]);
    expect(buildFieldTestsPayload(undefined, NOW)).toEqual([]);
  });

  test("entrees corrompues (pas un tableau, objets sans ts) -> ignorees sans crash", () => {
    expect(buildFieldTestsPayload("pas un tableau" as unknown, NOW)).toEqual([]);
    const entries = [{ endurance6min_m: 1450 }, null, "junk", { ts: "invalid", gobletKg: 20 }];
    expect(buildFieldTestsPayload(entries, NOW)).toEqual([]);
  });

  test("entree plus vieille que 90 jours -> ignoree (test perime)", () => {
    const entries = [{ ts: NOW - (FIELD_TESTS_MAX_AGE_DAYS + 1) * DAY_MS, gobletKg: 22 }];
    expect(buildFieldTestsPayload(entries, NOW)).toEqual([]);
  });

  test("entree exactement a la limite (90 jours) -> encore valide", () => {
    const entries = [{ ts: NOW - FIELD_TESTS_MAX_AGE_DAYS * DAY_MS, gobletKg: 22 }];
    const payload = buildFieldTestsPayload(entries, NOW);
    expect(payload).toHaveLength(1);
    expect(payload[0].key).toBe("gobletKg");
  });

  test("plusieurs entrees pour la meme cle -> la plus recente gagne", () => {
    const entries = [
      { ts: NOW - 60 * DAY_MS, gobletKg: 18 },
      { ts: NOW - 2 * DAY_MS, gobletKg: 24 }, // la plus recente
      { ts: NOW - 30 * DAY_MS, gobletKg: 20 },
    ];
    const payload = buildFieldTestsPayload(entries, NOW);
    expect(payload).toHaveLength(1);
    expect(payload[0].value).toBe(24);
  });

  test("valeur 0 ou negative -> ignoree (jamais un test valide)", () => {
    const entries = [{ ts: NOW - DAY_MS, gobletKg: 0 }, { ts: NOW - DAY_MS, splitKg: -5 }];
    expect(buildFieldTestsPayload(entries, NOW)).toEqual([]);
  });

  test("dedie plusieurs cles depuis une meme entree (batterie complete)", () => {
    const entries = [
      {
        ts: NOW - DAY_MS,
        broadJumpCm: 210,
        sprint10s: 1.9,
        endurance6min_m: 1400,
      },
    ];
    const payload = buildFieldTestsPayload(entries, NOW);
    expect(payload).toHaveLength(3);
    const byKey = Object.fromEntries(payload.map((p) => [p.key, p]));
    expect(byKey.broadJumpCm).toMatchObject({ value: 210, unit: "cm" });
    expect(byKey.sprint10s).toMatchObject({ value: 1.9, unit: "s" });
    expect(byKey.endurance6min_m).toMatchObject({ value: 1400, unit: "m" });
  });

  test("cap a 6 entrees : les plus recentes gagnent si plus de 6 cles ont une valeur fraiche", () => {
    const entries = [
      {
        ts: NOW - 40 * DAY_MS,
        broadJumpCm: 200,
        tripleJumpCm: 600,
        cmjCm: 35,
        lateralBoundCm: 180,
      },
      {
        ts: NOW - DAY_MS, // plus recent : ces cles doivent primer dans le cap
        sprint10s: 1.9,
        sprint20s: 3.1,
        sprint30s: 4.4,
        endurance6min_m: 1400,
      },
    ];
    const payload = buildFieldTestsPayload(entries, NOW);
    expect(payload.length).toBeLessThanOrEqual(FIELD_TESTS_MAX_ENTRIES);
    expect(payload).toHaveLength(6);
    const keys = payload.map((p) => p.key);
    // Les 4 cles les plus recentes doivent toutes etre presentes.
    expect(keys).toEqual(
      expect.arrayContaining(["sprint10s", "sprint20s", "sprint30s", "endurance6min_m"])
    );
  });

  test("notes/playlist ne sont jamais traites comme des tests mesures", () => {
    const entries = [{ ts: NOW - DAY_MS, notes: "RAS", playlist: "force" }];
    expect(buildFieldTestsPayload(entries, NOW)).toEqual([]);
  });

  test("nowMs par defaut utilise Date.now() (pas de crash sans argument explicite)", () => {
    const entries = [{ ts: Date.now() - DAY_MS, gobletKg: 22 }];
    const payload = buildFieldTestsPayload(entries);
    expect(payload).toHaveLength(1);
  });
});
