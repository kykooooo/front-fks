// hooks/coach/useClubInviteCode.ts
//
// Émission d'un code d'invitation, côté coach.
//
// CE QUI CHANGE POUR LE COACH, ET POURQUOI IL FAUT LE DIRE À L'ÉCRAN :
// le code n'est plus stocké en clair, donc il n'est plus RELISIBLE. Il apparaît
// une fois, au moment où le serveur le crée, et vit uniquement dans la mémoire
// de cet écran. S'il est perdu (application fermée, téléphone redémarré), le
// coach en génère un nouveau — ce qui RÉVOQUE le précédent. Cette conséquence
// n'est jamais une surprise : elle est annoncée avant, et confirmée après.
//
// Ce hook ne garde AUCUNE trace persistante du code (ni AsyncStorage, ni store)
// — l'y écrire recréerait exactement la fuite qu'on vient de fermer.

import { useCallback, useEffect, useRef, useState } from "react";

import { issueClubInviteCode } from "../../services/clubInvites";

export type ClubInviteCodeState = {
  /** Code affichable, uniquement depuis l'émission de CETTE session d'écran. */
  code: string | null;
  /** ms epoch de fin de validité du code affiché (0 si inconnu). */
  expiresAt: number | null;
  /** Nombre d'usages autorisés annoncé par le serveur. */
  maxUses: number | null;
  /** true si l'émission a remplacé (donc révoqué) un code précédent. */
  replacedPrevious: boolean;
  /** Message d'erreur FR de la dernière tentative, ou null. */
  error: string | null;
  isIssuing: boolean;
  /** Émet un nouveau code. Ne lève jamais. */
  issue: () => void;
};

/**
 * Résultat d'émission, ACCOMPAGNÉ du club auquel il appartient.
 *
 * Porter le clubId dans l'état plutôt que de le remettre à zéro dans un effet
 * n'est pas un détail de style : un effet de remise à zéro laisse forcément un
 * rendu intermédiaire pendant lequel le code de l'ANCIEN club s'affiche sous le
 * nom du NOUVEAU. Ici, un code ne peut structurellement pas survivre à un
 * changement de club.
 */
type IssuedCode = {
  clubId: string;
  code: string;
  expiresAt: number | null;
  maxUses: number | null;
  replacedPrevious: boolean;
};

export function useClubInviteCode(clubId: string | null): ClubInviteCodeState {
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [errorState, setErrorState] = useState<{ clubId: string; message: string } | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const issue = useCallback(() => {
    if (!clubId || isIssuing) return;
    const target = clubId;
    setIsIssuing(true);
    setErrorState(null);

    issueClubInviteCode(target)
      .then((outcome) => {
        if (!mountedRef.current) return;
        if (!outcome.ok) {
          setErrorState({ clubId: target, message: outcome.message });
          return;
        }
        setIssued({
          clubId: target,
          code: outcome.code,
          expiresAt: outcome.expiresAt || null,
          maxUses: outcome.maxUses || null,
          replacedPrevious: outcome.replacedPrevious,
        });
      })
      .finally(() => {
        if (mountedRef.current) setIsIssuing(false);
      });
  }, [clubId, isIssuing]);

  // Un code (ou une erreur) n'est montré que s'il concerne le club affiché.
  const current = issued && issued.clubId === clubId ? issued : null;
  const error = errorState && errorState.clubId === clubId ? errorState.message : null;

  return {
    code: current?.code ?? null,
    expiresAt: current?.expiresAt ?? null,
    maxUses: current?.maxUses ?? null,
    replacedPrevious: current?.replacedPrevious ?? false,
    error,
    isIssuing,
    issue,
  };
}
