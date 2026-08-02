// domain/coachView/roster.ts
//
// Effectif coach : recherche, filtres, tri.
//
// Objectif de terrain : en moins de 30 secondes, le coach doit pouvoir isoler
// « qui je dois vérifier aujourd'hui », « qui n'a pas fait sa séance »,
// « de qui je n'ai aucune nouvelle ». Rien de plus, rien de décoratif.
//
// NOTE PRODUIT : il n'existe VOLONTAIREMENT aucun filtre douleur/fatigue. Cette
// donnée est interdite au coach côté serveur : proposer un filtre qui ne pourra
// jamais rien renvoyer serait mentir sur ce que l'app sait faire.
//
// Module PUR. Tous les tris sont STABLES et déterministes : à égalité on
// départage toujours par prénom (fr) puis par playerUid, jamais par l'ordre
// d'arrivée de Firestore.

import { INACTIVITE_CHECK_JOURS } from "./attention";
import type { CoachPlayerView } from "./types";

export const COACH_ROSTER_FILTERS = [
  "tous",
  "a_verifier",
  "a_surveiller",
  "seance_non_faite",
  "seance_adaptee",
  "aucune_donnee_recente",
] as const;
export type CoachRosterFilter = (typeof COACH_ROSTER_FILTERS)[number];

/** Libellés d'onglets : ce que le coach lit, sans jargon. */
export const COACH_ROSTER_FILTER_LABEL: Record<CoachRosterFilter, string> = {
  tous: "Tous",
  a_verifier: "À vérifier",
  a_surveiller: "À surveiller",
  seance_non_faite: "Séance non faite",
  seance_adaptee: "Séance adaptée par le joueur",
  aucune_donnee_recente: "Sans donnée récente",
};

export const COACH_ROSTER_SORTS = ["priorite", "prenom", "activite"] as const;
export type CoachRosterSort = (typeof COACH_ROSTER_SORTS)[number];

export const COACH_ROSTER_SORT_LABEL: Record<CoachRosterSort, string> = {
  priorite: "Par priorité",
  prenom: "Par prénom",
  activite: "Par dernière séance",
};

// Plage des diacritiques combinants produits par la décomposition NFD.
// Construite par points de code : un caractère combinant écrit tel quel dans un
// fichier source ne survit pas au premier copier-coller ni à un lint agressif.
const DIACRITIQUES_COMBINANTS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

/** Minuscules + accents retirés : "Gaël" et "gael" doivent se trouver l'un l'autre. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITIQUES_COMBINANTS, "")
    .toLowerCase()
    .trim();
}

/** Recherche sur prénom, poste et niveau. Requête vide → tout le monde passe. */
export function matchesCoachSearch(view: CoachPlayerView, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const haystack = normalizeSearchText(
    [view.prenom ?? "", view.poste ?? "", view.niveau ?? ""].join(" "),
  );
  return haystack.includes(q);
}

/** true si le joueur a lui-même dévié de sa séance (adapté / sauté / remplacé). */
export function aDevieDeSaSeance(view: CoachPlayerView): boolean {
  const exec = view.execution;
  if (!exec) return false;
  return (
    (exec.adapte ?? 0) > 0 ||
    (exec.saute ?? 0) > 0 ||
    (exec.remplace ?? 0) > 0 ||
    exec.statut === "partielle" ||
    exec.statut === "interrompue"
  );
}

/** true si une séance prévue est restée sans séance faite derrière. */
export function aUneSeanceNonFaite(view: CoachPlayerView): boolean {
  return view.signaux.some((s) => s.code === "seance_prevue_non_faite");
}

/** true si on ne dispose d'aucune trace d'entraînement récente (ou d'aucune trace). */
export function sansDonneeRecente(view: CoachPlayerView): boolean {
  if (view.statut === "unknown") return true;
  if (!view.derniereActivite) return true;
  return view.derniereActivite.joursEcoules >= INACTIVITE_CHECK_JOURS;
}

