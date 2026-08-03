// domain/appSpace.ts
//
// QUEL ESPACE L'APPLICATION AFFICHE : coach, ou joueur — et, depuis ce lot, ce
// qu'elle fait quand la personne a réellement DROIT AUX DEUX.
//
// ─── LE DÉFAUT CORRIGÉ AU LOT PRÉCÉDENT ─────────────────────────────────────
// La navigation lisait `users/{uid}.role === "coach"`. Ce champ a DEUX
// problèmes, et le second est le plus grave :
//
//  1. le transfert de propriété ne le touche pas. Un joueur devenu propriétaire
//     avait donc TOUS les droits côté serveur et continuait de voir
//     l'application joueur ;
//  2. les règles Firestore autorisent chacun à écrire SON PROPRE document
//     `users/{uid}` en entier (`allow create, update: if isOwner(userId)`).
//     N'importe quel joueur pouvait donc s'écrire `role: "coach"` et obtenir
//     l'espace coach. Il n'y trouvait rien de lisible (les règles refusent tout
//     le reste), mais l'écran s'ouvrait — et un écran qui s'ouvre sur une
//     promesse vide est un mensonge de plus.
//
// ─── LE DÉFAUT CORRIGÉ ICI : « un compte, un espace » ───────────────────────
// La dérivation précédente répondait par UN espace. Elle ne pouvait donc pas
// dire « les deux », et c'est exactement ce qu'un ENTRAÎNEUR-JOUEUR est —
// le cas courant en club amateur. Conséquence documentée (et vécue) :
// devenir propriétaire faisait PERDRE l'accès à son propre entraînement.
//
// Le modèle de données porte désormais deux axes indépendants (cf.
// `domain/clubRoles`, `functions/src/clubAuthority`, `firestore.rules`) :
//
//   . `accessRole`   -> permissions d'encadrement -> ouvre l'espace COACH ;
//   . `playerStatus` -> statut de joueur          -> ouvre l'espace JOUEUR.
//
// Ce fichier ne fait que les LIRE. Il ne les combine jamais en un seul rôle : la
// fusion est précisément ce qu'on vient de défaire.
//
// ─── LE PRINCIPE, ET CE QU'IL INTERDIT ──────────────────────────────────────
// On ne SYNCHRONISE pas `users/{uid}.role` avec l'appartenance : deux champs
// tenus en accord, c'est deux sources de vérité, donc une divergence qui finit
// par arriver. On DÉRIVE l'espace de l'autorité qui existe déjà et que le
// serveur contrôle seul :
//
//     clubs/{clubId}/members/{uid}
//
// Ce document n'est écrivable par aucun client, sauf l'amorçage du créateur de
// club (firestore.rules, match /members/{memberId} : `accessRole` exactement
// "owner", et seulement par celui que `ownerUid` désigne déjà — `playerStatus`
// et `coachAccess` y sont interdits à tout client). Il est en revanche TOUJOURS
// lisible par son titulaire (`allow read: if isOwner(memberId)`) : c'est ce qui
// rend cette dérivation possible sans élargir le moindre droit.
//
// ─── CE QUI N'EST PAS UNE ENTRÉE DE CES FONCTIONS ───────────────────────────
// `users/{uid}.role` n'apparaît NULLE PART dans ce fichier, et c'est la preuve
// la plus simple qu'un champ client falsifié n'ouvre plus rien : il n'est pas
// un paramètre, donc il ne peut pas peser sur le résultat.

import { isActivePlayerStatus, isClubStaffRole, normalizeAccessRole, type ClubAccessRole } from "./clubRoles";

/** Les deux applications que FKS sait afficher. Une seule à la fois à l'écran. */
export type AppSpace = "coach" | "player";

/**
 * Ce que la navigation doit faire. `en-attente` n'est pas un espace : c'est
 * l'aveu qu'on ne sait PAS encore, et l'ordre d'afficher l'écran de chargement
 * plutôt que de parier. Parier ferait clignoter l'espace joueur devant un coach
 * à chaque démarrage — un bug visible, et une fuite d'attention.
 */
export type AppSpaceDecision = AppSpace | "en-attente";

