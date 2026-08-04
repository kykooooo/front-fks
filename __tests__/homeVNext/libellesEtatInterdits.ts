// __tests__/homeVNext/libellesEtatInterdits.ts
// =============================================================================
// D1 — LA LISTE DES JUGEMENTS GLOBAUX INTERDITS
// =============================================================================
//
// DECISION DU FONDATEUR (D1, 2026-07-28), apres avoir regarde la variante 2 :
//   « La pastille d'etat global est RETIREE COMPLETEMENT de la variante
//     "Progression integree". Aucun de ces libelles, ni aucun autre jugement
//     global : "En forme", "Frais", "Pret a performer", "Un peu charge",
//     "Charge moderee".
//     Motif : le modele de charge utilise encore des valeurs initiales
//     artificielles et ne connait pas les entrainements club. Une pastille
//     "Charge FKS" ne pourra revenir que le jour ou son calcul reposera sur des
//     donnees entierement reelles avec une portee expliquee. »
//
// POURQUOI CE FICHIER N'EST PAS UN `.test.ts`
// -----------------------------------------------------------------------------
// Il est LU par plusieurs suites (le ViewModel du Home, la carte, l'ecran
// entier). Si la liste vivait dans l'une d'elles et que les autres l'importaient,
// les `describe` de la premiere seraient rejoues dans chacune des autres. Le nom
// de ce fichier ne contient donc pas `.test.` : le `testMatch` de
// `jest.worktree.config.js` (`**/__tests__/**/*.test.ts(x)`) ne le ramasse pas.
//
// POURQUOI LA LISTE EST LUE, ET NON RECOPIEE
// -----------------------------------------------------------------------------
// Les six premiers libelles sortent de `config/trainingDefaults.FOOTBALL_LABELS`
// — la source canonique de `getFootballLabel(tsb).label`, c'est-a-dire
// exactement ce qui alimentait la pastille (`HomeVNextTrend.stateLabel`). Les
// lire garantit que l'ajout d'un septieme etat dans la config est couvert sans
// que personne y pense. Une liste recopiee aurait vieilli en silence, et c'est
// precisement le genre de garde qui donne du vert sans rien proteger.
//
// `config/trainingDefaults.ts` est HORS PERIMETRE MODIFIABLE : il est importe,
// jamais touche.
// =============================================================================

import { FOOTBALL_LABELS } from "../../config/trainingDefaults";

/**
 * Les deux libelles que le fondateur a nommes et qui ne sont PAS des `label` de
 * `FOOTBALL_LABELS` — d'ou l'ajout a la main, avec leur provenance exacte :
 *   - « Prêt à performer » : `message` de l'etat OPTIMAL
 *     (`config/trainingDefaults.ts`:149). Il n'a jamais ete affiche par le Home,
 *     mais le fondateur l'a cite, donc il est garde.
 *   - « Charge modérée » : `screens/newSession/resetExplain.ts`:91.
 */
const HORS_FOOTBALL_LABELS = ["Prêt à performer", "Charge modérée"] as const;

/** Tous les jugements globaux qui ne doivent apparaitre nulle part en variante 2. */
export const LIBELLES_ETAT_INTERDITS: readonly string[] = [
  ...Object.values(FOOTBALL_LABELS).map((etat) => etat.label),
  ...HORS_FOOTBALL_LABELS,
];

/**
 * Ceux qui sont REELLEMENT produits par le Home, donc ceux qu'un ecart de code
 * pourrait faire reapparaitre. Sert aux messages d'echec : savoir lequel des
 * libelles est sorti aide plus qu'un « le corpus contient un mot interdit ».
 */
export const LIBELLES_ETAT_DU_JOUR: readonly string[] = Object.values(FOOTBALL_LABELS).map(
  (etat) => etat.label
);
