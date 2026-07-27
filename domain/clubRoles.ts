// domain/clubRoles.ts
//
// Rôles d'appartenance à un club, côté application, et le PRÉDICAT D'AUTORITÉ
// qui va avec.
//
// TROISIÈME et dernière copie du même contrat, assumée comme telle :
//   1. functions/src/clubAuthority.ts — la décision serveur ;
//   2. firestore.rules                — la décision de la base ;
//   3. ce fichier                     — ce que l'application AFFICHE.
//
// La différence de nature compte : les deux premières ACCORDENT des droits, ce
// fichier n'en accorde aucun. Il sert à dire la vérité à l'écran (« ton compte
// est désigné propriétaire mais son appartenance ne le dit pas ») et à ne jamais
// promettre un bouton que le serveur refusera. Un écran plus permissif que le
// serveur produit une erreur inexpliquée ; un écran plus strict cache une
// fonction qui marche. Les deux se corrigent en gardant cette liste alignée.
//
// L'INVARIANT, mot pour mot : « un propriétaire est autorisé uniquement si
// ownerUid le désigne ET s'il possède encore une appartenance active avec le
// rôle propriétaire ».

export const CLUB_ROLE_OWNER = "owner";
export const CLUB_ROLE_COACH = "coach";
export const CLUB_ROLE_PLAYER = "player";
/** Pierre tombale posée par le retrait serveur. N'ouvre rien, nulle part. */
export const CLUB_ROLE_REMOVED = "removed";

export const CLUB_ROLES = [
  CLUB_ROLE_OWNER,
  CLUB_ROLE_COACH,
  CLUB_ROLE_PLAYER,
  CLUB_ROLE_REMOVED,
] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

/** Rôles d'ENCADREMENT : le propriétaire est un encadrant, par construction. */
export const CLUB_STAFF_ROLES: readonly ClubRole[] = [CLUB_ROLE_OWNER, CLUB_ROLE_COACH];

/** Rôles d'appartenance ACTIVE. "removed" en est volontairement absent. */
export const CLUB_ACTIVE_ROLES: readonly ClubRole[] = [
  CLUB_ROLE_OWNER,
  CLUB_ROLE_COACH,
  CLUB_ROLE_PLAYER,
];

/** Rôle reconnu, ou `null` (absent, mal typé, inconnu) — default-deny. */
export function normalizeClubRole(value: unknown): ClubRole | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  return (CLUB_ROLES as readonly string[]).includes(raw) ? (raw as ClubRole) : null;
}

export function isClubStaffRole(value: unknown): boolean {
  const role = normalizeClubRole(value);
  return role !== null && CLUB_STAFF_ROLES.includes(role);
}

export function isActiveClubRole(value: unknown): boolean {
  const role = normalizeClubRole(value);
  return role !== null && CLUB_ACTIVE_ROLES.includes(role);
}

/**
 * Verdict d'autorité propriétaire, identique à celui du serveur
 * (functions/src/clubAuthority.resolveOwnerAuthority). Quatre états, dont deux
 * incohérences NOMMÉES : les écraser en un `false` reviendrait à faire
 * disparaître le club de l'espace coach sans jamais dire pourquoi.
 */
export type ClubOwnerAuthority =
  | "authorized"
  | "not-owner"
  | "designation-without-membership"
  | "membership-without-designation";

export function resolveClubOwnerAuthority(params: {
  /** clubs/{clubId}.ownerUid tel que lu. */
  ownerUid: unknown;
  /** clubs/{clubId}/members/{uid}.role tel que lu. */
  myRole: unknown;
  /** uid du compte connecté. */
  uid: unknown;
}): ClubOwnerAuthority {
  const owner = typeof params.ownerUid === "string" ? params.ownerUid.trim() : "";
  const me = typeof params.uid === "string" ? params.uid.trim() : "";
  const designated = owner !== "" && me !== "" && owner === me;
  const holdsRole = normalizeClubRole(params.myRole) === CLUB_ROLE_OWNER;

  if (designated && holdsRole) return "authorized";
  if (designated) return "designation-without-membership";
  if (holdsRole) return "membership-without-designation";
  return "not-owner";
}

/** L'état lu est-il une incohérence d'autorité (donc : à réparer) ? */
export function isClubOwnerAuthorityInconsistent(authority: ClubOwnerAuthority): boolean {
  return (
    authority === "designation-without-membership" || authority === "membership-without-designation"
  );
}

