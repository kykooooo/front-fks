// functions/src/clubOwnershipApi.ts
//
// Porte callable du TRANSFERT DE PROPRIETE. Ce fichier ne contient AUCUNE
// decision metier : il fournit l'identite (uid du JETON, jamais un parametre
// client), branche l'Admin SDK sur le port `MemberStore`, journalise sobrement,
// et traduit l'erreur interne en HttpsError.
//
// TOUT est reutilise du retrait : le magasin (`createMemberStore`), la
// traduction (`toHttpsError`) et le journal de reparation
// (`logClubAuthorityInconsistency`). Rien n'est recopie — une seconde copie de
// l'une de ces trois choses serait un second endroit ou se tromper.
//
// LE MODE ADMINISTRATEUR N'EST PAS ICI, ET C'EST VOULU. `adminTransferClubOwnership`
// saute la verification d'autorite de l'appelant : il ne doit exister aucune
// route reseau vers lui. Il vit dans clubOwnershipCli.ts, qui n'est exporte
// nulle part dans index.ts.
//
// Meme limite de test que clubMembersApi.ts : `firebase-functions` et
// `firebase-admin` ne sont installes nulle part dans ce depot, donc ce fichier
// n'est pas testable ici. Tout ce qui decide vit dans le coeur pur, qui l'est
// integralement.

import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { getDb } from "./admin";
import {
  createMemberStore,
  logClubAuthorityInconsistency,
  toHttpsError,
} from "./clubMembersApi";
import { transferClubOwnership as transferClubOwnershipCore } from "./clubOwnership";
import { REGION } from "./config";

export const transferClubOwnership = onCall(
  { region: REGION },
  async (request: CallableRequest<{ clubId?: unknown; newOwnerUid?: unknown }>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");

    try {
      const result = await transferClubOwnershipCore(
        {
          store: createMemberStore(getDb()),
          now: Date.now,
          onInconsistency: logClubAuthorityInconsistency,
        },
        {
          actorUid: uid,
          clubId: request.data?.clubId,
          newOwnerUid: request.data?.newOwnerUid,
        },
      );
      // Trace d'exploitation volontairement pauvre : quel club, qui passe la main
      // a qui, et si le geste etait un rejeu. Aucun nom de club, aucune donnee de
      // suivi, aucun secret.
      logger.info("clubOwnership: propriete transferee", {
        clubId: result.clubId,
        previousOwnerUid: result.previousOwnerUid,
        newOwnerUid: result.newOwnerUid,
        previousOwnerRole: result.previousOwnerRole,
        alreadyTransferred: result.alreadyTransferred,
        mode: result.mode,
      });
      return result;
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);
