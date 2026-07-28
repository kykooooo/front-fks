// functions/src/clubMembers.ts
//
// LES TROIS FORMES DE RETRAIT — coeur metier PUR.
//
// ─── POURQUOI TROIS GESTES ET NON UN ────────────────────────────────────────
// Depuis la separation des permissions d'encadrement et du statut de joueur
// (clubAuthority.ts), « retirer un membre » est devenu AMBIGU. Pour un
// entraineur-joueur — le cas courant en club amateur — il faut pouvoir
// distinguer trois intentions qui n'ont rien a voir :
//
//   1. ARRETER SON SUIVI DE JOUEUR (`deactivateClubPlayer`) : il ne joue plus,
//      mais il continue d'encadrer. `playerStatus` -> "inactive". Ses
//      permissions d'encadrement ne sont PAS nommees dans l'ecriture, donc pas
//      touchees : il garde son espace Coach.
//   2. REVOQUER SES PERMISSIONS D'ENCADREMENT (`revokeClubStaffAccess`) : il
//      n'est plus entraineur, mais il reste joueur de l'effectif.
//      `accessRole` -> null. `playerStatus` n'est PAS nomme : son suivi
//      continue, sa fiche reste dans l'effectif suivi.
//   3. LE RETIRER COMPLETEMENT (`removeClubMember`) : les DEUX axes fermes, la
//      projection purgee, et le club detache de son profil.
//
// Exigence de Kyllian, mot pour mot : « ces trois actions NE DOIVENT PAS
// produire la meme transaction ». C'est structurel ici, pas conventionnel :
// TROIS fonctions, TROIS corps de transaction, TROIS callables. Il n'existe
// aucun parametre d'action venu du client — donc rien a valider, rien a
// usurper : le geste est choisi par le POINT D'ENTREE, que le runtime callable
// route lui-meme. Un drapeau dans la charge utile aurait fait exactement
// l'inverse : une transaction commune modulee par une valeur cliente.
//
// Ce que les trois PARTAGENT, en revanche, est ecrit une seule fois
// (`lireEtAutoriser`) : l'ordre des lectures, le predicat d'autorite, la
// protection du proprietaire et la matrice acteur x cible. Trois copies de ce
// socle auraient ete trois endroits ou se tromper.
//
// ─── LA MATRICE ACTEUR x CIBLE, UNE SEULE REGLE POUR LES TROIS ──────────────
//   . cible SANS permission d'encadrement -> tout encadrant du club, ou la
//     personne elle-meme ;
//   . cible AVEC permission d'encadrement -> le PROPRIETAIRE autorise, ou la
//     personne elle-meme.
//
// Pourquoi un coach ne touche pas a un autre coach : ce serait une escalade
// LATERALE — deux encadrants pourraient se verrouiller mutuellement hors du
// club, et le premier a appuyer gagnerait. La composition de l'encadrement a un
// seul responsable, le proprietaire. Se retirer SOI-MEME reste toujours permis :
// c'est une reduction de ses propres droits, jamais une prise de pouvoir.
//
// ─── ET UN QUATRIEME GESTE, QUI VA DANS L'AUTRE SENS ────────────────────────
// `enrollSelfAsClubPlayer` (« Je m'entraine aussi ») ACTIVE le statut de joueur
// de l'appelant, uniquement sur lui-meme. C'est l'exact inverse du geste 1
// ci-dessus, et il obeit aux memes deux regles structurelles :
//   . il ne NOMME PAS `accessRole` dans son ecriture, donc il ne peut pas le
//     changer — un encadrant ne perd rien en devenant joueur ;
//   . il n'accepte AUCUN identifiant de cible. Sa signature n'a pas de
//     `memberUid` : le geste ne peut pas etre pointe vers quelqu'un d'autre.
// Le raisonnement complet (autorisation d'acces alignee sur le rattachement par
// code, projection laissee au projecteur) est en tete de la section « Geste 4 ».
//
// ─── LE PIEGE DU PROPRIETAIRE : DEUX GESTES SUR QUATRE ──────────────────────
// OWNER_TRANSFER_REQUIRED protege ce qui ferait perdre au club son
// proprietaire : la revocation de son encadrement, et son retrait complet. Il
// NE protege PAS le troisieme : un proprietaire qui arrete de jouer
// (`deactivateClubPlayer` sur lui-meme) ne transfere pas son club pour autant —
// un president qui raccroche les crampons reste president. Les trois cas sont
// testes nommement.
//
// ─── LA REGLE DE PROJECTION QUI GOUVERNE TOUT CA ────────────────────────────
// « Le projecteur suit UNIQUEMENT le statut joueur, puis applique
//   l'autorisation d'acces. Les permissions d'encadrement ne rendent JAMAIS une
//   fiche consultable. » (projector.ts, verrouille par test)
// C'est ce qui fait qu'arreter le suivi supprime la fiche, et que revoquer
// l'encadrement ne la touche pas.
//
// ─── RETRAIT COMPLET (le geste historique) ──────────────────────────────────
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
//     statut de joueur qui n'est plus "active" et supprime AUSSI — mais en plus,
//     la lecture coach est fermee par TROIS verrous independants (statut de
//     joueur, coachAccess, appartenance active). On ne depend d'aucun ordre
//     d'evenements.
//  2. "double retrait" et "membre absent" doivent se distinguer. Sans trace, le
//     second retrait d'un joueur ressemble a un retrait de quelqu'un qui n'a
//     jamais ete la : deux situations differentes, deux reponses differentes.
//  3. L'audit. `removedAt` / `removedBy` sont les SEULES traces conservees, et
//     elles ne disent rien du joueur : ni nom, ni seance, ni donnee de suivi.
//     Son historique sportif personnel (users/{uid} et ses sous-collections)
//     n'est JAMAIS touche — le retrait du club n'est pas une suppression de
//     compte, et le libelle affiche au coach le dit mot pour mot.
//
// ─── LE RETRAIT FERME LES DEUX AXES, EXPLICITEMENT ──────────────────────────
// Depuis la separation des permissions d'encadrement et du statut de joueur
// (clubAuthority.ts), une appartenance porte DEUX choses. Retirer quelqu'un qui
// n'en fermerait qu'une laisserait soit un encadrant sans effectif, soit — bien
// pire — un suivi sportif toujours projete vers un club qu'on vient de quitter.
// Le retrait ecrit donc les deux, dans la meme ecriture :
//
//   . permissions d'encadrement -> `accessRole: null`
//                             => `isClubStaff` faux : plus d'effectif, plus de
//                                note privee, plus de cadre de semaine.
//   . statut de joueur      -> `playerStatus: "inactive"`
//                             => `isActivePlayer` faux : le projecteur refuse de
//                                reconstruire, et `isPlayerMember` (regles) rend
//                                toute projection residuelle illisible.
//   . appartenance          -> les deux etant fermes, `isActiveMember` est faux :
//                                le club, le cadre de semaine et la directive
//                                deviennent illisibles pour lui.
//   . acces coach associe   -> coachAccess "revoked"
//                             => `isCoachAccessGranted` faux (default-deny).
//   . projection existante  -> supprimee dans la MEME transaction.
//   . references / caches   -> users/{playerUid}.clubId remis a null (uniquement
//                             s'il pointe encore vers CE club), donc plus de club
//                             fantome dans les reglages du joueur, et
//                             `clubIdOfUser` (triggers.ts) ne renvoie plus rien.
//
// Il n'existe PLUS de valeur "removed" : l'etat retire, c'est l'absence des deux
// axes. C'est ce qui rend impossible d'en oublier un — il n'y a pas d'etiquette
// unique a poser qui pourrait laisser l'autre champ derriere elle.
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
  ACCESS_ROLE_FIELD,
  PLAYER_STATUS_ACTIVE,
  PLAYER_STATUS_FIELD,
  PLAYER_STATUS_INACTIVE,
  clubAuthoritySignal,
  hasOwnerMembership,
  isActiveMembership,
  isActivePlayer,
  isClubStaff,
  isDesignatedOwner,
  resolveOwnerAuthority,
  type ClubAuthoritySignal,
} from "./clubAuthority";
import {
  COACH_ACCESS_FIELD,
  initialCoachAccess,
  isCoachAccessGranted,
  normalizeCoachAccess,
  type CoachAccessState,
} from "./coachAccess";
import { JOIN_ACCESS_POLICY_FIELD } from "./joinAccessPolicy";

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

