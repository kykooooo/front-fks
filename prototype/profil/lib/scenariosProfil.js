// prototype/profil/lib/scenariosProfil.js
// =============================================================================
// JEUX DE DONNEES FICTIVES POUR LE PROFIL **DE PRODUCTION**
// =============================================================================
// Un scenario par fixture du contrat (`screens/profilVNext/fixtures.ts`), avec
// des donnees EQUIVALENTES : le cote a cote compare deux ecrans nourris de la
// meme histoire, pas deux histoires differentes. Les scenarios sont DERIVES des
// fixtures (une seule source), jamais recopies a la main.
//
// Ces scenarios alimentent les STORES bouchonnes (stubs/scenarioState) — c'est
// ce que lit `screens/ProfileScreen.tsx` — plus UNE lecture hors store : les
// tests terrain, semes dans le stub AsyncStorage sous la cle exacte que
// `readTestsRaw()` consulte (`fks_tests_v1_harnais-uid`).
//
// APPROXIMATIONS ASSUMEES (patron lib/mapping.js du Home) — la liste est aussi
// exportee (`APPROXIMATIONS`) pour etre affichee dans l'onglet « Limites » :
//
//   1. CLUB — le ProfileScreen de production n'affiche AUCUN club (la carte
//      club vit aux Reglages, ~700 pt mesures par AUDIT_PROFIL.md). La donnee
//      club des fixtures n'a donc AUCUNE contrepartie cote actuel.
//   2. IDENTITE — la production lit `lastAiContext.profile`, un instantane
//      ecrit a la generation (P1-1). On y verse les MEMES valeurs persistees
//      que le doc joueur pour que le cote a cote soit comparable ; en realite
//      les deux peuvent diverger. L'etat « chargement » (lastAiContext = null)
//      montre la fabrication : la production affiche un nom de repli et perd
//      poste/niveau/pied/objectif, alors que le vNext attend sans rien inventer.
//   3. SEANCES — fabriquees : `2 x microcycleSessionIndex + 2` seances
//      completees, reparties de J-2 a J-56 (~8 semaines) AVANT `nowISO` (jamais
//      Date.now()), volumeScore 300, 45 min, focus "mixed". Plausibles, pas
//      issues d'un moteur.
//   4. CHARGE — l'amorce REELLE du store : ATL0 = 12, CTL0 = 15, TSB = +3,
//      tsbHistory vide, dailyApplied vide. C'est elle qui produit le mensonge
//      « En forme — Pret a performer » et les 7 barres identiques du graphe
//      (P0-1 / P0-2). On le MONTRE, on ne l'arrange pas.
//   5. TESTS — semes au format brut que `readTestsRaw` lit ; seuls `ts` et
//      `playlist` sont consommes par le ProfileScreen, les valeurs chiffrees
//      (saut, sprint, endurance) sont plausibles mais decoratives.
//   6. PARCOURS — aucun pathway actif : la section « Parcours » du ProfileScreen
//      n'apparait pas (les fixtures du Profil n'en portent pas).
//   7. JOURS CLUB / MATCH — ["tue","thu"] et ["sun"] des que clubParSemaine > 0.
//      Declaration plausible ; les fixtures ne portent pas de jours.
//   8. CHARGES EXTERNES — tableau vide. « Club / match : 0 sem » s'affiche donc
//      tel quel — et c'est P0-3 : meme alimente, le code le force a zero.
//
// Aucune donnee reelle, aucun acces reseau. `__fictif: true` partout.
// =============================================================================
"use strict";

const path = require("path");
const { APP_ROOT } = require("./paths");

// Meme instance module que celle servie a l'app par le hook require : le chemin
// absolu resolu est identique, Node rend donc le meme objet (require.cache).
const AsyncStorage = require("./stubs/async-storage").default;

const fixturesMod = require(path.join(APP_ROOT, "screens/profilVNext/fixtures.ts"));
const FIXTURES = fixturesMod.PROFIL_VNEXT_FIXTURES_RENDU || fixturesMod.PROFIL_VNEXT_FIXTURES;

