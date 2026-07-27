// functions/src/clubMembers.ts
//
// RETRAIT REEL D'UN MEMBRE — coeur metier PUR.
//
// Comme inviteCodes.ts, ce fichier ne connait NI firebase-admin NI
// firebase-functions : il travaille sur un port minimal (`MemberStore`), ce qui
// le rend integralement testable sans emulateur. Le branchement Admin SDK vit
// dans clubMembersApi.ts.
//
// ─── LE PROBLEME QU'IL RESOUD ───────────────────────────────────────────────
// Revoquer un code d'invitation n'expulse PERSONNE : l'acces d'un joueur repose
// sur l'EXISTENCE de clubs/{clubId}/members/{uid}. Tant que ce document vit, le
// joueur lit le cadre de semaine et la directive, et le serveur continue de
// projeter son suivi vers le coach. Il n'existait aucun chemin, ni ecran, pour
// le retirer.
//
// ─── POURQUOI UNE PIERRE TOMBALE ET NON UNE SUPPRESSION ─────────────────────
// Supprimer le document marcherait pour la lecture (les regles exigent son
// existence), mais il manquerait TROIS choses :
//
//  1. Le refus doit venir de l'ETAT, pas d'une course. Le projecteur serveur se
//     reconstruit sur ecriture de users/{uid}, de ses seances et de ses seances
//     planifiees — et un joueur retire continue de s'entrainer, donc les
//     triggers vont tourner. Avec un document ABSENT, la reprojection lit "pas
//     de membership" et supprime : correct. Avec une pierre tombale, elle lit un
//     role qui n'est pas "player" et supprime AUSSI — mais en plus, la lecture
//     coach est fermee par TROIS verrous independants (role, coachAccess,
//     appartenance active). On ne depend d'aucun ordre d'evenements.
//  2. "double retrait" et "membre absent" doivent se distinguer. Sans trace, le
//     second retrait d'un joueur ressemble a un retrait de quelqu'un qui n'a
//     jamais ete la : deux situations differentes, deux reponses differentes.
//  3. L'audit. `removedAt` / `removedBy` sont les SEULES traces conservees, et
//     elles ne disent rien du joueur : ni nom, ni seance, ni donnee de suivi.
//     Son historique sportif personnel (users/{uid} et ses sous-collections)
//     n'est JAMAIS touche — le retrait du club n'est pas une suppression de
//     compte, et le libelle affiche au coach le dit mot pour mot.
//
// ─── CE QUE LE RETRAIT FERME, POINT PAR POINT ───────────────────────────────
//   . appartenance         -> role "removed" (hors CLUB_ACTIVE_ROLES)
//                             => `isActiveMember` faux dans les regles : le club,
//                                le cadre de semaine et la directive deviennent
//                                illisibles pour lui.
//   . acces coach associe  -> coachAccess "revoked"
//                             => `isCoachAccessGranted` faux (default-deny).
//   . nouvelle projection  -> le projecteur exige role === "player"
//                             => tout rebuild ulterieur renvoie null.
//   . projection existante -> supprimee dans la MEME transaction.
//   . references / caches  -> users/{playerUid}.clubId remis a null (uniquement
//                             s'il pointe encore vers CE club), donc plus de club
//                             fantome dans les reglages du joueur, et
//                             `clubIdOfUser` (triggers.ts) ne renvoie plus rien.
//
// ─── ANTI-ORACLE : POURQUOI "membre absent" PEUT ETRE DIT ───────────────────
// Le contrat d'invitation refuse d'avouer l'existence d'un club ou d'un code,
// parce qu'un attaquant pourrait ENUMERER. Ici, il n'y a rien a enumerer : la
// verification d'autorite passe AVANT toute lecture de la cible, donc seul un
// encadrant DE CE CLUB atteint la reponse "ce membre n'est pas dans l'effectif",
// a propos d'un uid qu'il a lui-meme lu dans SON PROPRE effectif. Il n'apprend
// rien qu'il ne sache deja. L'ordre des verifications n'est donc pas un detail :
// c'est lui qui rend le message honnete sans rouvrir de fuite.