// ─── Les gestes, nommes une seule fois ──────────────────────────────────────

/**
 * Les gestes qui VISENT UN MEMBRE DESIGNE. Trois retraits, trois transactions,
 * et une matrice acteur x cible qui peut refuser (`STAFF_OWNER_ONLY`).
 */
export type ClubMemberTargetedGesture =
  | "removeClubMember"
  | "deactivateClubPlayer"
  | "revokeClubStaffAccess";

/**
 * Tous les gestes. Ce type ne traverse JAMAIS le reseau : il n'est pas un
 * parametre d'appel, c'est le nom interne du chemin d'ecriture. Chaque geste a
 * sa propre callable, donc son propre point d'entree — un client ne « choisit »
 * pas un geste dans une charge utile, il appelle une fonction ou une autre.
 *
 * `enrollSelfAsClubPlayer` est le SEUL qui ne vise pas une cible : il ne peut
 * porter que sur l'appelant lui-meme (cf. plus bas). C'est ce qui le sort de la
 * matrice acteur x cible, et de la liste `ClubMemberTargetedGesture`.
 */
export type ClubMemberGesture = ClubMemberTargetedGesture | "enrollSelfAsClubPlayer";

/**
 * Refus d'AUTORITE, par geste. Le message dit ce qui est refuse, jamais
 * pourquoi : appelant non encadrant, encadrant d'un autre club, club
 * inexistant, identifiant malforme et etat d'autorite incoherent produisent
 * tous EXACTEMENT le meme objet (cf. `removeDeniedError`).
 */
export const GESTURE_DENIED_MESSAGE: Record<ClubMemberGesture, string> = {
  removeClubMember: REMOVE_DENIED_MESSAGE,
  deactivateClubPlayer:
    "Arret du suivi impossible : cette action demande d'etre encadrant de ce club.",
  revokeClubStaffAccess:
    "Retrait des acces d'encadrement impossible : cette action demande d'etre encadrant de ce club.",
  // Ici, « ce club » n'apprend rien : seul quelqu'un qui possede deja une
  // appartenance ACTIVE atteint le succes, et tous les autres cas — club
  // inexistant, club d'autrui, autorite incoherente — rendent cette phrase-ci,
  // a l'identique.
  enrollSelfAsClubPlayer:
    "Activation impossible : cette action demande d'etre membre actif de ce club.",
};

/** Panne du magasin, par geste. Meme code, meme absence d'information. */
export const GESTURE_UNAVAILABLE_MESSAGE: Record<ClubMemberGesture, string> = {
  removeClubMember: REMOVE_UNAVAILABLE_MESSAGE,
  deactivateClubPlayer: "L'arret du suivi est momentanement indisponible. Reessaie.",
  revokeClubStaffAccess:
    "Le retrait des acces d'encadrement est momentanement indisponible. Reessaie.",
  enrollSelfAsClubPlayer:
    "L'activation de ton suivi est momentanement indisponible. Reessaie.",
};

/**
 * Protection du proprietaire, par geste. Le jeton machine est le MEME
 * (OWNER_TRANSFER_REQUIRED) : le front n'a qu'une chose a reconnaitre, et le
 * geste a faire est identique dans les deux cas. Seule la phrase change, parce
 * qu'elle nomme ce qui vient d'etre refuse.
 *
 * `deactivateClubPlayer` n'y figure PAS, et c'est le coeur de ce lot : arreter
 * le suivi de joueur d'un proprietaire ne lui retire aucun droit sur le club.
 */
export const OWNER_TRANSFER_MESSAGE_PAR_GESTE: Record<
  "removeClubMember" | "revokeClubStaffAccess",
  string
