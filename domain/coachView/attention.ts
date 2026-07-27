// domain/coachView/attention.ts
//
// « Qui nécessite une vérification humaine aujourd'hui ? »
//
// Ce module transforme des FAITS datés en SIGNAUX nommés, puis en un statut
// global. Trois garde-fous qui ne se négocient pas :
//
//  1. AUCUN score. Pas de pondération, pas de "risque à 72 %", pas de prédiction
//     de blessure. Un coach doit pouvoir refaire le raisonnement de tête.
//  2. Une donnée ABSENTE ne déclenche jamais une alerte. Elle produit
//     "unknown" (indisponible) ou rien du tout. Sinon le coach court après des
//     joueurs dont on ne sait simplement rien.
//  3. Un signal isolé de niveau "à surveiller" ne remonte JAMAIS en
//     "à vérifier", même s'il y en a cinq. Seul un fait de niveau "check"
//     produit un "check" — c'est ce qui garde le niveau haut crédible.
//
// Module PUR : `todayKey` est INJECTÉ (le projecteur serveur est sans horloge,
// tout le relatif au présent se calcule ici avec l'horloge du coach).

import { formatDayFR } from "../../utils/dateHelpers";
import { diffDaysBetweenKeys } from "./dates";
import type {
  CoachPlayerFacts,
  CoachSignal,
  CoachSignalCode,
  CoachStatusLevel,
} from "./types";

// ─── Seuils (exportés : le roster et les écrans doivent parler des MÊMES bornes) ─
/** À partir de 5 jours sans séance → à surveiller. */
export const INACTIVITE_WATCH_JOURS = 5;
/** À partir de 10 jours sans séance alors qu'il y avait de l'activité → à vérifier. */
export const INACTIVITE_CHECK_JOURS = 10;
/** 3 exercices sautés ou plus → à vérifier (le joueur a buté sur quelque chose). */
export const SAUTS_CHECK = 3;
/** 2 exercices adaptés ou plus → à surveiller. */
export const ADAPTATIONS_WATCH = 2;
/** Trou d'au moins 14 jours entre deux séances = coupure. */
export const COUPURE_JOURS = 14;
/** Séance faite il y a 3 jours ou moins = reprise "fraîche" après la coupure. */
export const RETOUR_RECENT_JOURS = 3;
/**
 * Retard toléré sur une séance prévue avant de passer au niveau HAUT.
 *
 * POURQUOI 2 ET PAS 1. En club amateur, un joueur qui génère sa séance le lundi
 * et l'exécute le mercredi est le cas ORDINAIRE, pas un décrochage. Classer un
 * jour de retard en "à vérifier" remplissait la tête de l'écran d'atterrissage
 * de rouge dès le lendemain d'une génération : le niveau haut n'aurait plus rien
 * signifié, et c'est exactement ce que le garde-fou n°3 protège. Un seul jour
 * reste donc "à surveiller" — le fait est dit, il ne réclame simplement pas un
 * appel. À partir de 2 jours, l'écart n'est plus un simple décalage.
 */
export const RETARD_SEANCE_JOURS_CHECK = 2;

export type CoachAttentionOutcome = {
  statut: CoachStatusLevel;
  signaux: CoachSignal[];
  /**
   * true = il MANQUE des données sur ce joueur (cf. `aDesDonneesManquantes`).
   *
   * ⚠️ Ce n'est PAS un cinquième niveau : la hiérarchie reste à 4
   * (normal / watch / check / unknown). C'est une nuance de LIBELLÉ : un
   * "Rien à signaler" se lit alors "Rien à signaler parmi les données
   * disponibles". Sans ça, le silence de l'app se confond avec une preuve
   * que tout va bien.
   */
  donneesPartielles: boolean;
};

/**
 * Faits — et seulement des faits — qui prouvent qu'une partie des données
 * manque. Aucun seuil, aucune pondération : quatre absences observables.
 *
 *  - aucune exécution transmise (on ne sait pas ce que le joueur a fait de sa séance) ;
 *  - aucune fenêtre d'activité (on ne peut pas parler d'assiduité) ;
 *  - aucune séance prévue connue (on ne peut pas dire "prévu vs fait") ;
 *  - profil incomplet (les séances sont moins bien ajustées, et on le sait).
 */
export function aDesDonneesManquantes(facts: CoachPlayerFacts): boolean {
  return (
    facts.execution === null ||
    facts.assiduite === null ||
    facts.seancePrevue === null ||
    !facts.profilComplet
  );
}

// Ordre d'affichage à niveau égal : du plus opérationnel au plus contextuel.
const CODE_ORDER: CoachSignalCode[] = [
  "seance_prevue_non_faite",
  "seance_interrompue",
  "exercices_sautes",
  "inactif",
  "seance_partielle",
  "exercices_adaptes",
  "retour_apres_coupure",
  "jamais_de_seance",
  "profil_incomplet",
  "seance_ajustee_moteur",
  "aucune_donnee",
];

