// functions/src/clubAuthority.ts
//
// LE PREDICAT D'AUTORITE D'UN CLUB. Module PUR (aucun Firestore, aucune
// horloge) : c'est la SEULE source de verite cote serveur de la question
// "cette personne a-t-elle autorite sur ce club, et a quel titre ?".
//
// ─── DEUX AXES INDEPENDANTS, ET C'EST TOUT LE SUJET ─────────────────────────
// Une appartenance `clubs/{clubId}/members/{uid}` porte desormais DEUX champs
// qui ne parlent PAS de la meme chose :
//
//   . `accessRole`   : les PERMISSIONS D'ENCADREMENT ("owner" | "coach").
//                      Absent = aucune permission d'encadrement.
//   . `playerStatus` : le STATUT DE JOUEUR ("active" | "inactive"), c'est-a-dire
//                      "cette personne possede-t-elle un suivi sportif dans ce
//                      club ?". Absent = elle n'en a jamais eu ici.
//
// LES DEUX PEUVENT COEXISTER. Un entraineur-joueur — cas courant en club
// amateur — porte `accessRole: "coach"` ET `playerStatus: "active"`.
//
// ─── POURQUOI UN REMPLACEMENT, ET PAS UN CHAMP DE PLUS ──────────────────────
// L'ancien modele tenait tout dans UN champ `role` a quatre valeurs
// (owner / coach / player / removed). C'est cette fusion qui produisait le
// defaut : "player" occupait la meme case que "coach", donc devenir encadrant
// EFFACAIT mecaniquement le fait d'etre joueur. Le transfert de propriete
// ecrivait `role: "owner"` et retirait, sans le vouloir et sans le dire, le
// suivi sportif du nouveau proprietaire.
//
// Ajouter `playerStatus` A COTE de `role` aurait laisse la moitie du piege en
// place : "player" serait reste une valeur de l'axe encadrement (signifiant en
// realite "aucune permission"), et le rattachement aurait du ecrire
// conditionnellement — "ecris role: player SAUF si la personne est deja
// encadrante" — c'est-a-dire deux champs tenus en accord, donc une divergence
// garantie a terme. On remplace.
//
// COUT DE MIGRATION : NUL, et c'est verifiable plutot que suppose. La base de
// production a ete videe le 21/07 (clubs et users supprimes par Kyllian, cf.
// memoire projet « Audit mode coach 21/07 » : « prod nettoyee integralement,
// plus de backfill ni d'annuaire a creer »). Il n'existe donc aucun document
// `members` portant l'ancien champ `role`. AUCUN chemin de compatibilite n'est
// ecrit ici : un repli qui accepterait encore `role` laisserait croire a une
// migration qui n'a pas lieu, et surtout il rouvrirait la fusion des deux axes
// pour tout document qui le porterait. Un ancien document, s'il en existait un,
// serait donc lu comme "aucune permission, aucun suivi" — fail-closed.
//
// ─── L'INVARIANT PROPRIETAIRE, MOT POUR MOT (inchange) ──────────────────────
// "Un proprietaire est autorise uniquement si ownerUid le designe ET s'il
//  possede encore une appartenance active avec le role proprietaire."
//
// Deux sources, jamais une seule :
//   1. clubs/{clubId}.ownerUid                 — la designation ;
//   2. clubs/{clubId}/members/{uid}.accessRole — l'appartenance.
//
// Quand les deux se contredisent, on NE CHOISIT PAS. On refuse, et on signale
// l'etat pour reparation. Choisir arbitrairement une source, c'est decider en
// silence laquelle des deux ment — et se tromper une fois sur deux.
//
// ─── UN PROPRIETAIRE EST DE FAIT ENCADRANT ──────────────────────────────────
// `CLUB_ACCESS_ROLES` contient "owner" ET "coach". Sans ca, poser le role
// proprietaire aurait retire au proprietaire l'ecriture du cadre de semaine et
// de la directive : un trou ouvert en en fermant un autre. Les regles Firestore
// appliquent la meme liste (fonction `isClubStaff`).
//
// ─── LA PIERRE TOMBALE, DANS UN MODELE A DEUX AXES ──────────────────────────
// Retirer quelqu'un doit fermer LES DEUX : plus d'encadrement ET plus de suivi
// projete. Le retrait (clubMembers.ts) ecrit donc `accessRole: null` ET
// `playerStatus: "inactive"`, plus `removedAt` / `removedBy`. Il n'existe plus
// de valeur "removed" : l'etat retire, c'est l'absence des deux, ce qui rend
// impossible d'oublier d'en fermer un. Ce qui distingue "retire" de "jamais
// venu" reste `removedAt`, et rien d'autre.
//
// ─── DUPLICATION ASSUMEE AVEC firestore.rules ───────────────────────────────
// Les regles Firestore ne peuvent pas importer de TypeScript. Le predicat existe
// donc DEUX fois : ici, et dans firestore.rules (`isClubOwner`, `isClubStaff`,
// `isActiveMember`, `isPlayerMember`). Il n'existe AUCUN verrou automatique
// d'egalite entre les deux ecritures — exactement la meme situation, et le meme
// remede, que pour COACH_ACCESS_GRANTING_STATES (cf. coachAccess.ts) : deux
// suites de tests exercent les MEMES cas des deux cotes
//   - functions/tests/clubAuthority.test.ts  (ce module) ;
//   - firestore-tests/rules.clubAuthority.test.ts (les vraies regles).
// Modifier l'un sans l'autre laisse la base plus stricte que le serveur, donc
// fail-closed, donc sans danger — mais silencieux. Toucher les deux, toujours.

