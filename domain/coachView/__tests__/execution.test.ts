// domain/coachView/__tests__/execution.test.ts
//
// Ce que ces tests protègent : un pourcentage affiché à un entraîneur doit
// pouvoir être REFAIT de tête à partir de ce qui est écrit à côté.
//
//  1. Le cas réaliste (12 exercices → 79 %) se décompose en catégories
//     EXCLUSIVES dont la somme vaut le total, et l'opération affichée redonne
//     bien le chiffre annoncé.
//  2. Dès qu'une pièce manque (total, nature des remplacements, un compteur),
//     AUCUNE formule n'est fabriquée : on nomme ce qui manque.
//  3. Une décomposition qui ne reproduit pas le pourcentage transmis n'est
//     jamais montrée — un calcul faux est pire qu'un calcul absent.
//
// Lancement depuis un worktree : npx jest --config jest.coach.config.js

import {
  COACH_EXECUTION_OPAQUE_MOTIFS,
  COACH_EXECUTION_OPAQUE_TEXTE,
  COACH_EXECUTION_POIDS,
  buildExecutionBreakdown,
} from "../execution";
import type { CoachExecutionView } from "../types";

/** Exécution complète, alignée sur le test de preuve serveur : 12 exercices → 79 %. */
function execution(overrides: Partial<CoachExecutionView> = {}): CoachExecutionView {
  return {
    pourcentage: 79,
    statut: "partielle",
    statutLibelle: "Séance réalisée en partie",
    fait: 7,
    adapte: 1,
    saute: 1,
    remplace: 2,
    remplaceEquivalent: 1,
    remplacePartiel: 1,
    total: 12,
    raisons: [],
    ...overrides,
  };
}

describe("buildExecutionBreakdown — le calcul se refait de tête", () => {
  test("aucune exécution connue → null (l'écran a déjà son état dégradé)", () => {
    expect(buildExecutionBreakdown(null)).toBeNull();
  });

  test("cas réaliste : les catégories exclusives somment au total", () => {
    const detail = buildExecutionBreakdown(execution());
    expect(detail?.verifiable).toBe(true);
    if (detail?.verifiable !== true) return;

    const somme = detail.lignes.reduce((acc, ligne) => acc + ligne.nombre, 0);
    expect(somme).toBe(detail.total);
    expect(detail.total).toBe(12);
    // Le reste du total est nommé, pas silencieusement absorbé.
    expect(detail.lignes.find((l) => l.cle === "non_renseigne")?.nombre).toBe(1);
  });

  test("l'opération affichée redonne le pourcentage annoncé", () => {
    const detail = buildExecutionBreakdown(execution());
    if (detail?.verifiable !== true) throw new Error("décomposition attendue vérifiable");

    expect(detail.sommePonderee).toBe(9.5);
    expect(detail.calcul).toBe("7 + 1 + 1 + 0,5 = 9,5 sur 12 exercices, soit 79 %");
    // La preuve arithmétique, recalculée ici sans réutiliser le code testé.
    expect(Math.round((9.5 / 12) * 100)).toBe(79);
  });

  test("les poids sont ceux de la règle écrite à l'écran", () => {
    expect(COACH_EXECUTION_POIDS.fait).toBe(1);
    expect(COACH_EXECUTION_POIDS.adapte).toBe(1);
    expect(COACH_EXECUTION_POIDS.remplace_equivalent).toBe(1);
    expect(COACH_EXECUTION_POIDS.remplace_partiel).toBe(0.5);
    expect(COACH_EXECUTION_POIDS.saute).toBe(0);
    expect(COACH_EXECUTION_POIDS.non_renseigne).toBe(0);
  });

  test("aucun « non renseigné » quand les catégories couvrent déjà le total", () => {
    // 7 + 1 + 1 + 1 + 1 = 11 exercices classés sur 11 : rien ne reste.
    // 9,5 / 11 = 86,4 → 86, d'où le pourcentage transmis.
    const detail = buildExecutionBreakdown(execution({ total: 11, pourcentage: 86 }));
    if (detail?.verifiable !== true) throw new Error("décomposition attendue vérifiable");
    expect(detail.lignes.some((l) => l.cle === "non_renseigne")).toBe(false);
  });

  test("les catégories qui pèsent zéro n'encombrent pas l'opération", () => {
    // 7 faits, 1 adapté, 5 sautés, 0 remplacement, sur 14 → 8 / 14 = 57 %.
    const detail = buildExecutionBreakdown(
      execution({
        pourcentage: 57,
        saute: 5,
        total: 14,
        remplace: 0,
        remplaceEquivalent: 0,
        remplacePartiel: 0,
      }),
    );
    if (detail?.verifiable !== true) throw new Error("décomposition attendue vérifiable");
    expect(detail.calcul).toBe("7 + 1 = 8 sur 14 exercices, soit 57 %");
    // Les catégories restent affichées, elles : c'est ce qui prouve l'exclusivité.
    expect(detail.lignes.map((l) => l.cle)).toContain("saute");
  });
});

