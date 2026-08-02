// domain/coachView/today.ts
//
// « Que dois-je regarder MAINTENANT ? » — modèle de lecture de l'écran
// d'atterrissage du coach.
//
// POURQUOI CE MODULE EXISTE.
// L'écran "Aujourd'hui" a besoin de trois choses que les modules voisins ne
// donnaient pas telles quelles : une raison COURTE et autoportante par joueur à
// vérifier (`roster` trie, `attention` explique, mais en phrases longues), un
// comptage des séances faites AUJOURD'HUI (`week` compte sur des bornes de
// semaine), et la copie des avertissements de couverture ("N profils non lus").
// Le tout est ici, pur et testable, pour que l'écran ne porte AUCUNE règle.
//
// DEUX INVARIANTS REPRIS DES MODULES VOISINS, jamais renégociés ici :
//  1. le serveur est SANS HORLOGE : `todayKey` est INJECTÉ, jamais lu de Date.now() ;
//  2. une donnée absente vaut `null`, jamais 0. Un coach qui lit "0 séance
//     aujourd'hui" doit pouvoir croire que la mesure a été faite. Quand la
//     fenêtre d'activité n'est pas projetée (cas NOMINAL tant que la boucle de
//     suivi joueur n'est pas mergée), on renvoie `null` — "on ne sait pas".
//
// Module PUR : ni React, ni Firestore, ni horloge implicite.
//
// NOTE D'INTÉGRATION : ce module n'est volontairement PAS ré-exporté par
// `domain/coachView/index.ts`. Plusieurs lots d'écrans sont écrits en parallèle
// sur cette branche ; toucher le baril partagé aurait créé un conflit de merge
// pour un simple `export *`. L'écran l'importe donc par son chemin.

import { formatDayFR } from "../../utils/dateHelpers";
import type { ClubTeamGender } from "../types";
import { diffDaysBetweenKeys, isValidDateKey } from "./dates";
import { coachStatusLabel } from "./statusLabel";
import { COACH_SOURCE_LABEL } from "./types";
import type {
  CoachPlayerView,
  CoachSignal,
  CoachSignalSource,
  CoachStatusLevel,
} from "./types";

/**
 * Nombre d'entrées affichées dans "À vérifier aujourd'hui". Au-delà, l'écran
 * renvoie vers l'effectif filtré : une liste de vingt noms sur l'écran d'accueil
 * n'est plus une liste de priorités, c'est un effectif de plus.
 */
export const COACH_TODAY_ATTENTION_MAX = 5;

// ─── Activité du jour ────────────────────────────────────────────────────────

export type CoachTodayActivity = {
  /** Jour de référence retenu ("" si la clé fournie était invalide). */
  todayKey: string;
  /** Membres dont la fenêtre d'activité est disponible (donc mesurables). */
  membresAvecDonnees: number;
  membresSansDonnees: number;
  /**
   * Membres ayant terminé AU MOINS une séance aujourd'hui. `null` = aucune
   * mesure possible (≠ 0).
   *
   * ⚠️ IL N'EXISTE VOLONTAIREMENT PAS de compteur "nombre de séances du jour".
   * La projection serveur ne transmet que des DATES dédupliquées
   * (`activity.doneDateKeys`) : deux séances faites le même jour y laissent une
   * seule trace. Un champ nommé "séances" serait donc un sous-comptage
   * silencieux — une estimation présentée comme une mesure. On ne compte que ce
   * que la donnée permet réellement de compter : des membres.
   */
  membresActifs: number | null;
  /**
   * Membres dont une partie des données MANQUE (exécution non transmise, fenêtre
   * d'activité absente, aucune séance prévue connue, profil incomplet — cf.
   * `aDesDonneesManquantes`). Ce n'est PAS un niveau de statut : c'est ce qui
   * permet à l'écran d'écrire « parmi les données disponibles » au lieu de
   * laisser croire que l'app a tout regardé.
   */
  membresDonneesPartielles: number;
};

/**
 * Compte les membres ayant terminé une séance aujourd'hui, à partir de faits datés.
 *
 * Même règle d'honnêteté que `buildWeekDigest` : un membre dont la fenêtre
 * d'activité n'est pas projetée n'est PAS compté à zéro, il est compté "sans
 * donnée". Si personne n'a de fenêtre, le chiffre entier vaut `null`.
 *
 * @param views    modèles de lecture des membres du groupe.
 * @param todayKey jour courant selon l'horloge du COACH.
 */
