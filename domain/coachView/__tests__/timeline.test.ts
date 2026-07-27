// domain/coachView/__tests__/timeline.test.ts
// « Que s'est-il passé ? » : uniquement des faits datés, du plus récent au plus ancien.
//
// FIXTURES D'EXÉCUTION : elles doivent rester des états que le serveur peut
// réellement produire, sinon un test passe sur des données impossibles. La règle
// (miroir de functions/src/projector.ts et de domain/coachView/execution.ts) :
//   somme pondérée = faits + adaptés + remplacés équivalents + 0,5 × remplacés partiels
//   pourcentage    = arrondi(somme pondérée ÷ nombre TOTAL d'exercices × 100)
// Les exercices sautés ou sans statut connu comptent dans le total en pesant 0 :
// les compteurs ne somment donc pas toujours au total, mais ne le dépassent jamais.

import { buildPlayerTimeline, timelineEventDateLabel } from "../timeline";
import { makeView } from "./fixtures";

const TODAY = "2026-07-27";

describe("buildPlayerTimeline", () => {
  test("aucune donnée → aucune ligne inventée", () => {
    expect(buildPlayerTimeline(makeView({}, TODAY), TODAY)).toEqual([]);
  });

  test("une ligne par séance faite, la plus récente en haut", () => {
    const view = makeView(
      { activity: { doneDateKeys: ["2026-07-20", "2026-07-26", "2026-07-23"] } },
      TODAY,
    );
    const events = buildPlayerTimeline(view, TODAY);
    expect(events.map((e) => e.dateKey)).toEqual(["2026-07-26", "2026-07-23", "2026-07-20"]);
    expect(events.every((e) => e.type === "seance_faite")).toBe(true);
    expect(events.every((e) => e.source === "execution")).toBe(true);
  });

  test("le détail de séance n'est attaché qu'à la séance dont on le connaît", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26", "2026-07-23"] },
        lastDone: {
          dateKey: "2026-07-26",
          // Couple RÉEL du serveur (FOCUS_MAP : focus "strength").
          title: "Séance renfo / force",
          focusLabel: "Renfo / Force",
          intensityLabel: "Modérée",
          durationMin: 40,
          blockCount: 4,
        },
      },
      TODAY,
    );
    const events = buildPlayerTimeline(view, TODAY);
    expect(events[0].contexte).toBe("Séance renfo / force · 40 min · 4 blocs");
    expect(events[1].contexte).toBeNull(); // on n'invente pas le détail des anciennes
  });

  test("séance prévue non réalisée : type dédié, source moteur", () => {
    const view = makeView(
      {
        lastPlanned: {
          dateKey: "2026-07-22",
          title: "Force",
          focusLabel: null,
          intensityLabel: null,
          durationMin: 45,
          blockCount: null,
        },
        activity: { doneDateKeys: ["2026-07-18"] },
      },
      TODAY,
    );
    const events = buildPlayerTimeline(view, TODAY);
    const prevue = events.find((e) => e.dateKey === "2026-07-22");
    expect(prevue?.type).toBe("seance_prevue_non_faite");
    expect(prevue?.libelle).toBe("Séance prévue non réalisée");
    expect(prevue?.source).toBe("moteur");
  });

  test("séance prévue à venir → simple information", () => {
    const view = makeView(
      {
        lastPlanned: {
          dateKey: "2026-07-29",
          title: "Explosivité",
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
        },
        activity: { doneDateKeys: ["2026-07-26"] },
      },
      TODAY,
    );
    const events = buildPlayerTimeline(view, TODAY);
    expect(events[0].type).toBe("seance_prevue");
    expect(events[0].libelle).toBe("Séance prévue");
  });

  test("écarts d'exécution : compteurs et raisons, en clair", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26"] },
        lastDone: {
          dateKey: "2026-07-26",
          title: "Renfo",
          focusLabel: null,
          intensityLabel: null,
          durationMin: 40,
          blockCount: 4,
        },
        // 7 faits + 2 adaptés + 0 remplacé = 9 sur 10 exercices → 90 %.
        // (L'ancien 70 % de cette fixture était IMPOSSIBLE avec ces compteurs :
        // aucun total entier ne le produit — cf. note en tête du fichier.)
        execution: {
          completionPct: 90,
          completionStatus: "partial",
          itemsDone: 7,
          itemsAdapted: 2,
          itemsSkipped: 1,
          itemsReplaced: 0,
          itemsReplacedEquivalent: 0,
          itemsReplacedPartial: 0,
          itemsTotal: 10,
          deviationLabels: ["Manque de temps"],
        },
      },
      TODAY,
    );
    const ecarts = buildPlayerTimeline(view, TODAY).find((e) => e.type === "execution_ecarts");
    expect(ecarts?.libelle).toBe("Séance réalisée en partie");
    // « des exercices réalisés » et non « réalisé » tout court : le pourcentage
    // compte des exercices, il ne mesure ni l'effort ni la qualité de la séance.
    expect(ecarts?.contexte).toBe(
      "90 % des exercices réalisés · 7 exercices faits, 2 adaptés, 1 sauté, raison : Manque de temps",
    );
    expect(ecarts?.source).toBe("execution");
  });

  test("séance complète sans écart → pas de ligne d'exécution bavarde", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26"] },
        // Cas DÉGRADÉ voulu : le serveur ne transmet que le statut, aucun
        // compteur. Les trois champs de détail restent donc `null` eux aussi —
        // on ne fabrique ni total ni nuance de remplacement.
        execution: {
          completionPct: null,
          completionStatus: "full",
          itemsDone: null,
          itemsAdapted: null,
          itemsSkipped: null,
          itemsReplaced: null,
          itemsReplacedEquivalent: null,
          itemsReplacedPartial: null,
          itemsTotal: null,
          deviationLabels: [],
        },
      },
      TODAY,
    );
    const events = buildPlayerTimeline(view, TODAY);
    expect(events.some((e) => e.type === "execution_ecarts")).toBe(false);
  });

  test("ajustement moteur : libellé qui ne se confond pas avec un choix du joueur", () => {
    const view = makeView(
      {
        adaptation: { adapted: true, labels: ["Volume réduit"] },
        activity: { doneDateKeys: ["2026-07-26"] },
      },
      TODAY,
    );
    const ajustement = buildPlayerTimeline(view, TODAY).find(
      (e) => e.type === "ajustement_moteur",
    );
    expect(ajustement?.libelle).toBe("Séance ajustée par FKS");
    expect(ajustement?.contexte).toBe("Volume réduit");
    expect(ajustement?.source).toBe("moteur");
  });

  test("identifiants stables et uniques (listes React)", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26", "2026-07-23"] },
        lastPlanned: {
          dateKey: "2026-07-29",
          title: null,
          focusLabel: "Vitesse",
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
        },
      },
      TODAY,
    );
    const ids = buildPlayerTimeline(view, TODAY).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildPlayerTimeline(view, TODAY).map((e) => e.id)).toEqual(ids); // déterministe
  });

  test("aucun JSON ni token moteur dans les textes", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26"] },
        adaptation: { adapted: true, labels: ["Volume réduit"] },
        // 4 faits sur 8 exercices → 50 %, la valeur transmise. 4 + 3 sautés = 7 :
        // le 8e exercice est resté sans statut (séance abandonnée), il compte
        // dans le total en pesant 0. Les compteurs ne somment donc pas au total.
        execution: {
          completionPct: 50,
          completionStatus: "abandoned",
          itemsDone: 4,
          itemsAdapted: 0,
          itemsSkipped: 3,
          itemsReplaced: 0,
          itemsReplacedEquivalent: 0,
          itemsReplacedPartial: 0,
          itemsTotal: 8,
          deviationLabels: ["Autre raison"],
        },
      },
      TODAY,
    );
    const texte = buildPlayerTimeline(view, TODAY)
      .map((e) => `${e.libelle} ${e.contexte ?? ""}`)
      .join(" ");
    expect(texte).not.toMatch(/[{}[\]]/);
    expect(texte).not.toMatch(/token:|_id\b|null|undefined/);
  });
});

describe("timelineEventDateLabel", () => {
  test("date lisible, ou repli honnête", () => {
    const view = makeView({ activity: { doneDateKeys: ["2026-07-04"] } }, TODAY);
    const event = buildPlayerTimeline(view, TODAY)[0];
    expect(timelineEventDateLabel(event)).toBe("samedi 4 juillet");
    expect(timelineEventDateLabel({ ...event, dateKey: null })).toBe("Date inconnue");
  });
});
