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

  test("nom — consigne, sans ':' (fréquent dans les circuits)", () => {
    const raw =
      "Hydratation + collation protéinée — Eau + shaker ou yaourt grec, à prendre en parallèle";
    expect(parseStepLine(raw)).toEqual({
      name: "Hydratation + collation protéinée",
      consigne: "Eau + shaker ou yaourt grec, à prendre en parallèle",
      raw,
    });
  });

  test("':' situé après le premier tiret : le ':' appartient à la consigne", () => {
    const raw =
      "ÉCHAUFFEMENT — 5 min : footing léger + gammes athlétiques + 3 accélérations progressives";
    expect(parseStepLine(raw)).toEqual({
      name: "ÉCHAUFFEMENT",
      consigne: "5 min : footing léger + gammes athlétiques + 3 accélérations progressives",
      raw,
    });
  });

  test("ligne numérotée sans ':' : découpée sur le tiret", () => {
    const raw =
      "1. Sprint navette 10-20-10 m — Sprint 10 m, touche le sol, 20 m, touche, 10 m retour. Explosif à chaque départ";
    expect(parseStepLine(raw)).toEqual({
      name: "1. Sprint navette 10-20-10 m",
      consigne:
        "Sprint 10 m, touche le sol, 20 m, touche, 10 m retour. Explosif à chaque départ",
      raw,
    });
  });

  test("repli : aucun séparateur", () => {
    const raw = "Gainage latéral statique 30 secondes de chaque côté";
    expect(parseStepLine(raw)).toEqual({ raw });
  });

  test("repli : partie avant le tiret trop longue pour être un nom", () => {
    const raw =
      "Enchaîne les trois exercices sans temps de repos entre chaque mouvement du circuit — puis récupère 1 min";
    expect(parseStepLine(raw)).toEqual({ raw });
  });
});
