// services/clubInvites.ts
//
// Unique porte d'entrée FRONT du contrat d'invitation club. Deux appels, tous
// deux vers des Cloud Functions (region europe-west4) :
//   - issueClubInviteCode : le coach émet un code, affiché UNE seule fois ;
//   - joinClubWithInviteCode : le joueur se rattache à un club.
//
// RÈGLE ABSOLUE DE CE FICHIER : le front ne juge JAMAIS un code. Il n'a plus
// aucun moyen de savoir si un code existe (les règles Firestore ferment la
// collection), et il ne doit pas faire semblant : pas de contrôle de longueur,
// pas de format attendu, pas de « code invalide » décidé localement. Il
// transmet la saisie et affiche la réponse du serveur.
//
// Deuxième règle : aucun message brut de Firebase n'atteint l'écran. Les
// erreurs remontent en anglais ("Missing or insufficient permissions") ; on ne
// lit que le CODE d'erreur et on choisit ici une phrase française.

// Import de TYPE uniquement (effacé à la compilation) : le module
// `firebase/functions` est chargé PARESSEUSEMENT, au premier appel réel. Sans
// ça, tout écran qui importe ce service tire le SDK Functions dans son graphe
// de modules — y compris sous Jest, où ce paquet n'est distribué qu'en ESM et
// fait tomber des suites qui n'ont rien à voir avec les invitations.
import type { HttpsCallableResult } from "firebase/functions";

import { app } from "./firebase";

/** Région des Cloud Functions — alignée sur functions/src/config.ts (REGION). */
const FUNCTIONS_REGION = "europe-west4";

/** Noms des callables — alignés sur functions/src/index.ts. */
const ISSUE_CALLABLE = "issueClubInviteCode";
const JOIN_CALLABLE = "joinClubWithInviteCode";

/**
 * Nettoyage de TRANSPORT (pas de validation) : majuscules, séparateurs retirés.
 * Le serveur renormalise de toute façon — cette fonction ne sert qu'à éviter
 * d'envoyer des espaces collés par un copier-coller, et à afficher la saisie
 * proprement. Elle ne décide jamais qu'un code est bon ou mauvais.
 */
export const normalizeInviteCodeInput = (raw: string): string =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export type InviteFailureReason =
  | "rejected" // le serveur refuse le code, sans dire pourquoi (par conception)
  | "rateLimited" // trop de tentatives
  | "unauthenticated" // session perdue
  | "forbidden" // émission refusée, sans dire pourquoi (par conception)
  | "notFound" // callable absente / non déployée
  | "unavailable"; // réseau / fonction indisponible

export type JoinClubOutcome =
  | { ok: true; clubId: string; clubName: string | null; alreadyMember: boolean }
  | { ok: false; reason: InviteFailureReason; message: string };

export type IssueCodeOutcome =
  | { ok: true; code: string; expiresAt: number; maxUses: number; replacedPrevious: boolean }
  | { ok: false; reason: InviteFailureReason; message: string };

/** Messages joueur. Français, actionnables, jamais une phrase Firebase. */
const JOIN_MESSAGES: Record<InviteFailureReason, string> = {
  rejected:
    "Ce code n'est pas valide. Demande à ton coach de t'en envoyer un nouveau : un code peut expirer ou être remplacé.",
  rateLimited: "Trop de tentatives. Réessaie plus tard, ou demande un nouveau code à ton coach.",
  unauthenticated: "Ta session a expiré. Reconnecte-toi puis réessaie.",
  forbidden: "Tu n'as pas les droits pour cette action.",
  notFound: "Ce club est introuvable.",
  unavailable: "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
};

/**
 * Messages coach (émission).
 *
 * `forbidden` COUVRE PLUSIEURS CAS, ET C'EST VOULU. Le serveur répond
 * désormais la même chose qu'on ne soit pas coach du club, que le club ait
 * disparu, ou que l'identifiant envoyé soit malformé — sans quoi n'importe quel
 * compte pourrait demander au serveur « ce club existe-t-il ? » et se faire
 * répondre.
 *
 * Conséquence assumée sur cet écran : un coach dont le club aurait disparu lit
 * un message de droits et non « club introuvable ». La phrase ci-dessous est
 * donc écrite pour ne mentir dans AUCUN des cas — elle n'affirme pas la cause,
 * elle donne le seul geste utile (actualiser, et regarder si le club est
 * toujours là) au lieu d'envoyer le coach chercher au mauvais endroit.
 */
