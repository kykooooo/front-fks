// prototype/home-vnext/lib/scenariosActuel.js
// =============================================================================
// JEUX DE DONNEES FICTIVES POUR LE HOME **DE PRODUCTION**
// =============================================================================
// Repris tel quel du harnais d'audit de juillet 2026, a trois differences pres :
//   - la racine du depot vient de `paths.js` (plus de chemin machine en dur) ;
//   - un scenario derive a ete ajoute (`apres-echec-generation`), signale comme
//     tel : le Home actuel n'a AUCUN etat d'erreur de generation, il fallait
//     bien montrer ce que le joueur voit reellement apres un echec ;
//   - chaque scenario porte `__fictif: true`.
//
// Aucune donnee reelle, aucun acces reseau. Les charges journalieres sont
// simulees avec le VRAI moteur (`engine/loadModel`) pour que le TSB du store et
// la courbe 7 jours du Home racontent la meme histoire.
//
// NOTE IMPORTANTE : ces scenarios alimentent les STORES — c'est ce que lit le
// Home actuel. Les 14 fixtures du prototype, elles, alimentent un ViewModel. Les
// deux mondes ne se melangent jamais : voir `mapping.js` pour la correspondance
// etat par etat, et la liste explicite de ce qui n'a pas d'equivalent.
// =============================================================================
"use strict";

const path = require("path");
const { APP_ROOT } = require("./paths");
const { updateTrainingLoad } = require(path.join(APP_ROOT, "engine/loadModel.ts"));
const { TRAINING_DEFAULTS } = require(path.join(APP_ROOT, "config/trainingDefaults.ts"));

// --- horloge fictive : jeudi 30 juillet 2026, 9h30 ---
// Meme jour que `FIXTURE_NOW_ISO` cote prototype (9h15) : les deux colonnes du
// mode cote a cote parlent bien du meme jeudi.
const TODAY_KEY = "2026-07-30";
const NOW_ISO = `${TODAY_KEY}T09:30:00`;

const pad2 = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Cle de date a J-offset (offset > 0 = passe, < 0 = futur). */
function dk(offset) {
  const d = new Date(`${TODAY_KEY}T12:00:00`);
  d.setDate(d.getDate() - offset);
  return toKey(d);
}
/** ISO local a J-offset, heure donnee. */
function iso(offset, time = "18:30:00") {
  return `${dk(offset)}T${time}`;
}
/** Jour de la semaine "mon".."sun" a J-offset. */
function dow(offset) {
  const d = new Date(`${dk(offset)}T12:00:00`);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}

// ---------------------------------------------------------------------------
// Simulation de charge : reproduit EXACTEMENT hooks/home/useLoadSeries
// (21 j de warmup + 7 j affiches, graines ATL0/CTL0).
// ---------------------------------------------------------------------------
const WINDOW = 28;

function simulate(dailyApplied) {
  let atl = TRAINING_DEFAULTS.ATL0;
  let ctl = TRAINING_DEFAULTS.CTL0;
  const series = [];
  for (let i = WINDOW - 1; i >= 0; i -= 1) {
    const key = dk(i);
    const load = Number(dailyApplied[key] ?? 0) || 0;
    const next = updateTrainingLoad(atl, ctl, load, { dtDays: 1 });
    atl = next.atl;
    ctl = next.ctl;
    if (i <= 6) series.push(Number(next.tsb.toFixed(1)));
  }
  return { atl, ctl, tsb: ctl - atl, series };
}

/**
 * `shape` = charges relatives par jour (cle = J-offset). On cherche le facteur
 * d'echelle qui amene le TSB final sur `target` : le profil de charge reste
 * realiste, seule son amplitude est calee.
 */
function scaleToTsb(shape, target) {
  const build = (f) => {
    const out = {};
    for (const [off, v] of Object.entries(shape)) {
      const load = Math.round(v * f);
      if (load > 0) out[dk(Number(off))] = load;
    }
    return out;
  };
  let lo = 0;
  let hi = 12;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { tsb } = simulate(build(mid));
    // plus la charge monte, plus le TSB descend -> fonction decroissante
    if (tsb > target) lo = mid;
    else hi = mid;
  }
  const factor = (lo + hi) / 2;
  const dailyApplied = build(factor);
  const sim = simulate(dailyApplied);
  return { dailyApplied, factor, ...sim };
}