import {
  CLUB_ROLE_PLAYER,
  CLUB_ROLE_REMOVED,
  clubAuthoritySignal,
  hasOwnerMembership,
  isActiveMembership,
  isClubStaff,
  isDesignatedOwner,
  normalizeClubRole,
  resolveOwnerAuthority,
  type ClubAuthoritySignal,
} from "./clubAuthority";
import { COACH_ACCESS_FIELD } from "./coachAccess";

// ─── Port de stockage ───────────────────────────────────────────────────────

export type MemberDocData = Record<string, unknown>;

export interface MemberTx {
  get(path: string): Promise<MemberDocData | null>;
  set(path: string, data: MemberDocData, opts?: { merge?: boolean }): void;
  delete(path: string): void;
}

export interface MemberStore {
  runTransaction<T>(fn: (tx: MemberTx) => Promise<T>): Promise<T>;
}

export type ClubMemberDeps = {
  store: MemberStore;
  now: () => number;
  /** Journal de reparation. Appele UNIQUEMENT sur un etat d'autorite incoherent. */
  onInconsistency?: (signal: ClubAuthoritySignal) => void;
};

/** Chemins Firestore touches par le retrait (centralises, comme invitePaths). */
export const memberPaths = {
  club: (clubId: string) => `clubs/${clubId}`,
  member: (clubId: string, uid: string) => `clubs/${clubId}/members/${uid}`,
  playerSummary: (clubId: string, uid: string) => `clubs/${clubId}/playerSummaries/${uid}`,
  user: (uid: string) => `users/${uid}`,
} as const;

// ─── Erreurs ────────────────────────────────────────────────────────────────

export type ClubMemberErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "failed-precondition"
  | "unavailable";

/**
 * Jeton d'echec TYPE du retrait du proprietaire. Litteral, verrouille par test :
 * c'est le SEUL refus de ce module qui doit etre PARLANT, parce qu'il indique le
 * geste a faire (transferer la propriete) au lieu de laisser deviner.
 */
export const OWNER_TRANSFER_REQUIRED = "OWNER_TRANSFER_REQUIRED";

export class ClubMemberError extends Error {
  constructor(
    readonly code: ClubMemberErrorCode,
    message: string,
    /** Jeton machine, present UNIQUEMENT sur les echecs typés. */
    readonly reason: string | null = null,
  ) {
    super(message);
    this.name = "ClubMemberError";
  }
}

/**
 * REFUS UNIQUE de tout ce qui touche a l'AUTORITE : appelant non encadrant,
 * encadrant d'un autre club, club inexistant, identifiants malformes, etat
 * d'autorite incoherent. Un seul objet, un seul message — separer ces cas
 * apprendrait a un curieux si un club existe, et lequel.
 */
export const REMOVE_DENIED_CODE: ClubMemberErrorCode = "permission-denied";
export const REMOVE_DENIED_MESSAGE =
  "Retrait impossible : cette action demande d'etre encadrant de ce club.";

export const REMOVE_UNAVAILABLE_CODE: ClubMemberErrorCode = "unavailable";
export const REMOVE_UNAVAILABLE_MESSAGE =
  "Le retrait est momentanement indisponible. Reessaie.";

export const MEMBER_NOT_FOUND_CODE: ClubMemberErrorCode = "not-found";
export const MEMBER_NOT_FOUND_MESSAGE =
  "Ce membre ne fait pas partie de l'effectif de ce club.";

export const OWNER_TRANSFER_CODE: ClubMemberErrorCode = "failed-precondition";
export const OWNER_TRANSFER_MESSAGE =
  "Impossible de retirer le proprietaire du club. Transfere d'abord la propriete a un autre encadrant, puis retire ce compte.";

/** Raisons INTERNES d'un refus d'autorite. Elles ne sortent JAMAIS de ce module. */
export type RemoveDenialReason =
  | "malformed-club-id"
  | "malformed-member-id"
  | "club-missing"
  | "not-staff"
  | "authority-inconsistent";

/**
 * Traduit une raison interne en erreur publique. `reason` est volontairement
 * IGNORE : la signature l'exige pour que l'appelant NOMME ce qu'il refuse, mais
 * toutes les raisons produisent le meme objet.
 */
export function removeDeniedError(_reason: RemoveDenialReason): ClubMemberError {
  return new ClubMemberError(REMOVE_DENIED_CODE, REMOVE_DENIED_MESSAGE);
}

