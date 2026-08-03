// domain/clubRoles.ts
//
// Appartenance à un club, côté application : les DEUX AXES, et le PRÉDICAT
// D'AUTORITÉ qui va avec.
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
// fonction qui marche. Les deux se corrigent en gardant ces listes alignées.
//
// ─── LES DEUX AXES ──────────────────────────────────────────────────────────
// `clubs/{clubId}/members/{uid}` porte deux champs indépendants :
//
//   . `accessRole`   : les PERMISSIONS D'ENCADREMENT ("owner" | "coach").
//                      Absent = aucune permission. Décide de l'espace coach.
//   . `playerStatus` : le STATUT DE JOUEUR ("active" | "inactive"), c'est-à-dire
//                      « cette personne a-t-elle un suivi sportif dans ce
//                      club ? ». Absent = elle n'en a jamais eu ici.
//
// LES DEUX PEUVENT COEXISTER : un entraîneur-joueur — cas courant en club
// amateur — porte `accessRole: "coach"` ET `playerStatus: "active"`. L'ancien
// champ unique `role` (owner/coach/player/removed) a disparu : c'est sa fusion
// des deux axes qui faisait qu'obtenir l'encadrement effaçait le fait d'être
// joueur.
//
// L'INVARIANT PROPRIÉTAIRE, mot pour mot : « un propriétaire est autorisé
// uniquement si ownerUid le désigne ET s'il possède encore une appartenance
// active avec le rôle propriétaire ».

export const CLUB_ACCESS_ROLE_OWNER = "owner";
export const CLUB_ACCESS_ROLE_COACH = "coach";

/**
 * Les permissions d'encadrement, de la plus large à la plus étroite. Il n'y a
 * PAS de valeur « aucune » : l'absence de permission est l'absence de champ, ce
 * qui rend impossible d'écrire « aucune » par erreur là où on attendait un rôle.
 */
export const CLUB_ACCESS_ROLES = [CLUB_ACCESS_ROLE_OWNER, CLUB_ACCESS_ROLE_COACH] as const;

export type ClubAccessRole = (typeof CLUB_ACCESS_ROLES)[number];

export const PLAYER_STATUS_ACTIVE = "active";
export const PLAYER_STATUS_INACTIVE = "inactive";

export const CLUB_PLAYER_STATUSES = [PLAYER_STATUS_ACTIVE, PLAYER_STATUS_INACTIVE] as const;

export type ClubPlayerStatus = (typeof CLUB_PLAYER_STATUSES)[number];

/** Permission reconnue, ou `null` (absente, mal typée, inconnue) — default-deny. */
export function normalizeAccessRole(value: unknown): ClubAccessRole | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  return (CLUB_ACCESS_ROLES as readonly string[]).includes(raw) ? (raw as ClubAccessRole) : null;
}

/** Statut reconnu, ou `null` (absent, mal typé, inconnu) — default-deny. */
export function normalizePlayerStatus(value: unknown): ClubPlayerStatus | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  return (CLUB_PLAYER_STATUSES as readonly string[]).includes(raw)
    ? (raw as ClubPlayerStatus)
    : null;
}

/** Cette valeur d'`accessRole` donne-t-elle l'encadrement ? (owner OU coach) */
export function isClubStaffRole(value: unknown): boolean {
  return normalizeAccessRole(value) !== null;
}

/** Ce `playerStatus` décrit-il un suivi sportif ACTIF dans ce club ? */
export function isActivePlayerStatus(value: unknown): boolean {
  return normalizePlayerStatus(value) === PLAYER_STATUS_ACTIVE;
}

/**
 * Appartenance ACTIVE : encadrement OU suivi actif. Miroir de `isActiveMember`
 * (règles) et `isActiveMembership` (serveur). Une pierre tombale — les deux
 * fermés — n'en est pas une.
 */
export function isActiveClubMembership(params: {
  accessRole: unknown;
  playerStatus: unknown;
}): boolean {
  return isClubStaffRole(params.accessRole) || isActivePlayerStatus(params.playerStatus);
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
  /** clubs/{clubId}/members/{uid}.accessRole tel que lu. */
  myAccessRole: unknown;
  /** uid du compte connecté. */
  uid: unknown;
}): ClubOwnerAuthority {
  const owner = typeof params.ownerUid === "string" ? params.ownerUid.trim() : "";
  const me = typeof params.uid === "string" ? params.uid.trim() : "";
  const designated = owner !== "" && me !== "" && owner === me;
  const holdsRole = normalizeAccessRole(params.myAccessRole) === CLUB_ACCESS_ROLE_OWNER;

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
 * DEUX AXES, DEUX PHRASES. Le statut affiché combine désormais la permission
 * d'encadrement ET le statut de joueur : dire « Encadrant du club » à un
 * entraîneur-joueur serait une demi-vérité, et c'est précisément la demi-vérité
 * que ce lot supprime du modèle de données.
 *
 * Cette fonction n'accorde aucun droit — elle dit la vérité, et elle enlève un
 * bouton plutôt que de laisser une erreur l'expliquer.
 */
export function clubMembershipCopy(params: {
  accessRole: unknown;
  playerStatus: unknown;
}): {
  /** Ligne d'état sous le nom du club. */
  statut: string;
  /** Pastille de rôle. */
  badge: string;
  /** Le départ volontaire est-il possible ? (le serveur reste seul juge) */
  peutQuitter: boolean;
  /** Pourquoi il ne l'est pas, et quel geste faire. `null` s'il l'est. */
  empechement: string | null;
} {
  const joueur = isActivePlayerStatus(params.playerStatus);

  switch (normalizeAccessRole(params.accessRole)) {
    case CLUB_ACCESS_ROLE_OWNER:
      return {
        statut: joueur ? "Propriétaire du club, et joueur de l'effectif" : "Propriétaire du club",
        badge: joueur ? "Propriétaire-joueur" : "Propriétaire",
        peutQuitter: false,
        empechement:
          "Tu es propriétaire de ce club. Pour le quitter, la propriété doit d'abord être transférée à un autre membre — contacte le support FKS.",
      };
    case CLUB_ACCESS_ROLE_COACH:
      return {
        statut: joueur ? "Encadrant du club, et joueur de l'effectif" : "Encadrant du club",
        badge: joueur ? "Encadrant-joueur" : "Encadrant",
        peutQuitter: true,
        empechement: null,
      };
    default:
      // Aucune permission d'encadrement. On ne promet aucun statut particulier,
      // et le départ volontaire reste offert (le serveur tranche).
      return {
        statut: joueur ? "Joueur de l'effectif" : "Membre du club",
        badge: joueur ? "Joueur" : "Membre",
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
