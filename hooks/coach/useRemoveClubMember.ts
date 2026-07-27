// hooks/coach/useRemoveClubMember.ts
//
// Retrait d'un membre du club, côté coach.
//
// CE QUE CE HOOK NE FAIT PAS, ET POURQUOI :
//  - il ne DÉCIDE de rien. Il ne devine pas si l'utilisateur est encadrant, ni
//    si la cible est le propriétaire : le serveur est seul juge, et le front qui
//    anticipe un refus finit toujours par se tromper dans un sens ou dans
//    l'autre (bouton caché à tort, ou promesse non tenue) ;
//  - il ne parle PAS à l'utilisateur. Il expose un état, l'écran affiche. Même
//    règle que `useCoachPlayer` : un hook de données n'émet pas de toast ;
//  - il ne modifie AUCUN cache local. La vérité du retrait est en base ; l'écran
//    relit (ou revient à l'effectif, qui relit). Écrire un état optimiste ici
//    ferait diverger l'affichage du serveur pour la seule seconde où le coach
//    regarde vraiment.
//
// Une seule garde technique : un geste à la fois, et aucune écriture d'état
// après démontage (le coach quitte souvent la fiche juste après le retrait).

import { useCallback, useEffect, useRef, useState } from "react";

import {
  removeClubMember as removeClubMemberCall,
  type RemoveMemberFailureReason,
} from "../../services/clubMembers";

export type RemoveMemberPhase =
  | { kind: "idle" }
  | { kind: "pending" }
  /** Retrait effectif. `alreadyRemoved` = rejeu (le membre était déjà retiré). */
  | { kind: "done"; alreadyRemoved: boolean }
  | { kind: "failed"; reason: RemoveMemberFailureReason; message: string };

export type UseRemoveClubMemberState = {
  phase: RemoveMemberPhase;
  /** Raccourci de lecture pour désactiver le bouton pendant l'appel. */
  isRemoving: boolean;
  /** Lance le retrait. Ne lève jamais. Sans effet si un geste est déjà en cours. */
  remove: () => void;
  /** Remet l'état à zéro (fermeture de la confirmation, changement de fiche). */
  reset: () => void;
};

export function useRemoveClubMember(
  clubId: string | null,
  memberUid: string | null,
): UseRemoveClubMemberState {
  const [phase, setPhase] = useState<RemoveMemberPhase>({ kind: "idle" });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Changement de cible : l'état d'un retrait ne doit JAMAIS survivre au passage
  // d'une fiche à une autre — un « retiré » affiché sur le mauvais joueur serait
  // le pire mensonge possible de cet écran.
  useEffect(() => {
    setPhase({ kind: "idle" });
  }, [clubId, memberUid]);

  const inFlightRef = useRef(false);

  const remove = useCallback(() => {
    if (!clubId || !memberUid || inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase({ kind: "pending" });

    removeClubMemberCall(clubId, memberUid)
      .then((outcome) => {
        if (!mountedRef.current) return;
        setPhase(
          outcome.ok
            ? { kind: "done", alreadyRemoved: outcome.alreadyRemoved }
            : { kind: "failed", reason: outcome.reason, message: outcome.message },
        );
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [clubId, memberUid]);

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setPhase({ kind: "idle" });
  }, []);

  return { phase, isRemoving: phase.kind === "pending", remove, reset };
}
