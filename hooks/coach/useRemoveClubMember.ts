// hooks/coach/useRemoveClubMember.ts
//
// LES TROIS FORMES DE RETRAIT, côté coach — un hook par geste affiché.
//
// UN SEUL HOOK PARAMÉTRÉ, ET NON TROIS COPIES. Ce qui est délicat ici n'est pas
// l'appel (trois lignes), c'est la discipline d'état : un geste à la fois, pas
// d'écriture après démontage, purge à la perte d'autorité, et surtout un état
// qui n'appartient qu'à SA cible. Recopier ça trois fois, ce serait trois
// endroits où l'oublier.
//
// LE GESTE ENTRE DANS LA CLÉ D'ÉTAT. Sans ça, deux gestes montés sur la même
// fiche partageraient un état : le « fait » de l'un s'afficherait sous le bouton
// de l'autre. La clé est donc (club, membre, geste), et le rendu ne montre que
// ce qui correspond aux trois.
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
  deactivateClubPlayer as deactivateClubPlayerCall,
  removeClubMember as removeClubMemberCall,
  revokeClubStaffAccess as revokeClubStaffAccessCall,
  type RemoveMemberOutcome,
  type RemoveMemberFailureReason,
} from "../../services/clubMembers";
import {
  canCommitCoachData,
  currentCoachAuthorityToken,
} from "../../state/coachAuthorityGate";
import { useCoachDataPurge } from "./useCoachDataPurge";

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

/**
 * LES TROIS GESTES. Le nom est interne au front : il ne part pas sur le réseau
 * (chaque geste a sa propre callable), il ne sert qu'à choisir la fonction du
 * service et à séparer les états.
 */
export type ClubMemberGeste = "retrait-complet" | "arret-suivi" | "retrait-encadrement";

const APPEL_PAR_GESTE: Record<
  ClubMemberGeste,
  (clubId: string, memberUid: string) => Promise<RemoveMemberOutcome>
> = {
  "retrait-complet": removeClubMemberCall,
  "arret-suivi": deactivateClubPlayerCall,
  "retrait-encadrement": revokeClubStaffAccessCall,
};

/**
 * Cible sous forme de clé — club, membre ET geste. "/" est interdit dans un
 * doc-id / un UID, et le geste vient d'une liste fermée : pas de collision.
 */
function targetKeyOf(
  clubId: string | null,
  memberUid: string | null,
  geste: ClubMemberGeste,
): string | null {
  return clubId && memberUid ? `${clubId}/${memberUid}/${geste}` : null;
}

export function useClubMemberGeste(
  geste: ClubMemberGeste,
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

  const targetKey = targetKeyOf(clubId, memberUid, geste);
  // Le filtre par cible, AU RENDU. Changer de fiche suffit à rendre l'état
  // précédent invisible — il n'y a rien à remettre à zéro, donc rien qui puisse
  // arriver en retard. Une réponse revenue après le changement de fiche est
  // enregistrée sous SA cible et ne s'affiche pas sur une autre.
  const phase = entry.key !== null && entry.key === targetKey ? entry.phase : IDLE;

  const inFlightRef = useRef(false);

  // PURGE À LA PERTE D'AUTORITÉ. L'état de retrait PORTE l'identifiant d'un
  // joueur (`key`) : c'est de la donnée coach, si peu que ce soit. Il repart à
  // l'état neutre. Le retrait déjà parti vers le serveur, lui, suit son cours —
  // la purge est LOCALE, elle n'annule aucune écriture en base.
  useCoachDataPurge(
    useCallback(() => {
      setEntry(NEUTRAL);
    }, []),
  );

  const remove = useCallback(() => {
    if (!clubId || !memberUid || inFlightRef.current) return;
    // Clé capturée au moment du geste : c'est elle qui datera la réponse.
    const key = `${clubId}/${memberUid}/${geste}`;
    // Jeton capturé au DÉPART, vérifié à l'ARRIVÉE.
    const jetonAutorite = currentCoachAuthorityToken();
    inFlightRef.current = true;
    setEntry({ key, phase: { kind: "pending" } });

    APPEL_PAR_GESTE[geste](clubId, memberUid)
      .then((outcome) => {
        if (!mountedRef.current || !canCommitCoachData(jetonAutorite)) return;
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
  }, [clubId, memberUid, geste]);

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setEntry(NEUTRAL);
  }, []);

  return { phase, isRemoving: phase.kind === "pending", remove, reset };
}

/**
 * Le retrait COMPLET, sous son nom historique. Conservé parce que c'est le geste
 * que le reste du dépôt connaît déjà — et parce qu'un alias d'une ligne coûte
 * moins cher qu'une vague de renommages dans du code qui marche.
 */
export function useRemoveClubMember(
  clubId: string | null,
  memberUid: string | null,
): UseRemoveClubMemberState {
  return useClubMemberGeste("retrait-complet", clubId, memberUid);
}
