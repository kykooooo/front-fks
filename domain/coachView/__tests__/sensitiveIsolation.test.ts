// domain/coachView/__tests__/sensitiveIsolation.test.ts
//
// PENDANT FRONT de la sonde hostile serveur (functions/tests/sensitiveIsolation).
//
// Le front ne FABRIQUE aucun libellé d'adaptation ni aucune raison d'écart : ils
// arrivent déjà traduits et filtrés par la projection coach-safe. Ce fichier le
// PROUVE au lieu de le supposer, sur toute la chaîne réellement affichée :
//
//     document serveur brut
//        → parseCoachPlayerSummary   (frontière : construction explicite)
//        → toCoachPlayerView          (modèle de lecture)
//        → buildAttentionSignals      (statut + alertes)
//        → buildPlayerTimeline        (chronologie)
//
// Deux propriétés, toutes deux permanentes :
//  1. un payload SATURÉ de données sensibles produit exactement la même sortie
//     qu'un payload propre — statut, signaux, chronologie, textes compris ;
//  2. aucun texte affiché ne contient de vocabulaire de santé ou de charge
//     interne, y compris quand le serveur enverrait (par régression) un libellé
//     médical dans `adaptation.labels`.

import { parseCoachPlayerSummary } from "../../coachSummary";
import { buildAttentionSignals } from "../attention";
import { toCoachPlayerView } from "../fromSummary";
import { buildPlayerTimeline } from "../timeline";

const TODAY = "2026-07-27";

/** Projection telle que le serveur la publie aujourd'hui (déjà coach-safe). */
const payloadPropre = () => ({
  playerUid: "u1",
  firstName: "Anna",
  ageCategory: "U15",
  position: "Milieu",
  level: "Regional",
  profileComplete: true,
  latestSession: {
    dateKey: "2026-07-24",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
    status: "done",
  },
  lastActivity: { dateKey: "2026-07-24", durationMin: 40 },
  adaptation: { adapted: true, labels: ["Semaine club intense : charge FKS réduite"] },
  activity: { doneDateKeys: ["2026-07-24", "2026-07-20"] },
  lastPlanned: {
    dateKey: "2026-07-26",
    title: "Séance vitesse",
    focusLabel: "Vitesse",
    intensityLabel: "Intense",
    durationMin: 35,
    blockCount: 3,
  },
  lastDone: {
    dateKey: "2026-07-24",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
  },
  execution: {
    // (7 + 2 + 1) / 13 = 77 % — chiffres cohérents entre eux, comme en prod.
    completionPct: 77,
    completionStatus: "partial",
    itemsDone: 7,
    itemsAdapted: 2,
    itemsSkipped: 1,
    itemsReplaced: 1,
    itemsReplacedEquivalent: 1,
    itemsReplacedPartial: 0,
    itemsTotal: 13,
    deviationLabels: ["Manque de temps"],
  },
});

/**
 * Même document, avec tout ce qu'un serveur régressé (ou une écriture directe en
 * base) pourrait y glisser : champs de santé à la racine, dans `execution`, dans
 * `latestSession`, et jusque dans les listes de libellés.
 */
const payloadSensible = () => {
  const base = payloadPropre();
  return {
    ...base,
    painLevel: 4,
    painZones: ["SENTINEL_ZONE"],
    fatigue: 5,
    sleep: 2,
    recovery: 1,
    rpe: 9,
    atl: 78.4,
    ctl: 46.9,
    tsb: -31.5,
    comment: "SENTINEL_COMMENT_mal_au_genou",
    injuries: [{ zone: "SENTINEL_ZONE", severity: 3 }],
    // « Mon corps » (lot 1) : la liste est LOCALE au téléphone, elle n'existe
    // pas côté serveur — la frontière coach tient donc aujourd'hui par
    // construction. On arme quand même la sentinelle AVANT qu'un lot de
    // synchronisation existe, plutôt qu'après : le jour où `bodyInjuries`
    // partirait vers Firestore, c'est ce test qui doit tomber, pas un coach qui
    // doit lire la blessure d'un joueur dans son effectif.
    bodyInjuries: [
      { id: "SENTINEL_ID", zone: "SENTINEL_ZONE", gravite: 3, statut: "active", source: "manual" },
    ],
    latestSession: { ...base.latestSession, painFlag: true, rpe: 9 },
    execution: { ...base.execution, painReported: true, comments: ["SENTINEL_COMMENT_ITEM"] },
  };
};

