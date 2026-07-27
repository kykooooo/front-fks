// functions/src/coachAccessSync.ts
//
// Recalcul SERVEUR de `clubs/{clubId}/members/{playerUid}.coachAccess` quand le
// profil du joueur change (la categorie d'age peut apparaitre ou changer).
//
// Ce fichier ne contient AUCUNE decision : elle vit dans `resolveCoachAccess`
// (coachAccess.ts, module pur). Ici on lit, on compare, et on n'ecrit QUE si la
// valeur change reellement.
//
// POURQUOI "n'ecrire que si ca change" n'est pas une micro-optimisation : une
// ecriture sur members/ redeclenche `onMemberWritten`, donc une reconstruction
// de projection. Ecrire systematiquement transformerait chaque sauvegarde de
// profil en deux tours de moulin. Ici, le second tour ne se produit jamais.
//
// Le port `MemberAccessStore` existe pour la meme raison que `InviteStore` dans
// inviteCodes.ts : rendre la logique testable sans emulateur. Ce fichier
// n'importe donc NI firebase-admin NI firebase-functions — le branchement
// Firestore vit dans triggers.ts.

import { resolveCoachAccess, type CoachAccessState } from "./coachAccess";

export type MemberSnapshot = {
  role: unknown;
  coachAccess: unknown;
};

export type MemberAccessStore = {
  /** members/{playerUid} — null si le joueur n'est pas (ou plus) rattache. */
  readMember(clubId: string, playerUid: string): Promise<MemberSnapshot | null>;
  /** users/{playerUid}.ageCategory — `undefined` si le profil n'existe pas. */
  readAgeCategory(playerUid: string): Promise<unknown>;
  /** Ecriture CIBLEE du seul champ d'autorisation (merge). */
  writeCoachAccess(clubId: string, playerUid: string, state: CoachAccessState): Promise<void>;
};

export type CoachAccessSyncResult =
  | { action: "no-member" }
  | { action: "not-player" }
  | { action: "unchanged"; state: CoachAccessState }
  | { action: "updated"; from: unknown; to: CoachAccessState };

/**
 * Aligne l'etat d'autorisation sur le profil ACTUEL du joueur.
 *
 * Ne touche jamais un "approved" ni un "revoked" (cf. resolveCoachAccess).
 * Ne cree jamais un membership : si le joueur n'est pas rattache, il n'y a rien
 * a autoriser.
 */
export async function syncCoachAccessFromProfile(
  store: MemberAccessStore,
  clubId: string,
  playerUid: string,
): Promise<CoachAccessSyncResult> {
  const member = await store.readMember(clubId, playerUid);
  if (!member) return { action: "no-member" };
  // Un coach n'a pas de suivi joueur a autoriser : le champ n'a pas de sens pour lui.
  if (member.role !== "player") return { action: "not-player" };

  const ageCategory = await store.readAgeCategory(playerUid);
  const next = resolveCoachAccess(member.coachAccess, ageCategory);

  if (member.coachAccess === next) return { action: "unchanged", state: next };

  await store.writeCoachAccess(clubId, playerUid, next);
  return { action: "updated", from: member.coachAccess, to: next };
}
