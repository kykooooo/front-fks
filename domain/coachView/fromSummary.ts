// domain/coachView/fromSummary.ts
//
// Projection serveur (coachSummary) → modèle de lecture coach (CoachPlayerView).
//
// C'est LE point de passage obligatoire : aucun écran coach ne lit un champ brut
// de la projection. Deux raisons concrètes :
//
//  - le serveur est SANS HORLOGE (il n'envoie que des dates absolues) ; tout le
//    relatif au présent ("il y a 3 jours", "séance manquée") se calcule ici, avec
//    l'horloge du coach, à partir d'un `todayKey` INJECTÉ ;
//  - les champs de la boucle de suivi joueur (activity / lastPlanned / lastDone /
//    execution) sont ABSENTS aujourd'hui et arriveront plus tard : leur absence
//    est le cas NOMINAL. Elle donne `null`, jamais 0, jamais une valeur inventée.
//
// Module PUR : ni React, ni Firestore, ni Date.now().

import type {
  CoachExecutionSummary,
  CoachLatestSession,
  CoachPlayerSummary,
  CoachSessionRef,
} from "../coachSummary";
import { buildAttentionSignals } from "./attention";
import { addDaysToKey, compareDateKeysDesc, diffDaysBetweenKeys, elapsedLabel, isValidDateKey } from "./dates";
import { reconcileSessionTitle } from "./sessionTitle";
import type {
  CoachAssiduiteJour,
  CoachAssiduiteView,
  CoachExecutionStatut,
  CoachExecutionView,
  CoachLastActivityView,
  CoachPlayerFacts,
  CoachPlayerView,
  CoachSessionView,
} from "./types";
import { COACH_EXECUTION_STATUT_LABEL } from "./types";

/** Fenêtre d'assiduité affichée : 14 jours (= borne de la fenêtre serveur). */
export const ASSIDUITE_JOURS = 14;
/** Sous-fenêtre courte, celle que le coach lit en premier. */
export const ASSIDUITE_JOURS_COURTS = 7;

const STATUT_PAR_STATUS: Record<string, CoachExecutionStatut> = {
  full: "complete",
  partial: "partielle",
  abandoned: "interrompue",
};

/** Initiale d'avatar. `[...prenom]` et pas `prenom[0]` : gère les prénoms accentués. */
function toInitiale(prenom: string | null): string {
  if (!prenom) return "?";
  const first = [...prenom.trim()][0];
  return first ? first.toUpperCase() : "?";
}

/** Une référence sans AUCUN contenu utile ne vaut pas mieux que rien → null. */
function refToSessionView(ref: CoachSessionRef | null): CoachSessionView | null {
  if (!ref) return null;
  const view: CoachSessionView = {
    dateKey: ref.dateKey,
    // INVARIANT titre/type : un titre qui contredit le type est ABANDONNÉ ici
    // (cf. sessionTitle.ts). On garde le type, jamais les deux versions.
    titre: reconcileSessionTitle(ref.title, ref.focusLabel),
    focus: ref.focusLabel,
    intensite: ref.intensityLabel,
    dureeMin: ref.durationMin,
    nbBlocs: ref.blockCount,
  };
  return isSessionViewVide(view) ? null : view;
}

function latestToSessionView(session: CoachLatestSession | null): CoachSessionView | null {
  if (!session) return null;
  const view: CoachSessionView = {
    dateKey: session.dateKey,
    // Même invariant que `refToSessionView` : titre contradictoire → abandonné.
    titre: reconcileSessionTitle(session.title, session.focusLabel),
    focus: session.focusLabel,
    intensite: session.intensityLabel,
    dureeMin: session.durationMin,
    nbBlocs: session.blockCount,
  };
  return isSessionViewVide(view) ? null : view;
}

function isSessionViewVide(view: CoachSessionView): boolean {
  return (
    view.dateKey === null &&
    view.titre === null &&
    view.focus === null &&
    view.intensite === null &&
    view.dureeMin === null &&
    view.nbBlocs === null
  );
}

/**
 * Exécution serveur → vue. Un bloc entièrement vide (aucun compteur, aucun
 * statut, aucune raison) est traité comme ABSENT : afficher "0 exercice sauté"
 * alors qu'on ne sait rien serait présenter une absence comme une mesure.
 */
function toExecutionView(exec: CoachExecutionSummary | null): CoachExecutionView | null {
  if (!exec) return null;
  const statut = exec.completionStatus ? STATUT_PAR_STATUS[exec.completionStatus] ?? null : null;
  const view: CoachExecutionView = {
    pourcentage: exec.completionPct,
    statut,
    statutLibelle: statut ? COACH_EXECUTION_STATUT_LABEL[statut] : null,
    fait: exec.itemsDone,
    adapte: exec.itemsAdapted,
    saute: exec.itemsSkipped,
    remplace: exec.itemsReplaced,
    remplaceEquivalent: exec.itemsReplacedEquivalent,
    remplacePartiel: exec.itemsReplacedPartial,
    total: exec.itemsTotal,
    raisons: exec.deviationLabels,
  };
  // `total` est VOLONTAIREMENT absent de ce test : un total seul, sans aucun
  // compteur ni statut, ne détaille aucun calcul — ce n'est pas un signal.
  const vide =
    view.pourcentage === null &&
    view.statut === null &&
    view.fait === null &&
    view.adapte === null &&
    view.saute === null &&
    view.remplace === null &&
    view.raisons.length === 0;
  return vide ? null : view;
}

