// hooks/coach/useCoachLandingTab.ts
//
// LA LECTURE QUI DÉCIDE DE L'ONGLET D'ATTERRISSAGE COACH.
//
// Il n'y a ici NI règle, NI compteur : la règle est dans
// `domain/coachView/landing.ts`, et l'effectif vient de `useCoachRoster` —
// exactement la même source de vérité que les trois écrans coach. Ce hook ne
// fait que brancher l'une sur l'autre, et ajouter un délai de garde.
//
// POURQUOI UNE LECTURE DE PLUS, ET POURQUOI C'EST ASSUMÉ.
// `initialRouteName` n'est lu qu'UNE fois, au montage du navigateur : la réponse
// doit donc être connue AVANT que les onglets existent. Or chaque écran coach
// appelle déjà `useCoachRoster` pour son propre compte (Aujourd'hui, Effectif et
// Semaine en font chacun une lecture) — ce hook n'introduit donc pas une classe
// nouvelle de duplication, il en ajoute une occurrence. Et dans le cas qui a
// motivé le correctif (club vide), l'onglet Aujourd'hui n'est jamais monté :
// cette lecture REMPLACE la sienne au lieu de s'y ajouter.
//
// LE DÉLAI DE GARDE. Tant que la décision n'est pas prise, l'appelant affiche un
// squelette : sans butée, une lecture qui ne reviendrait jamais laisserait
// l'espace coach inaccessible. Passé le délai, on ouvre sur l'onglet historique.

import { useEffect, useState } from "react";

import { useCoachClub } from "./useCoachClub";
import { useCoachRoster } from "./useCoachRoster";
import { chooseCoachLandingTab, type CoachLandingTab } from "../../domain/coachView/landing";

/**
 * Au-delà de ce délai, on n'attend plus la réponse de l'effectif et on ouvre
 * l'espace sur l'onglet historique. Large exprès : une lecture froide (Firestore
 * réveillé, réseau de stade) est lente, et se replier trop tôt ferait
 * réapparaître le défaut qu'on corrige.
 */
export const COACH_LANDING_TIMEOUT_MS = 8000;

export type UseCoachLandingTabOptions = {
  /** Délai de garde. Injectable pour les tests. */
  timeoutMs?: number;
};

/**
 * Onglet sur lequel ouvrir l'espace coach, ou `null` tant qu'on ne sait pas.
 *
 * `null` veut dire ATTENDS, jamais « prends le défaut » : l'appelant doit rendre
 * un squelette. C'est ce qui évite le clignotement « Aujourd'hui → Semaine ».
 */
export function useCoachLandingTab(options?: UseCoachLandingTabOptions): CoachLandingTab | null {
  const club = useCoachClub();
  const roster = useCoachRoster(club.clubId);

  const timeoutMs = options?.timeoutMs ?? COACH_LANDING_TIMEOUT_MS;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // `setTimedOut` part d'un `setTimeout`, pas du corps de l'effet : aucun
    // rendu en cascade au montage.
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  return chooseCoachLandingTab({
    clubStatus: club.status,
    rosterStatus: roster.status,
    // La preuve qu'une lecture d'effectif a abouti POUR CE CLUB. Voir le
    // commentaire de `CoachLandingInput.rosterAnswered` : sans elle, la fenêtre
    // de rendu pendant laquelle le club est résolu mais l'effectif pas encore
    // demandé se lirait comme « club vide ».
    rosterAnswered: roster.fetchedAt !== null,
    memberCount: roster.memberCount,
    timedOut,
  });
}
