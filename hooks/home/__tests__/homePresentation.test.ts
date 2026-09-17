// hooks/home/__tests__/homePresentation.test.ts
// Helpers purs de l'en-tête et de la bande « Cette semaine » — sans renderer.

import { decrireJourSemaine, extrairePrenom, salutation } from "../homePresentation";
import type { PrimaryCtaKind } from "../usePrimaryCta";

describe("extrairePrenom", () => {
  test("null / undefined → null", () => {
    expect(extrairePrenom(null)).toBeNull();
    expect(extrairePrenom(undefined)).toBeNull();
  });

  test("chaîne vide ou faite uniquement d'espaces → null", () => {
    expect(extrairePrenom("")).toBeNull();
    expect(extrairePrenom("   ")).toBeNull();
  });

  test("un seul mot → ce mot", () => {
    expect(extrairePrenom("Kyllian")).toBe("Kyllian");
  });

  test("nom composé « Prénom Nom » → le premier mot seul", () => {
    expect(extrairePrenom("Kyllian Le Bris")).toBe("Kyllian");
  });

  test("prénom à trait d'union conservé intact (pas coupé sur le trait)", () => {
    expect(extrairePrenom("Jean-Pierre Dupont")).toBe("Jean-Pierre");
  });

  test("espaces superflus autour et entre les mots sont ignorés", () => {
    expect(extrairePrenom("   Marvin   Durand ")).toBe("Marvin");
  });
});

describe("salutation", () => {
  const KINDS_DEFAUT: PrimaryCtaKind[] = ["start_today", "start_pending", "choose_cycle", "prepare"];

  test("day_off avec prénom", () => {
    expect(salutation("day_off", "Kyllian")).toBe("Bien joué, Kyllian.");
  });

  test("day_off sans prénom — jamais de virgule orpheline, jamais « joueur »", () => {
    expect(salutation("day_off", null)).toBe("Bien joué.");
  });

  test("recovery avec prénom", () => {
    expect(salutation("recovery", "Marvin")).toBe("Salut, Marvin.");
  });

  test("recovery sans prénom", () => {
    expect(salutation("recovery", null)).toBe("Salut.");
  });

  test.each(KINDS_DEFAUT)("%s avec prénom → « À toi de jouer »", (kind) => {
    expect(salutation(kind, "Kyllian")).toBe("À toi de jouer, Kyllian.");
  });

  test.each(KINDS_DEFAUT)("%s sans prénom → « À toi de jouer. » sans virgule", (kind) => {
    expect(salutation(kind, null)).toBe("À toi de jouer.");
  });

  test("aucune sortie ne contient jamais le mot « joueur »", () => {
    const kinds: PrimaryCtaKind[] = [
      "day_off",
      "recovery",
      "start_today",
      "start_pending",
      "choose_cycle",
      "prepare",
    ];
    for (const kind of kinds) {
      expect(salutation(kind, "Kyllian")).not.toMatch(/joueur/i);
      expect(salutation(kind, null)).not.toMatch(/joueur/i);
    }
  });
});

describe("decrireJourSemaine", () => {
  const JOUR_NEUTRE = {
    isToday: false,
    hasFks: false,
    hasExt: false,
    hasPlanned: false,
    hasMatch: false,
    hasClub: false,
  };

  test("rien du tout — juste le jour", () => {
    expect(decrireJourSemaine(JOUR_NEUTRE, "lundi")).toBe("lundi, rien de prévu");
  });

  test("aujourd'hui, rien de prévu", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, isToday: true }, "jeudi")).toBe(
      "jeudi, aujourd'hui, rien de prévu"
    );
  });

  test("séance FKS faite", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, hasFks: true }, "mardi")).toBe(
      "mardi, séance FKS faite"
    );
  });

  test("séance prévue (planifiée, pas encore faite)", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, hasPlanned: true }, "mercredi")).toBe(
      "mercredi, séance prévue"
    );
  });

  test("activité externe enregistrée sans séance FKS", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, hasExt: true }, "vendredi")).toBe(
      "vendredi, activité enregistrée hors FKS"
    );
  });

  test("priorité hasFks > hasExt > hasPlanned — comme la pastille visuelle", () => {
    expect(
      decrireJourSemaine({ ...JOUR_NEUTRE, hasFks: true, hasExt: true, hasPlanned: true }, "samedi")
    ).toBe("samedi, séance FKS faite");
    expect(
      decrireJourSemaine({ ...JOUR_NEUTRE, hasExt: true, hasPlanned: true }, "samedi")
    ).toBe("samedi, activité enregistrée hors FKS");
  });

  test("match proche ce jour-là", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, hasMatch: true }, "dimanche")).toBe(
      "dimanche, rien de prévu, match"
    );
  });

  test("entraînement club ce jour-là", () => {
    expect(decrireJourSemaine({ ...JOUR_NEUTRE, hasClub: true }, "jeudi")).toBe(
      "jeudi, rien de prévu, club"
    );
  });

  test("match prioritaire sur club le même jour", () => {
    expect(
      decrireJourSemaine({ ...JOUR_NEUTRE, hasMatch: true, hasClub: true }, "jeudi")
    ).toBe("jeudi, rien de prévu, match");
  });

  test("combinaison complète : aujourd'hui + séance FKS faite + match", () => {
    expect(
      decrireJourSemaine(
        { ...JOUR_NEUTRE, isToday: true, hasFks: true, hasMatch: true },
        "jeudi"
      )
    ).toBe("jeudi, aujourd'hui, séance FKS faite, match");
  });
});
