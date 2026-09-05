// domain/clubJoinMessages.ts
//
// CE QU'ON DIT AU JOUEUR APRÈS UNE TENTATIVE DE RATTACHEMENT — et rien de plus
// que ce que le serveur nous a réellement appris.
//
// Un club peut exiger la validation manuelle de ses entrées
// (`joinAccessPolicy: "approval_required"`, `functions/src/coachAccess.ts`).
// Dans ce cas le serveur pose `coachAccess: "pending"` sur l'appartenance et le
// renvoie dans la réponse du rattachement : le joueur EST membre, mais son suivi
// n'est pas encore consultable par le coach. Lui annoncer « Tu as rejoint {club} »
// est faux au moment qui compte — il croit être vu, il ne l'est pas (P2-07 de
// l'audit d'inscription du 05/09).
//
// Quand la réponse ne porte pas l'état (fonction plus ancienne déployée, valeur
// inattendue), on n'invente rien : message neutre, aucune promesse.

import type { CoachAccessState } from "./coachAccess";

export type ToastRattachement = {
  type: "success" | "info";
  title: string;
  message: string;
};

export function messageRattachementReussi(
  clubName: string | null,
  coachAccess: CoachAccessState | null,
): ToastRattachement {
  const club = clubName?.trim() ? clubName.trim() : null;

  if (coachAccess === "pending") {
    return {
      type: "info",
      title: club ? `Demande envoyée à ${club}` : "Demande envoyée",
      message: "En attente de validation du coach.",
    };
  }

  return {
    type: "success",
    title: "Profil enregistré",
    message: club ? `Tu as rejoint ${club}.` : "Tu as rejoint ton club.",
  };
}