> = {
  removeClubMember: OWNER_TRANSFER_MESSAGE,
  revokeClubStaffAccess:
    "Impossible de retirer les acces d'encadrement du proprietaire du club. Transfere d'abord la propriete a un autre encadrant.",
};

/**
 * Jeton d'echec TYPE de la matrice acteur x cible : la cible fait partie de
 * l'ENCADREMENT, et l'appelant n'est ni le proprietaire ni la personne
 * concernee.
 *
 * Ce refus est PARLANT — il nomme le geste a faire — et ce n'est pas un oracle :
 * seul un encadrant de CE club l'atteint, et les regles Firestore lui donnent
 * deja la lecture complete de `members` (il sait donc qui encadre). Il n'apprend
 * rien qu'il ne puisse lire.
 */
export const STAFF_OWNER_ONLY = "STAFF_OWNER_ONLY";

export const STAFF_OWNER_ONLY_CODE: ClubMemberErrorCode = "failed-precondition";

/**
 * Restreint aux gestes QUI VISENT UNE CIBLE. Un geste qui ne peut porter que
 * sur soi-meme n'atteint jamais la matrice : lui inventer une phrase serait du
 * texte mort, et surtout un message qu'aucun test ne pourrait provoquer.
 */
export const STAFF_OWNER_ONLY_MESSAGE: Record<ClubMemberTargetedGesture, string> = {
  removeClubMember:
    "Ce compte fait partie de l'encadrement du club. Seul le proprietaire peut le retirer.",
  deactivateClubPlayer:
    "Ce compte fait partie de l'encadrement du club. Seul le proprietaire peut arreter son suivi de joueur.",
  revokeClubStaffAccess:
    "Seul le proprietaire du club peut retirer les acces d'encadrement d'un autre encadrant.",
};

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

/** Meme refus, pour un geste donne. `reason` reste ignore, pour la meme raison. */
export function gestureDeniedError(
  geste: ClubMemberGesture,
  _reason: RemoveDenialReason,
): ClubMemberError {
  return new ClubMemberError(REMOVE_DENIED_CODE, GESTURE_DENIED_MESSAGE[geste]);
}

export function ownerTransferRequiredError(
  geste: "removeClubMember" | "revokeClubStaffAccess" = "removeClubMember",
): ClubMemberError {
  return new ClubMemberError(
    OWNER_TRANSFER_CODE,
    OWNER_TRANSFER_MESSAGE_PAR_GESTE[geste],
    OWNER_TRANSFER_REQUIRED,
  );
}

