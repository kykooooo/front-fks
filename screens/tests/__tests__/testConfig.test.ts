// screens/tests/__tests__/testConfig.test.ts
// Batterie unique (Phase C) : le socle est constant (3 tests, quel que soit
// le cycle actif) ; seule la section "Aller plus loin" varie selon le
// matériel déclaré et la catégorie d'âge — fonctions pures, aucune dépendance UI.

import {
  CORE_FIELD_KEYS,
  CORE_FIELD_WHY,
  OPTIONAL_FIELD_KEYS,
  getOptionalFields,
  hasWeightsEquipment,
  EQUIPMENT_OPTIONAL_FIELD_KEYS,
  SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS,
  WEIGHT_EQUIPMENT_IDS,
  FIELD_DEFS,
} from "../testConfig";

describe("hasWeightsEquipment", () => {
  test("false si aucun matériel déclaré", () => {
    expect(hasWeightsEquipment([], [])).toBe(false);
    expect(hasWeightsEquipment(undefined, undefined)).toBe(false);
    expect(hasWeightsEquipment(null, null)).toBe(false);
  });

  test("false si le matériel déclaré ne comporte que des machines/accessoires non chargés", () => {
    expect(hasWeightsEquipment(["squat_rack", "bench", "leg_press", "cable_machine"], ["cones", "speed_ladder"])).toBe(
      false
    );
  });

  test("true si une charge portable est présente côté salle", () => {
    expect(hasWeightsEquipment(["dumbbells_medium"], [])).toBe(true);
    expect(hasWeightsEquipment(["barbell"], [])).toBe(true);
    expect(hasWeightsEquipment(["kettlebell"], [])).toBe(true);
  });

  test("true si une charge portable est présente côté maison", () => {
    expect(hasWeightsEquipment([], ["home_dumbbells"])).toBe(true);
    expect(hasWeightsEquipment([], ["home_kettlebell"])).toBe(true);
    expect(hasWeightsEquipment([], ["sandbag"])).toBe(true);
  });

  test("chaque id de WEIGHT_EQUIPMENT_IDS déclenche true isolément", () => {
    for (const id of WEIGHT_EQUIPMENT_IDS) {
      expect(hasWeightsEquipment([id], [])).toBe(true);
    }
  });
});

describe("CORE_FIELD_KEYS — le socle est constant", () => {
  test("exactement 3 tests, toujours les mêmes", () => {
    expect(CORE_FIELD_KEYS).toEqual(["broadJumpCm", "sprint10s", "endurance6min_m"]);
  });

  test("aucun des 3 tests socle ne nécessite de matériel", () => {
    const materielFields = new Set([
      ...EQUIPMENT_OPTIONAL_FIELD_KEYS,
      ...SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS,
    ]);
    for (const key of CORE_FIELD_KEYS) {
      expect(materielFields.has(key)).toBe(false);
    }
  });

  test("chaque test socle a une ligne 'pourquoi' non vide", () => {
    for (const key of CORE_FIELD_KEYS) {
      expect(CORE_FIELD_WHY[key]).toEqual(expect.any(String));
      expect(CORE_FIELD_WHY[key].length).toBeGreaterThan(0);
    }
  });

  test("le socle n'apparaît jamais dans la liste des tests optionnels (pas de doublon)", () => {
    for (const key of CORE_FIELD_KEYS) {
      expect(OPTIONAL_FIELD_KEYS).not.toContain(key);
    }
  });
});

describe("getOptionalFields — indépendant de tout cycle/playlist", () => {
  test("sans matériel, la section optionnelle n'exige jamais de matériel de salle", () => {
    const fields = getOptionalFields({ hasWeightsEquipment: false, ageCategory: null });
    expect(fields).toEqual(OPTIONAL_FIELD_KEYS);
    expect(fields).not.toContain("gobletKg");
    expect(fields).not.toContain("splitKg");
    expect(fields).not.toContain("trapbar3rmKg");
  });

  test("la section optionnelle ne contient jamais Yo-Yo IR1 (retiré, Phase A)", () => {
    const fields = getOptionalFields({ hasWeightsEquipment: true, ageCategory: "Senior" });
    expect(fields).not.toContain("yoYoIR1_m");
  });

  test("avec matériel, ajoute le module salle (goblet + split)", () => {
    const fields = getOptionalFields({ hasWeightsEquipment: true, ageCategory: null });
    expect(fields).toEqual(
      expect.arrayContaining(["gobletKg", "gobletReps", "splitKg", "splitReps"])
    );
  });

  test("avec matériel mais sans catégorie senior, jamais de trap bar 3RM", () => {
    for (const ageCategory of [null, "U13", "U15", "U17", "U18"] as const) {
      const fields = getOptionalFields({ hasWeightsEquipment: true, ageCategory });
      expect(fields).not.toContain("trapbar3rmKg");
    }
  });

  test("trap bar 3RM seulement si Senior ET matériel", () => {
    expect(getOptionalFields({ hasWeightsEquipment: true, ageCategory: "Senior" })).toContain(
      "trapbar3rmKg"
    );
    expect(getOptionalFields({ hasWeightsEquipment: false, ageCategory: "Senior" })).not.toContain(
      "trapbar3rmKg"
    );
  });

  test("la liste de base ne dépend d'aucun cycle actif (même résultat quel que soit le profil hors matériel/âge)", () => {
    const withoutEquip = getOptionalFields({ hasWeightsEquipment: false, ageCategory: "Senior" });
    expect(withoutEquip).toEqual(OPTIONAL_FIELD_KEYS);
  });
});

describe("Complétude — chaque test connu est soit socle, soit dans une des listes optionnelles (ou volontairement retiré)", () => {
  test("FIELD_DEFS = socle ∪ optionnel ∪ salle ∪ salle senior ∪ Yo-Yo (seule exception retirée)", () => {
    const covered = new Set<string>([
      ...CORE_FIELD_KEYS,
      ...OPTIONAL_FIELD_KEYS,
      ...EQUIPMENT_OPTIONAL_FIELD_KEYS,
      ...SENIOR_EQUIPMENT_OPTIONAL_FIELD_KEYS,
    ]);
    const RETIRED = new Set(["yoYoIR1_m"]);
    for (const def of FIELD_DEFS) {
      const isCovered = covered.has(def.key) || RETIRED.has(def.key);
      expect(isCovered).toBe(true);
    }
  });
});
