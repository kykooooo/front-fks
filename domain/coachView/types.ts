// domain/coachView/types.ts
//
// MODÈLES DE LECTURE de l'espace coach.
//
// Règle d'architecture : l'UI coach ne lit JAMAIS des champs bruts de la
// projection serveur éparpillés dans les écrans. Elle consomme uniquement les
// modèles décrits ici, produits par `fromSummary`, enrichis par `attention`,
// `timeline`, `week`. Conséquence directe : quand le serveur gagnera de
// nouveaux champs (boucle de suivi joueur), seul ce dossier bouge.
//
// Deux invariants portés par ces types :
//  1. AUCUNE donnée de santé (douleur, fatigue, RPE, sommeil, TSB/ATL/CTL) —
//     elle est interdite au coach côté serveur, on ne la reconstitue pas ici.
//  2. Toute information affichée dit d'OÙ elle vient (`CoachSignalSource`) et
//     POURQUOI elle est là (`pourquoi`). Une estimation n'est jamais présentée
//     comme une mesure : ce qu'on ne sait pas vaut `null`, jamais 0.
//
// Module PUR : aucune dépendance React / Firestore / horloge implicite.

import type { AgeCategory } from "../types";

// ─── Niveaux de statut (hiérarchie STABLE à 4 niveaux) ───────────────────────
// Volontairement PAS de "critique" : le coach n'est pas médecin, et un outil de
// préparation physique n'a pas à dramatiser. Un niveau ne se déduit jamais d'un
// score opaque, seulement de faits nommés (cf. attention.ts).
export const COACH_STATUS_LEVELS = ["normal", "watch", "check", "unknown"] as const;
export type CoachStatusLevel = (typeof COACH_STATUS_LEVELS)[number];

/** Libellé coach d'un niveau. La couleur n'est JAMAIS seule porteuse de sens. */
export const COACH_STATUS_LABEL: Record<CoachStatusLevel, string> = {
  normal: "Rien à signaler",
  watch: "À surveiller",
  check: "À vérifier",
  unknown: "Indisponible",
};

// ─── Provenance d'une information (obligatoire, affichée) ────────────────────
//  declare   : le joueur l'a renseigné lui-même (profil, poste, niveau)
//  execution : ce que le joueur a réellement fait pendant la séance
//  moteur    : une règle automatique de FKS (ex : séance allégée)
//  calcule   : calculé par l'app à partir de faits datés (ex : jours d'inactivité)
//  absent    : aucune donnée — état honnête, jamais masqué par une valeur par défaut
export const COACH_SIGNAL_SOURCES = ["declare", "execution", "moteur", "calcule", "absent"] as const;
export type CoachSignalSource = (typeof COACH_SIGNAL_SOURCES)[number];

/** Libellé de provenance, affiché tel quel sous l'information. */
export const COACH_SOURCE_LABEL: Record<CoachSignalSource, string> = {
  declare: "Déclaré par le joueur",
  execution: "Séance réalisée",
  moteur: "Règle automatique FKS",
  calcule: "Calculé par l'app",
  absent: "Donnée non disponible",
};

// ─── Signaux ─────────────────────────────────────────────────────────────────
export const COACH_SIGNAL_CODES = [
  "aucune_donnee",
  "jamais_de_seance",
  "seance_prevue_non_faite",
  "inactif",
  "seance_partielle",
  "seance_interrompue",
  "exercices_sautes",
  "exercices_adaptes",
  "profil_incomplet",
  "retour_apres_coupure",
  "seance_ajustee_moteur",
] as const;
export type CoachSignalCode = (typeof COACH_SIGNAL_CODES)[number];

export type CoachSignal = {
  code: CoachSignalCode;
  level: CoachStatusLevel;
  /** Titre court, sans jargon (jamais "TSB", "RPE", "token"). */
  titre: string;
  /** Réponse en une phrase à « pourquoi ce signal ? », en français simple. */
  pourquoi: string;
  source: CoachSignalSource;
  /** Date du FAIT observé quand elle est connue, sinon null. */
  dateKey: string | null;
};

// ─── Blocs du modèle de lecture joueur ───────────────────────────────────────

/** Dernière activité connue = un fait daté + son ancienneté calculée par le front. */
export type CoachLastActivityView = {
  dateKey: string;
  /** Jours écoulés depuis la date, selon l'horloge du coach (0 = aujourd'hui). */
  joursEcoules: number;
  /** "Aujourd'hui" | "Hier" | "Il y a N jours". */
  libelle: string;
};

