// functions/src/coachAccessSync.ts
//
// REPARATION SERVEUR de `clubs/{clubId}/members/{playerUid}.coachAccess` quand
// le champ manque ou porte une valeur illisible.
//
// ⚠️ CE N'EST PLUS UN RECALCUL. Avant, ce module realignait l'etat sur la
// categorie d'age du profil ; l'age ne joue plus aucun role (cf. coachAccess.ts).
// Ce qui reste est strictement : "si aucun etat valide n'est pose, pose celui de
// la politique du club". Un etat deja pose n'est JAMAIS reevalue — c'est ce qui
// garantit qu'un changement de politique ne redistribue pas les acces des
// membres existants dans le dos de tout le monde.
//
// Ce fichier ne contient AUCUNE decision : elle vit dans `resolveCoachAccess`
// (coachAccess.ts) et `resolveCoachAccessPolicy` (coachAccessPolicy.ts), deux
// modules purs. Ici on lit, on compare, et on n'ecrit QUE si la valeur change.
//
// POURQUOI "n'ecrire que si ca change" n'est pas une micro-optimisation : une
// ecriture sur members/ redeclenche `onMemberWritten`, donc une reconstruction
// de projection. Ecrire systematiquement transformerait chaque sauvegarde de
// profil en deux tours de moulin. Ici, le second tour ne se produit jamais.
//
// COUT DE LECTURE : la politique du club n'est lue QUE dans le cas ou elle sert,
// c'est-a-dire quand il n'y a pas d'etat valide sur le membership. Le cas
// courant (etat deja pose) ne coute donc aucune lecture supplementaire. Ce
// court-circuit est legitime parce que `resolveCoachAccess` conserve, par
// contrat, tout etat valide quelle que soit la politique — un test le prouve
// dans les deux modes.
//
// Le port `MemberAccessStore` existe pour la meme raison que `InviteStore` dans
// inviteCodes.ts : rendre la logique testable sans emulateur. Ce fichier
// n'importe donc NI firebase-admin NI firebase-functions — le branchement
// Firestore vit dans triggers.ts.

import { normalizeCoachAccess, resolveCoachAccess, type CoachAccessState } from "./coachAccess";

export type MemberSnapshot = {
  role: unknown;
  coachAccess: unknown;
};

export type MemberAccessStore = {
  /** members/{playerUid} — null si le joueur n'est pas (ou plus) rattache. */
  readMember(clubId: string, playerUid: string): Promise<MemberSnapshot | null>;
  /**
   * clubs/{clubId}.coachAccessPolicy — `undefined` si le club ou le champ
   * n'existe pas. Appele UNIQUEMENT quand la valeur sert reellement.
   */
  readClubPolicy(clubId: string): Promise<unknown>;
  /** Ecriture CIBLEE du seul champ d'autorisation (merge). */
  writeCoachAccess(clubId: string, playerUid: string, state: CoachAccessState): Promise<void>;
};

export type CoachAccessSyncResult =
  | { action: "no-member" }
  | { action: "not-player" }
  | { action: "unchanged"; state: CoachAccessState }
  | { action: "updated"; from: unknown; to: CoachAccessState };

/**
 * Pose l'etat d'autorisation s'il manque, et ne touche a rien sinon.
 *
 * Ne cree jamais un membership : si le joueur n'est pas rattache, il n'y a rien
 * a autoriser. Ne produit jamais "approved" : la politique ne peut donner que
 * "not_required" ou "pending".
 */
export async function ensureCoachAccessState(
  store: MemberAccessStore,
  clubId: string,
  playerUid: string,
): Promise<CoachAccessSyncResult> {
  const member = await store.readMember(clubId, playerUid);
  if (!member) return { action: "no-member" };
  // Un coach n'a pas de suivi joueur a autoriser : le champ n'a pas de sens pour lui.
  if (member.role !== "player") return { action: "not-player" };

  // Etat deja pose et lisible : on s'arrete AVANT de lire le club.
  const existing = normalizeCoachAccess(member.coachAccess);
  if (existing !== null) return { action: "unchanged", state: existing };

  const next = resolveCoachAccess(member.coachAccess, await store.readClubPolicy(clubId));

  // `member.coachAccess` est ici forcement illisible (absent, vide, mal type ou
  // inconnu) : la comparaison ne peut etre vraie que si le magasin ment. On la
  // garde quand meme — elle ne coute rien et ferme la porte a une ecriture en
  // boucle si un jour la normalisation s'assouplit.
  if (member.coachAccess === next) return { action: "unchanged", state: next };

  await store.writeCoachAccess(clubId, playerUid, next);
  return { action: "updated", from: member.coachAccess, to: next };
}
