// screens/tests/__tests__/testConfig.test.ts
// Composition de batterie selon le matériel déclaré et la catégorie d'âge —
// fonctions pures, aucune dépendance UI.

import {
  getPlaylistFields,
  hasWeightsEquipment,
  PLAYLIST_FIELDS_BASE,
  EQUIPMENT_FIELDS,
  SENIOR_EQUIPMENT_FIELDS,
  WEIGHT_EQUIPMENT_IDS,
  type PlaylistId,
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

describe("getPlaylistFields", () => {
  const playlists: PlaylistId[] = ["fondation", "force", "explosivite", "endurance", "saison"];

  test("sans matériel, aucune playlist n'exige de matériel de salle (= batterie socle)", () => {
    for (const playlist of playlists) {
      const fields = getPlaylistFields(playlist, { hasWeightsEquipment: false, ageCategory: null });
      expect(fields).toEqual(PLAYLIST_FIELDS_BASE[playlist]);
      expect(fields).not.toContain("gobletKg");
      expect(fields).not.toContain("splitKg");
      expect(fields).not.toContain("trapbar3rmKg");
    }
  });

  test("le socle ne contient jamais Yo-Yo IR1 (retiré des parcours par défaut)", () => {
    for (const playlist of playlists) {
      const fields = getPlaylistFields(playlist, { hasWeightsEquipment: true, ageCategory: "Senior" });
      expect(fields).not.toContain("yoYoIR1_m");
    }
  });

  test("avec matériel, ajoute goblet/split pour fondation et force", () => {
    const fondation = getPlaylistFields("fondation", { hasWeightsEquipment: true, ageCategory: null });
    expect(fondation).toEqual(
      expect.arrayContaining(["gobletKg", "gobletReps", "splitKg", "splitReps"])
    );
    const force = getPlaylistFields("force", { hasWeightsEquipment: true, ageCategory: null });
    expect(force).toEqual(expect.arrayContaining(["gobletKg", "gobletReps", "splitKg", "splitReps"]));
  });

  test("avec matériel mais sans catégorie senior, jamais de trap bar 3RM", () => {
    for (const ageCategory of [null, "U13", "U15", "U17", "U18"] as const) {
      const force = getPlaylistFields("force", { hasWeightsEquipment: true, ageCategory });
      expect(force).not.toContain("trapbar3rmKg");
      const explo = getPlaylistFields("explosivite", { hasWeightsEquipment: true, ageCategory });
      expect(explo).not.toContain("trapbar3rmKg");
    }
  });

  test("trap bar 3RM seulement si Senior ET matériel", () => {
    expect(getPlaylistFields("force", { hasWeightsEquipment: true, ageCategory: "Senior" })).toContain(
      "trapbar3rmKg"
    );
    expect(getPlaylistFields("force", { hasWeightsEquipment: false, ageCategory: "Senior" })).not.toContain(
      "trapbar3rmKg"
    );
  });

  test("explosivité ajoute split squat (kg + reps) seulement avec matériel", () => {
    const withEquip = getPlaylistFields("explosivite", { hasWeightsEquipment: true, ageCategory: null });
    expect(withEquip).toEqual(expect.arrayContaining(["splitKg", "splitReps"]));
    const withoutEquip = getPlaylistFields("explosivite", { hasWeightsEquipment: false, ageCategory: null });
    expect(withoutEquip).not.toContain("splitKg");
    expect(withoutEquip).not.toContain("splitReps");
  });

  test("endurance et saison ne gagnent jamais de champ force (pas de coloration force prévue)", () => {
    for (const ageCategory of [null, "Senior"] as const) {
      const endurance = getPlaylistFields("endurance", { hasWeightsEquipment: true, ageCategory });
      expect(endurance).toEqual(PLAYLIST_FIELDS_BASE.endurance);
      const saison = getPlaylistFields("saison", { hasWeightsEquipment: true, ageCategory });
      expect(saison).toEqual(PLAYLIST_FIELDS_BASE.saison);
    }
  });

  test("le socle de chaque playlist ne contient aucun champ nécessitant du matériel", () => {
    const materielFields = new Set([
      "gobletKg",
      "gobletReps",
      "splitKg",
      "splitReps",
      "trapbar3rmKg",
      ...Object.values(EQUIPMENT_FIELDS).flat(),
      ...Object.values(SENIOR_EQUIPMENT_FIELDS).flat(),
    ]);
    for (const playlist of playlists) {
      for (const key of PLAYLIST_FIELDS_BASE[playlist]) {
        expect(materielFields.has(key)).toBe(false);
      }
    }
  });
});