export function buildTodayActivity(
  views: CoachPlayerView[],
  todayKey: string,
): CoachTodayActivity {
  const jourValide = isValidDateKey(todayKey);

  let membresAvecDonnees = 0;
  let membresActifs = 0;
  let membresDonneesPartielles = 0;

  for (const view of views) {
    // Compté AVANT le `continue` : un membre sans fenêtre d'activité est
    // justement l'un de ceux dont les données sont partielles.
    if (view.donneesPartielles) membresDonneesPartielles += 1;
    if (!view.assiduite) continue;
    membresAvecDonnees += 1;
    if (!jourValide) continue;
    // `datesSeancesFaites` est dédupliqué en amont : la date du jour y figure au
    // plus une fois. On compte donc des MEMBRES actifs, jamais des occurrences —
    // cf. la note sur `membresActifs` ci-dessus.
    if (view.datesSeancesFaites.includes(todayKey)) membresActifs += 1;
  }

  const mesurable = jourValide && membresAvecDonnees > 0;
  return {
    todayKey: jourValide ? todayKey : "",
    membresAvecDonnees,
    membresSansDonnees: views.length - membresAvecDonnees,
    membresActifs: mesurable ? membresActifs : null,
    membresDonneesPartielles,
  };
}

// ─── Entrées "À vérifier aujourd'hui" ────────────────────────────────────────

export type CoachTodayEntry = {
  playerUid: string;
  prenom: string | null;
  statut: CoachStatusLevel;
  statutLibelle: string;
  /**
   * Pourquoi ce joueur est dans la liste, en UNE ligne autoportante
   * ("Séance prévue mardi, pas encore faite", "Sans séance depuis 12 jours").
   */
  raison: string;
  /** Deuxième ligne : autres points à regarder, ou dernière séance connue. */
  complement: string;
  /** Origine de l'information portée par `raison` (jamais implicite). */
  source: CoachSignalSource;
  /**
   * true = une partie des données de ce joueur manque (cf. `donneesPartielles`).
   * Repris tel quel du modèle de lecture : la ligne doit pouvoir dire que son
   * statut ne porte que sur ce qui a été transmis.
   */
  donneesPartielles: boolean;
};

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Jour d'un fait, en langage de vestiaire. Dans la semaine écoulée on donne le
 * seul nom du jour ("mardi") : c'est ainsi qu'un coach en parle, et il n'y a
 * aucune ambiguïté possible sur moins de sept jours. Au-delà, on redonne la
 * date complète, sinon "mardi" pourrait désigner trois mardis différents.
 */
function jourCourt(dateKey: string | null, todayKey: string): string {
  // Garde explicite : `formatDayFR` passe par un `Date` local, qui REPORTE
  // silencieusement une date impossible ("2026-02-30" devient le 2 mars). On
  // préfère ne rien dire plutôt que d'afficher un jour que personne n'a vécu.
  if (!isValidDateKey(dateKey)) return "";
  const complet = formatDayFR(dateKey);
  if (!complet) return "";
  const ecart = diffDaysBetweenKeys(dateKey, todayKey);
  if (ecart === null) return complet;
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "hier";
  if (ecart > 1 && ecart < 7) return complet.split(" ")[0];
  return complet;
}

/**
 * Raison courte. Le titre du signal suffit dans la quasi-totalité des cas
 * ("Sans séance depuis 12 jours", "Séance interrompue", "3 exercices sautés").
 * Seule exception : la séance prévue non réalisée, dont le titre ne dit pas
 * QUAND — or c'est précisément l'information qui déclenche l'appel au joueur.
 */
function raisonCourte(signal: CoachSignal, todayKey: string): string {
  if (signal.code === "seance_prevue_non_faite") {
    const jour = jourCourt(signal.dateKey, todayKey);
    if (jour) return `Séance prévue ${jour}, pas encore faite`;
  }
  return signal.titre;
}

/**
 * Deuxième ligne. On préfère annoncer les autres points à regarder (le coach
 * saura qu'ouvrir la fiche en vaut la peine) ; à défaut on rappelle la dernière
 * séance connue, et si l'on n'en connaît aucune, on le DIT.
 */
