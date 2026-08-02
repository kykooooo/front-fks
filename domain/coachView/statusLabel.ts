// domain/coachView/statusLabel.ts
//
// « RIEN À SIGNALER » N'EST PAS « TOUT VA BIEN ».
//
// LE DÉFAUT CORRIGÉ. Un joueur dont l'exécution n'est pas transmise, dont la
// fenêtre d'activité est absente et dont le profil est incomplet ne déclenche
// aucun signal : l'app affichait donc « Rien à signaler ». Le coach lisait une
// preuve que tout allait bien, alors que c'était une absence d'information. Le
// silence de l'outil se confondait avec un constat.
//
// CE QUE FAIT CE MODULE. Il nuance le SEUL libellé qui pose ce problème :
// « Rien à signaler » devient « Rien à signaler parmi les données disponibles »
// quand `donneesPartielles` est levé (cf. `aDesDonneesManquantes`, attention.ts).
//
// CE QU'IL NE FAIT PAS, ET C'EST VOLONTAIRE.
//  - Il ne crée AUCUN cinquième niveau de statut : la hiérarchie reste à 4
//    (normal / watch / check / unknown). C'est une nuance de libellé, rien de plus.
//  - Il ne touche PAS aux trois autres niveaux. « À vérifier » et « À surveiller »
//    disent déjà qu'il faut regarder ; « Indisponible » dit déjà qu'on ne sait
//    rien. Seul « Rien à signaler » affirmait quelque chose de faux.
//
// Module PUR : ni React, ni Firestore, ni horloge.

import { COACH_STATUS_LABEL, type CoachStatusLevel } from "./types";

/**
 * Libellé COMPLET d'un statut, nuancé quand une partie des données manque.
 *
 * @param level             niveau du joueur (hiérarchie à 4, inchangée).
 * @param donneesPartielles drapeau porté par `CoachPlayerView.donneesPartielles`.
 */
export function coachStatusLabel(
  level: CoachStatusLevel,
  donneesPartielles: boolean,
): string {
  if (level === "normal" && donneesPartielles) {
    return `${COACH_STATUS_LABEL.normal} parmi les données disponibles`;
  }
  return COACH_STATUS_LABEL[level] ?? COACH_STATUS_LABEL.unknown;
}

/**
 * Précision à afficher À CÔTÉ d'un libellé volontairement court (une pastille de
 * liste, un en-tête de fiche). `null` = le libellé court dit déjà tout, il n'y a
 * rien à ajouter.
 *
 * POURQUOI une fonction séparée plutôt qu'un libellé long dans la pastille : à
 * 375 pt, « Rien à signaler parmi les données disponibles » ne tient pas dans
 * une pastille posée à côté d'un prénom — elle se couperait en plein mot, et la
 * nuance disparaîtrait précisément là où elle compte. La pastille reste courte,
 * la phrase entière se lit juste en dessous (et le lecteur d'écran l'entend).
 */
export function coachStatusPrecision(
  level: CoachStatusLevel,
  donneesPartielles: boolean,
): string | null {
  const complet = coachStatusLabel(level, donneesPartielles);
  return complet === COACH_STATUS_LABEL[level] ? null : complet;
}

/**
 * Phrase de contexte d'une carte de statut, quand des données manquent.
 * `null` quand rien ne manque : on n'ajoute pas une ligne de bruit à chaque fiche.
 */
export function coachDonneesPartiellesNote(donneesPartielles: boolean): string | null {
  if (!donneesPartielles) return null;
  return "Une partie des données de ce joueur n'a pas été transmise : ce constat ne porte que sur ce qui est connu.";
}
