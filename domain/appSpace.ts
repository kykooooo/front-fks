// domain/appSpace.ts
//
// QUEL ESPACE L'APPLICATION AFFICHE : coach, ou joueur.
//
// ─── LE DÉFAUT CORRIGÉ ICI ──────────────────────────────────────────────────
// Jusqu'à ce lot, la navigation lisait `users/{uid}.role === "coach"`
// (navigation/RootNavigator). Ce champ a DEUX problèmes, et le second est le
// plus grave :
//
//  1. le transfert de propriété ne le touche pas (et il a de bonnes raisons de
//     ne pas le toucher : voir functions/src/clubOwnership.ts, écriture 6). Un
//     joueur devenu propriétaire avait donc TOUS les droits côté serveur et
//     continuait de voir l'application joueur ;
//  2. les règles Firestore autorisent chacun à écrire SON PROPRE document
//     `users/{uid}` en entier (`allow create, update: if isOwner(userId)`).
//     N'importe quel joueur pouvait donc s'écrire `role: "coach"` et obtenir
//     l'espace coach. Il n'y trouvait rien de lisible (les règles refusent tout
//     le reste), mais l'écran s'ouvrait — et un écran qui s'ouvre sur une
//     promesse vide est un mensonge de plus.
//
// ─── LE PRINCIPE, ET CE QU'IL INTERDIT ──────────────────────────────────────
// On ne SYNCHRONISE pas `users/{uid}.role` avec l'appartenance : deux champs
// tenus en accord, c'est deux sources de vérité, donc une divergence qui finit
// par arriver. On DÉRIVE l'espace de l'autorité qui existe déjà et que le
// serveur contrôle seul :
//
//     clubs/{clubId}/members/{uid}.role
//
// Ce document n'est écrivable par aucun client, sauf l'amorçage du créateur de
// club (firestore.rules, match /members/{memberId} : rôle exactement "owner", et
// seulement par celui que `ownerUid` désigne déjà). Il est en revanche TOUJOURS
// lisible par son titulaire (`allow read: if isOwner(memberId)`) : c'est ce qui
// rend cette dérivation possible sans élargir le moindre droit.
//
// Le prédicat n'est pas recréé ici : `isClubStaffRole` (domain/clubRoles) est le
// miroir d'affichage de `CLUB_STAFF_ROLES` (functions/src/clubAuthority) et de
// `isClubStaff` (firestore.rules). Un encadrant — propriétaire OU coach — voit
// l'espace coach. Personne d'autre.
//
// ─── CE QUI N'EST PAS UNE ENTRÉE DE CETTE FONCTION ──────────────────────────
// `users/{uid}.role` n'apparaît NULLE PART dans ce fichier, et c'est la preuve
// la plus simple qu'un champ client falsifié n'ouvre plus rien : il n'est pas
// un paramètre, donc il ne peut pas peser sur le résultat.

import { isClubStaffRole, normalizeClubRole, type ClubRole } from "./clubRoles";

/** Les deux applications que FKS sait afficher. Jamais les deux à la fois. */
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
 *  - `lu`          : instantané reçu. `role` vaut `undefined`/`null` si le
 *                    document n'existe pas (pas d'appartenance) ;
 *  - `illisible`   : la lecture a échoué.
 */
export type ClubMembershipReading =
  | { statut: "aucun-club" }
  | { statut: "en-attente" }
  | { statut: "lu"; role: unknown }
  | { statut: "illisible" };

/**
 * LA dérivation. Un encadrant voit l'espace coach ; tout le reste voit l'espace
 * joueur.
 *
 * POURQUOI `illisible` retombe sur l'espace JOUEUR. C'est le même default-deny
 * que partout ailleurs dans ce périmètre : on n'ouvre pas un espace sur une
 * question sans réponse. Le coût est borné et réversible — l'abonnement livre
 * la vraie valeur dès qu'il y arrive, et l'espace bascule tout seul. Ouvrir
 * l'espace coach « au bénéfice du doute » aurait le coût inverse : un écran
 * d'encadrement dont TOUTES les lectures sont refusées par les règles, sans
 * jamais dire pourquoi.
 *
 * À noter : ce cas est théorique pour un vrai encadrant. Son propre document
 * d'appartenance lui est toujours lisible ; un échec ici est un incident réseau,
 * et le SDK Firestore sert alors son cache puis rejoue l'abonnement.
 */
export function resolveAppSpace(lecture: ClubMembershipReading): AppSpaceDecision {
  if (lecture.statut === "en-attente") return "en-attente";
  if (lecture.statut === "lu" && isClubStaffRole(lecture.role)) return "coach";
  return "player";
}

/**
 * Le rôle d'appartenance retenu, ou `null`. Sert à DIRE l'état (écrans, journal),
 * jamais à ouvrir un droit — c'est `resolveAppSpace` qui décide de l'espace, et
 * le serveur qui décide des droits.
 */
export function readMembershipRole(lecture: ClubMembershipReading): ClubRole | null {
  return lecture.statut === "lu" ? normalizeClubRole(lecture.role) : null;
}