// ---------------------------------------------------------------------------
// Fabriques d'objets metier
// ---------------------------------------------------------------------------
let seq = 0;
const nextId = (p) => `${p}_${(seq += 1)}`;

function session({ offset, completed = true, focus = "strength", intensity = "moderate", aiV2 = null, durationMin = 45 }) {
  const key = dk(offset);
  return {
    id: nextId("s"),
    date: key,
    dateISO: key,
    focus,
    phase: "Playlist",
    intensity,
    volumeScore: 12,
    exercises: [],
    completed,
    durationMin,
    createdAt: `${key}T08:00:00`,
    ...(aiV2 ? { aiV2 } : {}),
  };
}

function external({ offset, source = "club", rpe = 6, durationMin = 75 }) {
  return { id: nextId("x"), source, dateISO: dk(offset), rpe, durationMin };
}

function routine({ offset, category = "MOBILITÉ EXPRESS", title = "Flow hanches 8 min", durationMin = 8 }) {
  return { id: nextId("r"), dateISO: `${dk(offset)}T19:00:00`, category, title, durationMin };
}

const ai = (title, focus, intensity, min) => ({
  title,
  focusPrimary: focus,
  intensity,
  durationMin: min,
});

// ---------------------------------------------------------------------------
// Profils de charge reutilisables (cle = J-offset)
// ---------------------------------------------------------------------------
/** 3 seances FKS + 2 entrainements club par semaine, sur 4 semaines. */
const SHAPE_REGULIER = (() => {
  const s = {};
  for (let i = 1; i <= 27; i += 1) {
    const d = dow(i);
    if (d === "tue" || d === "thu") s[i] = 100; // club
    else if (d === "mon" || d === "sat") s[i] = 75; // FKS
    else if (d === "sun") s[i] = 110; // match
  }
  return s;
})();

/** Meme base mais grosse surcharge sur les 6 derniers jours. */
const SHAPE_SURCHARGE = (() => {
  const s = { ...SHAPE_REGULIER };
  for (let i = 0; i <= 6; i += 1) s[i] = (s[i] ?? 60) + 130;
  return s;
})();

/** Entrainement normal puis arret total il y a 24 jours. */
const SHAPE_COUPURE = (() => {
  const s = {};
  for (let i = 24; i <= 27; i += 1) s[i] = 110;
  return s;
})();

/** Un seul jour d'activite (debutant). */
const SHAPE_DEBUTANT = { 3: 90 };

// ---------------------------------------------------------------------------
// Les 12 etats
// ---------------------------------------------------------------------------
const AI_SESSION = ai("Force bas du corps", "strength", "moderate", 45);
const AI_LONGUE = ai(
  "Force bas du corps + prévention ischios et travail d'appuis en fin de séance",
  "strength",
  "hard",
  75
);