describe("buildExecutionBreakdown — ce qu'on ne sait pas ne se fabrique pas", () => {
  test("total absent → aucune formule, motif nommé", () => {
    const detail = buildExecutionBreakdown(execution({ total: null }));
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("total_absent");
    expect(detail.texte).toContain("nombre total d'exercices");
  });

  test("total à zéro : dénominateur impossible → traité comme inconnu, jamais comme un total", () => {
    const detail = buildExecutionBreakdown(execution({ total: 0 }));
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("total_absent");
  });

  test("nature des remplacements inconnue → on ne répartit pas au hasard", () => {
    const detail = buildExecutionBreakdown(
      execution({ remplaceEquivalent: null, remplacePartiel: null }),
    );
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("remplacements_indetermines");
  });

  test("zéro remplacement : la répartition est PROUVÉE, pas devinée", () => {
    // `remplace = 0` est la somme de deux compteurs positifs ou nuls : chacun
    // vaut donc zéro. Déduction arithmétique, seule exception admise.
    const detail = buildExecutionBreakdown(
      execution({
        pourcentage: 73,
        remplace: 0,
        remplaceEquivalent: null,
        remplacePartiel: null,
        fait: 7,
        adapte: 1,
        saute: 1,
        total: 11,
      }),
    );
    expect(detail?.verifiable).toBe(true);
  });

  test("un compteur manquant → aucune décomposition", () => {
    const detail = buildExecutionBreakdown(execution({ adapte: null }));
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("compteurs_absents");
  });

  test("compteurs supérieurs au total → catégories non exclusives, on n'affiche rien", () => {
    const detail = buildExecutionBreakdown(execution({ total: 5 }));
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("somme_superieure_au_total");
  });

  test("pourcentage non reproductible → jamais de démonstration fausse", () => {
    const detail = buildExecutionBreakdown(execution({ pourcentage: 95 }));
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("pourcentage_non_reproduit");
  });

  test("1 point d'écart reste toléré : les deux côtés arrondissent", () => {
    // 9,5 / 12 = 79,17 → 79. Un serveur qui tronque annoncerait 78 : même calcul.
    expect(buildExecutionBreakdown(execution({ pourcentage: 78 }))?.verifiable).toBe(true);
    expect(buildExecutionBreakdown(execution({ pourcentage: 80 }))?.verifiable).toBe(true);
    expect(buildExecutionBreakdown(execution({ pourcentage: 81 }))?.verifiable).toBe(false);
  });

  test("pourcentage absent : le calcul reste montrable, sans annoncer de %", () => {
    const detail = buildExecutionBreakdown(execution({ pourcentage: null }));
    if (detail?.verifiable !== true) throw new Error("décomposition attendue vérifiable");
    expect(detail.pourcentage).toBeNull();
    expect(detail.calcul).toBe("7 + 1 + 1 + 0,5 = 9,5 sur 12 exercices");
    expect(detail.calcul).not.toContain("%");
  });

  test("valeur illisible (document ancien) → inconnu, jamais NaN à l'écran", () => {
    // `undefined` ne peut pas venir du parseur, mais un document jamais reparsé
    // le produirait : `NaN sur undefined exercices` serait affiché au coach.
    const abime = execution({ total: undefined as unknown as number });
    const detail = buildExecutionBreakdown(abime);
    expect(detail?.verifiable).toBe(false);
    if (detail?.verifiable !== false) return;
    expect(detail.motif).toBe("total_absent");
  });

  test("chaque motif porte une phrase affichable, distincte des autres", () => {
    const textes = COACH_EXECUTION_OPAQUE_MOTIFS.map(
      (motif) => COACH_EXECUTION_OPAQUE_TEXTE[motif],
    );
    // Table complète : aucun motif sans phrase.
    textes.forEach((texte) => expect((texte ?? "").length).toBeGreaterThan(40));
    // Et aucune phrase recyclée : un « détail indisponible » générique ne dirait
    // pas au coach CE QUI manque, donc ne lui apprendrait rien.
    expect(new Set(textes).size).toBe(COACH_EXECUTION_OPAQUE_MOTIFS.length);
  });
});