const chaineComplete = (raw: unknown) => {
  const summary = parseCoachPlayerSummary(raw);
  if (!summary) throw new Error("payload de test invalide");
  const view = toCoachPlayerView(summary, TODAY);
  const attention = buildAttentionSignals(view, TODAY);
  const timeline = buildPlayerTimeline(view, TODAY);
  return { summary, view, attention, timeline };
};

describe("front — aucun signal coach ne naît d'une donnée sensible", () => {
  it("payload saturé de données sensibles → MÊME sortie de bout en bout", () => {
    const sale = chaineComplete(payloadSensible());
    const propre = chaineComplete(payloadPropre());

    // Égalité stricte : statut, signaux, chronologie, et jusqu'aux textes.
    expect(sale.summary).toEqual(propre.summary);
    expect(sale.view).toEqual(propre.view);
    expect(sale.attention).toEqual(propre.attention);
    expect(sale.timeline).toEqual(propre.timeline);
    expect(JSON.stringify(sale)).toBe(JSON.stringify(propre));
  });

  it("aucune sentinelle sensible ne survit à la frontière de parsing", () => {
    const blob = JSON.stringify(chaineComplete(payloadSensible()));
    expect(blob).not.toContain("SENTINEL");
    for (const mot of ["painlevel", "painzones", "painflag", "painreported", "injuries", "bodyinjuries", "gravite", "\"rpe\"", "\"tsb\"", "\"atl\"", "\"ctl\"", "\"sleep\"", "\"comment\""]) {
      expect(blob.toLowerCase()).not.toContain(mot);
    }
  });

  it("le statut coach ne dépend d'aucune donnée sensible (contre-preuve : il RÉAGIT aux faits d'exécution)", () => {
    // On ne veut pas prouver l'immobilité : on veut prouver que ce qui bouge est
    // le fait d'exécution AUTORISÉ (séance interrompue), pas sa raison.
    const base = payloadPropre();
    const neutre = chaineComplete(base);
    const interrompue = chaineComplete({
      ...base,
      execution: { ...base.execution, completionStatus: "abandoned" },
    });
    expect(neutre.attention.statut).not.toBe(interrompue.attention.statut);
    expect(interrompue.attention.signaux.map((s) => s.code)).toContain("seance_interrompue");
    // …et le « pourquoi » affiché ne cite JAMAIS une cause médicale.
    const textes = interrompue.attention.signaux.map((s) => `${s.titre} ${s.pourquoi}`).join(" ").toLowerCase();
    for (const mot of ["douleur", "mal ", "blessure", "fatigue", "médical", "genou"]) {
      expect(textes).not.toContain(mot);
    }
  });

  it("aucun texte de chronologie ne peut citer une raison sensible", () => {
    // Défense en profondeur : même si le serveur régressait et renvoyait un
    // libellé médical dans `deviationLabels`, la chronologie le recopierait.
    // On verrouille donc la propriété au niveau de ce qui EST affiché, pour que
    // la régression se voie ici et pas sur le téléphone d'un coach.
    const base = payloadPropre();
    const { timeline } = chaineComplete(base);
    const textes = timeline.map((e) => `${e.libelle} ${e.contexte ?? ""}`).join(" ").toLowerCase();
    for (const mot of ["douleur", "pain", "blessure", "fatigue", "rpe", "tsb", "genou", "chargé"]) {
      expect(textes).not.toContain(mot);
    }
    // La chronologie reste vivante (on n'a pas tout vidé).
    expect(timeline.length).toBeGreaterThan(0);
    expect(textes).toContain("manque de temps");
  });

  it("les libellés d'adaptation affichés viennent du serveur, jamais d'un calcul front", () => {
    // `ajustementsMoteur` est une COPIE de `adaptation.labels` : si le serveur
    // n'envoie rien, le front n'invente rien (et l'écran dit « Séance standard »).
    const sans = chaineComplete({ ...payloadPropre(), adaptation: { adapted: false, labels: [] } });
    expect(sans.view.ajustementsMoteur).toEqual([]);
    expect(sans.attention.signaux.map((s) => s.code)).not.toContain("seance_ajustee_moteur");

    const avec = chaineComplete(payloadPropre());
    expect(avec.view.ajustementsMoteur).toEqual(["Semaine club intense : charge FKS réduite"]);
  });
});