const ISSUE_MESSAGES: Record<InviteFailureReason, string> = {
  rejected: "Le code n'a pas pu être généré. Réessaie.",
  rateLimited: "Trop de demandes d'affilée. Réessaie dans un moment.",
  unauthenticated: "Ta session a expiré. Reconnecte-toi puis réessaie.",
  forbidden:
    "Impossible de générer un code pour ce club. Actualise l'écran : si le club n'apparaît plus, c'est qu'il n'est plus accessible avec ce compte.",
  notFound: "Le service d'invitation ne répond pas. Réessaie dans un moment.",
  unavailable: "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
};

/**
 * Traduit le code d'erreur callable en raison métier.
 * `functions/not-found` couvre DEUX cas : le club introuvable, et la fonction
 * pas encore déployée. Les deux se soldent par « réessaie », donc ne pas les
 * distinguer n'induit personne en erreur.
 */
export function readFailureReason(err: unknown): InviteFailureReason {
  const raw = (err as { code?: unknown } | null)?.code;
  const code = typeof raw === "string" ? raw.replace(/^functions\//, "") : "";
  switch (code) {
    case "permission-denied":
      return "rejected";
    case "resource-exhausted":
      return "rateLimited";
    case "unauthenticated":
      return "unauthenticated";
    case "not-found":
      return "notFound";
    case "invalid-argument":
      return "notFound";
    default:
      return "unavailable";
  }
}

/**
 * Chargement PARESSEUX du SDK Functions, par `require` synchrone (Metro le
 * résout comme un import normal). Volontairement pas un `import()` dynamique :
 * l'environnement de test ne sait pas l'exécuter, et un chargement qui échoue
 * seulement sous test transformerait des vérifications en illusions.
 */
const loadFunctionsSdk = (): typeof import("firebase/functions") =>
  require("firebase/functions");

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
 * Rattache l'utilisateur connecté à un club. Ne LÈVE JAMAIS : les appelants
 * (inscription, réglages) doivent pouvoir continuer leur parcours quoi qu'il
 * arrive — un code refusé n'est pas une panne de l'application.
 */
export async function joinClubWithInviteCode(rawCode: string): Promise<JoinClubOutcome> {
  const code = normalizeInviteCodeInput(rawCode);
  try {
    const res = await invoke<{
      clubId?: unknown;
      clubName?: unknown;
      alreadyMember?: unknown;
    }>(JOIN_CALLABLE, { code });

    const clubId = typeof res.data?.clubId === "string" ? res.data.clubId : "";
    if (!clubId) {
      // Réponse inattendue : on la traite comme une indisponibilité plutôt que
      // d'annoncer un rattachement qu'on n'a pas pu constater.
      return { ok: false, reason: "unavailable", message: JOIN_MESSAGES.unavailable };
    }
    return {
      ok: true,
      clubId,
      clubName: typeof res.data?.clubName === "string" ? res.data.clubName : null,
      alreadyMember: res.data?.alreadyMember === true,
    };
  } catch (err) {
    const reason = readFailureReason(err);
    // `forbidden` n'existe pas côté joueur : un refus d'accès au code EST le
    // refus générique, on ne le distingue pas.
    const normalized: InviteFailureReason = reason === "forbidden" ? "rejected" : reason;
    return { ok: false, reason: normalized, message: JOIN_MESSAGES[normalized] };
  }
}

/**
 * Émet un nouveau code pour le club du coach. Le code renvoyé n'est JAMAIS
 * relisible : il n'existe qu'en mémoire dans l'écran qui reçoit cette réponse.
 * Émettre révoque le code précédent — c'est le comportement voulu, et l'écran
 * doit le dire au coach avant comme après.
 */
export async function issueClubInviteCode(clubId: string): Promise<IssueCodeOutcome> {
  try {
    const res = await invoke<{
      code?: unknown;
      expiresAt?: unknown;
      maxUses?: unknown;
      replacedPrevious?: unknown;
    }>(ISSUE_CALLABLE, { clubId });

    const code = typeof res.data?.code === "string" ? res.data.code : "";
    if (!code) return { ok: false, reason: "unavailable", message: ISSUE_MESSAGES.unavailable };

    return {
      ok: true,
      code,
      expiresAt: typeof res.data?.expiresAt === "number" ? res.data.expiresAt : 0,
      maxUses: typeof res.data?.maxUses === "number" ? res.data.maxUses : 0,
      replacedPrevious: res.data?.replacedPrevious === true,
    };
  } catch (err) {
    let reason = readFailureReason(err);
    // Côté coach, `permission-denied` est le refus UNIQUE de l'émission : droits
    // manquants, club disparu et identifiant malformé arrivent tous ici, sans
    // qu'on puisse les distinguer — c'est précisément ce qui ferme l'oracle
    // d'existence de club. La phrase affichée en tient compte (ISSUE_MESSAGES).
    if (reason === "rejected") reason = "forbidden";
    return { ok: false, reason, message: ISSUE_MESSAGES[reason] };
  }
}