function complementDe(view: CoachPlayerView): string {
  const autres = Math.max(0, view.signaux.length - 1);
  if (autres > 0) return `+ ${pluriel(autres, "autre point")} à regarder`;
  if (view.derniereActivite) {
    return `Dernière séance ${view.derniereActivite.libelle.toLocaleLowerCase("fr-FR")}`;
  }
  return "Aucune séance enregistrée";
}

/**
 * Transforme des vues joueur (déjà filtrées et triées par `buildCoachRoster`)
 * en lignes prêtes à afficher. L'ordre d'entrée est CONSERVÉ : la priorité de
 * lecture est décidée par `roster`, pas ici.
 */
export function buildTodayAttentionEntries(
  views: CoachPlayerView[],
  todayKey: string,
): CoachTodayEntry[] {
  return views.map((view) => {
    // `signaux` est trié par niveau décroissant : le premier est le motif
    // principal. Un joueur sans aucun signal ne devrait pas arriver ici ; s'il
    // arrive quand même, on affiche son statut plutôt que de le faire
    // disparaître silencieusement de la liste.
    const principal = view.signaux[0] ?? null;
    // Libellé NUANCÉ : un joueur sans signal dont il manque des données ne se lit
    // pas « Rien à signaler » mais « Rien à signaler parmi les données
    // disponibles » (cf. statusLabel.ts). Les niveaux à surveiller / à vérifier
    // sont inchangés — eux disaient déjà qu'il fallait regarder.
    const libelle = coachStatusLabel(view.statut, view.donneesPartielles);
    return {
      playerUid: view.playerUid,
      prenom: view.prenom,
      statut: view.statut,
      statutLibelle: libelle,
      raison: principal ? raisonCourte(principal, todayKey) : libelle,
      complement: complementDe(view),
      source: principal ? principal.source : "absent",
      donneesPartielles: view.donneesPartielles,
    };
  });
}

/**
 * Provenance des signaux de la liste, en UNE ligne.
 *
 * POURQUOI une ligne de section et pas une mention sous chaque nom : la règle
 * produit exige que le coach sache toujours d'où vient ce qu'il lit, mais
 * répéter "calculé par l'app" cinq fois de suite transforme une liste de
 * priorités en formulaire. On énonce donc les origines RÉELLEMENT présentes
 * dans la liste, une fois, sous les lignes. Aucune origine n'est inventée :
 * elles sont lues sur les entrées elles-mêmes.
 *
 * Ordre figé (calculé → réalisé → déclaré → moteur → absent) pour que la phrase
 * ne change pas de forme à chaque rafraîchissement.
 */
export function buildTodaySourcesLabel(entries: CoachTodayEntry[]): string | null {
  if (entries.length === 0) return null;
  const presentes = new Set<CoachSignalSource>(entries.map((e) => e.source));
  const ordre: CoachSignalSource[] = ["calcule", "execution", "declare", "moteur", "absent"];
  const libelles = ordre
    .filter((source) => presentes.has(source))
    .map((source) => COACH_SOURCE_LABEL[source].toLocaleLowerCase("fr-FR"));
  if (libelles.length === 0) return null;
  return `D'où viennent ces signaux : ${libelles.join(", ")}.`;
}

// ─── Couverture des données (ce que la liste ne couvre PAS) ──────────────────

export type CoachTodayNoteId = "profils_non_lus" | "profils_en_preparation";

export type CoachTodayNote = {
  id: CoachTodayNoteId;
  niveau: CoachStatusLevel;
  titre: string;
  pourquoi: string;
};

/**
 * Avertissements de couverture, affichés SOUS la liste d'attention.
 *
 * POURQUOI ils vivent à côté de la liste et pas ailleurs : si trois profils
 * n'ont pas pu être lus, la phrase "Rien à vérifier aujourd'hui" n'est plus
 * vraie — elle est seulement vraie pour ce qu'on a réussi à lire. Le coach doit
 * voir les deux au même endroit, sinon il conclut à tort.
 *
 * Les deux cas sont volontairement DISTINCTS : "non lu" est un échec de lecture
 * (on réessaie), "en cours de préparation" est un état normal du serveur (on
 * attend). Les confondre ferait paniquer pour rien, ou ignorer un vrai trou.
 */
