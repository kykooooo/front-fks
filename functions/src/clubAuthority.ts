// functions/src/clubAuthority.ts
//
// LE PREDICAT D'AUTORITE D'UN CLUB. Module PUR (aucun Firestore, aucune
// horloge) : c'est la SEULE source de verite cote serveur de la question
// "cette personne a-t-elle autorite sur ce club, et a quel titre ?".
//
// ─── L'INVARIANT, MOT POUR MOT ──────────────────────────────────────────────
// "Un proprietaire est autorise uniquement si ownerUid le designe ET s'il
//  possede encore une appartenance active avec le role proprietaire."
//
// Deux sources, jamais une seule :
//   1. clubs/{clubId}.ownerUid          — la designation ;
//   2. clubs/{clubId}/members/{uid}.role — l'appartenance.
//
// Quand les deux se contredisent, on NE CHOISIT PAS. On refuse, et on signale
// l'etat pour reparation. Choisir arbitrairement une source, c'est decider en
// silence laquelle des deux ment — et se tromper une fois sur deux.
//
// ownerUid garde son utilite : c'est une reference rapide (qui EST cense etre le
// proprietaire), et c'est elle qui rend l'incoherence DETECTABLE. Ce qu'elle ne
// fait plus, c'est accorder un droit toute seule.
//
// ─── POURQUOI UN ROLE "owner" A DU NAITRE AVEC CE PREDICAT ──────────────────
// Avant ce lot, `members/{uid}.role` ne connaissait que "coach" et "player", et
// le createur du club s'ecrivait lui-meme en "coach". Sous l'invariant, TOUS les
// clubs existants auraient ete incoherents des la premiere lecture : ownerUid
// designant quelqu'un qui n'a pas d'appartenance proprietaire. Le role et le
// predicat arrivent donc dans le meme mouvement, et le chemin de creation de
// club ecrit desormais "owner" (repositories/clubsRepo.createClubAsCoach).
// Cout en production : NUL — la base a ete videe le 21/07, il n'existe aucun
// club a migrer.
//
// ─── UN PROPRIETAIRE EST DE FAIT ENCADRANT ──────────────────────────────────
// `CLUB_STAFF_ROLES` contient "owner" ET "coach". Sans ca, poser le role
// proprietaire aurait retire au proprietaire l'ecriture du cadre de semaine et
// de la directive : un trou ouvert en en fermant un autre. Les regles Firestore
// appliquent la meme liste (fonction `isClubStaff`).
//
// ─── DUPLICATION ASSUMEE AVEC firestore.rules ───────────────────────────────
// Les regles Firestore ne peuvent pas importer de TypeScript. Le predicat existe
// donc DEUX fois : ici, et dans firestore.rules (`isClubOwner`, `isClubStaff`,
// `isActiveMember`). Il n'existe AUCUN verrou automatique d'egalite entre les
// deux ecritures — exactement la meme situation, et le meme remede, que pour
// COACH_ACCESS_GRANTING_STATES (cf. coachAccess.ts) : deux suites de tests
// exercent les MEMES cas des deux cotes
//   - functions/tests/clubAuthority.test.ts  (ce module) ;
//   - firestore-tests/rules.clubAuthority.test.ts (les vraies regles).
// Modifier l'un sans l'autre laisse la base plus stricte que le serveur, donc
// fail-closed, donc sans danger — mais silencieux. Toucher les deux, toujours.

/** Roles reconnus sur clubs/{clubId}/members/{uid}. */
export const CLUB_ROLE_OWNER = "owner";
export const CLUB_ROLE_COACH = "coach";
export const CLUB_ROLE_PLAYER = "player";
/**
 * Pierre tombale posee par le retrait serveur (clubMembers.ts). Ce n'est PAS un
 * role d'appartenance : c'est la trace qu'il y en a eu une. Elle n'ouvre rien,
 * nulle part, et c'est ce qui fait que le refus vient de l'ETAT et non d'une
 * course entre le retrait et un trigger de reprojection.
 */
export const CLUB_ROLE_REMOVED = "removed";

export const CLUB_ROLES = [
  CLUB_ROLE_OWNER,
  CLUB_ROLE_COACH,
  CLUB_ROLE_PLAYER,
  CLUB_ROLE_REMOVED,
] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

/** Les roles d'ENCADREMENT. Recopie dans firestore.rules (`isClubStaff`). */
export const CLUB_STAFF_ROLES: readonly ClubRole[] = [CLUB_ROLE_OWNER, CLUB_ROLE_COACH];

/**
 * Les roles d'appartenance ACTIVE. Recopie dans firestore.rules
 * (`isActiveMember`). "removed" en est volontairement absent : un membre retire
 * ne doit plus lire le cadre de semaine, la directive, ni meme le club.
 */
export const CLUB_ACTIVE_ROLES: readonly ClubRole[] = [
  CLUB_ROLE_OWNER,
  CLUB_ROLE_COACH,
  CLUB_ROLE_PLAYER,
];

export type ClubDocLike = Record<string, unknown> | null | undefined;
export type MembershipLike = Record<string, unknown> | null | undefined;

/** Chaine non vide, ou `null`. Une chaine d'espaces n'est pas un identifiant. */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Role reconnu, ou `null` (valeur absente, mal typee, ou inconnue). */
export function normalizeClubRole(value: unknown): ClubRole | null {
  const raw = str(value);
  if (raw === null) return null;
  return (CLUB_ROLES as readonly string[]).includes(raw) ? (raw as ClubRole) : null;
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

/** L'appartenance porte-t-elle le role proprietaire ? */
export function hasOwnerMembership(membership: MembershipLike): boolean {
  return normalizeClubRole(membership?.role) === CLUB_ROLE_OWNER;
}

/** Appartenance ACTIVE (owner / coach / player). Une pierre tombale ne l'est pas. */
export function isActiveMembership(membership: MembershipLike): boolean {
  const role = normalizeClubRole(membership?.role);
  return role !== null && CLUB_ACTIVE_ROLES.includes(role);
}

/**
 * Appartenance d'ENCADREMENT (owner ou coach). C'est le predicat que consomment
 * la lecture de l'effectif, la lecture des projections, l'ecriture du cadre de
 * semaine, de la note privee et de la directive.
 *
 * Il ne lit QUE le membership : il ne depend pas de `ownerUid`, donc il ne peut
 * pas etre victime d'une incoherence entre les deux sources.
 */
export function isClubStaff(membership: MembershipLike): boolean {
  const role = normalizeClubRole(membership?.role);
  return role !== null && CLUB_STAFF_ROLES.includes(role);
}

/**
 * Verdict d'autorite PROPRIETAIRE. Quatre etats, et deux d'entre eux sont des
 * anomalies qu'il faut nommer plutot que d'ecraser en un simple `false` :
 *
 *  - "authorized"      : les deux sources concordent. Seul cas autorisant.
 *  - "not-owner"       : ni designe, ni porteur du role. Cas nominal d'un coach
 *                        ordinaire ou d'un joueur — ce n'est PAS une anomalie.
 *  - "designation-without-membership" : ownerUid le designe, mais il n'a pas (ou
 *                        plus) l'appartenance proprietaire. INCOHERENT.
 *  - "membership-without-designation" : il porte le role proprietaire, mais
 *                        ownerUid designe quelqu'un d'autre (ou personne).
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