/** Noms des deux champs, ecrits UNE SEULE FOIS (les fautes de frappe ouvrent des trous). */
export const ACCESS_ROLE_FIELD = "accessRole";
export const PLAYER_STATUS_FIELD = "playerStatus";

/** Permissions d'encadrement reconnues. */
export const CLUB_ACCESS_ROLE_OWNER = "owner";
export const CLUB_ACCESS_ROLE_COACH = "coach";

export const CLUB_ACCESS_ROLES = [CLUB_ACCESS_ROLE_OWNER, CLUB_ACCESS_ROLE_COACH] as const;

/** `null` (champ absent) est un etat legitime : "aucune permission d'encadrement". */
export type ClubAccessRole = (typeof CLUB_ACCESS_ROLES)[number];

/** Statut de joueur reconnu. `null` (champ absent) = aucun suivi dans ce club. */
export const PLAYER_STATUS_ACTIVE = "active";
export const PLAYER_STATUS_INACTIVE = "inactive";

export const CLUB_PLAYER_STATUSES = [PLAYER_STATUS_ACTIVE, PLAYER_STATUS_INACTIVE] as const;

export type ClubPlayerStatus = (typeof CLUB_PLAYER_STATUSES)[number];

export type ClubDocLike = Record<string, unknown> | null | undefined;
export type MembershipLike = Record<string, unknown> | null | undefined;

/** Chaine non vide, ou `null`. Une chaine d'espaces n'est pas un identifiant. */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Permission d'encadrement reconnue, ou `null` (absente, mal typee, inconnue). */
export function normalizeAccessRole(value: unknown): ClubAccessRole | null {
  const raw = str(value);
  if (raw === null) return null;
  return (CLUB_ACCESS_ROLES as readonly string[]).includes(raw) ? (raw as ClubAccessRole) : null;
}

/** Statut de joueur reconnu, ou `null` (absent, mal type, inconnu). */
export function normalizePlayerStatus(value: unknown): ClubPlayerStatus | null {
  const raw = str(value);
  if (raw === null) return null;
  return (CLUB_PLAYER_STATUSES as readonly string[]).includes(raw)
    ? (raw as ClubPlayerStatus)
    : null;
}

/** clubs/{clubId}.ownerUid, ou `null` s'il est absent / illisible. */
export function readOwnerUid(club: ClubDocLike): string | null {
  return club ? str(club.ownerUid) : null;
}

/**
 * `ownerUid` DESIGNE-t-il cet utilisateur ? Reference rapide, jamais un droit a
 * elle seule. Un uid vide ne peut jamais correspondre a un ownerUid absent :
 * les deux valent `null`, et `null === null` est ici explicitement refuse.
 */
export function isDesignatedOwner(club: ClubDocLike, uid: unknown): boolean {
  const owner = readOwnerUid(club);
  const candidate = str(uid);
  return owner !== null && candidate !== null && owner === candidate;
}

/** L'appartenance porte-t-elle la permission proprietaire ? */
export function hasOwnerMembership(membership: MembershipLike): boolean {
  return normalizeAccessRole(membership?.[ACCESS_ROLE_FIELD]) === CLUB_ACCESS_ROLE_OWNER;
}

/**
 * Appartenance d'ENCADREMENT (owner ou coach). C'est le predicat que consomment
 * la lecture de l'effectif, la lecture des projections, l'ecriture du cadre de
 * semaine, de la note privee et de la directive.
 *
 * Il ne lit QUE `accessRole` : il ne depend ni de `ownerUid`, ni du statut de
 * joueur. Un entraineur-joueur est donc encadrant a part entiere, et le rester
 * ne doit rien a son suivi sportif.
 */
