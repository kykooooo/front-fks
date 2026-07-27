// domain/coachView/__tests__/fromSummary.test.ts
// Projection serveur → modèle de lecture coach.
// Cas prioritaire : AUJOURD'HUI aucun champ v2 n'existe. L'absence doit produire
// un modèle exploitable, jamais un plantage ni un chiffre inventé.

import { toCoachPlayerView, toCoachPlayerViews, ASSIDUITE_JOURS } from "../fromSummary";
import { makeSummary } from "./fixtures";

const TODAY = "2026-07-27"; // lundi

describe("toCoachPlayerView — projection MINIMALE (cas nominal aujourd'hui)", () => {
  test("aucun champ v2 → tout à null, aucun 0 inventé", () => {
    const view = toCoachPlayerView(makeSummary(), TODAY);

    expect(view.playerUid).toBe("u1");
    expect(view.prenom).toBe("Anna");
    expect(view.initiale).toBe("A");
    expect(view.derniereActivite).toBeNull();
    expect(view.seancePrevue).toBeNull();
    expect(view.seanceFaite).toBeNull();
    expect(view.execution).toBeNull();
    expect(view.assiduite).toBeNull(); // et surtout PAS { faitesSur7j: 0 }
    expect(view.datesSeancesFaites).toEqual([]);
    expect(view.ajustementsMoteur).toEqual([]);
    expect(view.statut).toBe("unknown");
  });

  test("prénom absent → initiale de repli, jamais de crash", () => {
    const view = toCoachPlayerView(makeSummary({ firstName: null }), TODAY);
    expect(view.initiale).toBe("?");
    expect(view.prenom).toBeNull();
  });

  test("prénom accentué → initiale correcte", () => {
    expect(toCoachPlayerView(makeSummary({ firstName: "Élise" }), TODAY).initiale).toBe("É");
  });
});

describe("toCoachPlayerView — séance prévue et séance faite COEXISTENT", () => {
  test("latestSession 'planned' alimente la séance prévue seulement", () => {
    const view = toCoachPlayerView(
      makeSummary({
        latestSession: {
          dateKey: "2026-07-28",
          // Couple RÉEL du serveur (FOCUS_MAP : focus "strength") : titre et type
          // viennent de la même source, ils ne peuvent pas se contredire.
          title: "Séance renfo / force",
          focusLabel: "Renfo / Force",
          intensityLabel: "Modérée",
          durationMin: 40,
          blockCount: 4,
          status: "planned",
        },
      }),
      TODAY,
    );
    expect(view.seancePrevue).toEqual({
      dateKey: "2026-07-28",
      titre: "Séance renfo / force",
      focus: "Renfo / Force",
      intensite: "Modérée",
      dureeMin: 40,
      nbBlocs: 4,
    });
    expect(view.seanceFaite).toBeNull();
  });

  test("lastPlanned + lastDone remplissent les DEUX slots (contrat v2)", () => {
    const view = toCoachPlayerView(
      makeSummary({
        lastPlanned: {
          dateKey: "2026-07-26",
          title: "Force bas du corps",
          focusLabel: "Renfo / Force",
          intensityLabel: "Élevée",
          durationMin: 45,
          blockCount: 5,
        },
        lastDone: {
          dateKey: "2026-07-25",
          title: "Explosivité",
          focusLabel: "Vitesse",
          intensityLabel: "Modérée",
          durationMin: 35,
          blockCount: 4,
        },
      }),
      TODAY,
    );
    expect(view.seancePrevue?.dateKey).toBe("2026-07-26");
    expect(view.seanceFaite?.dateKey).toBe("2026-07-25");
  });

  test("lastPlanned prend le dessus sur latestSession", () => {
    const view = toCoachPlayerView(
      makeSummary({
        latestSession: {
          dateKey: "2026-07-20",
          title: "Ancienne",
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
          status: "planned",
        },
        lastPlanned: {
          dateKey: "2026-07-28",
          title: "Nouvelle",
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
        },
      }),
      TODAY,
    );
    expect(view.seancePrevue?.titre).toBe("Nouvelle");
  });

  test("lastActivity seule → séance faite datée, sans détail inventé", () => {
    const view = toCoachPlayerView(
      makeSummary({ lastActivity: { dateKey: "2026-07-26", durationMin: 38 } }),
      TODAY,
    );
    expect(view.seanceFaite).toEqual({
      dateKey: "2026-07-26",
      titre: null,
      focus: null,
      intensite: null,
      dureeMin: 38,
      nbBlocs: null,
    });
    expect(view.derniereActivite).toEqual({
      dateKey: "2026-07-26",
      joursEcoules: 1,
      libelle: "Hier",
    });
  });

  test("référence de séance entièrement vide → null (rien à afficher)", () => {
    const view = toCoachPlayerView(
      makeSummary({
        lastPlanned: {
          dateKey: null,
          title: null,
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
        },
      }),
      TODAY,
    );
    expect(view.seancePrevue).toBeNull();
  });
});