/**
 * Carte séance. `seancePrevue` et `seanceFaite` COEXISTENT : aujourd'hui elles se
 * disputent un seul slot serveur (`latestSession`), ce qui empêche le coach de
 * voir « ce qui était prévu VS ce qui a été fait ». Ici elles sont séparées.
 */
export type CoachSessionView = {
  dateKey: string | null;
  titre: string | null;
  focus: string | null;
  intensite: string | null;
  dureeMin: number | null;
  nbBlocs: number | null;
};

/** Statut d'exécution, en français, côté vue. */
export const COACH_EXECUTION_STATUTS = ["complete", "partielle", "interrompue"] as const;
export type CoachExecutionStatut = (typeof COACH_EXECUTION_STATUTS)[number];

export const COACH_EXECUTION_STATUT_LABEL: Record<CoachExecutionStatut, string> = {
  complete: "Séance réalisée en entier",
  partielle: "Séance réalisée en partie",
  interrompue: "Séance interrompue",
};

/**
 * Ce que le JOUEUR a fait de sa séance. Vocabulaire réservé au joueur :
 * "adapté", "sauté", "remplacé" décrivent SES choix — jamais ceux du moteur
 * (voir `ajustementsMoteur`, qui est une tout autre information).
 */
export type CoachExecutionView = {
  /** 0..100, ou null si non transmis (ne JAMAIS afficher 0 à la place de null). */
  pourcentage: number | null;
  statut: CoachExecutionStatut | null;
  statutLibelle: string | null;
  fait: number | null;
  adapte: number | null;
  saute: number | null;
  /** Total des remplacements (équivalents + partiels), pour un affichage compact. */
  remplace: number | null;
  /**
   * Détail des remplacements. Ils N'ONT PAS le même poids dans `pourcentage`
   * (1 pour un équivalent, 0,5 pour un partiel) : sans cette séparation, le
   * coach ne peut pas refaire le calcul qu'on lui montre — un score opaque.
   * `null` = nuance non transmise ; on n'invente pas une répartition.
   */
  remplaceEquivalent: number | null;
  remplacePartiel: number | null;
  /**
   * Nombre total d'exercices de la séance = dénominateur du pourcentage.
   * ⚠️ Les catégories (fait / adapté / sauté / remplacé) sont EXCLUSIVES — un
   * exercice n'est rangé que dans une seule — mais elles ne somment pas
   * forcément au total : un exercice au statut inconnu compte dans le total en
   * pesant 0. `null` = total inconnu → l'écran dit qu'il ne peut pas détailler
   * le calcul, il ne reconstitue pas un total.
   */
  total: number | null;
  /** Libellés d'écart allowlistés serveur, pris tels quels (non inversibles). */
  raisons: string[];
};

/** Un jour de la fenêtre d'assiduité : fait / pas fait, sans interprétation. */
export type CoachAssiduiteJour = {
  dateKey: string;
  fait: boolean;
};

/**
 * Assiduité = comptage de FAITS datés sur des fenêtres explicites.
 * `null` quand le serveur ne projette pas encore la fenêtre d'activité :
 * on préfère « donnée indisponible » à un 0 qui se lirait comme « n'a rien fait ».
 */
export type CoachAssiduiteView = {
  /**
   * ⚠️ Comme `CoachWeekDigest.seancesFaites` : ces compteurs partent de dates
   * dédupliquées, donc ils valent "nombre de JOURS avec au moins une séance".
   * L'écran doit le dire (cf. AssiduiteSection, hint "jours avec séance").
   */
  faitesSur7j: number;
  faitesSur14j: number;
  /** 14 derniers jours, du PLUS ANCIEN au plus récent (sens de lecture d'un calendrier). */
  jours: CoachAssiduiteJour[];
};