export function staffOwnerOnlyError(geste: ClubMemberTargetedGesture): ClubMemberError {
  return new ClubMemberError(
    STAFF_OWNER_ONLY_CODE,
    STAFF_OWNER_ONLY_MESSAGE[geste],
    STAFF_OWNER_ONLY,
  );
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

// ─── Traces d'audit, nommees une seule fois ─────────────────────────────────
//
// Chaque geste pose SA PROPRE trace. Trois paires de champs plutot qu'une seule,
// parce qu'un journal qui melangerait « retire du club » et « ne joue plus » ne
// permettrait plus de dire lequel des trois gestes a eu lieu — et c'est
// exactement la distinction que ce lot introduit.

/** Retrait COMPLET. Les seules traces conservees, et elles ne disent rien du joueur. */
export const REMOVED_AT_FIELD = "removedAt";
export const REMOVED_BY_FIELD = "removedBy";

/** Arret du SUIVI DE JOUEUR. */
export const PLAYER_DEACTIVATED_AT_FIELD = "playerDeactivatedAt";
export const PLAYER_DEACTIVATED_BY_FIELD = "playerDeactivatedBy";

/** Revocation des PERMISSIONS D'ENCADREMENT. */
export const STAFF_REVOKED_AT_FIELD = "staffRevokedAt";
export const STAFF_REVOKED_BY_FIELD = "staffRevokedBy";

/**
 * ACTIVATION VOLONTAIRE DE SON PROPRE SUIVI DE JOUEUR.
 *
 * UN SEUL CHAMP, et pas de `...By`. Les trois retraits portent un auteur parce
 * qu'un tiers peut les declencher ; celui-ci ne peut venir que du titulaire de
 * l'appartenance (`memberUid` vaut toujours `actorUid`, cf. plus bas). Un champ
 * qui ne peut porter qu'une seule valeur connue d'avance n'apprend rien a la
 * relecture — il donnerait juste l'illusion qu'un tiers aurait pu agir.
 */
export const PLAYER_ENROLLED_AT_FIELD = "playerEnrolledAt";

// ─── Socle commun aux trois gestes ──────────────────────────────────────────

/** Refus possibles, communs aux trois gestes. */
type GestureDenial =
  | { kind: "denied"; reason: RemoveDenialReason; signal: ClubAuthoritySignal | null }
  | { kind: "member-missing" }
  | { kind: "owner-transfer-required" }
  | { kind: "staff-owner-only" };

type GestureOutcome<T> = { ok: true; result: T } | ({ ok: false } & GestureDenial);

type Prelude =
  | {
      ok: true;
      club: MemberDocData;
      /** Appartenance de l'APPELANT. Identique a `target` quand il agit sur lui-meme. */
      actorMembership: MemberDocData | null;
      /** Appartenance de la CIBLE, garantie existante. */
      target: MemberDocData;
      estSoiMeme: boolean;
      /** L'appelant est-il le proprietaire AUTORISE (les deux sources concordent) ? */
      acteurProprietaire: boolean;
    }
  | ({ ok: false } & GestureDenial);

/**
 * LECTURES ET AUTORITE — la partie que les trois gestes partagent, ecrite une
 * seule fois. Elle n'ECRIT RIEN : elle lit, elle juge, elle rend la matiere.
 *
 * L'ORDRE FAIT PARTIE DU CONTRAT :
 *   a. le club existe (sinon : MEME refus que « pas encadrant » — le distinguer
 *      apprendrait a un curieux qu'un identifiant de club existe) ;
 *   b. autorite de l'appelant SUR CE CLUB, AVANT toute lecture de la cible
 *      (anti-oracle, cf. en-tete de fichier) ;
 *   c. existence reelle de la cible dans CE club ;
 *   d. protection du proprietaire, quand le geste la demande ;
 *   e. matrice acteur x cible : une cible ENCADRANTE n'est touchee que par le
 *      proprietaire, ou par elle-meme.
 *
 * ─── L'ANTI-ORACLE SURVIT A L'AUTORISATION « SOI-MEME » ────────────────────
 * Ouvrir les gestes a « soi-meme » aurait pu rouvrir une fuite : un inconnu
 * aurait pu distinguer « ce club n'existe pas » (refus d'autorite) de « ce club
 * existe mais je n'y suis pas » (cible absente), et donc ENUMERER les clubs.
 * C'est ferme par construction : un appelant qui n'est pas encadrant n'est
 * autorise que si son PROPRE document d'appartenance existe, et dans ce cas la
 * cible EST ce document. Le refus « membre absent » n'est donc atteignable que
 * par un encadrant de ce club, a propos d'un uid lu dans son propre effectif.
 */
async function lireEtAutoriser(
  tx: MemberTx,
  params: {
    geste: ClubMemberGesture;
    clubId: string;
    actorUid: string;
    memberUid: string;
    /** Le geste retire-t-il au proprietaire ce qui fait de lui un proprietaire ? */
    protegeProprietaire: boolean;
  },
): Promise<Prelude> {
  const { geste, clubId, actorUid, memberUid } = params;

  // a. Le club existe.
  const club = await tx.get(memberPaths.club(clubId));
  if (!club) return { ok: false, kind: "denied", reason: "club-missing", signal: null };

  const actorMembership = await tx.get(memberPaths.member(clubId, actorUid));

  // b. AUTORITE. Verifiee AVANT de toucher a la cible.
  const authority = resolveOwnerAuthority(club, actorMembership, actorUid);
  const signal = clubAuthoritySignal({ clubId, uid: actorUid, action: geste }, authority);
  if (signal) {
    // Etat incoherent : on REFUSE et on signale. Ne pas trancher entre les deux
    // sources est le coeur de l'invariant ; laisser passer un geste destructeur
    // sur un club dont l'autorite est douteuse le contredirait.
    return { ok: false, kind: "denied", reason: "authority-inconsistent", signal };
  }

  const acteurEncadrant = isClubStaff(actorMembership);
  const estSoiMeme = actorUid === memberUid;
  // Un encadrant de CE club, ou quelqu'un qui agit sur sa PROPRE appartenance
  // EXISTANTE. Un encadrant d'un AUTRE club n'a par construction aucun
  // membership ici, et un inconnu n'en a nulle part.
  if (!acteurEncadrant && !(estSoiMeme && actorMembership !== null)) {
    return { ok: false, kind: "denied", reason: "not-staff", signal: null };
  }

  // c. La cible appartient-elle REELLEMENT a ce club ? Sur le chemin
  //    « soi-meme », la cible EST l'appartenance de l'appelant : on la reutilise
  //    plutot que de la relire, ce qui interdit toute divergence entre les deux
  //    lectures d'un meme document.
  const target = estSoiMeme
    ? actorMembership
    : await tx.get(memberPaths.member(clubId, memberUid));
  if (!target) return { ok: false, kind: "member-missing" };

  // d. PROTECTION DU PROPRIETAIRE. Volontairement LARGE : l'une OU l'autre des
  //    deux sources suffit a declencher le refus. Sur un etat coherent les deux
  //    disent la meme chose ; sur un etat abime, refuser reste le seul geste sur
  //    — on ne veut surtout pas qu'une incoherence devienne le chemin par lequel
  //    un club perd son proprietaire.
  if (
    params.protegeProprietaire &&
    (isDesignatedOwner(club, memberUid) || hasOwnerMembership(target))
  ) {
    return { ok: false, kind: "owner-transfer-required" };
  }

  const acteurProprietaire = authority === "authorized";

  // e. MATRICE ACTEUR x CIBLE. Toucher a l'appartenance d'un ENCADRANT demande
  //    d'etre le proprietaire — ou d'etre cet encadrant. Un coach qui degraderait
  //    un autre coach serait une escalade laterale : le premier a appuyer
  //    gagnerait.
  if (!estSoiMeme && isClubStaff(target) && !acteurProprietaire) {
    return { ok: false, kind: "staff-owner-only" };
  }

  return { ok: true, club, actorMembership, target, estSoiMeme, acteurProprietaire };
}

/**
 * Traduction UNIQUE d'un refus en erreur publique, et signalement eventuel.
 * Appelee HORS transaction : un rejeu pour contention ne doit pas multiplier les
 * lignes de journal.
 */
function throwGestureDenial(
  deps: ClubMemberDeps,
  geste: ClubMemberGesture,
  failure: GestureDenial,
): never {
  if (failure.kind === "member-missing") {
    throw new ClubMemberError(MEMBER_NOT_FOUND_CODE, MEMBER_NOT_FOUND_MESSAGE);
  }
  if (failure.kind === "owner-transfer-required") {
    // Inatteignable pour `deactivateClubPlayer` (il ne demande jamais la
    // protection) — le repli garde le type honnete sans inventer de message.
    throw ownerTransferRequiredError(
      geste === "revokeClubStaffAccess" ? "revokeClubStaffAccess" : "removeClubMember",
    );
  }
  if (failure.kind === "staff-owner-only") {
    // STRUCTURELLEMENT INATTEIGNABLE pour l'activation du suivi : la matrice
    // n'est evaluee que `!estSoiMeme`, et ce geste force `memberUid = actorUid`.
    // On ne fabrique donc AUCUN message pour lui — on retombe sur son refus
    // generique, celui qu'il rend deja pour toutes ses autres impossibilites.
    if (geste === "enrollSelfAsClubPlayer") throw gestureDeniedError(geste, "not-staff");
    throw staffOwnerOnlyError(geste);
  }

  if (failure.signal) deps.onInconsistency?.(failure.signal);
  throw gestureDeniedError(geste, failure.reason);
}

/**
 * Enveloppe commune : forme des identifiants, transaction, traduction des
 * pannes. Le CORPS de la transaction, lui, est propre a chaque geste — c'est
 * exactement ce que Kyllian exige (« ces trois actions ne doivent pas produire
 * la meme transaction »).
 */
async function executerGeste<T>(
  deps: ClubMemberDeps,
  params: { geste: ClubMemberGesture; actorUid: string; clubId: unknown; memberUid: unknown },
  corps: (
    tx: MemberTx,
    contexte: { clubId: string; memberUid: string; actorUid: string; now: number },
  ) => Promise<GestureOutcome<T>>,
): Promise<T> {
  const geste = params.geste;
  const actorUid = String(params.actorUid ?? "").trim();
  if (!actorUid) throw new ClubMemberError("unauthenticated", "Connexion requise.");

  if (!isPlausibleId(params.clubId)) throw gestureDeniedError(geste, "malformed-club-id");
  if (!isPlausibleId(params.memberUid)) throw gestureDeniedError(geste, "malformed-member-id");
  const clubId = params.clubId.trim();
  const memberUid = params.memberUid.trim();

  const now = deps.now();

  let outcome: GestureOutcome<T>;
  try {
    outcome = await deps.store.runTransaction<GestureOutcome<T>>((tx) =>
      corps(tx, { clubId, memberUid, actorUid, now }),
    );
  } catch (err) {
    if (err instanceof ClubMemberError) throw err;
    throw new ClubMemberError(REMOVE_UNAVAILABLE_CODE, GESTURE_UNAVAILABLE_MESSAGE[geste]);
  }

  if (outcome.ok) return outcome.result;
  throwGestureDenial(deps, geste, outcome);
}

// ─── Geste 1 : RETRAIT COMPLET ──────────────────────────────────────────────

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
  return executerGeste<RemoveMemberResult>(
    deps,
    { geste: "removeClubMember", ...params },
    async (tx, { clubId, memberUid, actorUid, now }) => {
      const prelude = await lireEtAutoriser(tx, {
        geste: "removeClubMember",
        clubId,
        actorUid,
        memberUid,
        // LE GESTE RETIRE SES POUVOIRS AU PROPRIETAIRE : la protection s'applique.
        protegeProprietaire: true,
      });
      if (!prelude.ok) return prelude;

      // Idempotence : deja retire -> AUCUNE ecriture, succes annonce comme tel.
      // « Deja retire » se lit sur l'ETAT (les deux axes fermes), jamais sur la
      // presence de `removedAt` : c'est l'etat qui refuse, pas la trace.
      if (!isActiveMembership(prelude.target)) {
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
      //
      //    LES DEUX AXES SONT FERMES ICI, NOMMEMENT. `accessRole: null` retire
      //    l'encadrement ; `playerStatus: "inactive"` retire le suivi. Ecrire
      //    `null` plutot que de supprimer le champ est deliberé : la valeur
      //    reste LISIBLE (donc auditable), et `normalizeAccessRole(null)` vaut
      //    `null` — exactement le meme verdict qu'un champ absent.
      tx.set(
        memberPaths.member(clubId, memberUid),
        {
          uid: memberUid,
          [ACCESS_ROLE_FIELD]: null,
          [PLAYER_STATUS_FIELD]: PLAYER_STATUS_INACTIVE,
          // Troisieme verrou, independant des deux autres : meme si une lecture
          // future oubliait de regarder l'un des axes, l'acces reste ferme
          // (default-deny).
          [COACH_ACCESS_FIELD]: "revoked",
          [REMOVED_AT_FIELD]: now,
          [REMOVED_BY_FIELD]: actorUid,
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. Projection deja produite : supprimee ici meme. Ne pas dependre du
      //    trigger pour cette suppression est deliberé — un trigger est
      //    asynchrone, et la donnee doit disparaitre avec le geste.
      tx.delete(memberPaths.playerSummary(clubId, memberUid));

      // 3. Reference du joueur vers son club. C'est le SEUL des trois gestes qui
      //    la touche : les deux gestes partiels laissent la personne DANS le
      //    club, donc son profil doit continuer de le designer. Sans ce
      //    nettoyage-ci, un membre reellement parti garderait un club fantome
      //    dans ses reglages, et `clubIdOfUser` (triggers.ts) continuerait de
      //    designer ce club a chaque seance enregistree.
      if (clearedUserClub) {
        tx.set(memberPaths.user(memberUid), { clubId: null, updatedAt: now }, { merge: true });
      }

      return {
        ok: true,
        result: { clubId, memberUid, alreadyRemoved: false, clearedUserClub },
      };
    },
  );
}

// ─── Geste 2 : ARRETER LE SUIVI DE JOUEUR ───────────────────────────────────

export type DeactivatePlayerResult = {
  clubId: string;
  memberUid: string;
  /**
   * `true` si le suivi etait DEJA arrete (rejeu du geste). Aucune ecriture, et
   * la trace du premier arret n'est pas reecrite.
   */
  alreadyInactive: boolean;
  /**
   * La personne CONSERVE-t-elle des permissions d'encadrement apres ce geste ?
   * Expose pour que l'ecran puisse DIRE ce qui est conserve — jamais pour en
   * deduire un droit (le serveur reste seul juge, a chaque appel).
   */
  keepsStaffAccess: boolean;
};

/**
 * ARRETE LE SUIVI SPORTIF d'un membre, sans toucher a son encadrement.
 *
 * CE QU'IL FERME : `playerStatus` -> "inactive" (donc plus de projection, et
 * `isPlayerMember` rend illisible toute projection residuelle) et `coachAccess`
 * -> "revoked" (troisieme verrou, default-deny, exactement comme au retrait
 * complet). La projection deja produite est supprimee DANS la transaction.
 *
 * CE QU'IL CONSERVE, ET C'EST TOUT L'INTERET : `accessRole` n'est PAS nomme dans
 * l'ecriture — un `merge` qui ne le nomme pas ne peut pas le changer. Un
 * entraineur-joueur garde donc integralement son espace Coach. `users/{uid}.clubId`
 * n'est pas touche non plus : la personne reste membre du club.
 *
 * CE QU'IL N'EXIGE PAS, ET C'EST LE PIEGE DE CE LOT : aucune protection du
 * proprietaire. Un president qui arrete de jouer ne transfere pas son club.
 *
 * CONSEQUENCE ASSUMEE, la meme qu'au retrait complet : `coachAccess: "revoked"`
 * survit a un futur rattachement (`resolveCoachAccess` conserve tout etat deja
 * pose, cf. coachAccess.ts). Une personne dont on a arrete le suivi puis qui
 * ressaisit un code d'invitation redevient joueuse SANS redevenir consultable —
 * il faudra une decision explicite. Ce n'est pas un effet nouveau de ce lot :
 * c'est exactement le comportement du retrait complet depuis son origine.
 */
export async function deactivateClubPlayer(
  deps: ClubMemberDeps,
  params: { actorUid: string; clubId: unknown; memberUid: unknown },
): Promise<DeactivatePlayerResult> {
  return executerGeste<DeactivatePlayerResult>(
    deps,
    { geste: "deactivateClubPlayer", ...params },
    async (tx, { clubId, memberUid, actorUid, now }) => {
      const prelude = await lireEtAutoriser(tx, {
        geste: "deactivateClubPlayer",
        clubId,
        actorUid,
        memberUid,
        // AUCUNE PROTECTION DU PROPRIETAIRE. Ce geste ne retire aucun pouvoir sur
        // le club : il n'y a donc rien a transferer d'abord.
        protegeProprietaire: false,
      });
      if (!prelude.ok) return prelude;

      const keepsStaffAccess = isClubStaff(prelude.target);

      // Idempotence : aucun suivi actif -> AUCUNE ecriture.
      if (!isActivePlayer(prelude.target)) {
        return {
          ok: true,
          result: { clubId, memberUid, alreadyInactive: true, keepsStaffAccess },
        };
      }

      // ── Ecritures ──────────────────────────────────────────────────────────
      // 1. UN SEUL AXE BOUGE. `accessRole` est absent de cette ecriture, donc
      //    intact. `coachAccess` accompagne le statut : les deux parlent du meme
      //    sujet — la consultation du suivi — et les separer laisserait un verrou
      //    ouvert derriere l'autre.
      tx.set(
        memberPaths.member(clubId, memberUid),
        {
          uid: memberUid,
          [PLAYER_STATUS_FIELD]: PLAYER_STATUS_INACTIVE,
          [COACH_ACCESS_FIELD]: "revoked",
          [PLAYER_DEACTIVATED_AT_FIELD]: now,
          [PLAYER_DEACTIVATED_BY_FIELD]: actorUid,
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. La fiche de suivi disparait AVEC le geste, pas quand un trigger
      //    voudra bien passer. Une reprojection ulterieure relira le statut et
      //    renverra `null` : le refus vient de l'ETAT, pas d'une course.
      tx.delete(memberPaths.playerSummary(clubId, memberUid));

      return {
        ok: true,
        result: { clubId, memberUid, alreadyInactive: false, keepsStaffAccess },
      };
    },
  );
}

// ─── Geste 3 : REVOQUER LES PERMISSIONS D'ENCADREMENT ───────────────────────

export type RevokeStaffAccessResult = {
  clubId: string;
  memberUid: string;
  /** `true` si la personne n'avait DEJA plus d'encadrement (rejeu). Zero ecriture. */
  alreadyRevoked: boolean;
  /**
   * La personne CONSERVE-t-elle un suivi sportif actif apres ce geste ? `true`
   * signifie qu'elle reste dans l'effectif suivi comme n'importe quel joueur.
   */
  keepsPlayerStatus: boolean;
};

/**
 * RETIRE LES PERMISSIONS D'ENCADREMENT, sans toucher au suivi sportif.
 *
 * CE QU'IL FERME : `accessRole` -> null. La personne perd l'espace Coach —
 * immediatement, sans reconnexion : `hooks/useAppSpace` est abonne a ce document
 * et la purge de l'etat coach (`state/coachAuthorityGate`) est la CONSEQUENCE
 * MECANIQUE de la perte d'autorite, pas un appel separe qu'on pourrait oublier.
 *
 * CE QU'IL CONSERVE : `playerStatus` et `coachAccess` ne sont PAS nommes dans
 * l'ecriture. La projection n'est PAS supprimee. Un entraineur-joueur reste donc
 * dans l'effectif suivi, avec sa fiche, exactement comme avant — c'est la
 * moitie du contrat que le retrait unique ne savait pas exprimer.
 *
 * QUI PEUT LE FAIRE : le proprietaire, ou la personne elle-meme (demission). Un
 * coach ne degrade pas un autre coach (cf. la matrice, en-tete de fichier).
 *
 * LE PROPRIETAIRE EST PROTEGE : lui retirer l'encadrement fabriquerait un club
 * dont `ownerUid` designe quelqu'un sans appartenance proprietaire — exactement
 * l'etat que l'invariant interdit. Refus TYPE OWNER_TRANSFER_REQUIRED, y compris
 * quand il se le fait a lui-meme.
 */
export async function revokeClubStaffAccess(
  deps: ClubMemberDeps,
  params: { actorUid: string; clubId: unknown; memberUid: unknown },
): Promise<RevokeStaffAccessResult> {
  return executerGeste<RevokeStaffAccessResult>(
    deps,
    { geste: "revokeClubStaffAccess", ...params },
    async (tx, { clubId, memberUid, actorUid, now }) => {
      const prelude = await lireEtAutoriser(tx, {
        geste: "revokeClubStaffAccess",
        clubId,
        actorUid,
        memberUid,
        // LE GESTE RETIRE SES POUVOIRS AU PROPRIETAIRE : transfert d'abord.
        protegeProprietaire: true,
      });
      if (!prelude.ok) return prelude;

      const keepsPlayerStatus = isActivePlayer(prelude.target);

      // Idempotence : plus aucune permission -> AUCUNE ecriture.
      if (!isClubStaff(prelude.target)) {
        return {
          ok: true,
          result: { clubId, memberUid, alreadyRevoked: true, keepsPlayerStatus },
        };
      }

      // ── Ecriture UNIQUE ────────────────────────────────────────────────────
      // Un seul axe, un seul document, et surtout : PAS de suppression de
      // projection. Retirer la fiche d'un entraineur-joueur au motif qu'il n'est
      // plus entraineur reviendrait a lui retirer son suivi pour un geste qui ne
      // parle pas de suivi.
      tx.set(
        memberPaths.member(clubId, memberUid),
        {
          uid: memberUid,
          [ACCESS_ROLE_FIELD]: null,
          [STAFF_REVOKED_AT_FIELD]: now,
          [STAFF_REVOKED_BY_FIELD]: actorUid,
          updatedAt: now,
        },
        { merge: true },
      );

      return {
        ok: true,
        result: { clubId, memberUid, alreadyRevoked: false, keepsPlayerStatus },
      };
    },
  );
}

// ─── Geste 4 : ACTIVER SON PROPRE SUIVI DE JOUEUR ───────────────────────────
//
// « Je m'entraine aussi ». Le geste inverse de `deactivateClubPlayer`, et le
// SEUL de ce fichier qui OUVRE quelque chose au lieu de le fermer. Il est donc
// le seul a devoir justifier chacun de ses verrous, un par un.
//
// ─── POURQUOI IL NE PASSE PAS PAR LE CODE D'INVITATION ──────────────────────
// Techniquement, un encadrant PEUT deja saisir le code de son propre club :
// `joinClubWithInviteCode` pose `playerStatus: "active"` sans nommer
// `accessRole`, donc sans rien lui retirer. C'etait meme, jusqu'ici, le seul
// chemin. Mais demander a un fondateur de generer un code, de le lire, puis de
// le retaper pour entrer dans son propre effectif est une mauvaise experience :
// le code d'invitation existe pour authentifier quelqu'un qui vient de
// DEHORS. Ici, l'appartenance est deja etablie, verifiee, et ecrite par le
// serveur — il n'y a rien a prouver.
//
// ─── CE QU'IL FAIT, ET RIEN D'AUTRE ─────────────────────────────────────────
//   . `playerStatus` -> "active" ;
//   . `coachAccess`  -> l'etat que la POLITIQUE DU CLUB pose a l'entree, ou
//     celui deja pose s'il en existe un valide (voir plus bas) ;
//   . `playerEnrolledAt` -> la date, pour l'audit.
//
// ─── CE QU'IL NE FAIT PAS, ET COMMENT C'EST GARANTI ─────────────────────────
// `accessRole` n'est PAS NOMME dans l'ecriture. Ce n'est pas une garde qu'on
// aurait pu oublier d'ecrire, ni une relecture-reecriture qu'une course pourrait
// prendre en defaut : un `merge` ne peut pas changer un champ dont il ne parle
// pas. Meme mecanique que les trois retraits — c'est la raison pour laquelle
// aucun d'eux ne se marche dessus.
//
// `users/{uid}.clubId` n'est pas nomme non plus : la personne est deja membre de
// ce club, son profil le designe deja (c'est meme ce qui a permis a l'ecran de
// trouver cette appartenance). Il n'y a rien a rattacher.
//
// Aucun autre document n'est touche : ni un autre membre, ni le club, ni une
// projection tierce. La transaction ecrit UN document, celui de l'appelant.
//
// ─── L'AUTORISATION D'ACCES N'EST PAS FORCEE, ELLE EST ALIGNEE ──────────────
// `existingAccess ?? initialCoachAccess(politique du club)` — l'EXPRESSION
// EXACTE du rattachement par code (inviteCodes.ts). C'est un choix, et il se
// defend dans les deux sens :
//
//  . un etat DEJA POSE est conserve tel quel. Une personne dont le suivi avait
//    ete arrete porte `coachAccess: "revoked"` : se reactiver la remet dans
//    l'effectif suivi SANS rouvrir la consultation. Un "pending" reste
//    "pending". Activer le suivi n'a donc jamais l'effet de bord d'ouvrir un
//    acces que quelqu'un avait ferme ;
//  . un etat ABSENT (cas de l'appartenance d'amorçage du proprietaire, ou les
//    regles interdisent a tout client d'ecrire ce champ) recoit l'etat initial
//    de la politique du club : "not_required" en mode par defaut, "pending" en
//    mode `approval_required`.
//
// Autrement dit : MEME CLUB, MEME POLITIQUE, MEME RESULTAT qu'un joueur qui
// rejoint avec un code. Un encadrant qui s'active n'obtient aucun traitement
// plus favorable — et un club en `approval_required` verra son propre
// entraineur-joueur en attente d'approbation, exactement comme ses joueurs.
//
// L'alternative — poser "approved" ou "not_required" en dur au motif que « c'est
// lui-meme, il sait ce qu'il fait » — a ete ecartee : elle aurait fabrique une
// exception d'acces reservee a l'encadrement, c'est-a-dire precisement la
// categorie de personnes dont la fiche est la plus sensible a lire.
//
// ─── LA PROJECTION N'EST PAS ECRITE ICI, ET C'EST VOULU ─────────────────────
// Le retrait SUPPRIME la fiche dans sa transaction, parce qu'une donnee qui doit
// disparaitre ne peut pas attendre un trigger. L'inverse n'est pas vrai : une
// fiche qui doit APPARAITRE peut naitre du recalcul serveur, et elle DOIT en
// naitre — c'est le projecteur (projector.ts) qui detient le contrat coach-safe,
// et lui seul. L'ecriture du membership declenche `onMemberWritten`, qui
// reconstruit ; le projecteur relit alors `playerStatus` PUIS `coachAccess` et
// renvoie `null` si l'un des deux refuse. La fiche n'existe donc que si le
// contrat d'acces l'autorise, sans qu'aucune ligne de ce fichier n'ait a le
// re-decider (donc sans qu'aucune ne puisse le decider differemment).

export type EnrollSelfPlayerResult = {
  clubId: string;
  memberUid: string;
  /**
   * `true` si le suivi etait DEJA actif (rejeu). AUCUNE ecriture n'est emise, et
   * la date d'activation d'origine n'est pas reecrite.
   */
  alreadyActive: boolean;
  /** Etat d'autorisation d'acces EFFECTIF apres le geste (jamais choisi par le client). */
  coachAccess: CoachAccessState;
  /**
   * Cet etat ouvre-t-il la consultation ? Expose pour que l'ecran dise la
   * verite — « ton encadrement verra ta fiche » vs « une etape reste a faire » —
   * jamais pour en deduire un droit : le serveur reste seul juge, a chaque appel.
   */
  coachAccessGranted: boolean;
  /**
   * La personne conserve-t-elle ses permissions d'encadrement ? Toujours `true`
   * pour un encadrant, puisque le geste ne les nomme pas. C'est justement ce
   * qu'on veut pouvoir VERIFIER depuis l'exterieur.
   */
  keepsStaffAccess: boolean;
};

/**
 * ACTIVE LE SUIVI DE JOUEUR DE L'APPELANT, sur son propre club.
 *
 * UNIQUEMENT POUR SOI-MEME, et ce n'est pas une verification : c'est une
 * IMPOSSIBILITE de construction. Cette fonction ne prend AUCUN identifiant de
 * cible — `memberUid` n'existe pas dans sa signature. Il n'y a donc rien a
 * valider, rien a usurper, et aucun champ supplementaire dans une charge utile
 * ne peut deplacer le geste vers quelqu'un d'autre.
 *
 * APPARTENANCE ACTIVE OBLIGATOIRE. Une pierre tombale (les deux axes fermes)
 * n'est PAS une appartenance : sans ce verrou, quelqu'un qu'on vient de retirer
 * du club pourrait se remettre seul dans l'effectif suivi, sans code
 * d'invitation, sans quota, sans expiration — c'est-a-dire contourner tout le
 * contrat d'invitation par la porte de sortie. Le refus emprunte le message
 * « ce membre ne fait pas partie de l'effectif », qui est exactement le fait.
 *
 * AUCUNE PROTECTION DU PROPRIETAIRE : ce geste ne retire aucun pouvoir, il n'y
 * a donc rien a transferer d'abord. Un president qui se remet a s'entrainer
 * reste president — la symetrie exacte de `deactivateClubPlayer`.
 *
 * QUI PEUT L'APPELER : n'importe quel membre ACTIF du club, encadrant ou non.
 * Le bouton produit vit dans l'espace coach, mais la regle serveur ne parle pas
 * d'encadrement — exiger `accessRole` ici ajouterait une condition que rien ne
 * justifie, et refuserait par exemple a un ancien joueur redevenu simple membre
 * de reprendre son suivi.
 */
export async function enrollSelfAsClubPlayer(
  deps: ClubMemberDeps,
  params: { actorUid: string; clubId: unknown },
): Promise<EnrollSelfPlayerResult> {
  return executerGeste<EnrollSelfPlayerResult>(
    deps,
    {
      geste: "enrollSelfAsClubPlayer",
      actorUid: params.actorUid,
      clubId: params.clubId,
      // LA CIBLE EST L'APPELANT, ecrit ici et nulle part ailleurs. Aucune
      // valeur cliente n'entre dans ce parametre.
      memberUid: params.actorUid,
    },
    async (tx, { clubId, memberUid, now }) => {
      const prelude = await lireEtAutoriser(tx, {
        geste: "enrollSelfAsClubPlayer",
        clubId,
        actorUid: memberUid,
        memberUid,
        protegeProprietaire: false,
      });
      if (!prelude.ok) return prelude;

      // APPARTENANCE ACTIVE OBLIGATOIRE. `lireEtAutoriser` garantit que le
      // document EXISTE ; il ne dit rien de son contenu. Une pierre tombale
      // passe donc jusqu'ici, et c'est ce test-ci qui la refuse.
      if (!isActiveMembership(prelude.target)) return { ok: false, kind: "member-missing" };

      const keepsStaffAccess = isClubStaff(prelude.target);
      // MEME EXPRESSION QUE LE RATTACHEMENT PAR CODE (inviteCodes.ts) : etat
      // deja pose conserve, sinon etat initial de la politique du club.
      const existingAccess = normalizeCoachAccess(prelude.target[COACH_ACCESS_FIELD]);
      const coachAccess =
        existingAccess ?? initialCoachAccess(prelude.club[JOIN_ACCESS_POLICY_FIELD]);

      const resultat = (alreadyActive: boolean): EnrollSelfPlayerResult => ({
        clubId,
        memberUid,
        alreadyActive,
        coachAccess,
        coachAccessGranted: isCoachAccessGranted(coachAccess),
        keepsStaffAccess,
      });

      // Idempotence : suivi deja actif -> AUCUNE ecriture. Le succes est annonce
      // comme un rejeu, et la date d'activation d'origine reste intacte.
      if (isActivePlayer(prelude.target)) return { ok: true, result: resultat(true) };

      // ── Ecriture UNIQUE ────────────────────────────────────────────────────
      // `accessRole` est ABSENT de cet objet : un `merge` ne peut pas le
      // changer. Aucun autre chemin, aucun autre document.
      tx.set(
        memberPaths.member(clubId, memberUid),
        {
          uid: memberUid,
          [PLAYER_STATUS_FIELD]: PLAYER_STATUS_ACTIVE,
          [COACH_ACCESS_FIELD]: coachAccess,
          [PLAYER_ENROLLED_AT_FIELD]: now,
          updatedAt: now,
        },
        { merge: true },
      );

      return { ok: true, result: resultat(false) };
    },
  );
}

/**
 * Le membership decrit-il un joueur ENCORE consultable par le coach ?
 * Exportee pour que les tests de non-regression puissent poser la question dans
 * les memes termes que le projecteur (`playerStatus === "active"`).
 *
 * Elle ne regarde PLUS l'encadrement : un entraineur-joueur est projetable, et
 * c'est le but. Ce qui le protege reste ce qui protege tout le monde —
 * `coachAccess` et les regles Firestore.
 */
export function isProjectablePlayer(membership: MemberDocData | null): boolean {
  return isActivePlayer(membership);
}