/**
 * Toutes les dates de séances FAITES connues, quelle que soit la source qui nous
 * les a données (fenêtre d'activité, dernière séance faite, dernière activité,
 * séance affichée au statut "done"). Dédupliquées, triées du plus récent au plus
 * ancien, bornées à 14. Ce sont des FAITS datés, jamais des estimations.
 */
function collectDoneDateKeys(summary: CoachPlayerSummary): string[] {
  const keys: string[] = [];
  const push = (key: string | null | undefined) => {
    if (key && isValidDateKey(key) && !keys.includes(key)) keys.push(key);
  };
  for (const key of summary.activity?.doneDateKeys ?? []) push(key);
  push(summary.lastDone?.dateKey ?? null);
  push(summary.lastActivity?.dateKey ?? null);
  if (summary.latestSession?.status === "done") push(summary.latestSession.dateKey);
  keys.sort(compareDateKeysDesc);
  return keys.slice(0, ASSIDUITE_JOURS);
}

/**
 * Assiduité : UNIQUEMENT si le serveur projette une fenêtre d'activité. Sans
 * elle, une seule date connue ne fait pas une fenêtre — on renvoie `null`
 * ("donnée indisponible") plutôt qu'un "1 séance sur 14 jours" trompeur.
 */
function buildAssiduite(
  summary: CoachPlayerSummary,
  doneKeys: string[],
  todayKey: string,
): CoachAssiduiteView | null {
  if (!summary.activity) return null;
  if (!isValidDateKey(todayKey)) return null;

  const faits = new Set(doneKeys);
  const jours: CoachAssiduiteJour[] = [];
  // Du plus ancien au plus récent : sens de lecture d'un calendrier.
  for (let i = ASSIDUITE_JOURS - 1; i >= 0; i -= 1) {
    const dateKey = addDaysToKey(todayKey, -i);
    if (!dateKey) continue;
    jours.push({ dateKey, fait: faits.has(dateKey) });
  }

  const faitesSur14j = jours.filter((j) => j.fait).length;
  const faitesSur7j = jours.slice(-ASSIDUITE_JOURS_COURTS).filter((j) => j.fait).length;
  return { faitesSur7j, faitesSur14j, jours };
}

function buildDerniereActivite(
  doneKeys: string[],
  todayKey: string,
): CoachLastActivityView | null {
  const dateKey = doneKeys[0] ?? null;
  if (!dateKey) return null;
  const joursEcoules = diffDaysBetweenKeys(dateKey, todayKey);
  // todayKey invalide → on ne sait pas dater le fait par rapport à aujourd'hui.
  if (joursEcoules === null) return null;
  return { dateKey, joursEcoules, libelle: elapsedLabel(joursEcoules) };
}

/**
 * Construit le modèle de lecture d'un joueur.
 *
 * @param summary  projection coach-safe déjà parsée (parseCoachPlayerSummary).
 * @param todayKey clé "YYYY-MM-DD" du jour, selon l'horloge du COACH.
 */
export function toCoachPlayerView(
  summary: CoachPlayerSummary,
  todayKey: string,
): CoachPlayerView {
  const doneKeys = collectDoneDateKeys(summary);

  // Séance PRÉVUE et séance FAITE coexistent. Aujourd'hui le serveur n'a qu'un
  // slot (`latestSession`) : on le range dans le bon casier selon son statut,
  // et `lastPlanned`/`lastDone` (contrat v2) prennent le dessus quand ils arrivent.
  const seancePrevue =
    refToSessionView(summary.lastPlanned) ??
    (summary.latestSession?.status === "planned" ? latestToSessionView(summary.latestSession) : null);

  let seanceFaite =
    refToSessionView(summary.lastDone) ??
    (summary.latestSession?.status === "done" ? latestToSessionView(summary.latestSession) : null);

  // Repli : `lastActivity` est un fait de séance terminée (date + durée), même
  // quand aucun détail de séance n'est projeté. On l'affiche tel quel, sans
  // inventer de titre ni de focus.
  if (!seanceFaite && summary.lastActivity?.dateKey) {
    seanceFaite = {
      dateKey: summary.lastActivity.dateKey,
      titre: null,
      focus: null,
      intensite: null,
      dureeMin: summary.lastActivity.durationMin,
      nbBlocs: null,
    };
  }

  const facts: CoachPlayerFacts = {
    playerUid: summary.playerUid,
    prenom: summary.firstName,
    initiale: toInitiale(summary.firstName),
    categorieAge: summary.ageCategory,
    poste: summary.position,
    niveau: summary.level,
    profilComplet: summary.profileComplete,
    derniereActivite: buildDerniereActivite(doneKeys, todayKey),
    seancePrevue,
    seanceFaite,
    execution: toExecutionView(summary.execution),
    // `adaptation.labels` = ce que le MOTEUR a allégé, jamais un choix du joueur.
    ajustementsMoteur: summary.adaptation.adapted ? summary.adaptation.labels : [],
    datesSeancesFaites: doneKeys,
    assiduite: buildAssiduite(summary, doneKeys, todayKey),
  };

  const { statut, signaux, donneesPartielles } = buildAttentionSignals(facts, todayKey);
  return { ...facts, statut, signaux, donneesPartielles };
}

/** Confort : plusieurs projections → plusieurs vues, dans le même ordre. */
export function toCoachPlayerViews(
  summaries: CoachPlayerSummary[],
  todayKey: string,
): CoachPlayerView[] {
  return summaries.map((summary) => toCoachPlayerView(summary, todayKey));
}
