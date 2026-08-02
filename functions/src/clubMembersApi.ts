// functions/src/clubMembersApi.ts
//
// Porte callable du retrait d'un membre. Ce fichier ne contient AUCUNE decision
// metier : il fournit l'identite (uid du JETON, jamais un parametre client),
// branche l'Admin SDK sur le port `MemberStore` de clubMembers.ts, journalise
// sobrement, et traduit l'erreur interne en HttpsError.
//
// Meme decoupage que clubInvites.ts / inviteCodes.ts : tout ce qui decide vit
// dans le coeur pur. L'enveloppe elle-meme (lecture de `request.auth`,
// traduction des erreurs) EST desormais testee — voir
// functions/tests/callableEnvelope.test.ts.

import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { Firestore, Transaction } from "firebase-admin/firestore";

import { getDb } from "./admin";
import { readCallerUid } from "./callableIdentity";
import type { ClubAuthoritySignal } from "./clubAuthority";
import {
  ClubMemberError,
  deactivateClubPlayer as deactivateClubPlayerCore,
  enrollSelfAsClubPlayer as enrollSelfAsClubPlayerCore,
  removeClubMember as removeClubMemberCore,
  revokeClubStaffAccess as revokeClubStaffAccessCore,
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

/**
 * LE TRAITEMENT, extrait du wrapper `onCall` pour etre interrogeable par les
 * tests d'enveloppe (functions/tests/callableEnvelope.test.ts). Rien d'autre n'a
 * bouge : `onCall` recoit CETTE fonction, et la callable deployee expose le meme
 * traitement via `.run` — les tests exercent les DEUX chemins, sur la meme
 * matrice, pour qu'aucun ne puisse deriver de l'autre.
 *
 * L'identite reste lue ICI, depuis `request.auth`. Aucun parametre d'identite
 * n'a ete ajoute : la fonction prend une requete, et une seule (verrouille par
 * un test sur son arite).
 */
export const removeClubMemberHandler = async (
  request: CallableRequest<{ clubId?: unknown; memberUid?: unknown }>,
) => {
  const uid = readCallerUid(request);
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
};

export const removeClubMember = onCall({ region: REGION }, removeClubMemberHandler);

/**
 * ARRET DU SUIVI DE JOUEUR. Callable SEPAREE, et c'est le point de conception de
 * ce lot : le geste n'est pas un parametre de `removeClubMember`, c'est un autre
 * point d'entree. Consequences directes :
 *  . aucune valeur d'action ne vient du client, donc rien a valider en allowlist
 *    et rien a usurper — le routage est fait par le runtime callable ;
 *  . la transaction executee est REELLEMENT distincte (clubMembers.ts), pas une
 *    transaction commune modulee par un drapeau.
 *
 * `removeClubMember` garde exactement sa signature et sa semantique : aucun
 * changement de contrat pour les applications deja deployees.
 */
export const deactivateClubPlayerHandler = async (
  request: CallableRequest<{ clubId?: unknown; memberUid?: unknown }>,
) => {
  const uid = readCallerUid(request);
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

  try {
    const result = await deactivateClubPlayerCore(
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
    logger.info("clubMembers: suivi joueur arrete", {
      clubId: result.clubId,
      actorUid: uid,
      memberUid: result.memberUid,
      alreadyInactive: result.alreadyInactive,
      keepsStaffAccess: result.keepsStaffAccess,
    });
    return result;
  } catch (err) {
    throw toHttpsError(err);
  }
};

export const deactivateClubPlayer = onCall({ region: REGION }, deactivateClubPlayerHandler);

/**
 * REVOCATION DES PERMISSIONS D'ENCADREMENT. Troisieme point d'entree, meme
 * motif. La trace journalisee dit ce que le geste CONSERVE (`keepsPlayerStatus`)
 * autant que ce qu'il ferme : c'est la seule facon de relire un journal et de
 * savoir lequel des trois gestes a eu lieu.
 */
export const revokeClubStaffAccessHandler = async (
  request: CallableRequest<{ clubId?: unknown; memberUid?: unknown }>,
) => {
  const uid = readCallerUid(request);
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

  try {
    const result = await revokeClubStaffAccessCore(
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
    logger.info("clubMembers: acces d'encadrement retires", {
      clubId: result.clubId,
      actorUid: uid,
      memberUid: result.memberUid,
      alreadyRevoked: result.alreadyRevoked,
      keepsPlayerStatus: result.keepsPlayerStatus,
    });
    return result;
  } catch (err) {
    throw toHttpsError(err);
  }
};

export const revokeClubStaffAccess = onCall({ region: REGION }, revokeClubStaffAccessHandler);

/**
 * ACTIVATION VOLONTAIRE DE SON PROPRE SUIVI DE JOUEUR (« Je m'entraine aussi »).
 *
 * LA CHARGE UTILE NE PORTE QU'UN `clubId`, et c'est structurel : le coeur
 * (`enrollSelfAsClubPlayer`) n'a pas de parametre `memberUid`. Meme si un client
 * postait `memberUid`, `uid`, `actorUid` ou n'importe quel autre champ, il n'y
 * aurait AUCUN endroit ou le lire — la cible est posee par le coeur, a partir de
 * l'identite du jeton. C'est la difference entre « on ignore ce champ » et « ce
 * champ n'existe nulle part » : la seconde ne peut pas etre annulee par un oubli
 * de relecture.
 *
 * Sur le `clubId`, en revanche : il vient bien de la charge utile, comme pour
 * les trois retraits, et ce n'est pas une faiblesse. Il ne dit pas QUI on est,
 * il dit OU regarder. Le pointer vers un autre club fait lire
 * `clubs/{autre}/members/{appelant}` — qui n'existe pas — donc un refus. On ne
 * peut que se refuser un acces a soi-meme, jamais en obtenir un.
 */
export const enrollSelfAsClubPlayerHandler = async (
  request: CallableRequest<{ clubId?: unknown }>,
) => {
  const uid = readCallerUid(request);
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

  try {
    const result = await enrollSelfAsClubPlayerCore(
      {
        store: createMemberStore(getDb()),
        now: Date.now,
        onInconsistency: logClubAuthorityInconsistency,
      },
      { actorUid: uid, clubId: request.data?.clubId },
    );
    logger.info("clubMembers: suivi joueur active", {
      clubId: result.clubId,
      actorUid: uid,
      alreadyActive: result.alreadyActive,
      // L'ETAT d'autorisation, pas la donnee : de quoi relire un journal et
      // comprendre pourquoi une fiche est (ou n'est pas) apparue.
      coachAccess: result.coachAccess,
      keepsStaffAccess: result.keepsStaffAccess,
    });
    return result;
  } catch (err) {
    throw toHttpsError(err);
  }
};

export const enrollSelfAsClubPlayer = onCall({ region: REGION }, enrollSelfAsClubPlayerHandler);