/**
 * Ce que l'écran d'un MEMBRE dit de sa propre appartenance.
 *
 * Pourquoi ça existe (2026-07, lot transfert de propriété) : la carte « Mon
 * club » des réglages proposait « Quitter le club » à tout le monde. Or les
 * règles Firestore refusent au propriétaire de supprimer son appartenance — sa
 * disparition fabriquerait un `ownerUid` qui désigne un non-membre, exactement
 * l'incohérence que l'invariant proscrit. Le bouton existait donc pour quelqu'un
 * chez qui il ne pouvait JAMAIS marcher, et l'échec s'affichait en « Réessaie »,
 * c'est-à-dire un conseil faux.
 *
 * Ce n'était visible de personne avant ce lot, puisqu'un propriétaire est un
 * coach et ne voit pas cet écran. Le transfert change ça : un JOUEUR peut
 * désormais devenir propriétaire, et il garde l'application joueur.
 *
 * Cette fonction n'accorde aucun droit — elle dit la vérité, et elle enlève un
 * bouton plutôt que de laisser une erreur l'expliquer.
 */
export function clubMembershipCopy(role: unknown): {
  /** Ligne d'état sous le nom du club. */
  statut: string;
  /** Pastille de rôle. */
  badge: string;
  /** Le départ volontaire est-il possible ? (le serveur reste seul juge) */
  peutQuitter: boolean;
  /** Pourquoi il ne l'est pas, et quel geste faire. `null` s'il l'est. */
  empechement: string | null;
} {
  switch (normalizeClubRole(role)) {
    case CLUB_ROLE_OWNER:
      return {
        statut: "Propriétaire du club",
        badge: "Propriétaire",
        peutQuitter: false,
        empechement:
          "Tu es propriétaire de ce club. Pour le quitter, la propriété doit d'abord être transférée à un autre membre — contacte le support FKS.",
      };
    case CLUB_ROLE_COACH:
      return {
        statut: "Encadrant du club",
        badge: "Encadrant",
        peutQuitter: true,
        empechement: null,
      };
    default:
      // « player », « removed » et rôle illisible : on ne promet aucun statut
      // particulier, et le départ volontaire reste offert (le serveur tranche).
      return {
        statut: "Membre de l'effectif",
        badge: "Membre",
        peutQuitter: true,
        empechement: null,
      };
  }
}

/** Le geste, écrit une seule fois : il est identique dans les deux incohérences. */
const REPARATION_GESTE =
  "Aucune donnée n'a été perdue. Contactez le support FKS pour rétablir votre rôle sur ce club.";

/**
 * Ce que l'écran coach dit d'une incohérence d'autorité.
 *
 * DEUX LONGUEURS, et ce n'est pas de la coquetterie : `corps` tient dans un
 * bandeau borné à trois lignes (règle d'or : `numberOfLines` sur tout contenu
 * qui peut déborder), `details` s'affiche en pleine carte quand il n'y a
 * justement plus rien d'autre à montrer. Un texte d'honnêteté tronqué au milieu
 * d'une phrase serait pire qu'un texte court écrit exprès.
 *
 * Le ton : on nomme le fait constaté, on dit ce qui est fermé, on donne le
 * geste. On ne dramatise pas (rien n'est perdu) et on ne minimise pas (les
 * droits d'encadrement sont réellement fermés tant que ce n'est pas réparé).
 */
export function clubOwnerInconsistencyCopy(authority: ClubOwnerAuthority): {
  titre: string;
  corps: string;
  details: string;
} | null {
  if (!isClubOwnerAuthorityInconsistent(authority)) return null;

  const constat =
    authority === "designation-without-membership"
      ? "Ce club vous désigne comme propriétaire, mais votre appartenance à l'effectif ne le confirme pas."
      : "Votre appartenance indique le rôle propriétaire, mais ce club désigne quelqu'un d'autre.";

  return {
    titre: "Club à réparer",
    corps: `${constat} Les actions d'encadrement sont fermées tant que les deux ne concordent pas.`,
    details: `${constat} Par sécurité, l'accès à l'effectif et les actions d'encadrement sont fermés tant que les deux ne concordent pas. ${REPARATION_GESTE}`,
  };
}
