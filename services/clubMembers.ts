// services/clubMembers.ts
//
// Unique porte d'entrée FRONT des TROIS FORMES DE RETRAIT. Trois appels, vers
// trois Cloud Functions distinctes (région europe-west4) :
//
//   . `deactivateClubPlayer`  — arrêter le SUIVI DE JOUEUR (il ne joue plus,
//     mais il continue d'encadrer si c'était le cas) ;
//   . `revokeClubStaffAccess` — retirer les PERMISSIONS D'ENCADREMENT (il n'est
//     plus entraîneur, mais il reste joueur de l'effectif) ;
//   . `removeClubMember`      — le RETRAIT COMPLET : les deux, plus le
//     détachement du club.
//
// TROIS APPELS ET NON UN PARAMÈTRE D'ACTION. Le geste n'est jamais une valeur
// que ce fichier compose et envoie : c'est le NOM de la fonction appelée. Il n'y
// a donc rien qu'un attaquant puisse substituer dans la charge utile pour
// obtenir un autre geste que celui demandé — et côté serveur, rien à valider en
// allowlist. C'est la raison principale du découpage.
//
// RÈGLE ABSOLUE DE CE FICHIER, la même que services/clubInvites.ts : le front ne
// juge JAMAIS le geste. Il ne décide pas localement qu'un joueur « est
// probablement le propriétaire », il ne devine pas les droits de l'utilisateur,
// il n'anticipe aucun refus. Il transmet, et il affiche la réponse du serveur.
//
// Deuxième règle : aucun message brut de Firebase n'atteint l'écran. Les erreurs
// callables remontent en anglais ; on ne lit que le CODE (et, pour le seul refus
// parlant, le jeton porté par `details`) et on choisit ici une phrase française.
//
// LE SEUL REFUS PARLANT. `OWNER_TRANSFER_REQUIRED` est le seul cas où le message
// nomme la cause, parce qu'il indique le GESTE à faire. Tous les autres refus
// d'autorité partagent volontairement une phrase unique côté serveur : les
// distinguer apprendrait à un curieux ce qu'il n'a pas le droit de savoir.

// Import de TYPE uniquement (effacé à la compilation) : le module
// `firebase/functions` est chargé PARESSEUSEMENT, au premier appel réel — même
// raison qu'en invitation (ce paquet n'est distribué qu'en ESM et ferait tomber
// des suites Jest qui n'ont rien à voir).
import type { HttpsCallableResult } from "firebase/functions";

import { app } from "./firebase";

/** Région des Cloud Functions — alignée sur functions/src/config.ts (REGION). */
const FUNCTIONS_REGION = "europe-west4";

/** Noms des callables — alignés sur functions/src/index.ts. */
const REMOVE_CALLABLE = "removeClubMember";
const DEACTIVATE_CALLABLE = "deactivateClubPlayer";
const REVOKE_STAFF_CALLABLE = "revokeClubStaffAccess";

/**
 * Jetons machine des échecs typés, tels que le serveur les émet
 * (functions/src/clubMembers). Recopiés ici parce que le front ne peut pas
 * importer le code des Functions ; verrouillés par un test des deux côtés.
 */
export const OWNER_TRANSFER_REQUIRED = "OWNER_TRANSFER_REQUIRED";
export const STAFF_OWNER_ONLY = "STAFF_OWNER_ONLY";

export type RemoveMemberFailureReason =
  | "ownerTransferRequired" // il faut transférer la propriété d'abord
  | "staffOwnerOnly" // la cible encadre : seul le propriétaire y touche
  | "denied" // pas encadrant de ce club (ou état d'autorité à réparer)
  | "notMember" // ce membre n'est pas (ou plus) dans l'effectif
  | "unauthenticated"
  | "notFound" // callable absente / non déployée
  | "unavailable"; // réseau / fonction indisponible

export type RemoveMemberOutcome =
  | { ok: true; alreadyRemoved: boolean }
  | { ok: false; reason: RemoveMemberFailureReason; message: string };

/** Messages coach. Français, actionnables, jamais une phrase Firebase. */
const REMOVE_MESSAGES: Record<RemoveMemberFailureReason, string> = {
  ownerTransferRequired:
    "Ce compte est le propriétaire du club : il ne peut pas être retiré. Transférez d'abord la propriété à un autre encadrant.",
  staffOwnerOnly:
    "Ce compte fait partie de l'encadrement du club. Seul le propriétaire du club peut modifier ses accès.",
  denied:
    "Retrait impossible avec ce compte. Actualisez l'écran : si le club n'apparaît plus, c'est qu'il n'est plus accessible avec ce compte.",
  notMember:
    "Ce membre ne fait plus partie de l'effectif. Actualisez l'écran pour voir la liste à jour.",
  unauthenticated: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  notFound: "Le service de gestion de l'effectif ne répond pas. Réessayez dans un moment.",
  unavailable: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
};

