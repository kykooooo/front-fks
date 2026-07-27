// functions/src/clubMembersApi.ts
//
// Porte callable du retrait d'un membre. Ce fichier ne contient AUCUNE decision
// metier : il fournit l'identite (uid du JETON, jamais un parametre client),
// branche l'Admin SDK sur le port `MemberStore` de clubMembers.ts, journalise
// sobrement, et traduit l'erreur interne en HttpsError.
//
// Meme decoupage que clubInvites.ts / inviteCodes.ts, et pour la meme raison :
// `firebase-functions` et `firebase-admin` ne sont installes nulle part dans ce
// depot, donc ce fichier n'est pas testable ici. Tout ce qui decide vit dans le
// coeur pur, qui l'est integralement.

import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { Firestore, Transaction } from "firebase-admin/firestore";

import { getDb } from "./admin";
import type { ClubAuthoritySignal } from "./clubAuthority";
import {
  ClubMemberError,
  removeClubMember as removeClubMemberCore,
  type MemberDocData,
  type MemberStore,
  type MemberTx,
} from "./clubMembers";
import { REGION } from "./config";

/** Branche le port sur Firestore Admin (qui contourne les regles, par design). */
export function createMemberStore(db: Firestore): MemberStore {
  return {
    runTransaction(fn) {
      return db.runTransaction(async (t: Transaction) => {
        const tx: MemberTx = {
          async get(path) {
            const snap = await t.get(db.doc(path));
            return snap.exists ? ((snap.data() ?? {}) as MemberDocData) : null;
          },
          set(path, data, opts) {
            t.set(db.doc(path), data, { merge: opts?.merge ?? false });
          },
          delete(path) {
            t.delete(db.doc(path));
          },
        };
        return fn(tx);
      });
    },
  };
}

/** Traduction 1:1 vers l'enveloppe callable. Aucun enrichissement de message. */
export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof ClubMemberError) {
    // `details` transporte le jeton machine (OWNER_TRANSFER_REQUIRED) jusqu'au
    // front, qui a besoin de le distinguer d'un refus generique pour afficher le
    // GESTE a faire. Les refus non typés n'emportent rien.
    return err.reason
      ? new HttpsError(err.code, err.message, { reason: err.reason })
      : new HttpsError(err.code, err.message);
  }
  logger.error("clubMembers: erreur inattendue", {
    message: err instanceof Error ? err.message : String(err),
  });
  return new HttpsError("internal", "Une erreur est survenue. Reessaie.");
}

/**
 * JOURNAL DE REPARATION. C'est le mecanisme de signalement exige par
 * l'invariant : un etat ou `ownerUid` designe quelqu'un qui n'a pas (ou plus)
 * l'appartenance proprietaire n'est jamais absorbe en silence.
 *
 * Choix du mecanisme, assume : un `logger.error` serveur, et RIEN d'autre cote
 * base. Ecrire un document d'alerte aurait cree une collection de plus a
 * proteger, a purger et a rendre lisible — pour une anomalie qui, aujourd'hui,
 * ne peut naitre que d'une intervention administrateur (aucun chemin client ne
 * peut la produire : les regles refusent d'ecrire un role proprietaire ailleurs
 * que sur le ownerUid du club, et refusent de supprimer l'appartenance du
 * proprietaire).
 *
 * Cote coach, l'incoherence n'est PAS une disparition muette : le document club
 * reste lisible par son ownerUid (cf. firestore.rules, `allow get`), donc
 * l'application peut constater "je suis designe proprietaire mais mon
 * appartenance ne le dit pas" et l'afficher. C'est exactement ce que fait
 * `useCoachClub` via `ownershipInconsistent`.
 *
 * Charge du journal : identifiants + nature de l'ecart. Ni nom de club, ni
 * donnee de membre.
 *
 * EXPORTE parce que le transfert de propriete (clubOwnershipApi.ts) signale les
 * MEMES incoherences : deux journaux de formes differentes pour un meme etat
 * rendraient l'exploitation illisible.
 */
export const logClubAuthorityInconsistency = (signal: ClubAuthoritySignal): void => {
  logger.error("clubAuthority: etat d'autorite incoherent, reparation requise", {
    clubId: signal.clubId,
    uid: signal.uid,
    authority: signal.authority,
    action: signal.action,
  });
};

export const removeClubMember = onCall(
  { region: REGION },
  async (request: CallableRequest<{ clubId?: unknown; memberUid?: unknown }>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

    try {
      const result = await removeClubMemberCore(
        {
          store: createMemberStore(getDb()),
          now: Date.now,
          onInconsistency: logClubAuthorityInconsistency,
        },
        {
          actorUid: uid,
          clubId: request.data?.clubId,
          memberUid: request.data?.memberUid,
        },
      );
      // Trace d'exploitation volontairement pauvre : qui a retire qui, et si le
      // geste etait un rejeu. Aucune donnee de suivi, aucun nom.
      logger.info("clubMembers: membre retire", {
        clubId: result.clubId,
        actorUid: uid,
        memberUid: result.memberUid,
        alreadyRemoved: result.alreadyRemoved,
        clearedUserClub: result.clearedUserClub,
      });
      return result;
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);
