// functions/src/clubInvites.ts
//
// Les DEUX seules portes du contrat d'invitation club :
//   - issueClubInviteCode : le coach (ou l'owner) emet un code, affiche UNE FOIS ;
//   - joinClubWithInviteCode : le joueur se rattache, ecriture faite par le
//     serveur avec l'Admin SDK (les regles Firestore ferment desormais toute
//     creation cliente d'un membership "player").
//
// Ce fichier ne contient AUCUNE decision metier : il branche l'Admin SDK sur le
// port `InviteStore` de inviteCodes.ts, traduit les erreurs internes en
// HttpsError, et journalise sobrement les franchissements de seuil.

import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { Firestore, Transaction } from "firebase-admin/firestore";

import { getDb } from "./admin";
import type { ClubAuthoritySignal } from "./clubAuthority";
import { REGION } from "./config";
import {
  InviteError,
  issueInviteCode,
  joinClubWithCode,
  type AbuseSignal,
  type DocData,
  type InviteStore,
  type InviteTx,
} from "./inviteCodes";

/** Branche le port sur Firestore Admin (qui contourne les regles, par design). */
export function createInviteStore(db: Firestore): InviteStore {
  return {
    async get(path) {
      const snap = await db.doc(path).get();
      return snap.exists ? ((snap.data() ?? {}) as DocData) : null;
    },
    async set(path, data, opts) {
      await db.doc(path).set(data, { merge: opts?.merge ?? false });
    },
    runTransaction(fn) {
      return db.runTransaction(async (t: Transaction) => {
        const tx: InviteTx = {
          async get(path) {
            const snap = await t.get(db.doc(path));
            return snap.exists ? ((snap.data() ?? {}) as DocData) : null;
          },
          set(path, data, opts) {
            t.set(db.doc(path), data, { merge: opts?.merge ?? false });
          },
        };
        return fn(tx);
      });
    },
  };
}

/**
 * Origine reseau de l'appel. `rawRequest.ip` est renseigne par le runtime
 * callable v2 ; on retombe sur le PREMIER maillon de x-forwarded-for (le client
 * reel derriere les proxys Google) quand il manque. Absente, la limitation par
 * origine est simplement inactive — celle par utilisateur, elle, s'applique
 * toujours.
 */
export function readOriginKey(rawRequest: unknown): string | null {
  const req = rawRequest as
    | { ip?: unknown; headers?: Record<string, unknown> }
    | undefined
    | null;
  if (!req) return null;

  const forwarded = req.headers?.["x-forwarded-for"];
  const forwardedFirst =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : Array.isArray(forwarded) && typeof forwarded[0] === "string"
        ? String(forwarded[0]).split(",")[0]?.trim()
        : "";
  if (forwardedFirst) return forwardedFirst;

  return typeof req.ip === "string" && req.ip.trim() ? req.ip.trim() : null;
}

/** Traduction 1:1 vers l'enveloppe callable. Aucun enrichissement de message. */
export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof InviteError) return new HttpsError(err.code, err.message);
  logger.error("clubInvites: erreur inattendue", {
    message: err instanceof Error ? err.message : String(err),
  });
  return new HttpsError("internal", "Une erreur est survenue. Reessaie.");
}

/**
 * Journal d'abus. SOBRE et DELIBERE : geste + portee + uid + instant. Ni le
 * code tente, ni son empreinte, ni le club vise — un journal enumerable serait
 * une regression, ecrite de notre propre main.
 *
 * Le geste (`action`) n'est PAS porte par le signal : il est connu ici, puisque
 * chaque callable choisit son propre callback. Cote coeur, la charge du signal
 * reste donc minimale par construction.
 */
const logAbuse = (action: "issue" | "join") => (signal: AbuseSignal) => {
  logger.warn("clubInvites: seuil de tentatives franchi", {
    action,
    scope: signal.scope,
    uid: signal.uid,
    at: new Date(signal.at).toISOString(),
  });
};

/**
 * Journal de REPARATION de l'autorite du club. Meme mecanisme et meme sobriete
 * que dans clubMembersApi.ts : identifiants + nature de l'ecart, rien de plus.
 * Un etat incoherent (ownerUid designant quelqu'un sans appartenance
 * proprietaire, ou l'inverse) refuse l'emission ET laisse une trace serveur —
 * il n'est jamais absorbe en silence.
 */
const logInconsistency = (signal: ClubAuthoritySignal): void => {
  logger.error("clubAuthority: etat d'autorite incoherent, reparation requise", {
    clubId: signal.clubId,
    uid: signal.uid,
    authority: signal.authority,
    action: signal.action,
  });
};

export const issueClubInviteCode = onCall(
  { region: REGION },
  async (request: CallableRequest<{ clubId?: unknown }>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

    try {
      const result = await issueInviteCode(
        {
          store: createInviteStore(getDb()),
          now: Date.now,
          onAbuse: logAbuse("issue"),
          onInconsistency: logInconsistency,
        },
        {
          uid,
          clubId: request.data?.clubId,
          originKey: readOriginKey(request.rawRequest),
        },
      );
      // Trace d'exploitation volontairement pauvre : qui a emis, et si un code
      // precedent a saute. PAS le club, PAS le code, PAS son empreinte.
      logger.info("clubInvites: code emis", {
        uid,
        replacedPrevious: result.replacedPrevious,
      });
      return result;
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);

export const joinClubWithInviteCode = onCall(
  { region: REGION },
  async (request: CallableRequest<{ code?: unknown }>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

    try {
      return await joinClubWithCode(
        { store: createInviteStore(getDb()), now: Date.now, onAbuse: logAbuse("join") },
        {
          uid,
          originKey: readOriginKey(request.rawRequest),
          rawCode: request.data?.code,
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);