const LEVEL_RANK: Record<CoachStatusLevel, number> = {
  normal: 0,
  unknown: 1,
  watch: 2,
  check: 3,
};

/** Date FR lisible pour une phrase de coach ("samedi 4 juillet"), ou repli neutre. */
const jour = (dateKey: string | null): string => {
  const label = dateKey ? formatDayFR(dateKey) : "";
  return label || "une date inconnue";
};

/**
 * Produit les signaux d'attention + le statut global d'un joueur.
 *
 * @param facts   modèle de lecture SANS verdict (cf. types.CoachPlayerFacts).
 * @param todayKey clé "YYYY-MM-DD" du jour, selon l'horloge du coach.
 */
export function buildAttentionSignals(
  facts: CoachPlayerFacts,
  todayKey: string,
): CoachAttentionOutcome {
  const signaux: CoachSignal[] = [];

  const plannedKey = facts.seancePrevue?.dateKey ?? null;
  // Dernière trace de séance FAITE, quelle que soit la source qui nous l'a donnée.
  const doneKeys = facts.datesSeancesFaites;
  const lastDoneKey =
    doneKeys[0] ?? facts.seanceFaite?.dateKey ?? facts.derniereActivite?.dateKey ?? null;

  // ── Aucune donnée exploitable : on le DIT, on n'invente pas un "rien à signaler" ──
  const aucuneDonnee =
    !facts.derniereActivite &&
    !plannedKey &&
    !facts.seanceFaite &&
    !facts.execution &&
    doneKeys.length === 0;

  if (aucuneDonnee) {
    signaux.push({
      code: "aucune_donnee",
      level: "unknown",
      titre: "Aucune donnée d'entraînement",
      pourquoi: "Aucune séance prévue ni réalisée n'a été remontée pour ce joueur.",
      source: "absent",
      dateKey: null,
    });
  }

  // ── Séance prévue à une date passée, rien de fait depuis ──────────────────
  const plannedPasse = plannedKey !== null && plannedKey < todayKey;
  const rienFaitDepuisPlanned =
    plannedPasse && (lastDoneKey === null || lastDoneKey < (plannedKey as string));

  if (rienFaitDepuisPlanned) {
    // Combien de jours de retard, RÉELLEMENT. Un écart non mesurable (clé
    // illisible) ne fait jamais monter le niveau : on reste à "à surveiller" et
    // on ne raconte pas un nombre de jours qu'on ne connaît pas.
    const retardBrut = diffDaysBetweenKeys(plannedKey, todayKey);
    const retard = retardBrut === null ? null : Math.max(1, retardBrut);
    const niveau: CoachStatusLevel =
      retard !== null && retard >= RETARD_SEANCE_JOURS_CHECK ? "check" : "watch";
    const precision =
      retard === null
        ? ""
        : retard === 1
          ? " Cela fait 1 jour : un jour de décalage reste courant."
          : ` Cela fait ${retard} jours.`;

    signaux.push({
      code: "seance_prevue_non_faite",
      level: niveau,
      titre: "Séance prévue non réalisée",
      pourquoi: `Une séance était prévue ${jour(plannedKey)} et aucune séance terminée n'a été enregistrée depuis.${precision}`,
      source: "calcule",
      dateKey: plannedKey,
    });
  } else if (plannedKey !== null && lastDoneKey === null) {
    // Un programme existe, mais aucune séance terminée connue à ce jour.
    signaux.push({
      code: "jamais_de_seance",
      level: "watch",
      titre: "Aucune séance réalisée",
      pourquoi: "Une séance est prévue, mais aucune séance terminée n'a encore été enregistrée.",
      source: "calcule",
      dateKey: plannedKey,
    });
  }

  // ── Inactivité (uniquement si une activité a EXISTÉ : sinon c'est une absence) ──
  const jours = facts.derniereActivite?.joursEcoules ?? null;
  if (jours !== null && jours >= INACTIVITE_CHECK_JOURS) {
    signaux.push({
      code: "inactif",
      level: "check",
      titre: `Sans séance depuis ${jours} jours`,
      pourquoi: `Dernière séance ${jour(facts.derniereActivite?.dateKey ?? null)}. Le joueur s'entraînait avant : un retour est attendu.`,
      source: "calcule",
      dateKey: facts.derniereActivite?.dateKey ?? null,
    });
  } else if (jours !== null && jours >= INACTIVITE_WATCH_JOURS) {
    signaux.push({
      code: "inactif",
      level: "watch",
      titre: `Sans séance depuis ${jours} jours`,
      pourquoi: `Dernière séance ${jour(facts.derniereActivite?.dateKey ?? null)}.`,
      source: "calcule",
      dateKey: facts.derniereActivite?.dateKey ?? null,
    });
  }

  // ── Exécution réelle de la dernière séance faite ──────────────────────────
  const exec = facts.execution;
  const execDate = facts.seanceFaite?.dateKey ?? facts.derniereActivite?.dateKey ?? null;

  if (exec?.statut === "interrompue") {
    signaux.push({
      code: "seance_interrompue",
      level: "check",
      titre: "Séance interrompue",
      pourquoi: `Le joueur a arrêté sa séance avant la fin (${jour(execDate)}).`,
      source: "execution",
      dateKey: execDate,
    });
  } else if (exec?.statut === "partielle") {
    signaux.push({
      code: "seance_partielle",
      level: "watch",
      titre: "Séance réalisée en partie",
      // « des exercices prévus » et non « de la séance » : ce pourcentage est un
      // COMPTAGE d'exercices, pas une mesure d'effort ni de qualité. La fiche
      // joueur emploie exactement le même vocabulaire (CoachPlayerScreen).
      pourquoi:
        exec.pourcentage !== null
          ? `Environ ${exec.pourcentage} % des exercices prévus ont été réalisés.`
          : "Une partie seulement des exercices prévus a été réalisée.",
      source: "execution",
      dateKey: execDate,
    });
  }

  const saute = exec?.saute ?? null;
  if (saute !== null && saute >= SAUTS_CHECK) {
    signaux.push({
      code: "exercices_sautes",
      level: "check",
      titre: `${saute} exercices sautés`,
      pourquoi: "Plusieurs exercices n'ont pas été faits : un échange avec le joueur est utile.",
      source: "execution",
      dateKey: execDate,
    });
  } else if (saute !== null && saute >= 1) {
    signaux.push({
      code: "exercices_sautes",
      level: "watch",
      titre: saute === 1 ? "1 exercice sauté" : `${saute} exercices sautés`,
      pourquoi: "Le joueur a passé un ou deux exercices de sa séance.",
      source: "execution",
      dateKey: execDate,
    });
  }

  const adapte = exec?.adapte ?? null;
  if (adapte !== null && adapte >= ADAPTATIONS_WATCH) {
    signaux.push({
      code: "exercices_adaptes",
      level: "watch",
      titre: `${adapte} exercices adaptés`,
      pourquoi: "Le joueur a modifié plusieurs exercices pour pouvoir les faire.",
      source: "execution",
      dateKey: execDate,
    });
  }

  // ── Retour après coupure (fait mesurable : trou entre deux séances faites) ──
  if (doneKeys.length >= 2 && jours !== null && jours <= RETOUR_RECENT_JOURS) {
    const trou = diffDaysBetweenKeys(doneKeys[1], doneKeys[0]);
    if (trou !== null && trou >= COUPURE_JOURS) {
      signaux.push({
        code: "retour_apres_coupure",
        level: "watch",
        titre: "Reprise après une coupure",
        pourquoi: `Le joueur a repris ${jour(doneKeys[0])} après ${trou} jours sans séance : montée en charge à surveiller.`,
        source: "calcule",
        dateKey: doneKeys[0],
      });
    }
  }

  // ── Profil incomplet (fait déclaré, pas une absence de donnée) ─────────────
  if (!facts.profilComplet) {
    signaux.push({
      code: "profil_incomplet",
      level: "watch",
      titre: "Profil incomplet",
      pourquoi: "Le joueur n'a pas terminé son profil : les séances sont moins bien ajustées.",
      source: "declare",
      dateKey: null,
    });
  }

  // ── Ajustement MOTEUR : information, jamais une alerte ────────────────────
  // Ce n'est PAS le joueur qui a modifié sa séance : c'est FKS qui l'a allégée.
  if (facts.ajustementsMoteur.length > 0) {
    signaux.push({
      code: "seance_ajustee_moteur",
      level: "normal",
      titre: "Séance ajustée par FKS",
      pourquoi: `FKS a adapté la prescription automatiquement : ${facts.ajustementsMoteur.join(", ")}.`,
      source: "moteur",
      dateKey: plannedKey ?? facts.seanceFaite?.dateKey ?? null,
    });
  }

  // ── Tri d'affichage : niveau décroissant, puis ordre de code figé (stable) ──
  const ordonnes = signaux.slice().sort((a, b) => {
    const diff = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
    if (diff !== 0) return diff;
    return CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code);
  });

  // ── Statut global ─────────────────────────────────────────────────────────
  // Le maximum des niveaux présents, SANS agrégation : dix "watch" restent
  // "watch". Seul un fait classé "check" peut produire un "check".
  const statut = ordonnes.reduce<CoachStatusLevel>(
    (acc, signal) => (LEVEL_RANK[signal.level] > LEVEL_RANK[acc] ? signal.level : acc),
    "normal",
  );

  // Nuance de libellé, PAS un niveau de plus (cf. CoachAttentionOutcome).
  return { statut, signaux: ordonnes, donneesPartielles: aDesDonneesManquantes(facts) };
}