export function ownerTransferRequiredError(): ClubMemberError {
  return new ClubMemberError(OWNER_TRANSFER_CODE, OWNER_TRANSFER_MESSAGE, OWNER_TRANSFER_REQUIRED);
}

// ─── Forme des identifiants ─────────────────────────────────────────────────

/** Borne de forme (jamais un verdict d'existence). Alignee sur inviteCodes.ts. */
export const MAX_ID_LENGTH = 128;

export function isPlausibleId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return false;
  // Un "/" transformerait `clubs/{id}/members/{uid}` en un autre chemin.
  return !trimmed.includes("/") && !trimmed.includes("..");
}

// ─── Retrait ────────────────────────────────────────────────────────────────

export type RemoveMemberResult = {
  clubId: string;
  memberUid: string;
  /**
   * `true` si l'appartenance etait DEJA revoquee (rejeu du geste). Rien n'a ete
   * reecrit : ni la date de retrait, ni l'auteur — un double appui ne doit pas
   * reecrire l'histoire de l'audit.
   */
  alreadyRemoved: boolean;
  /**
   * `true` si users/{memberUid}.clubId pointait encore vers ce club et vient
   * d'etre remis a null. `false` s'il pointait ailleurs (le joueur a rejoint un
   * autre club entre-temps) : on ne touche alors a RIEN, sous peine de le
   * detacher d'un club qui n'a rien demande.
   */
  clearedUserClub: boolean;
};

type RemoveTxOutcome =
  | { ok: true; result: RemoveMemberResult }
  | { ok: false; kind: "denied"; reason: RemoveDenialReason; signal: ClubAuthoritySignal | null }
  | { ok: false; kind: "member-missing" }
  | { ok: false; kind: "owner-transfer-required" };

/**
 * Retire (desactive) l'appartenance d'un membre d'un club.
 *
 * Sequence, dans cet ORDRE EXACT — l'ordre fait partie du contrat :
 *   1. identite de l'appelant (jamais un parametre client) ;
 *   2. forme des identifiants, sans aucune lecture ;
 *   3. transaction : club, appelant, cible, profil de la cible ;
 *      a. autorite de l'appelant SUR CE CLUB (avant toute lecture de la cible) ;
 *      b. existence reelle de la cible dans CE club ;
 *      c. protection du proprietaire (echec TYPE) ;
 *      d. idempotence (deja retire) ;
 *      e. ecritures : pierre tombale + suppression de projection + nettoyage.
 *
 * Tout est dans UNE transaction : ou les trois ecritures passent, ou aucune.
 */
