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

// ─── ET QUAND ÇA N'A PAS MARCHÉ : DEUX ÉCHECS, DEUX PHRASES ─────────────────
//
// La carte annonçait « Le code club n'a pas été reconnu. » quoi qu'il arrive,
// y compris sous un message qui disait « Le serveur ne répond pas ». Le titre
// contredisait le corps : le joueur comprenait que SON code était mauvais et
// allait en redemander un à son coach, alors que le code était bon et que
// c'était le réseau (R6 de la contre-vérification du 05/09).
//
// On ne distingue que ce qu'on SAIT distinguer, et rien de plus : le serveur ne
// dit jamais POURQUOI un code est refusé (par conception, pour ne pas devenir
// un oracle d'existence). Ce qu'il dit, c'est s'il a répondu.

export type NatureEchecRattachement =
  /** Le serveur a répondu, et il refuse ce code. */
  | "code-refuse"
  /** Le serveur n'a pas pu répondre — ou pas répondre sur le code. */
  | "technique";

/**
 * Traduit la raison rendue par `services/clubInvites` en nature d'échec.
 *
 * `notFound` compte comme un refus de code : « ce club est introuvable » parle
 * bien de ce que le code désigne. `rateLimited`, `unauthenticated`,
 * `unavailable` et `forbidden` parlent de tout SAUF du code — et une raison
 * qu'on ne connaît pas ne devient jamais une accusation contre le code saisi.
 */
export function natureEchecRattachement(reason: unknown): NatureEchecRattachement {
  return reason === "rejected" || reason === "notFound" ? "code-refuse" : "technique";
}

/** Le titre affiché sur la carte d'échec. Une phrase par nature, pas deux. */
export function titreEchecRattachement(nature: NatureEchecRattachement): string {
  return nature === "code-refuse"
    ? "Le code club n'a pas été reconnu."
    : "Impossible de vérifier le code pour l'instant.";
}