export function buildTodayCoverageNotes(
  pendingCount: number,
  unreadableCount: number,
): CoachTodayNote[] {
  const notes: CoachTodayNote[] = [];

  const nonLus = Math.max(0, Math.trunc(unreadableCount));
  if (nonLus > 0) {
    notes.push({
      id: "profils_non_lus",
      niveau: "watch",
      titre: `${pluriel(nonLus, "profil")} non lu${nonLus > 1 ? "s" : ""}`,
      pourquoi:
        "Leur lecture a échoué : cette liste peut être incomplète. Tirez vers le bas pour réessayer.",
    });
  }

  const enPreparation = Math.max(0, Math.trunc(pendingCount));
  if (enPreparation > 0) {
    notes.push({
      id: "profils_en_preparation",
      niveau: "unknown",
      titre: `${pluriel(enPreparation, "profil")} en cours de préparation`,
      pourquoi:
        "Leurs données arrivent d'elles-mêmes dès qu'elles sont prêtes, sans rien faire de votre côté.",
    });
  }

  return notes;
}

// ─── Copie de l'état "rien à vérifier" ───────────────────────────────────────

/**
 * Titre de l'état « personne à vérifier ».
 *
 * « Rien à vérifier aujourd'hui » est un CONSTAT : il affirme que l'app a
 * regardé et n'a rien trouvé. Tant qu'il manque des données sur au moins un
 * membre, cette affirmation est fausse — l'app n'a regardé que ce qu'on lui a
 * transmis. Le titre le dit alors, au lieu de laisser le silence passer pour
 * une preuve.
 *
 * @param membresDonneesPartielles nombre de membres dont des données manquent.
 */
export function buildTodayEmptyTitle(membresDonneesPartielles: number): string {
  const partiels = Math.max(0, Math.trunc(membresDonneesPartielles));
  return partiels > 0
    ? "Rien à vérifier parmi les données disponibles"
    : "Rien à vérifier aujourd'hui";
}

/**
 * Ligne de contexte affichée quand personne n'est à vérifier. On ne se contente
 * pas d'un "Rien à signaler" : on dit SUR QUOI porte ce constat, sinon le coach
 * ne sait pas si l'app a regardé quelque chose.
 *
 * @param membresLus  membres réellement lus (les non lus ne comptent pas).
 * @param aSurveiller membres au statut "à surveiller".
 * @param memberWord  "joueur" | "joueuse" | "membre".
 * @param membresDonneesPartielles membres dont une partie des données manque.
 *        Ajoute une seconde phrase qui BORNE le constat, sans le contredire.
 */
export function buildTodayEmptyReason(
  membresLus: number,
  aSurveiller: number,
  memberWord: string,
  membresDonneesPartielles = 0,
): string {
  const mot = memberWord.trim() || "membre";
  if (membresLus <= 0) {
    return "Aucun profil lisible pour l'instant : rien ne peut être vérifié.";
  }
  // Formulations sans participe passé accordé : "joueuse" et "joueur" passent
  // dans la MÊME phrase sans faute d'accord. Un "1 joueuse suivi" suffirait à
  // faire douter un entraîneur du sérieux de l'outil.
  const base =
    aSurveiller > 0
      ? `${pluriel(aSurveiller, mot)} à surveiller, mais rien ne demande une lecture aujourd'hui.`
      : `Aucun signal à lire sur ${pluriel(membresLus, mot)}.`;

  const partiels = Math.max(0, Math.trunc(membresDonneesPartielles));
  if (partiels <= 0) return base;
  return `${base} Une partie des données manque pour ${pluriel(partiels, mot)} : ce constat ne porte que sur ce qui a été transmis.`;
}

// ─── Vocabulaire du groupe ───────────────────────────────────────────────────

/**
 * Mot employé pour UN membre de l'effectif. Une équipe féminine ne se lit pas
 * "3 joueurs sans séance" : c'est le genre de détail qui décide si un
 * entraîneur trouve l'outil sérieux ou bâclé.
 */
export function memberWordFor(teamGender: ClubTeamGender | null | undefined): string {
  if (teamGender === "female") return "joueuse";
  if (teamGender === "male") return "joueur";
  return "membre";
}

// ─── Date du jour en clair ───────────────────────────────────────────────────

/** "2026-07-27" → "Lundi 27 juillet". Clé invalide → "" (jamais une date inventée). */
export function formatTodayLabel(todayKey: string): string {
  // Même garde que `jourCourt` : une date calendaire impossible ne doit pas
  // ressortir "reportée" au jour suivant par l'arithmétique de `Date`.
  if (!isValidDateKey(todayKey)) return "";
  const label = formatDayFR(todayKey);
  if (!label) return "";
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}
