// screens/newSession/__tests__/resumeContexte.test.ts
//
// Verrou du helper de récap du pied collant (SPEC_DA_ACCUEIL_SEANCE.md §3.7).
// Les 6 scénarios demandés par la mission : lieu seul, mixte, sans matériel
// terrain, sans matériel salle, +N, aucun lieu.

import { resumerContexte, construireLibelles } from "../resumeContexte";
import type { EnvironmentSelection } from "../types";

const LIBELLES = construireLibelles(
  [
    { id: "power_sled", label: "Traîneau / Sled" },
    { id: "trap_bar", label: "Trap bar / Hex bar" },
    { id: "cable_machine", label: "Poulie / Cable" },
  ],
  [
    { id: "home_small", label: "Petit matériel" },
    { id: "backpack", label: "Sac à dos chargé" },
    { id: "water_bottles", label: "Bouteilles d'eau" },
    { id: "chair", label: "Chaise / Banc" },
  ],
  [
    { id: "field", label: "Terrain herbe / synthé" },
    { id: "cones", label: "Cônes" },
    { id: "bodyweight", label: "Poids du corps" }, // volontairement ignoré (voir construireLibelles)
    { id: "gym_full", label: "Équipement complet" }, // idem : jamais un vrai choix du joueur
  ]
);

describe("resumerContexte", () => {
  test("lieu seul, un élément coché → lieu + Équipement standard + libellé", () => {
    const environment: EnvironmentSelection = ["gym"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: ["power_sled"],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Salle · Équipement standard + Traîneau / Sled");
  });

  test("mixte : lieux joints par + DANS L'ORDRE DE SÉLECTION", () => {
    const environment: EnvironmentSelection = ["pitch", "home"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: ["field", "home_small"],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Terrain + Maison · Terrain herbe / synthé + Petit matériel");
  });

  test("terrain sans matériel coché → Poids du corps", () => {
    const environment: EnvironmentSelection = ["pitch"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: [],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Terrain · Poids du corps");
  });

  test("salle sans coche → Équipement standard (sans +)", () => {
    const environment: EnvironmentSelection = ["gym"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: [],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Salle · Équipement standard");
  });

  test("+N : au-delà de 2 libellés connus, les 2 premiers puis +N", () => {
    const environment: EnvironmentSelection = ["home"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: ["home_small", "backpack", "water_bottles", "chair"],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Maison · Petit matériel + Sac à dos chargé +2");
  });

  test("aucun lieu → invite à en choisir un, sans lire le matériel", () => {
    const environment: EnvironmentSelection = [];
    const resume = resumerContexte({
      environment,
      selectedEquipment: ["home_small", "backpack", "water_bottles", "chair"],
      libelles: LIBELLES,
    });
    expect(resume).toBe("Choisis un lieu pour continuer.");
  });

  test("ids sans libellé connu (gym_full, bodyweight) sont ignorés, jamais comptés comme un choix réel", () => {
    const environment: EnvironmentSelection = ["gym"];
    const resume = resumerContexte({
      environment,
      selectedEquipment: ["gym_full", "bodyweight"],
      libelles: LIBELLES,
    });
    // Rien de réellement coché derrière ces deux ids → même résultat que
    // selectedEquipment vide.
    expect(resume).toBe("Salle · Équipement standard");
  });
});

describe("construireLibelles", () => {
  test("fusionne plusieurs catalogues et exclut gym_full/bodyweight", () => {
    expect(LIBELLES.power_sled).toBe("Traîneau / Sled");
    expect(LIBELLES.home_small).toBe("Petit matériel");
    expect(LIBELLES.field).toBe("Terrain herbe / synthé");
    expect(LIBELLES.bodyweight).toBeUndefined();
    expect(LIBELLES.gym_full).toBeUndefined();
  });
});
