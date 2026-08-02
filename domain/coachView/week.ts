// domain/coachView/week.ts
//
// « Que s'est-il passé cette semaine ? » — synthèse de GROUPE.
//
// CE QUI EST CORRIGÉ ICI. Le bulletin historique
// (coachSummary.buildWeeklyReportSentence) annonce une semaine mais compte des
// états INSTANTANÉS ("à relancer", "séances prêtes") : le coach lit "cette
// semaine" et reçoit un instantané. Ici, tout compteur annoncé "cette semaine"
// est calculé sur les BORNES RÉELLES de la semaine (lundi → dimanche) à partir
// de dates de séances FAITES. Les indicateurs d'état, eux, sont explicitement
// annoncés comme "aujourd'hui".
//
// HONNÊTETÉ : un joueur dont on n'a pas la fenêtre d'activité n'est PAS compté
// à zéro séance — il est compté "sans donnée". Une seule date connue ne dit pas
// combien de séances ont eu lieu dans la semaine ; l'affirmer serait présenter
// une estimation comme une mesure.
//
// Aucune formulation prédictive : on décrit ce qui s'est passé, on n'annonce
// jamais ce qui va se passer.
//
// Module PUR : `weekKey` et `todayKey` injectés.

import { formatDayFR } from "../../utils/dateHelpers";
import { addDaysToKey, isValidDateKey } from "./dates";
import type { CoachPlayerView, CoachWeekDigest } from "./types";

const JOURS_SEMAINE = 7;

export type CoachWeekDigestOptions = {
  /** Mot singulier employé pour un membre ("joueur", "joueuse", "membre"). */
  memberWord?: string;
};

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Les 7 clés de la semaine à partir de son lundi. Clé invalide → []. */
export function weekDayKeys(weekKey: string): string[] {
  if (!isValidDateKey(weekKey)) return [];
  const jours: string[] = [];
  for (let i = 0; i < JOURS_SEMAINE; i += 1) {
    const key = addDaysToKey(weekKey, i);
    if (key) jours.push(key);
  }
  return jours;
}

/**
 * Synthèse de la semaine pour un groupe.
 *
 * @param views    modèles de lecture des membres du groupe.
 * @param weekKey  LUNDI de la semaine ("YYYY-MM-DD", cf. utils/dateHelpers.weekKeyOf).
 * @param todayKey jour courant selon l'horloge du coach (borne les jours écoulés).
 */
export function buildWeekDigest(
  views: CoachPlayerView[],
  weekKey: string,
  todayKey: string,
  options: CoachWeekDigestOptions = {},
): CoachWeekDigest {
  const memberWord = options.memberWord?.trim() || "joueur";
  const jours = weekDayKeys(weekKey);
  const debut = jours[0] ?? "";
  const fin = jours[jours.length - 1] ?? "";
  const joursSet = new Set(jours);
  // Jours déjà écoulés : on ne reproche pas à un joueur de ne pas avoir fait
  // une séance de vendredi… un mercredi.
  const joursEcoules = isValidDateKey(todayKey) ? jours.filter((j) => j <= todayKey) : jours;

  let membresAvecDonnees = 0;
  let seancesFaites = 0;
  let membresActifs = 0;
  let aVerifier = 0;
  let aSurveiller = 0;
  let couvertureIncomplete = false;

  for (const view of views) {
    if (view.statut === "check") aVerifier += 1;
    if (view.statut === "watch") aSurveiller += 1;

    // Sans fenêtre d'activité, on ne SAIT PAS combien de séances ont eu lieu.
    if (!view.assiduite) continue;
    membresAvecDonnees += 1;

    const dansLaSemaine = view.datesSeancesFaites.filter((d) => joursSet.has(d));
    seancesFaites += dansLaSemaine.length;
    if (dansLaSemaine.length > 0) membresActifs += 1;

    // Fenêtre saturée qui ne remonte pas jusqu'au lundi → comptage possiblement
    // incomplet pour ce membre. On le DIT au lieu d'afficher un chiffre exhaustif.
    const plusAncienne = view.datesSeancesFaites[view.datesSeancesFaites.length - 1];
    if (view.datesSeancesFaites.length >= 14 && debut && plusAncienne && plusAncienne > debut) {
      couvertureIncomplete = true;
    }
  }

  const membres = views.length;
  const membresSansDonnees = membres - membresAvecDonnees;
  const membresSansSeance = membresAvecDonnees - membresActifs;

  // ── Phrases : descriptives, datées, sans jargon ni promesse ───────────────
  const phrases: string[] = [];
  if (debut && fin) {
    phrases.push(`Semaine du ${formatDayFR(debut)} au ${formatDayFR(fin)}.`);
  }

  if (membres === 0) {
    phrases.push("Aucun membre dans le groupe.");
  } else if (membresAvecDonnees === 0) {
    phrases.push(
      `Aucune donnée d'activité disponible pour ${pluriel(membres, memberWord)} : assiduité de la semaine non mesurable.`,
    );
  } else if (seancesFaites === 0) {
    phrases.push(`Aucune séance enregistrée cette semaine pour ${pluriel(membresAvecDonnees, memberWord)} suivi${membresAvecDonnees > 1 ? "s" : ""}.`);
  } else {
    phrases.push(
      `${pluriel(seancesFaites, "séance")} réalisée${seancesFaites > 1 ? "s" : ""} cette semaine par ${pluriel(membresActifs, memberWord)} sur ${membresAvecDonnees} suivi${membresAvecDonnees > 1 ? "s" : ""}.`,
    );
  }

  if (membresSansSeance > 0 && seancesFaites > 0) {
    phrases.push(`${pluriel(membresSansSeance, memberWord)} sans aucune séance cette semaine.`);
  }
  if (membresSansDonnees > 0 && membresAvecDonnees > 0) {
    phrases.push(`Aucune donnée d'activité pour ${pluriel(membresSansDonnees, memberWord)}.`);
  }
  if (aVerifier > 0 || aSurveiller > 0) {
    const parties: string[] = [];
    if (aVerifier > 0) parties.push(`${aVerifier} à vérifier`);
    if (aSurveiller > 0) parties.push(`${aSurveiller} à surveiller`);
    phrases.push(`Aujourd'hui : ${parties.join(", ")}.`);
  }
  if (couvertureIncomplete) {
    phrases.push("Comptage possiblement incomplet : l'historique disponible remonte à 14 séances.");
  }

  return {
    weekKey,
    debut,
    fin,
    jours,
    joursEcoules,
    membres,
    membresAvecDonnees,
    membresSansDonnees,
    seancesFaites,
    membresActifs,
    membresSansSeance,
    aVerifier,
    aSurveiller,
    couvertureIncomplete,
    phrases,
  };
}