describe("toCoachPlayerView — exécution (boucle de suivi joueur)", () => {
  test("exécution complète → vue traduite en français", () => {
    const view = toCoachPlayerView(
      makeSummary({
        lastDone: {
          dateKey: "2026-07-26",
          title: "Séance renfo / force",
          focusLabel: "Renfo / Force",
          intensityLabel: "Élevée",
          durationMin: 45,
          blockCount: 5,
        },
        execution: {
          completionPct: 72,
          completionStatus: "partial",
          itemsDone: 8,
          itemsAdapted: 2,
          itemsSkipped: 1,
          itemsReplaced: 0,
          itemsReplacedEquivalent: 0,
          itemsReplacedPartial: 0,
          itemsTotal: 11,
          deviationLabels: ["Manque de temps", "Autre raison"],
        },
      }),
      TODAY,
    );
    expect(view.execution).toEqual({
      pourcentage: 72,
      statut: "partielle",
      statutLibelle: "Séance réalisée en partie",
      fait: 8,
      adapte: 2,
      saute: 1,
      remplace: 0,
      remplaceEquivalent: 0,
      remplacePartiel: 0,
      total: 11,
      raisons: ["Manque de temps", "Autre raison"],
    });
  });

  test("bloc exécution entièrement vide → null (une absence n'est pas une mesure)", () => {
    const view = toCoachPlayerView(
      makeSummary({
        execution: {
          completionPct: null,
          completionStatus: null,
          itemsDone: null,
          itemsAdapted: null,
          itemsSkipped: null,
          itemsReplaced: null,
          itemsReplacedEquivalent: null,
          itemsReplacedPartial: null,
          itemsTotal: null,
          deviationLabels: [],
        },
      }),
      TODAY,
    );
    expect(view.execution).toBeNull();
  });
});

describe("toCoachPlayerView — ajustements MOTEUR (piège produit)", () => {
  test("adaptation.adapted → libellés d'ajustement FKS, jamais des choix du joueur", () => {
    const view = toCoachPlayerView(
      makeSummary({
        adaptation: { adapted: true, labels: ["Volume réduit", "Impacts limités"] },
      }),
      TODAY,
    );
    expect(view.ajustementsMoteur).toEqual(["Volume réduit", "Impacts limités"]);
    expect(view.execution).toBeNull(); // le joueur, lui, n'a rien déclaré
  });

  test("adapted=false → aucun ajustement affiché même si des labels traînent", () => {
    const view = toCoachPlayerView(
      makeSummary({ adaptation: { adapted: false, labels: ["Volume réduit"] } }),
      TODAY,
    );
    expect(view.ajustementsMoteur).toEqual([]);
  });
});

describe("toCoachPlayerView — assiduité", () => {
  const activity = {
    doneDateKeys: ["2026-07-26", "2026-07-24", "2026-07-21", "2026-07-14"],
  };

  test("fenêtre d'activité → 14 jours, du plus ancien au plus récent", () => {
    const view = toCoachPlayerView(makeSummary({ activity }), TODAY);
    expect(view.assiduite).not.toBeNull();
    expect(view.assiduite!.jours).toHaveLength(ASSIDUITE_JOURS);
    expect(view.assiduite!.jours[0].dateKey).toBe("2026-07-14");
    expect(view.assiduite!.jours[ASSIDUITE_JOURS - 1].dateKey).toBe(TODAY);
    // 7 derniers jours = 21 → 27 juillet : 26, 24 et 21.
    expect(view.assiduite!.faitesSur7j).toBe(3);
    // 14 derniers jours = 14 → 27 juillet : la 4e date (14 juillet) est incluse.
    expect(view.assiduite!.faitesSur14j).toBe(4);
  });

  test("sans fenêtre d'activité → assiduité null, pas un 0 trompeur", () => {
    const view = toCoachPlayerView(
      makeSummary({ lastActivity: { dateKey: "2026-07-26", durationMin: 40 } }),
      TODAY,
    );
    expect(view.assiduite).toBeNull();
    expect(view.datesSeancesFaites).toEqual(["2026-07-26"]); // le fait, lui, existe
  });

  test("dates fusionnées, dédupliquées, triées, bornées à 14", () => {
    const beaucoup = Array.from({ length: 20 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const view = toCoachPlayerView(
      makeSummary({
        activity: { doneDateKeys: beaucoup },
        lastActivity: { dateKey: "2026-07-20", durationMin: 30 },
      }),
      TODAY,
    );
    expect(view.datesSeancesFaites).toHaveLength(14);
    expect(view.datesSeancesFaites[0]).toBe("2026-07-20");
    expect(new Set(view.datesSeancesFaites).size).toBe(14);
  });
});

describe("toCoachPlayerView — robustesse horloge", () => {
  test("todayKey invalide → pas de calcul relatif inventé", () => {
    const view = toCoachPlayerView(
      makeSummary({
        activity: { doneDateKeys: ["2026-07-26"] },
        lastActivity: { dateKey: "2026-07-26", durationMin: 40 },
      }),
      "pas-une-date",
    );
    expect(view.derniereActivite).toBeNull();
    expect(view.assiduite).toBeNull();
    expect(view.datesSeancesFaites).toEqual(["2026-07-26"]);
  });

  test("dates invalides côté serveur → ignorées", () => {
    const view = toCoachPlayerView(
      makeSummary({ activity: { doneDateKeys: ["2026-02-30", "pas une date"] } }),
      TODAY,
    );
    expect(view.datesSeancesFaites).toEqual([]);
  });
});

describe("toCoachPlayerViews", () => {
  test("conserve l'ordre d'entrée", () => {
    const views = toCoachPlayerViews(
      [makeSummary({ playerUid: "b" }), makeSummary({ playerUid: "a" })],
      TODAY,
    );
    expect(views.map((v) => v.playerUid)).toEqual(["b", "a"]);
  });
});
