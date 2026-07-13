import { parseStepLine } from "../parseStepLine";

describe("parseStepLine", () => {
  test("nom + dosage + consigne", () => {
    expect(
      parseStepLine(
        "Cat-camel: 8 répétitions lentes — À 4 pattes, alterne dos rond (chat) et dos creux (chameau)"
      )
    ).toEqual({
      name: "Cat-camel",
      dosage: "8 répétitions lentes",
      consigne: "À 4 pattes, alterne dos rond (chat) et dos creux (chameau)",
      raw: "Cat-camel: 8 répétitions lentes — À 4 pattes, alterne dos rond (chat) et dos creux (chameau)",
    });
  });

  test("nom + dosage, sans consigne", () => {
    expect(parseStepLine("Footing léger: 3-4 min")).toEqual({
      name: "Footing léger",
      dosage: "3-4 min",
      consigne: undefined,
      raw: "Footing léger: 3-4 min",
    });
  });

  test("repli : pas de ':' avant le dosage", () => {
    const raw = "Hydratation + collation protéinée — Eau + shaker ou yaourt grec, à prendre en parallèle";
    expect(parseStepLine(raw)).toEqual({ raw });
  });

  test("repli : ':' situé après le premier tiret (dans la consigne)", () => {
    const raw = "ÉCHAUFFEMENT — 5 min : footing léger + gammes athlétiques + 3 accélérations progressives";
    expect(parseStepLine(raw)).toEqual({ raw });
  });

  test("repli : ligne numérotée sans ':'", () => {
    const raw = "1. Sprint navette 10-20-10 m — Sprint 10 m, touche le sol, 20 m, touche, 10 m retour. Explosif à chaque départ";
    expect(parseStepLine(raw)).toEqual({ raw });
  });
});