export async function removeClubMember(
  deps: ClubMemberDeps,
  params: { actorUid: string; clubId: unknown; memberUid: unknown },
): Promise<RemoveMemberResult> {
  const actorUid = String(params.actorUid ?? "").trim();
  if (!actorUid) throw new ClubMemberError("unauthenticated", "Connexion requise.");

  if (!isPlausibleId(params.clubId)) throw removeDeniedError("malformed-club-id");
  if (!isPlausibleId(params.memberUid)) throw removeDeniedError("malformed-member-id");
  const clubId = params.clubId.trim();
  const memberUid = params.memberUid.trim();

  const now = deps.now();

  let outcome: RemoveTxOutcome;
  try {
    outcome = await deps.store.runTransaction<RemoveTxOutcome>(async (tx) => {
      // ── Lectures d'abord (contrainte Firestore) ────────────────────────────
      const club = await tx.get(memberPaths.club(clubId));
      if (!club) {
        // Club inexistant : MEME refus que "pas encadrant". Le distinguer
        // apprendrait a un curieux qu'un identifiant de club existe.
        return { ok: false, kind: "denied", reason: "club-missing", signal: null };
      }

      const actorMembership = await tx.get(memberPaths.member(clubId, actorUid));

      // a. AUTORITE. Verifiee AVANT de toucher a la cible (cf. anti-oracle,
      //    en-tete de fichier).
      const authority = resolveOwnerAuthority(club, actorMembership, actorUid);
      const signal = clubAuthoritySignal(
        { clubId, uid: actorUid, action: "removeClubMember" },
        authority,
      );
      if (signal) {
        // Etat incoherent : on REFUSE et on signale. Ne pas trancher entre les
        // deux sources est le coeur de l'invariant ; laisser passer un geste
        // destructeur sur un club dont l'autorite est douteuse le contredirait.
        return { ok: false, kind: "denied", reason: "authority-inconsistent", signal };
      }
      // Encadrant = appartenance active portant "owner" ou "coach", dans CE club.
      // Un encadrant d'un AUTRE club n'a par construction aucun membership ici.
      if (!isClubStaff(actorMembership)) {
        return { ok: false, kind: "denied", reason: "not-staff", signal: null };
      }

      // b. La cible appartient-elle REELLEMENT a ce club ?
      const targetMembership = await tx.get(memberPaths.member(clubId, memberUid));
      if (!targetMembership) return { ok: false, kind: "member-missing" };

      // c. PROTECTION DU PROPRIETAIRE. Volontairement LARGE : l'une OU l'autre
      //    des deux sources suffit a declencher le refus. Sur un etat coherent
      //    les deux disent la meme chose ; sur un etat abime, refuser reste le
      //    seul geste sur : on ne veut surtout pas qu'une incoherence devienne
      //    le chemin par lequel un club perd son proprietaire.
      if (isDesignatedOwner(club, memberUid) || hasOwnerMembership(targetMembership)) {
        return { ok: false, kind: "owner-transfer-required" };
      }

      // d. Idempotence : deja retire -> aucune ecriture, succes annonce comme tel.
      if (!isActiveMembership(targetMembership)) {
        return {
          ok: true,
          result: { clubId, memberUid, alreadyRemoved: true, clearedUserClub: false },
        };
      }

      // Le profil est lu MAINTENANT (donc toujours avant la premiere ecriture).
      const targetUser = await tx.get(memberPaths.user(memberUid));
      const userClubId =
        typeof targetUser?.clubId === "string" ? targetUser.clubId.trim() : "";
      const clearedUserClub = userClubId === clubId;

      // ── Ecritures ──────────────────────────────────────────────────────────
      // 1. Pierre tombale. `merge` conserve `joinedAt` (trace d'audit) et
      //    n'ajoute AUCUNE donnee de joueur : ce document n'en a jamais porte.
      tx.set(
        memberPaths.member(clubId, memberUid),
        {
          uid: memberUid,
          role: CLUB_ROLE_REMOVED,
          // Deuxieme verrou, independant du role : meme si une lecture future
          // oubliait de regarder le role, l'acces reste ferme (default-deny).
          [COACH_ACCESS_FIELD]: "revoked",
          removedAt: now,
          removedBy: actorUid,
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. Projection deja produite : supprimee ici meme. Ne pas dependre du
      //    trigger pour cette suppression est deliberé — un trigger est
      //    asynchrone, et la donnee doit disparaitre avec le geste.
      tx.delete(memberPaths.playerSummary(clubId, memberUid));

      // 3. Reference du joueur vers son club. Sans ca, il garde un club fantome
      //    dans ses reglages, et `clubIdOfUser` (triggers.ts) continue de
      //    designer ce club a chaque seance enregistree.
      if (clearedUserClub) {
        tx.set(memberPaths.user(memberUid), { clubId: null, updatedAt: now }, { merge: true });
      }

      return {
        ok: true,
        result: { clubId, memberUid, alreadyRemoved: false, clearedUserClub },
      };
    });
  } catch (err) {
    if (err instanceof ClubMemberError) throw err;
    throw new ClubMemberError(REMOVE_UNAVAILABLE_CODE, REMOVE_UNAVAILABLE_MESSAGE);
  }

  if (outcome.ok) return outcome.result;

  if (outcome.kind === "member-missing") {
    throw new ClubMemberError(MEMBER_NOT_FOUND_CODE, MEMBER_NOT_FOUND_MESSAGE);
  }
  if (outcome.kind === "owner-transfer-required") {
    throw ownerTransferRequiredError();
  }

  // Signalement HORS transaction : un rejeu pour contention ne doit pas
  // multiplier les lignes de journal.
  if (outcome.signal) deps.onInconsistency?.(outcome.signal);
  throw removeDeniedError(outcome.reason);
}

/**
 * Le membership decrit-il un joueur ENCORE consultable par le coach ?
 * Exportee pour que les tests de non-regression puissent poser la question dans
 * les memes termes que le projecteur (`role === "player"`).
 */
export function isProjectablePlayer(membership: MemberDocData | null): boolean {
  return normalizeClubRole(membership?.role) === CLUB_ROLE_PLAYER;
}