function build() {
  const list = [];

  // ---------------------------------------------------------------------
  // 1. Nouveau joueur
  // ---------------------------------------------------------------------
  list.push({
    id: "nouveau-joueur",
    titre: "Nouveau joueur",
    resume: "0 séance, aucun cycle actif, aucune charge, pas de club ni de match.",
    displayName: "Yanis",
    load: { atl: TRAINING_DEFAULTS.ATL0, ctl: TRAINING_DEFAULTS.CTL0, tsb: TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0, dailyApplied: {}, lastAppliedDate: null },
    sessions: { sessions: [], microcycleGoal: null, microcycleSessionIndex: 0, lastAiSessionV2: null },
    external: { externalLoads: [], completedRoutines: [], clubTrainingDays: [], matchDays: [] },
    sync: { storeHydrated: true, plannedFksDays: [] },
    settings: { weeklyGoal: 2 },
    attendu: { cta: "Préparer ma séance", chipCycle: false, semaine: "0/2", serie: "Nouvelle" },
  });

  // ---------------------------------------------------------------------
  // 2. Séance prévue aujourd'hui
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, -6.5);
    list.push({
      id: "seance-prevue-aujourdhui",
      titre: "Séance prévue aujourd'hui",
      resume: "Cycle Force, séance 4/12, séance du jour générée et non faite, série 3 j.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(2) },
      sessions: {
        sessions: [
          session({ offset: 12 }),
          session({ offset: 9 }),
          session({ offset: 6 }),
          session({ offset: 3 }),
          session({ offset: 0, completed: false, aiV2: AI_SESSION }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 3,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(0), sessionId: "planned-today" },
      },
      external: {
        externalLoads: [external({ offset: 1, source: "other", rpe: 5, durationMin: 40 }), external({ offset: 2 })],
        completedRoutines: [routine({ offset: 2 })],
        clubTrainingDays: ["tue", "fri"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [dk(0)] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "C'est parti !", chipCycle: "Séance 4/12 · Fondations", semaine: "1/2", serie: "3 j" },
    });
  }

  // ---------------------------------------------------------------------
  // 3. Séance terminée + feedback rempli
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, -9.2);
    list.push({
      id: "seance-terminee",
      titre: "Séance du jour terminée",
      resume: "Feedback déjà rempli (journée off), série 4 j, objectif hebdo atteint.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(0, "18:10:00") },
      sessions: {
        sessions: [
          session({ offset: 10 }),
          session({ offset: 7 }),
          session({ offset: 3 }),
          session({ offset: 0 }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 4,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(0), sessionId: "done-today" },
      },
      external: {
        externalLoads: [external({ offset: 1, source: "other", rpe: 5, durationMin: 40 }), external({ offset: 2 })],
        completedRoutines: [routine({ offset: 4 })],
        clubTrainingDays: ["tue", "fri"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Journée off", chipCycle: "Séance 5/12 · Montée en puissance", semaine: "2/2", serie: "4 j" },
    });
  }

  // ---------------------------------------------------------------------
  // 4. Journée récupération (TSB très négatif)
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_SURCHARGE, -18.5);
    list.push({
      id: "recuperation",
      titre: "Journée récupération",
      resume: "Charge très haute, le CTA bascule sur récup. Cycle Force séance 7/12.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(1) },
      sessions: {
        sessions: [
          session({ offset: 13 }),
          session({ offset: 10 }),
          session({ offset: 6 }),
          session({ offset: 3 }),
          session({ offset: 2 }),
          session({ offset: 1 }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 6,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(1), sessionId: "done-yesterday" },
      },
      external: {
        externalLoads: [external({ offset: 1 }), external({ offset: 3 }), external({ offset: 4, source: "match", rpe: 8, durationMin: 90 })],
        completedRoutines: [routine({ offset: 5 })],
        clubTrainingDays: ["tue", "thu"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Journée récup", chipCycle: "Séance 7/12 · Montée en puissance", semaine: "3/2", serie: "4 j", conseil: "Journée légère" },
    });
  }

  // ---------------------------------------------------------------------
  // 5. Reprise après interruption (24 jours)
  // ---------------------------------------------------------------------
  {
    const sim = simulate(
      Object.fromEntries(Object.entries(SHAPE_COUPURE).map(([o, v]) => [dk(Number(o)), v]))
    );
    list.push({
      id: "reprise-apres-interruption",
      titre: "Reprise après 24 jours",
      resume: "Dernière séance il y a 24 j, série 0, charges retombées, cycle figé 5/12.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(24) },
      sessions: {
        sessions: [session({ offset: 30 }), session({ offset: 27 }), session({ offset: 24 })],
        microcycleGoal: "force",
        microcycleSessionIndex: 4,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(24), sessionId: "old" },
      },
      external: {
        externalLoads: [external({ offset: 25 }), external({ offset: 26 })],
        completedRoutines: [routine({ offset: 24 })],
        clubTrainingDays: [],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Préparer ma séance", chipCycle: "Séance 5/12 · Montée en puissance", semaine: "0/2", serie: "Nouvelle" },
    });
  }

  // ---------------------------------------------------------------------
  // 6. Feedback en retard (séance d'avant-hier non validée)
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, -7.2);
    list.push({
      id: "feedback-en-retard",
      titre: "Feedback en retard",
      resume: "Séance faite il y a 2 jours toujours en attente de feedback.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(4) },
      sessions: {
        sessions: [
          session({ offset: 11 }),
          session({ offset: 8 }),
          session({ offset: 3 }),
          session({ offset: 2, completed: false, aiV2: AI_SESSION }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 5,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(2), sessionId: "pending-j2" },
      },
      external: {
        externalLoads: [external({ offset: 1, source: "other", rpe: 5, durationMin: 40 }), external({ offset: 2 })],
        completedRoutines: [routine({ offset: 6 })],
        clubTrainingDays: ["tue", "fri"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [dk(2)] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Ma séance est prête", chipCycle: "Séance 6/12 · Montée en puissance", semaine: "1/2", serie: "3 j", conseil: "Mobilité oubliée" },
    });
  }

  // ---------------------------------------------------------------------
  // 7. Progression indisponible (quasi aucune donnée)
  // ---------------------------------------------------------------------
  {
    const sim = simulate(
      Object.fromEntries(Object.entries(SHAPE_DEBUTANT).map(([o, v]) => [dk(Number(o)), v]))
    );
    list.push({
      id: "progression-indisponible",
      titre: "Progression indisponible",
      resume: "Cycle actif mais 1 seule séance : courbe de forme quasi plate.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(3) },
      sessions: {
        sessions: [session({ offset: 3 })],
        microcycleGoal: "fondation",
        microcycleSessionIndex: 0,
        lastAiSessionV2: null,
      },
      external: { externalLoads: [], completedRoutines: [], clubTrainingDays: [], matchDays: [] },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Préparer ma séance", chipCycle: "Séance 1/12 · Fondations", semaine: "1/2", serie: "Nouvelle" },
    });
  }

  // ---------------------------------------------------------------------
  // 8. Chargement (store non hydraté)
  // ---------------------------------------------------------------------
  list.push({
    id: "chargement",
    titre: "Chargement (store non hydraté)",
    resume: "storeHydrated = false : tous les sélecteurs renvoient leurs valeurs par défaut.",
    displayName: "joueur",
    load: { atl: 0, ctl: 0, tsb: 0, dailyApplied: {}, lastAppliedDate: null },
    sessions: { sessions: [], microcycleGoal: null, microcycleSessionIndex: 0, lastAiSessionV2: null },
    external: { externalLoads: [], completedRoutines: [], clubTrainingDays: [], matchDays: [] },
    sync: { storeHydrated: false, plannedFksDays: [] },
    settings: { weeklyGoal: 2 },
    attendu: { cta: "Préparer ma séance", chipCycle: false, semaine: "0/2", serie: "Nouvelle" },
  });

  // ---------------------------------------------------------------------
  // 9. Hors-ligne / sync en échec
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, -4.0);
    list.push({
      id: "hors-ligne-erreur",
      titre: "Hors-ligne (données périmées)",
      resume: "NetInfo hors-ligne : le bandeau global d'App.tsx est rendu par-dessus le Home.",
      displayName: "Yanis",
      offline: true,
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(2) },
      sessions: {
        sessions: [
          session({ offset: 9 }),
          session({ offset: 5 }),
          session({ offset: 3 }),
          session({ offset: 2 }),
          session({ offset: 0, completed: false, aiV2: AI_SESSION }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 3,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(0), sessionId: "cached-today" },
      },
      external: {
        externalLoads: [external({ offset: 1 })],
        completedRoutines: [routine({ offset: 1 })],
        clubTrainingDays: ["tue", "thu"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [dk(0)] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "C'est parti !", chipCycle: "Séance 4/12 · Fondations", semaine: "2/2", serie: "3 j" },
    });
  }

  // ---------------------------------------------------------------------
  // 10. Contenu très long (débordements)
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, -3.0);
    const longSessions = [];
    for (let i = 1; i <= 13; i += 1) longSessions.push(session({ offset: i }));
    longSessions.push(session({ offset: 0, completed: false, aiV2: AI_LONGUE }));
    list.push({
      id: "contenu-tres-long",
      titre: "Contenu très long",
      resume: "Nom à rallonge, sous-titre de CTA long, gêne signalée à libellé long, série 12 j.",
      displayName: "Jean-Baptiste de la Villardière-Montgomery",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(1) },
      sessions: {
        sessions: longSessions,
        microcycleGoal: "explosivite",
        microcycleSessionIndex: 8,
        lastAiSessionV2: { v2: AI_LONGUE, date: dk(0), sessionId: "long-today" },
      },
      external: {
        externalLoads: [external({ offset: 1 }), external({ offset: 2 }), external({ offset: 3 })],
        completedRoutines: [routine({ offset: 1 })],
        clubTrainingDays: ["tue"],
        matchDays: [dow(-2)],
      },
      feedback: {
        dayStates: {
          [dk(0)]: {
            feedback: {
              injury: { area: "ischio-jambiers de la cuisse droite (arrière)", severity: 2 },
            },
          },
        },
      },
      sync: { storeHydrated: true, plannedFksDays: [dk(0)] },
      settings: { weeklyGoal: 6 },
      attendu: { cta: "C'est parti !", chipCycle: "Séance 9/12 · Pic de forme", semaine: "3/6", serie: "13 j", conseil: "Gêne ... signalée" },
    });
  }

  // ---------------------------------------------------------------------
  // 11. Match imminent (J+1)
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, 6.2);
    list.push({
      id: "match-imminent",
      titre: "Match demain",
      resume: "Match à J+1, cycle Explosivité séance 9/12, joueur frais, série 6 j.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(1) },
      sessions: {
        sessions: [
          session({ offset: 12 }),
          session({ offset: 8 }),
          session({ offset: 5 }),
          session({ offset: 3 }),
          session({ offset: 1 }),
        ],
        microcycleGoal: "explosivite",
        microcycleSessionIndex: 8,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(1), sessionId: "done-yesterday" },
      },
      external: {
        externalLoads: [external({ offset: 2 }), external({ offset: 4 }), external({ offset: 5 }), external({ offset: 6 })],
        completedRoutines: [routine({ offset: 2 })],
        clubTrainingDays: ["tue", "thu"],
        matchDays: [dow(-1)],
      },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Préparer ma séance", chipCycle: "Séance 9/12 · Pic de forme", semaine: "2/2", serie: "6 j" },
    });
  }

  // ---------------------------------------------------------------------
  // 12. Cycle terminé (12/12)
  // ---------------------------------------------------------------------
  {
    const sim = scaleToTsb(SHAPE_REGULIER, 4.5);
    list.push({
      id: "cycle-termine",
      titre: "Cycle terminé",
      resume: "microcycleSessionIndex = 12 : le chip cycle disparaît.",
      displayName: "Yanis",
      load: { atl: sim.atl, ctl: sim.ctl, tsb: sim.tsb, dailyApplied: sim.dailyApplied, lastAppliedDate: iso(1) },
      sessions: {
        sessions: [
          session({ offset: 14 }),
          session({ offset: 10 }),
          session({ offset: 6 }),
          session({ offset: 3 }),
          session({ offset: 1 }),
        ],
        microcycleGoal: "force",
        microcycleSessionIndex: 12,
        lastAiSessionV2: { v2: AI_SESSION, date: dk(1), sessionId: "last-of-cycle" },
      },
      external: {
        externalLoads: [external({ offset: 2 })],
        completedRoutines: [routine({ offset: 1 })],
        clubTrainingDays: ["tue", "fri"],
        matchDays: [],
      },
      sync: { storeHydrated: true, plannedFksDays: [] },
      settings: { weeklyGoal: 2 },
      attendu: { cta: "Préparer ma séance", chipCycle: false, semaine: "2/2", serie: "3 j", conseil: "En forme" },
    });
  }

  // ---------------------------------------------------------------------
  // 13. Apres un echec de generation — SCENARIO DERIVE, AJOUT DU PROTOTYPE
  // ---------------------------------------------------------------------
  // Le Home ACTUEL n'a aucun etat d'erreur de generation : l'echec vit dans
  // l'ecran de generation (un toast), et le Home retombe sur "Preparer ma
  // seance" comme si rien ne s'etait passe. Ce scenario est donc la copie de
  // "match-imminent" SANS le match : c'est litteralement ce que le joueur voit
  // apres un echec. Le fait qu'il soit indiscernable d'une journee normale est
  // le constat, pas un defaut du harnais.
  // ---------------------------------------------------------------------
  {
    const base = list.find((s) => s.id === "match-imminent");
    list.push({
      ...base,
      id: "apres-echec-generation",
      titre: "Apres un echec de generation",
      resume:
        "Derive de « Match demain », match retire. Le Home actuel ne garde aucune trace de l'echec.",
      derive: "match-imminent",
      external: { ...base.external, matchDays: [] },
      attendu: { ...base.attendu, cta: "Préparer ma séance" },
    });
  }

  return list.map((sc) => ({ __fictif: true, ...sc }));
}

/** Recupere un scenario du Home actuel par identifiant. `null` si inconnu. */
function getScenario(id) {
  return build().find((s) => s.id === id) ?? null;
}

/** Transforme un scenario en patch pour scenarioState.setState. */
function toStorePatch(sc) {
  return {
    displayName: sc.displayName,
    offline: !!sc.offline,
    load: sc.load,
    sessions: sc.sessions,
    external: sc.external,
    sync: sc.sync,
    debug: { devNowISO: NOW_ISO },
    feedback: sc.feedback || { dayStates: {} },
    settings: sc.settings,
  };
}

module.exports = { build, getScenario, toStorePatch, TODAY_KEY, NOW_ISO, dk, dow, simulate };