/** Jeton machine porté par `details.reason`, ou `null`. */
function readErrorToken(err: unknown): string | null {
  const details = (err as { details?: unknown } | null)?.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const reason = (details as { reason?: unknown }).reason;
    return typeof reason === "string" ? reason : null;
  }
  return null;
}

/**
 * Traduit l'erreur callable en raison métier.
 *
 * Les échecs typés sont reconnus au JETON, pas au code d'erreur seul : le code
 * `failed-precondition` porte maintenant DEUX refus distincts, et il en portera
 * peut-être d'autres. Le jeton, lui, ne bouge pas.
 */
export function readRemoveFailureReason(err: unknown): RemoveMemberFailureReason {
  const token = readErrorToken(err);
  if (token === OWNER_TRANSFER_REQUIRED) return "ownerTransferRequired";
  if (token === STAFF_OWNER_ONLY) return "staffOwnerOnly";

  const raw = (err as { code?: unknown } | null)?.code;
  const code = typeof raw === "string" ? raw.replace(/^functions\//, "") : "";
  switch (code) {
    case "failed-precondition":
      // `failed-precondition` SANS le jeton : on ne prétend pas savoir de quelle
      // précondition il s'agit, on retombe sur le refus générique.
      return "denied";
    case "permission-denied":
      return "denied";
    case "not-found":
      // Couvre DEUX cas : le membre absent de l'effectif, et la callable pas
      // encore déployée. Le premier est de très loin le plus probable une fois
      // en production, et son message invite à actualiser — ce qui est le bon
      // geste dans les deux cas.
      return "notMember";
    case "unauthenticated":
      return "unauthenticated";
    case "invalid-argument":
      return "notFound";
    default:
      return "unavailable";
  }
}

/**
 * Chargement PARESSEUX du SDK Functions, par `require` synchrone (Metro le
 * résout comme un import normal). Volontairement pas un `import()` dynamique :
 * l'environnement de test ne sait pas l'exécuter.
 */
const loadFunctionsSdk = (): typeof import("firebase/functions") => require("firebase/functions");

async function invoke<TRes>(
  name: string,
  payload: Record<string, unknown>,
): Promise<HttpsCallableResult<TRes>> {
  const { getFunctions, httpsCallable } = loadFunctionsSdk();
  const call = httpsCallable<Record<string, unknown>, TRes>(
    getFunctions(app, FUNCTIONS_REGION),
    name,
  );
  return call(payload);
}

/**
 * Corps commun des trois gestes : appeler, traduire, ne JAMAIS lever — l'écran
 * doit pouvoir afficher un refus sans que la fiche joueur se démonte.
 *
 * Le drapeau de rejeu ne porte pas le même nom d'un geste à l'autre
 * (`alreadyRemoved` / `alreadyInactive` / `alreadyRevoked`) : chaque serveur dit
 * ce qui était déjà fait, dans SES mots. Le front les ramène à une seule
 * question — « est-ce que ce geste avait déjà été fait ? » — parce que c'est la
 * seule chose que l'écran a besoin de dire autrement.
 */
async function appelerGeste(
  callable: string,
  clubId: string,
  memberUid: string,
  champRejeu: string,
): Promise<RemoveMemberOutcome> {
  try {
    const res = await invoke<Record<string, unknown>>(callable, { clubId, memberUid });
    return { ok: true, alreadyRemoved: res.data?.[champRejeu] === true };
  } catch (err) {
    const reason = readRemoveFailureReason(err);
    return { ok: false, reason, message: REMOVE_MESSAGES[reason] };
  }
}

/**
 * RETRAIT COMPLET : les deux axes fermés, la fiche purgée, le club détaché.
 *
 * `alreadyRemoved` distingue un vrai retrait d'un rejeu (double appui, retour
 * en arrière) : l'écran le dit autrement, au lieu d'annoncer deux fois le même
 * succès comme s'il s'était passé deux choses.
 */
export async function removeClubMember(
  clubId: string,
  memberUid: string,
): Promise<RemoveMemberOutcome> {
  return appelerGeste(REMOVE_CALLABLE, clubId, memberUid, "alreadyRemoved");
}

/**
 * ARRÊTER LE SUIVI DE JOUEUR. La personne quitte l'effectif suivi ; si elle
 * encadre le club, elle continue de l'encadrer.
 */
export async function deactivateClubPlayer(
  clubId: string,
  memberUid: string,
): Promise<RemoveMemberOutcome> {
  return appelerGeste(DEACTIVATE_CALLABLE, clubId, memberUid, "alreadyInactive");
}

/**
 * RETIRER LES ACCÈS D'ENCADREMENT. La personne perd l'espace coach ; si elle est
 * joueuse de l'effectif, son suivi continue exactement comme avant.
 */
export async function revokeClubStaffAccess(
  clubId: string,
  memberUid: string,
): Promise<RemoveMemberOutcome> {
  return appelerGeste(REVOKE_STAFF_CALLABLE, clubId, memberUid, "alreadyRevoked");
}
