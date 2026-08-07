// screens/profilVNext/fixtures.ts
// =============================================================================
// Profil vNext — JEUX D'ESSAI (harnais + tests, jamais l'app)
// =============================================================================
// Chaque fixture est un `ProfilVNextInput` COMPLET (aucun champ omis, aucun
// spread) au FORMAT REEL de ce que le produit persiste — rapport formats du
// 07/08 :
//   - `position` / `level` / `dominantFoot` / `mainObjective` : les valeurs
//     Firestore SANS accents (allowlists Cloud Functions). La seule exception
//     reelle est le « i » circonflexe de « entraînements » — il est persiste
//     ainsi, ne pas le « corriger ».
//   - `cycle.microcycleGoal` : un des 5 ids canoniques (le store canonicalise
//     a l'ecriture, un legacy ne peut pas arriver jusqu'ici).
//   - `tests.lastTs` : des millisecondes (le produit ecrit `Date.now()`).
//   - `club.badge` : une chaine EXACTE de `clubMembershipCopy`
//     (domain/clubRoles.ts:170,178,187).
//
// Toutes les donnees sont inventees (`__fictif: true`). L'instant de reference
// est fige et SANS fuseau, comme au Home.
// =============================================================================

import type { ProfilVNextInput } from "./viewModel";

/** Mercredi 6 aout 2026, fin de journee. Sans fuseau, comme au Home. */
export const FIXTURE_NOW_ISO = "2026-08-06T18:30:00";
export const FIXTURE_TODAY_KEY = "2026-08-06";

/**
 * `ts` de tests au format reel (ms). Construits par `new Date(...)` local —
 * exactement comme `Date.now()` au moment de la saisie. Deterministe sur la
 * machine du harnais.
 */
const TS_TEST_RECENT = new Date("2026-07-26T17:40:00").getTime();
const TS_TEST_ANCIEN = new Date("2026-05-11T10:05:00").getTime();

export type ProfilFixture = {
  id: string;
  titre: string;
  description: string;
  __fictif: true;
  input: ProfilVNextInput;
};