export function isClubStaff(membership: MembershipLike): boolean {
  return normalizeAccessRole(membership?.[ACCESS_ROLE_FIELD]) !== null;
}

/**
 * L'appartenance porte-t-elle un SUIVI SPORTIF actif ?
 *
 * C'est le SEUL predicat qui decide qu'une fiche de suivi doit exister
 * (projector.ts) et qu'elle est lisible (firestore.rules, `isPlayerMember`).
 * Il ne regarde PAS `accessRole` : c'est exactement ce qui fait apparaitre un
 * entraineur-joueur dans l'effectif suivi, comme n'importe quel joueur — et
 * sous les memes conditions, `coachAccess` compris.
 */
export function isActivePlayer(membership: MembershipLike): boolean {
  return normalizePlayerStatus(membership?.[PLAYER_STATUS_FIELD]) === PLAYER_STATUS_ACTIVE;
}

/**
 * Appartenance ACTIVE au club : encadrement OU suivi sportif actif. Recopie
 * dans firestore.rules (`isActiveMember`).
 *
 * Une pierre tombale n'en est pas une : elle n'a ni l'un ni l'autre. Un membre
 * retire ne doit plus lire le club, ni le cadre de semaine, ni la directive.
 */
export function isActiveMembership(membership: MembershipLike): boolean {
  return isClubStaff(membership) || isActivePlayer(membership);
}

/**
 * Verdict d'autorite PROPRIETAIRE. Quatre etats, et deux d'entre eux sont des
 * anomalies qu'il faut nommer plutot que d'ecraser en un simple `false` :
 *
 *  - "authorized"      : les deux sources concordent. Seul cas autorisant.
 *  - "not-owner"       : ni designe, ni porteur de la permission. Cas nominal
 *                        d'un coach ordinaire ou d'un joueur — PAS une anomalie.
 *  - "designation-without-membership" : ownerUid le designe, mais il n'a pas (ou
 *                        plus) la permission proprietaire. INCOHERENT.
 *  - "membership-without-designation" : il porte la permission proprietaire,
 *                        mais ownerUid designe quelqu'un d'autre (ou personne).
 *                        INCOHERENT.
 */
export type OwnerAuthority =
  | "authorized"
  | "not-owner"
  | "designation-without-membership"
  | "membership-without-designation";

export function resolveOwnerAuthority(
  club: ClubDocLike,
  membership: MembershipLike,
  uid: unknown,
): OwnerAuthority {
  const designated = isDesignatedOwner(club, uid);
  const holdsRole = hasOwnerMembership(membership);
  if (designated && holdsRole) return "authorized";
  if (designated) return "designation-without-membership";
  if (holdsRole) return "membership-without-designation";
  return "not-owner";
}

/** LA question, en un booleen. `true` exige les DEUX sources. */
export function isClubOwnerAuthorized(
  club: ClubDocLike,
  membership: MembershipLike,
  uid: unknown,
): boolean {
  return resolveOwnerAuthority(club, membership, uid) === "authorized";
}

/**
 * L'etat lu est-il une INCOHERENCE d'autorite ? Distinct de "pas autorise" :
 * un coach ordinaire n'est pas autorise comme proprietaire, et c'est parfaitement
 * normal. Une incoherence, elle, doit etre SIGNALEE POUR REPARATION.
 */
export function isOwnerAuthorityInconsistent(authority: OwnerAuthority): boolean {
  return (
    authority === "designation-without-membership" || authority === "membership-without-designation"
  );
}

/**
 * Signal d'incoherence. Charge volontairement PAUVRE : de quoi reparer, rien de
 * plus. Ni nom de club, ni donnee de joueur, ni contenu de document — un journal
 * ne doit pas devenir la surface qu'on vient de fermer ailleurs.
 */
export type ClubAuthoritySignal = {
  clubId: string;
  uid: string;
  authority: OwnerAuthority;
  /** Geste au cours duquel l'incoherence a ete rencontree. */
  action: string;
};

/**
 * Fabrique le signal si (et seulement si) l'etat est incoherent, `null` sinon.
 * Le point d'appel n'a donc qu'un `if` a ecrire, et ne peut pas se tromper sur
 * ce qui merite un signalement.
 */
export function clubAuthoritySignal(
  params: { clubId: string; uid: string; action: string },
  authority: OwnerAuthority,
): ClubAuthoritySignal | null {
  if (!isOwnerAuthorityInconsistent(authority)) return null;
  return { clubId: params.clubId, uid: params.uid, authority, action: params.action };
}
