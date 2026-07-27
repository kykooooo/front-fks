// services/clubMembers.ts
//
// Unique porte d'entrée FRONT du retrait d'un membre du club. Un seul appel,
// vers la Cloud Function `removeClubMember` (region europe-west4).
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

/** Nom de la callable — aligné sur functions/src/index.ts. */
const REMOVE_CALLABLE = "removeClubMember";

/**
 * Jeton machine de l'échec typé, tel que le serveur l'émet
 * (functions/src/clubMembers.OWNER_TRANSFER_REQUIRED). Recopié ici parce que le
 * front ne peut pas importer le code des Functions ; verrouillé par un test des
 * deux côtés.
 */
export const OWNER_TRANSFER_REQUIRED = "OWNER_TRANSFER_REQUIRED";

export type RemoveMemberFailureReason =
  | "ownerTransferRequired" // le seul refus qui nomme sa cause
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
  denied:
    "Retrait impossible avec ce compte. Actualisez l'écran : si le club n'apparaît plus, c'est qu'il n'est plus accessible avec ce compte.",
  notMember:
    "Ce membre ne fait plus partie de l'effectif. Actualisez l'écran pour voir la liste à jour.",
  unauthenticated: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  notFound: "Le service de gestion de l'effectif ne répond pas. Réessayez dans un moment.",
  unavailable: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
};

/** Le serveur a-t-il renvoyé l'échec TYPÉ du propriétaire ? */
function isOwnerTransferRequired(err: unknown): boolean {
  const details = (err as { details?: unknown } | null)?.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return (details as { reason?: unknown }).reason === OWNER_TRANSFER_REQUIRED;
  }
  return false;
}

/**
 * Traduit l'erreur callable en raison métier.
 *
 * L'échec typé est reconnu au JETON, pas au code d'erreur seul : le code
 * `failed-precondition` pourrait un jour servir à autre chose, le jeton non.
 */
export function readRemoveFailureReason(err: unknown): RemoveMemberFailureReason {
  if (isOwnerTransferRequired(err)) return "ownerTransferRequired";

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
 * Retire un membre de l'effectif du club. Ne LÈVE JAMAIS : l'écran doit pouvoir
 * afficher un refus sans que la fiche joueur se démonte.
 *
 * `alreadyRemoved` distingue un vrai retrait d'un rejeu (double appui, retour
 * en arrière) : l'écran le dit autrement, au lieu d'annoncer deux fois le même
 * succès comme s'il s'était passé deux choses.
 */
export async function removeClubMember(
  clubId: string,
  memberUid: string,
): Promise<RemoveMemberOutcome> {
  try {
    const res = await invoke<{ alreadyRemoved?: unknown }>(REMOVE_CALLABLE, {
      clubId,
      memberUid,
    });
    return { ok: true, alreadyRemoved: res.data?.alreadyRemoved === true };
  } catch (err) {
    const reason = readRemoveFailureReason(err);
    return { ok: false, reason, message: REMOVE_MESSAGES[reason] };
  }
}