/** Modèle de lecture complet d'un joueur pour l'espace coach. */
export type CoachPlayerView = {
  playerUid: string;
  prenom: string | null;
  /** Initiale d'avatar, toujours utilisable ("?" si prénom inconnu). */
  initiale: string;
  categorieAge: AgeCategory | null;
  poste: string | null;
  niveau: string | null;
  profilComplet: boolean;

  statut: CoachStatusLevel;
  signaux: CoachSignal[];
  /**
   * true = une partie des données de ce joueur MANQUE (exécution non transmise,
   * fenêtre d'activité absente, aucune séance prévue connue, profil incomplet).
   *
   * ⚠️ Ce n'est PAS un cinquième niveau de statut : la hiérarchie reste à 4
   * (normal / watch / check / unknown). C'est une NUANCE DE LIBELLÉ — un
   * "Rien à signaler" doit se lire "Rien à signaler parmi les données
   * disponibles" quand ce drapeau est levé, pour ne pas faire passer une
   * absence d'information pour une absence de problème.
   */
  donneesPartielles: boolean;

  derniereActivite: CoachLastActivityView | null;
  seancePrevue: CoachSessionView | null;
  seanceFaite: CoachSessionView | null;
  execution: CoachExecutionView | null;

  /**
   * Séances ALLÉGÉES PAR LE MOTEUR FKS (ex-`adaptation.labels`).
   * ATTENTION : ce n'est PAS « le joueur a modifié sa séance » — c'est FKS qui a
   * ajusté la prescription. Le libellé affiché doit lever l'ambiguïté
   * ("Séance ajustée par FKS"), sinon le coach lit un faux comportement joueur.
   */
  ajustementsMoteur: string[];

  /** Dates des séances faites connues (max 14, tri décroissant). Fait brut. */
  datesSeancesFaites: string[];
  assiduite: CoachAssiduiteView | null;
};

/**
 * Faits d'un joueur SANS son verdict : `attention.buildAttentionSignals` prend
 * ceci en entrée pour produire `statut` + `signaux`. Un `CoachPlayerView` complet
 * est assignable à ce type (le verdict est simplement ignoré) — ça évite un
 * cycle d'imports entre fromSummary et attention.
 */
export type CoachPlayerFacts = Omit<
  CoachPlayerView,
  "statut" | "signaux" | "donneesPartielles"
>;

// ─── Timeline ────────────────────────────────────────────────────────────────
export const COACH_TIMELINE_TYPES = [
  "seance_faite",
  "seance_prevue",
  "seance_prevue_non_faite",
  "execution_ecarts",
  "ajustement_moteur",
] as const;
export type CoachTimelineEventType = (typeof COACH_TIMELINE_TYPES)[number];

export type CoachTimelineEvent = {
  /** Identifiant stable pour les listes React (jamais un index). */
  id: string;
  type: CoachTimelineEventType;
  dateKey: string | null;
  /** Ce qui s'est passé, en une ligne. */
  libelle: string;
  /** Détail utile (durée, focus, écarts) ou null. Jamais de JSON ni de token. */
  contexte: string | null;
  source: CoachSignalSource;
};

// ─── Synthèse de semaine (groupe) ────────────────────────────────────────────
export type CoachWeekDigest = {
  /** Lundi de la semaine ("YYYY-MM-DD"), tel que fourni. */
  weekKey: string;
  /** Bornes RÉELLES de la semaine : lundi → dimanche. */
  debut: string;
  fin: string;
  /** Les 7 clés de la semaine, du lundi au dimanche. */
  jours: string[];
  /** Jours de la semaine déjà écoulés (<= aujourd'hui) : borne du comptage honnête. */
  joursEcoules: string[];

  membres: number;
  /** Membres pour lesquels une fenêtre d'activité est disponible. */
  membresAvecDonnees: number;
  membresSansDonnees: number;
  /**
   * Séances faites DANS les bornes de la semaine (pas sur 7 jours glissants).
   *
   * ⚠️ UNITÉ RÉELLE : la projection serveur ne transmet que des DATES
   * dédupliquées (`activity.doneDateKeys`). Deux séances faites le même jour par
   * le même joueur n'y laissent qu'une trace : ce compteur vaut donc "au plus
   * une séance par jour et par joueur". L'écran DOIT écrire cette règle sous le
   * chiffre (cf. CoachWeekScreen, hint de `metric-seances`), sinon le coach lit
   * un total qu'il ne peut pas expliquer — et qui sous-compte en silence.
   */
  seancesFaites: number;
  membresActifs: number;
  membresSansSeance: number;
  aVerifier: number;
  aSurveiller: number;
  /**
   * true si, pour au moins un membre, la fenêtre de 14 dates est saturée et ne
   * remonte pas jusqu'au lundi : le comptage de la semaine peut être incomplet.
   * On le DIT plutôt que de laisser croire à un chiffre exhaustif.
   */
  couvertureIncomplete: boolean;
  /** Phrases descriptives (jamais prédictives), prêtes à afficher. */
  phrases: string[];
};

// ─── Fraîcheur des données ───────────────────────────────────────────────────
export type CoachFreshness = {
  libelle: string;
  /** Âge des données en minutes, ou null si inconnu. */
  ageMinutes: number | null;
  /** true = données probablement dépassées → l'écran peut proposer d'actualiser. */
  perimee: boolean;
};
