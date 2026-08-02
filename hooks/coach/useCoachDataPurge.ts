// hooks/coach/useCoachDataPurge.ts
//
// « QUAND L'AUTORITE TOMBE, VIDE-TOI. » — en une ligne, pour tout detenteur de
// donnees coach.
//
// POURQUOI CE HOOK EXISTE PLUTOT QU'UN `useEffect` RECOPIE PARTOUT.
// Aujourd'hui, toutes les donnees coach vivent dans l'etat local de hooks montes
// sous l'espace coach : la fermeture de l'espace les demonte, donc les efface.
// C'est vrai, et c'est fragile — parce que c'est une propriete de l'ARBRE React,
// pas une regle ecrite. Le jour ou l'effectif passera dans un store, ou ou un
// ecran restera monte derriere une superposition, la purge disparaitra sans que
// rien ne le signale.
//
// Ce hook rend la purge EXPLICITE et TESTABLE : elle s'observe sans demonter
// quoi que ce soit, et un futur detenteur de donnees coach n'a qu'une ligne a
// ecrire pour etre couvert.
//
// La remise a zero doit etre STABLE (useCallback) : elle n'a aucune raison de
// dependre d'un rendu, et un abonnement repose a chaque rendu couterait cher
// pour rien.

import { useEffect, useRef } from "react";

import { onCoachDataPurge, type CoachPurgeRaison } from "../../state/coachAuthorityGate";

/**
 * @param vider ce qu'il faut effacer quand l'autorite coach n'est plus
 *              confirmee. Appele AUSSI pendant une revalidation (`chargement`) :
 *              on vide d'abord, on reaffiche apres confirmation.
 */
export function useCoachDataPurge(vider: (raison: CoachPurgeRaison) => void): void {
  // La derniere version de la fonction est gardee dans une ref : l'abonnement
  // est pose UNE fois, et il appelle toujours le code a jour. Sans ca, un
  // appelant qui passe une fonction non memoisee reabonnerait a chaque rendu.
  const viderRef = useRef(vider);
  useEffect(() => {
    viderRef.current = vider;
  });

  useEffect(() => onCoachDataPurge((raison) => viderRef.current(raison)), []);
}