/** Cle AsyncStorage lue par readTestsRaw() avec l'uid du stub firebase. */
const CLE_TESTS = "fks_tests_v1_harnais-uid";

// L'amorce REELLE du store de charge (config/trainingDefaults.ts : ATL0 = 12,
// CTL0 = 15). TSB = CTL0 - ATL0 = +3 : le « En forme » d'un compte neuf.
const AMORCE_LOAD = { atl: 12, ctl: 15, tsb: 3, tsbHistory: [], dailyApplied: {}, lastAppliedDate: null };

const pad2 = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Cle de date a J-offset AVANT le nowISO de la fixture (jamais Date.now()). */
function dk(nowISO, offset) {
  const d = new Date(`${nowISO.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - offset);
  return toKey(d);
}

/**
 * Les seances completees fabriquees : `2 x index + 2`, reparties de J-2 a J-56.
 * Deterministes (aucun aleatoire, aucune horloge).
 */
function fabriquerSeances(fixture) {
  const n = 2 * Math.max(0, fixture.input.cycle.microcycleSessionIndex) + 2;
  const seances = [];
  for (let i = 0; i < n; i += 1) {
    const offset = 2 + Math.round((i * 54) / Math.max(1, n - 1));
    const key = dk(fixture.input.nowISO, offset);
    seances.push({
      id: `s_${fixture.id}_${i + 1}`,
      date: key,
      dateISO: key,
      completed: true,
      completedAt: `${key}T18:30:00`,
      focus: "mixed",
      intensity: "moderate",
      volumeScore: 300,
      durationMin: 45,
      exercises: [],
    });
  }
  return seances;
}

/**
 * Les entrees de tests a semer : `count` entrees, la plus recente a `lastTs`,
 * les precedentes espacees de 9 jours. Format brut de l'app (ts en ms +
 * champs de mesure) — le ProfileScreen ne lit que `ts` et `playlist`.
 */
function fabriquerTests(fixture) {
  const { count, lastTs } = fixture.input.tests;
  if (!count || lastTs == null) return [];
  const playlist = fixture.input.cycle.microcycleGoal;
  const NEUF_JOURS_MS = 9 * 24 * 3600 * 1000;
  const entrees = [];
  for (let i = 0; i < count; i += 1) {
    entrees.push({
      ts: lastTs - i * NEUF_JOURS_MS,
      ...(playlist ? { playlist } : {}),
      broadJumpCm: 212 + ((i * 3) % 10),
      sprint10s: 46 + (i % 4),
      endurance6min_m: 1280 + ((i * 17) % 60),
    });
  }
  return entrees;
}

/** Le `lastAiContext.profile` au format que la generation ecrit reellement. */
function fabriquerAiProfile(profil) {
  return {
    first_name: profil.firstName,
    position: profil.position,
    level: profil.level,
    dominant_foot: profil.dominantFoot,
    main_objective: profil.mainObjective,
    target_fks_sessions_per_week: profil.targetFksSessionsPerWeek,
    club_trainings_per_week: profil.clubTrainingsPerWeek,
    matches_per_week: profil.matchesPerWeek,
  };
}

function fabriquerScenario(fixture) {
  const { input } = fixture;
  const clubActif = (input.profil.clubTrainingsPerWeek ?? 0) > 0;

  // L'etat « chargement » est le mensonge P1-1 en conditions reelles : memes
  // donnees que « joueur-complet », mais `lastAiContext = null` (aucune
  // generation encore). NOTE HONNETE : le repli litteral « Joueur » du code
  // (`ProfileScreen.tsx:159`) ne s'affiche que si le displayName Auth manque
  // AUSSI ; ici le displayName de la fixture est conserve (regle generale du
  // harnais), la production affiche donc le nom Auth et PERD poste / niveau /
  // pied / objectif — meme defaut, costume moins voyant.
  const estChargement = fixture.id === "chargement";
  const base = estChargement
    ? FIXTURES.find((f) => f.id === "joueur-complet").input
    : input;

  return {
    __fictif: true,
    id: fixture.id,
    titre: fixture.titre,
    resume: fixture.description,
    displayName: input.displayNameAuth,
    load: { ...AMORCE_LOAD },
    sessions: {
      sessions: fabriquerSeances({ id: fixture.id, input: base }),
      microcycleGoal: base.cycle.microcycleGoal,
      microcycleSessionIndex: base.cycle.microcycleSessionIndex,
      lastAiContext: estChargement ? null : { profile: fabriquerAiProfile(base.profil) },
      activePathwayId: null,
    },
    external: {
      externalLoads: [],
      targetFksSessionsPerWeek: base.profil.targetFksSessionsPerWeek,
      clubTrainingsPerWeek: base.profil.clubTrainingsPerWeek,
      matchesPerWeek: base.profil.matchesPerWeek,
      clubTrainingDays: clubActif ? ["tue", "thu"] : [],
      matchDays: clubActif ? ["sun"] : [],
    },
    sync: { storeHydrated: true },
    settings: { weeklyGoal: 2 },
    tests: fabriquerTests({ id: fixture.id, input: base }),
    nowISO: input.nowISO,
  };
}

let cacheListe = null;
function build() {
  if (!cacheListe) cacheListe = FIXTURES.map(fabriquerScenario);
  return cacheListe;
}

/** Recupere le scenario d'un etat par identifiant de fixture. `null` si inconnu. */
function getScenario(id) {
  return build().find((s) => s.id === id) ?? null;
}

/** Transforme un scenario en patch pour stubs/scenarioState.setState. */
function toStorePatch(sc) {
  return {
    displayName: sc.displayName,
    offline: false,
    load: sc.load,
    sessions: sc.sessions,
    external: sc.external,
    sync: sc.sync,
    debug: { devNowISO: sc.nowISO },
    feedback: { dayStates: {} },
    settings: sc.settings,
  };
}

/**
 * Seme les tests terrain dans le stub AsyncStorage — A APPELER AVANT CHAQUE
 * rendu du Profil actuel : la memoire du stub est PARTAGEE entre les rendus,
 * re-semer a chaque scenario empeche les entrees d'un etat de fuir dans le
 * suivant (count = 0 ecrit un tableau vide, il n'efface pas seulement).
 */
async function seedAsyncStorage(sc) {
  await AsyncStorage.setItem(CLE_TESTS, JSON.stringify(sc.tests));
}

/** La liste des approximations, affichee par le visualiseur (onglet Limites). */
const APPROXIMATIONS = [
  "Club : le ProfileScreen de production n'affiche aucun club (la carte club vit aux Réglages, ~700 pt — AUDIT_PROFIL.md). La donnée club des fixtures n'a pas de contrepartie côté actuel.",
  "Identité : la production lit lastAiContext.profile (instantané de génération, P1-1). Le harnais y verse les mêmes valeurs que le doc joueur pour un côte à côte comparable ; l'état « chargement » (lastAiContext = null) montre la perte — nom de repli Auth, poste/niveau/pied/objectif disparus.",
  "Séances : fabriquées (2 × index de cycle + 2, réparties de J-2 à J-56 avant l'horloge fictive), volumeScore 300, 45 min — plausibles, pas issues d'un moteur.",
  "Charge : l'amorce réelle du store (ATL 12 / CTL 15 / TSB +3, historique vide). C'est elle qui produit « En forme » et les 7 barres identiques du graphe (P0-1 / P0-2) — le harnais le montre, il ne l'arrange pas.",
  "Tests : semés dans AsyncStorage au format brut lu par readTestsRaw ; seuls ts et playlist sont consommés par l'écran, les valeurs chiffrées sont décoratives.",
  "Parcours : aucun pathway actif — la section « Parcours » du ProfileScreen n'apparaît pas.",
  "Jours club/match : mardi/jeudi + dimanche dès que le rythme club est déclaré — les fixtures ne portent pas de jours.",
  "Charges externes : tableau vide — « Club / match : 0 sem » s'affiche tel quel, et c'est P0-3 (même alimenté, le code le force à zéro).",
];

module.exports = { build, getScenario, toStorePatch, seedAsyncStorage, APPROXIMATIONS, CLE_TESTS };