/**
 * État de lecture de SA PROPRE appartenance au club. Quatre situations, toutes
 * nommées : les fondre appauvrirait la décision.
 *
 *  - `aucun-club`  : `users/{uid}.clubId` est absent — il n'y a aucune
 *                    appartenance à lire, donc rien à attendre ;
 *  - `en-attente`  : l'abonnement est posé, le premier instantané n'est pas
 *                    encore arrivé ;
 *  - `lu`          : instantané reçu. Les deux champs valent `undefined`/`null`
 *                    si le document n'existe pas (pas d'appartenance) ;
 *  - `illisible`   : la lecture a échoué.
 */
export type ClubMembershipReading =
  | { statut: "aucun-club" }
  | { statut: "en-attente" }
  | { statut: "lu"; accessRole: unknown; playerStatus: unknown }
  | { statut: "illisible" };

/**
 * LES ESPACES AUXQUELS LE SERVEUR DONNE DROIT. C'est la seule fonction qui
 * décide de ce qui est OUVERT ; tout le reste (préférence locale, sélecteur)
 * ne fait que choisir à l'intérieur de ce qu'elle renvoie.
 *
 * ─── POURQUOI L'ESPACE JOUEUR N'EST PAS TOUJOURS DISPONIBLE ────────────────
 * Un compte SANS encadrement a toujours son application d'entraînement : c'est
 * l'application FKS, elle ne demande aucun club. La question ne se pose donc
 * que pour un ENCADRANT : lui, on ne lui ouvre l'espace joueur que s'il a
 * réellement un suivi sportif dans ce club (`playerStatus: "active"`).
 *
 * Sans cette condition, TOUT coach verrait un sélecteur — dont une moitié
 * mènerait à une application d'entraînement qu'il n'utilise pas, avec un
 * questionnaire de profil joueur à remplir pour rien. L'exigence produit est
 * explicite : le sélecteur n'apparaît QUE si la personne a réellement les deux.
 *
 * ─── COMMENT UN ENCADRANT OBTIENT UN SUIVI ─────────────────────────────────
 * En rejoignant l'effectif comme n'importe qui : il saisit un code d'invitation
 * de son club (`joinClubWithInviteCode` pose `playerStatus: "active"` sans
 * toucher à ses permissions). C'est un geste explicite de sa part — devenir
 * encadrant n'a jamais valu consentement à être suivi, et ce lot ne change pas
 * ça. Ce qu'il change, c'est l'inverse : devenir encadrant ne RETIRE plus le
 * suivi de quelqu'un qui l'avait déjà.
 */
export function espacesDisponibles(lecture: ClubMembershipReading): {
  coach: boolean;
  joueur: boolean;
} {
  if (lecture.statut !== "lu") {
    // Ni fait établi, ni réponse : on n'ouvre rien de plus que l'application
    // d'entraînement, qui sait vivre sans club (default-deny côté coach).
    return { coach: false, joueur: true };
  }
  const coach = isClubStaffRole(lecture.accessRole);
  return { coach, joueur: !coach || isActivePlayerStatus(lecture.playerStatus) };
}

/**
 * LA dérivation. Un encadrant voit l'espace coach ; tout le reste voit l'espace
 * joueur ; et celui qui a droit aux deux voit celui qu'il a choisi.
 *
 * ─── LA PRÉFÉRENCE N'OUVRE RIEN, JAMAIS ────────────────────────────────────
 * `preference` ne fait que CHOISIR entre des espaces déjà autorisés par le
 * serveur. Elle est appliquée après `espacesDisponibles`, et uniquement quand
 * les deux sont ouverts. Conséquences, toutes voulues :
 *  . un compte qui perd l'encadrement bascule vers l'espace joueur MÊME si sa
 *    préférence locale dit "coach" ;
 *  . un encadrant sans suivi reste dans l'espace coach MÊME si sa préférence
 *    locale dit "player" ;
 *  . une préférence falsifiée dans le stockage local n'ouvre donc aucun écran
 *    que le serveur n'ait déjà accordé.
 *
 * `preference` vaut `"en-attente"` tant que le stockage local n'a pas répondu.
 * Ce n'est un temps d'attente QUE pour les comptes qui ont réellement les deux
 * espaces : pour tous les autres, la décision est prise sans elle.
 *
 * ─── POURQUOI `illisible` RETOMBE SUR L'ESPACE JOUEUR ──────────────────────
 * C'est le même default-deny que partout ailleurs dans ce périmètre : on
 * n'ouvre pas un espace sur une question sans réponse. Le coût est borné et
 * réversible — l'abonnement livre la vraie valeur dès qu'il y arrive, et
 * l'espace bascule tout seul. Ouvrir l'espace coach « au bénéfice du doute »
 * aurait le coût inverse : un écran d'encadrement dont TOUTES les lectures sont
 * refusées par les règles, sans jamais dire pourquoi.
 */