export const PROFIL_VNEXT_FIXTURES: ProfilFixture[] = [
  {
    id: "joueur-complet",
    titre: "Joueur installe, tout renseigne",
    description:
      "Profil complet, cycle Force en cours (4e seance), tests recents, club " +
      "avec role simple. L'ecran de reference pour comparer les variantes.",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Kylian",
        position: "Milieu",
        level: "Regional",
        dominantFoot: "Pied droit",
        mainObjective: "Gagner en vitesse / explosivite",
        targetFksSessionsPerWeek: 3,
        clubTrainingsPerWeek: 2,
        matchesPerWeek: 1,
      },
      displayNameAuth: "Kylian",
      cycle: { microcycleGoal: "force", microcycleSessionIndex: 3 },
      tests: { count: 5, lastTs: TS_TEST_RECENT },
      club: { clubId: "club-fictif-1", nom: "ES Fauville", badge: "Joueur" },
    },
  },
  {
    id: "compte-neuf",
    titre: "Compte neuf, setup termine",
    description:
      "Vient de finir le setup : identite et rythme declares, cycle auto pose " +
      "(0 seance faite), aucun test, aucun club. RIEN n'est fabrique pour " +
      "combler : pas d'etat de forme, pas de compteur.",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Nael",
        position: "Defenseur",
        level: "Amateur",
        dominantFoot: "Pied gauche",
        mainObjective: "Etre en forme toute la saison",
        targetFksSessionsPerWeek: 2,
        clubTrainingsPerWeek: 2,
        matchesPerWeek: 1,
      },
      displayNameAuth: "Nael",
      cycle: { microcycleGoal: "fondation", microcycleSessionIndex: 0 },
      tests: { count: 0, lastTs: null },
      club: { clubId: null, nom: null, badge: null },
    },
  },
  {
    id: "profil-partiel",
    titre: "Vieux compte, champs manquants",
    description:
      "Compte anterieur aux champs recents : pas d'objectif declare, pas de " +
      "cible FKS, pas de matchs. Chaque absence s'affiche « A definir » et " +
      "renvoie au setup — jamais un defaut invente (pas de « ?? 2 »).",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Sofiane",
        position: "Attaquant",
        level: "National",
        dominantFoot: null,
        mainObjective: null,
        targetFksSessionsPerWeek: null,
        clubTrainingsPerWeek: 3,
        matchesPerWeek: null,
      },
      displayNameAuth: "Sofiane",
      cycle: { microcycleGoal: "endurance", microcycleSessionIndex: 7 },
      tests: { count: 2, lastTs: TS_TEST_ANCIEN },
      club: { clubId: null, nom: null, badge: null },
    },
  },
  {
    id: "chargement",
    titre: "Identite pas encore chargee",
    description:
      "Le onSnapshot du doc joueur n'a pas rendu son premier instantane. " +
      "L'ecran attend — il n'affiche NI « Joueur », NI des chips vides.",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "chargement",
        firstName: null,
        position: null,
        level: null,
        dominantFoot: null,
        mainObjective: null,
        targetFksSessionsPerWeek: null,
        clubTrainingsPerWeek: null,
        matchesPerWeek: null,
      },
      displayNameAuth: "Kylian",
      cycle: { microcycleGoal: "force", microcycleSessionIndex: 3 },
      tests: { count: 5, lastTs: TS_TEST_RECENT },
      club: { clubId: "club-fictif-1", nom: "ES Fauville", badge: "Joueur" },
    },
  },
  {
    id: "proprietaire-club",
    titre: "Proprietaire-joueur d'un club",
    description:
      "Le cas club le plus charge : proprietaire ET joueur de l'effectif. La " +
      "ligne club porte le badge exact de clubMembershipCopy.",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Marvin",
        position: "Gardien",
        level: "Semi-pro",
        dominantFoot: "Ambidextre",
        mainObjective: "Reprendre apres une blessure",
        targetFksSessionsPerWeek: 4,
        clubTrainingsPerWeek: 3,
        matchesPerWeek: 2,
      },
      displayNameAuth: "Marvin",
      cycle: { microcycleGoal: "saison", microcycleSessionIndex: 11 },
      tests: { count: 12, lastTs: TS_TEST_RECENT },
      club: {
        clubId: "club-fictif-2",
        nom: "FC Rouen Sapins",
        badge: "Propriétaire-joueur",
      },
    },
  },
  {
    id: "sans-cycle",
    titre: "Aucun cycle actif",
    description:
      "Cycle abandonne, pas encore rechoisi. La ligne devient « Choisir mon " +
      "cycle », sans fait — l'absence est un etat, pas un « 0/12 ».",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Ibrahim",
        position: "Milieu",
        level: "Amateur",
        dominantFoot: "Pied droit",
        mainObjective: "Mieux encaisser les entraînements et les matchs",
        targetFksSessionsPerWeek: 2,
        clubTrainingsPerWeek: 1,
        matchesPerWeek: 1,
      },
      displayNameAuth: "Ibrahim",
      cycle: { microcycleGoal: null, microcycleSessionIndex: 0 },
      tests: { count: 1, lastTs: TS_TEST_ANCIEN },
      club: { clubId: "club-fictif-3", nom: "AS Bolbec", badge: "Membre" },
    },
  },
  {
    id: "stress-textes-longs",
    titre: "Resistance aux textes longs",
    description:
      "Pas un etat produit : le test de mise en page. Prenom compose, objectif " +
      "le plus long du referentiel, nom de club a rallonge, cycle au label le " +
      "plus large. A regarder en 320 px et en texte x1,3.",
    __fictif: true,
    input: {
      nowISO: FIXTURE_NOW_ISO,
      profil: {
        etat: "pret",
        firstName: "Jean-Christophe",
        position: "Defenseur",
        level: "Regional",
        dominantFoot: "Pied gauche",
        mainObjective: "Mieux encaisser les entraînements et les matchs",
        targetFksSessionsPerWeek: 4,
        clubTrainingsPerWeek: 5,
        matchesPerWeek: 2,
      },
      displayNameAuth: "Jean-Christophe",
      cycle: { microcycleGoal: "saison", microcycleSessionIndex: 9 },
      tests: { count: 30, lastTs: TS_TEST_RECENT },
      club: {
        clubId: "club-fictif-4",
        nom: "Association Sportive Gonfreville-l'Orcher Football",
        badge: "Encadrant-joueur",
      },
    },
  },
];

/**
 * Ce que le harnais rend : les etats produit + le cas de resistance.
 * (Meme decoupage qu'au Home : `stress-textes-longs` n'est pas un etat produit,
 * il est rendu en plus pour qu'on puisse le regarder.)
 */
export const PROFIL_VNEXT_FIXTURES_RENDU = PROFIL_VNEXT_FIXTURES;
