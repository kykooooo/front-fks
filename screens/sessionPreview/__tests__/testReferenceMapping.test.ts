// screens/sessionPreview/__tests__/testReferenceMapping.test.ts
//
// Logique pure de mapping "reference de test terrain -> ligne affichee sous un
// exercice" (chantier E3 individualisation, affichage seul, aucune logique
// moteur). Coach honnete : en cas de doute, on n'affiche rien.

import { getItemTestReference, pickLatestTestValues, type TestReferenceValues } from "../testReferenceMapping";
import type { BlockItem } from "../sessionPreviewConfig";

const item = (overrides: Partial<BlockItem>): BlockItem => ({ name: "", ...overrides });

describe("getItemTestReference — force (goblet / split squat)", () => {
  test("goblet squat avec kg + reps -> ligne complete", () => {
    const tests: TestReferenceValues = { gobletKg: 24, gobletReps: 8 };
    const ref = getItemTestReference(item({ id: "str_goblet_squat", name: "Goblet squat" }), tests);
    expect(ref).toBe("Ta référence test : 24 kg × 8");
  });

  test("goblet squat avec kg seul (pas de reps enregistrees) -> pas de x", () => {
    const tests: TestReferenceValues = { gobletKg: 24 };
    const ref = getItemTestReference(item({ id: "str_goblet_squat" }), tests);
    expect(ref).toBe("Ta référence test : 24 kg");
  });

  test("goblet squat sans donnee de test -> null (rien a afficher)", () => {
    const ref = getItemTestReference(item({ id: "str_goblet_squat" }), {});
    expect(ref).toBeNull();
  });

  test("split squat classique -> ligne correcte", () => {
    const tests: TestReferenceValues = { splitKg: 18, splitReps: 6 };
    const ref = getItemTestReference(item({ id: "str_db_split_squat", name: "Split squat haltères" }), tests);
    expect(ref).toBe("Ta référence test : 18 kg × 6");
  });

  test("bulgarian split squat -> meme mapping que split squat (meme test terrain)", () => {
    const tests: TestReferenceValues = { splitKg: 20 };
    const ref = getItemTestReference(item({ id: "str_bulgarian_split", name: "Bulgarian split squat" }), tests);
    expect(ref).toBe("Ta référence test : 20 kg");
  });
});

describe("getItemTestReference — vitesse (sprint/acceleration avec distance explicite)", () => {
  test("accélération 10m -> chrono test 10m", () => {
    const tests: TestReferenceValues = { sprint10s: 1.9 };
    const ref = getItemTestReference(item({ id: "sprint_accel_10m", name: "Accélération 10m" }), tests);
    expect(ref).toBe("Ton chrono test 10 m : 1,90 s");
  });

  test("flying 20m -> chrono test 20m", () => {
    const tests: TestReferenceValues = { sprint20s: 3.05 };
    const ref = getItemTestReference(item({ id: "sprint_flying_20m", name: "Flying 20m" }), tests);
    expect(ref).toBe("Ton chrono test 20 m : 3,05 s");
  });

  test("sprint 30m -> chrono test 30m", () => {
    const tests: TestReferenceValues = { sprint30s: 4.42 };
    const ref = getItemTestReference(item({ id: "sprint_float_sprint_30m" }), tests);
    expect(ref).toBe("Ton chrono test 30 m : 4,42 s");
  });

  test("sprint sans distance explicite (cotes, ins&outs 50m) -> null (distance ambigue)", () => {
    const tests: TestReferenceValues = { sprint10s: 1.9, sprint20s: 3.1, sprint30s: 4.4 };
    expect(getItemTestReference(item({ id: "sprint_hill_8_10s", name: "Côtes sprint 8-10s" }), tests)).toBeNull();
    expect(getItemTestReference(item({ id: "sprint_ins_and_outs_50m" }), tests)).toBeNull();
  });

  test("distance reconnue mais pas de test enregistre pour cette distance -> null", () => {
    const tests: TestReferenceValues = { sprint20s: 3.1 }; // pas de sprint10s
    const ref = getItemTestReference(item({ id: "sprint_accel_10m" }), tests);
    expect(ref).toBeNull();
  });
});

describe("getItemTestReference — hors perimetre / garde-fous", () => {
  test("exercice sans lien evident (gainage, mobilite) -> null", () => {
    const tests: TestReferenceValues = { gobletKg: 24, sprint10s: 1.9 };
    expect(getItemTestReference(item({ id: "core_plank_hold", name: "Gainage planche" }), tests)).toBeNull();
  });

  test("item null/undefined -> null (pas de crash)", () => {
    expect(getItemTestReference(null, { gobletKg: 24 })).toBeNull();
    expect(getItemTestReference(undefined, { gobletKg: 24 })).toBeNull();
  });

  test("tests null/undefined -> null (pas de crash)", () => {
    expect(getItemTestReference(item({ id: "str_goblet_squat" }), null)).toBeNull();
    expect(getItemTestReference(item({ id: "str_goblet_squat" }), undefined)).toBeNull();
  });

  test("valeur de test 0 ou negative -> ignoree (jamais un test valide)", () => {
    expect(getItemTestReference(item({ id: "str_goblet_squat" }), { gobletKg: 0 })).toBeNull();
  });
});

describe("pickLatestTestValues", () => {
  test("prend la valeur la plus recente par cle (entrees non triees)", () => {
    const entries = [
      { ts: 1000, gobletKg: 18 },
      { ts: 3000, gobletKg: 24 }, // la plus recente
      { ts: 2000, gobletKg: 20 },
    ];
    expect(pickLatestTestValues(entries)).toEqual({ gobletKg: 24 });
  });

  test("combine plusieurs cles depuis plusieurs entrees", () => {
    const entries = [
      { ts: 2000, sprint10s: 1.9 },
      { ts: 1000, gobletKg: 24, gobletReps: 8 },
    ];
    expect(pickLatestTestValues(entries)).toEqual({ sprint10s: 1.9, gobletKg: 24, gobletReps: 8 });
  });

  test("entrees vides/absentes -> objet vide, pas de crash", () => {
    expect(pickLatestTestValues([])).toEqual({});
    expect(pickLatestTestValues(null)).toEqual({});
    expect(pickLatestTestValues(undefined)).toEqual({});
  });

  test("ignore les valeurs 0/negatives/non numeriques", () => {
    const entries = [{ ts: 1000, gobletKg: 0, splitKg: -5, sprint10s: NaN as unknown as number }];
    expect(pickLatestTestValues(entries)).toEqual({});
  });
});