export function resolveAppSpace(
  lecture: ClubMembershipReading,
  preference: AppSpace | null | "en-attente" = null,
): AppSpaceDecision {
  if (lecture.statut === "en-attente") return "en-attente";

  const espaces = espacesDisponibles(lecture);
  if (!espaces.coach) return "player";
  if (!espaces.joueur) return "coach";

  // Les deux sont ouverts : c'est le seul cas où la préférence pèse.
  if (preference === "en-attente") return "en-attente";
  // DÉFAUT « coach » quand rien n'a encore été choisi. Un joueur qui vient
  // d'obtenir l'encadrement doit VOIR ce qu'il a gagné — le poser dans son
  // espace habituel lui cacherait le changement, et c'est exactement le défaut
  // d'origine (« le brassard change de bras, le maillot non »). Rien n'est
  // perdu au passage : le sélecteur le ramène à son entraînement en un geste,
  // et ce geste est mémorisé.
  return preference ?? "coach";
}

/**
 * La permission d'encadrement lue, ou `null`. Sert à DIRE l'état (écrans,
 * journal), jamais à ouvrir un droit — c'est `resolveAppSpace` qui décide de
 * l'espace, et le serveur qui décide des droits.
 */
export function readMembershipAccessRole(lecture: ClubMembershipReading): ClubAccessRole | null {
  return lecture.statut === "lu" ? normalizeAccessRole(lecture.accessRole) : null;
}

/**
 * LE SUIVI SPORTIF DE L'UTILISATEUR DANS SON CLUB, EN TROIS ÉTATS.
 *
 * ─── POURQUOI TROIS, ET PAS UN BOOLÉEN ─────────────────────────────────────
 * C'est ce que lit le bouton « Je m'entraîne aussi » (espace coach) pour savoir
 * lequel des deux gestes proposer : l'ACTIVER, ou l'ARRÊTER. Un booléen les
 * ramènerait à deux, donc forcerait à choisir un geste même quand on ne sait
 * pas encore — et le mauvais choix, ici, se paie cher dans les deux sens :
 *  . proposer « activer » à quelqu'un qui a déjà un suivi, c'est un bouton qui
 *    ne change rien (le serveur répond « déjà actif », mais l'écran a menti) ;
 *  . proposer « arrêter » à quelqu'un qui n'a rien, c'est promettre de retirer
 *    quelque chose qui n'existe pas.
 * Tant qu'on ne sait pas, on n'affiche NI l'un NI l'autre. `inconnu` couvre le
 * démarrage, la revalidation, l'absence de club et l'échec de lecture : quatre
 * situations où la seule réponse honnête est « je ne sais pas encore ».
 *
 * ─── CE QU'ELLE N'EST PAS ──────────────────────────────────────────────────
 * Elle n'ACCORDE rien. `actif` ne donne aucun droit, `inactif` n'en retire
 * aucun : le serveur revérifie tout à chaque appel, et un écran qui se
 * tromperait ne produirait qu'un bouton refusé, jamais une écriture.
 */
export type PlayerFollowState = "actif" | "inactif" | "inconnu";

export function readPlayerFollowState(lecture: ClubMembershipReading): PlayerFollowState {
  if (lecture.statut !== "lu") return "inconnu";
  return isActivePlayerStatus(lecture.playerStatus) ? "actif" : "inactif";
}
