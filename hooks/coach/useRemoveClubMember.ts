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
//
// COMMENT L'ÉTAT RESTE ATTACHÉ À SA CIBLE. L'état d'un retrait ne vaut que pour
// le membre sur lequel le geste a été fait : un « retiré » affiché sur le mauvais
// joueur serait le pire mensonge possible de cet écran. Plutôt que de remettre
// l'état à zéro APRÈS COUP dans un effet (une remise à zéro qui arrive toujours
// un rendu trop tard, et qui n'attrape pas une réponse revenue entre-temps),
// l'état PORTE la cible à laquelle il appartient et le rendu ne montre que ce
// qui correspond à la cible affichée. Un état qui n'est pas le sien n'a donc
// jamais l'occasion d'être vu, même une fraction de seconde.

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
  /**
   * Remet l'état à zéro (fermeture de la confirmation). Un changement de fiche,
   * lui, n'a rien à appeler : l'état est filtré par cible au rendu.
   */
  reset: () => void;
};

/** Phase affichée par défaut. Constante de module : son identité est stable, un
 *  retour à l'état neutre ne provoque donc aucun rendu inutile chez l'appelant. */
const IDLE: RemoveMemberPhase = { kind: "idle" };

/**
 * État interne : une phase ET la cible à laquelle elle appartient.
 * `key` à `null` = phase qui n'appartient à personne (état neutre).
 */
type PhaseEntry = { key: string | null; phase: RemoveMemberPhase };

const NEUTRAL: PhaseEntry = { key: null, phase: IDLE };

/** Cible sous forme de clé. "/" est interdit dans un doc-id / un UID : pas de collision. */
function targetKeyOf(clubId: string | null, memberUid: string | null): string | null {
  return clubId && memberUid ? `${clubId}/${memberUid}` : null;
}

export function useRemoveClubMember(
  clubId: string | null,
  memberUid: string | null,
): UseRemoveClubMemberState {
  const [entry, setEntry] = useState<PhaseEntry>(NEUTRAL);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const targetKey = targetKeyOf(clubId, memberUid);
  // Le filtre par cible, AU RENDU. Changer de fiche suffit à rendre l'état
  // précédent invisible — il n'y a rien à remettre à zéro, donc rien qui puisse
  // arriver en retard. Une réponse revenue après le changement de fiche est
  // enregistrée sous SA cible et ne s'affiche pas sur une autre.
  const phase = entry.key !== null && entry.key === targetKey ? entry.phase : IDLE;

  const inFlightRef = useRef(false);

  const remove = useCallback(() => {
    if (!clubId || !memberUid || inFlightRef.current) return;
    // Clé capturée au moment du geste : c'est elle qui datera la réponse.
    const key = `${clubId}/${memberUid}`;
    inFlightRef.current = true;
    setEntry({ key, phase: { kind: "pending" } });

    removeClubMemberCall(clubId, memberUid)
      .then((outcome) => {
        if (!mountedRef.current) return;
        setEntry({
          key,
          phase: outcome.ok
            ? { kind: "done", alreadyRemoved: outcome.alreadyRemoved }
            : { kind: "failed", reason: outcome.reason, message: outcome.message },
        });
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [clubId, memberUid]);

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setEntry(NEUTRAL);
  }, []);

  return { phase, isRemoving: phase.kind === "pending", remove, reset };
}
