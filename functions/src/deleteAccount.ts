// functions/src/deleteAccount.ts
//
// Callable de suppression de compte (exigence Apple/Google). Un utilisateur
// authentifié ne peut supprimer QUE son propre compte (uid du token, jamais un
// paramètre client). Ordre STRICT :
//   1. purge Firestore côté club (membership + projection coach-safe) ;
//   2. purge users/{uid} + TOUTES ses sous-collections (recursiveDelete) ;
//   3. suppression du compte Firebase Auth EN DERNIER — si la purge échoue,
//      le compte reste utilisable et l'utilisateur peut simplement réessayer.
//
// Idempotente et défensive : documents absents = no-op, compte Auth déjà
// supprimé = succès. Log minimal (uid + compteurs), aucune donnée perso.
//
// Ce que la purge N'EFFACE PAS (voulu) : les docs clubs/{clubId} dont
// l'utilisateur serait ownerUid (un club contient les données d'AUTRES
// membres ; le retrait d'un club est une opération distincte, hors scope).

import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAdminAuth, getDb } from "./admin";
import { paths, REGION } from "./config";
import { buildClubPurgePaths } from "./accountPurge";

export const deleteAccount = onCall(
  { region: REGION },
  async (request: CallableRequest): Promise<{ ok: true }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Connexion requise pour supprimer un compte.");
    }

    const db = getDb();
    let clubDocsDeleted = 0;

    try {
      // ── 1. Découverte des clubs de l'utilisateur ──────────────────────────
      // Source principale : users/{uid}.clubId (posé par attachUserToClub /
      // createClubAsCoach côté front). Complément défensif : collection group
      // sur `members` (le doc membership porte un champ `uid`, cf.
      // setClubMembership) pour attraper un membership résiduel dans un club
      // qui ne serait plus référencé par le profil.
      const clubIdCandidates: unknown[] = [];

      const userSnap = await db.doc(paths.user(uid)).get();
      if (userSnap.exists) {
        clubIdCandidates.push((userSnap.data() as Record<string, unknown>).clubId);
      }

      try {
        const memberships = await db.collectionGroup("members").where("uid", "==", uid).get();
        for (const memberDoc of memberships.docs) {
          clubIdCandidates.push(memberDoc.ref.parent.parent?.id);
        }
      } catch {
        // Index collection-group absent (single-field `members.uid` en scope
        // collection group non activé) → on retombe sur le clubId du profil,
        // suffisant pour tous les chemins d'écriture actuels.
        logger.warn("deleteAccount: requête collectionGroup members indisponible, fallback clubId profil", { uid });
      }

      // ── 2. Purge club : membership + projection coach-safe ────────────────
      // Idempotent : delete sur doc absent = no-op. Le trigger onMemberWritten
      // reconstruit/supprime aussi la projection, mais on la supprime
      // explicitement pour ne pas dépendre d'un trigger asynchrone.
      const clubPaths = buildClubPurgePaths(uid, clubIdCandidates);
      if (clubPaths.length > 0) {
        const batch = db.batch();
        for (const path of clubPaths) batch.delete(db.doc(path));
        await batch.commit();
        clubDocsDeleted = clubPaths.length;
      }

      // ── 3. Purge users/{uid} + toutes ses sous-collections ────────────────
      // recursiveDelete couvre `sessions`, `plannedSessions` ET toute
      // sous-collection future sans mise à jour de cette fonction.
      await db.recursiveDelete(db.doc(paths.user(uid)));
    } catch (err) {
      logger.error("deleteAccount: purge Firestore échouée (compte Auth conservé, retry possible)", {
        uid,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError("internal", "La suppression des données a échoué. Réessaie.");
    }

    // ── 4. Compte Firebase Auth EN DERNIER ──────────────────────────────────
    try {
      await getAdminAuth().deleteUser(uid);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      // Déjà supprimé (rejeu) → succès idempotent.
      if (code !== "auth/user-not-found") {
        logger.error("deleteAccount: suppression du compte Auth échouée", { uid, code });
        throw new HttpsError("internal", "La suppression du compte a échoué. Réessaie.");
      }
    }

    logger.info("deleteAccount: terminé", { uid, clubDocsDeleted });
    return { ok: true };
  },
);
