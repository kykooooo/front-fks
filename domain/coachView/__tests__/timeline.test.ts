// domain/coachView/__tests__/timeline.test.ts
// « Que s'est-il passé ? » : uniquement des faits datés, du plus récent au plus ancien.

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
        execution: {
          completionPct: 70,
          completionStatus: "partial",
          itemsDone: 7,
          itemsAdapted: 2,
          itemsSkipped: 1,
          itemsReplaced: 0,
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
      "70 % des exercices réalisés · 7 exercices faits, 2 adaptés, 1 sauté, raison : Manque de temps",
    );
    expect(ecarts?.source).toBe("execution");
  });

  test("séance complète sans écart → pas de ligne d'exécution bavarde", () => {
    const view = makeView(
      {
        activity: { doneDateKeys: ["2026-07-26"] },
        execution: {
          completionPct: null,
          completionStatus: "full",
          itemsDone: null,
          itemsAdapted: null,
          itemsSkipped: null,
          itemsReplaced: null,
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
        execution: {
          completionPct: 50,
          completionStatus: "abandoned",
          itemsDone: 4,
          itemsAdapted: 0,
          itemsSkipped: 3,
          itemsReplaced: 0,
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