export function matchesCoachFilter(view: CoachPlayerView, filter: CoachRosterFilter): boolean {
  switch (filter) {
    case "a_verifier":
      return view.statut === "check";
    case "a_surveiller":
      return view.statut === "watch";
    case "seance_non_faite":
      return aUneSeanceNonFaite(view);
    // ATTENTION : "adaptée" veut dire ADAPTÉE PAR LE JOUEUR. Une séance allégée
    // par le moteur FKS n'entre PAS dans ce filtre — c'est une autre information.
    case "seance_adaptee":
      return aDevieDeSaSeance(view);
    case "aucune_donnee_recente":
      return sansDonneeRecente(view);
    case "tous":
    default:
      return true;
  }
}

// Priorité d'affichage : ce qui demande une action humaine remonte en premier.
const STATUT_RANG: Record<CoachPlayerView["statut"], number> = {
  check: 0,
  watch: 1,
  unknown: 2,
  normal: 3,
};

const parPrenomPuisUid = (a: CoachPlayerView, b: CoachPlayerView): number => {
  const nameCmp = (a.prenom ?? "").localeCompare(b.prenom ?? "", "fr");
  if (nameCmp !== 0) return nameCmp;
  return a.playerUid < b.playerUid ? -1 : a.playerUid > b.playerUid ? 1 : 0;
};

/**
 * Tri. `priorite` (défaut) : à vérifier → à surveiller → indisponible → normal,
 * puis le plus ancien sans séance d'abord (une absence de date compte comme
 * "le plus ancien" : c'est justement ce qu'il faut regarder).
 */
export function sortCoachViews(
  views: CoachPlayerView[],
  sort: CoachRosterSort = "priorite",
): CoachPlayerView[] {
  const copie = views.slice(); // jamais de tri en place : l'appelant garde sa liste
  if (sort === "prenom") return copie.sort(parPrenomPuisUid);

  if (sort === "activite") {
    return copie.sort((a, b) => {
      // Plus récent d'abord ; inconnu en dernier (on ne le fait pas passer pour récent).
      const ja = a.derniereActivite?.joursEcoules ?? Number.POSITIVE_INFINITY;
      const jb = b.derniereActivite?.joursEcoules ?? Number.POSITIVE_INFINITY;
      if (ja !== jb) return ja - jb;
      return parPrenomPuisUid(a, b);
    });
  }

  return copie.sort((a, b) => {
    const ra = STATUT_RANG[a.statut];
    const rb = STATUT_RANG[b.statut];
    if (ra !== rb) return ra - rb;
    const ja = a.derniereActivite?.joursEcoules ?? Number.POSITIVE_INFINITY;
    const jb = b.derniereActivite?.joursEcoules ?? Number.POSITIVE_INFINITY;
    if (ja !== jb) return jb - ja; // le plus ancien d'abord
    return parPrenomPuisUid(a, b);
  });
}

export type CoachRosterOptions = {
  query?: string;
  filter?: CoachRosterFilter;
  sort?: CoachRosterSort;
};

/** Recherche + filtre + tri, dans cet ordre. */
export function buildCoachRoster(
  views: CoachPlayerView[],
  options: CoachRosterOptions = {},
): CoachPlayerView[] {
  const { query = "", filter = "tous", sort = "priorite" } = options;
  const filtres = views.filter(
    (view) => matchesCoachSearch(view, query) && matchesCoachFilter(view, filter),
  );
  return sortCoachViews(filtres, sort);
}

/**
 * Compteurs par filtre, pour afficher le nombre à côté de chaque onglet.
 * Calculés sur la liste COMPLÈTE (indépendants de la recherche en cours).
 */
export function countCoachRosterFilters(
  views: CoachPlayerView[],
): Record<CoachRosterFilter, number> {
  const counts = {
    tous: 0,
    a_verifier: 0,
    a_surveiller: 0,
    seance_non_faite: 0,
    seance_adaptee: 0,
    aucune_donnee_recente: 0,
  } as Record<CoachRosterFilter, number>;

  for (const view of views) {
    for (const filter of COACH_ROSTER_FILTERS) {
      if (matchesCoachFilter(view, filter)) counts[filter] += 1;
    }
  }
  return counts;
}
