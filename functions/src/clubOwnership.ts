// functions/src/clubOwnership.ts
//
// TRANSFERT DE PROPRIETE D'UN CLUB — coeur metier PUR.
//
// Comme clubMembers.ts et inviteCodes.ts, ce fichier ne connait NI
// firebase-admin NI firebase-functions : il travaille sur le port `MemberStore`
// (le MEME que le retrait, importe et non recopie), ce qui le rend integralement
// testable sans emulateur. Le branchement Admin SDK vit dans clubOwnershipApi.ts.
//
// ─── LE PROBLEME QU'IL RESOUD ───────────────────────────────────────────────
// Le lot precedent a ferme le retrait d'un membre, et il s'est arrete net sur un
// cas : le PROPRIETAIRE. Le retirer fabriquerait exactement l'etat que
// l'invariant interdit — un club dont `ownerUid` designe quelqu'un qui n'est plus
// membre. Le retrait echoue donc avec OWNER_TRANSFER_REQUIRED, et il n'existait
// aucun geste pour faire ce qu'il demande. Un fondateur qui quitte le club
// laissait le club coince : ni transferable, ni nettoyable.
//
// ─── UN SEUL PREDICAT, PAS UN SECOND MODULE D'AUTORITE ──────────────────────
// L'invariant de Kyllian, mot pour mot : « toutes les Functions, regles et
// projections utilisent le MEME predicat ». Ce fichier n'en cree aucun : il
// consomme `resolveOwnerAuthority` (clubAuthority.ts), les memes chemins
// (`memberPaths`), le meme port de stockage et le meme type d'erreur
// (`ClubMemberError`) que le retrait. La seule chose qu'il ajoute, c'est une
// SEQUENCE d'ecritures.
//
// ─── LES SIX FENETRES QUI NE DOIVENT JAMAIS EXISTER ─────────────────────────
//  1. zero proprietaire            — impossible : `ownerUid` et les deux roles
//                                    changent dans UNE transaction, jamais en
//                                    deux gestes. Il n'y a aucun instant
//                                    observable entre les deux.
//  2. deux proprietaires permanents — impossible par construction : l'autorite
//                                    exige `ownerUid` ET le role, et `ownerUid`
//                                    est un champ UNIQUE. Deux appartenances
//                                    portant le role "owner" ne font pas deux
//                                    proprietaires : celle qui n'est pas designee
//                                    n'ouvre RIEN (etat incoherent, refuse
//                                    partout, signale pour reparation).
//  3. ancien proprietaire sans role — impossible : il recoit un role EXPLICITE
//                                    ("coach") dans la meme transaction.
//  4. droits survivants par un `ownerUid` orphelin — impossible : la designation
//                                    seule n'a plus jamais accorde de droit
//                                    depuis le lot precedent.
//  5. transfert vers quelqu'un d'exterieur — refuse : la cible doit deja etre un
//                                    membre ACTIF de CE club.
//  6. double soumission qui "echoue" alors qu'elle a reussi — traitee : voir la
//                                    FENETRE DE REJEU, plus bas.
//
// ─── QUEL ROLE RECOIT L'ANCIEN PROPRIETAIRE, ET POURQUOI "coach" ────────────
// Il devient "coach", pas "player", pas rien.
//
//  . "rien" (appartenance supprimee) est exclu : ce serait retirer un membre
//    dans le meme geste qu'un transfert, sans pierre tombale, sans revocation
//    d'acces, sans nettoyage de `users/{uid}.clubId` — c'est-a-dire refaire a
//    moitie le travail que `removeClubMember` fait entierement. Le transfert
//    transfere ; le retrait retire. Deux gestes, dans cet ordre, et le second
//    fonctionne NORMALEMENT sur l'ancien proprietaire une fois le premier passe.
//  . "player" est exclu, et c'est le piege du lot : le projecteur serveur
//    projette les membres de role "player". Retrograder le fondateur en joueur
//    ferait apparaitre SON PROPRE suivi d'entrainement dans l'effectif consulte
//    par les encadrants. Un transfert de propriete n'est pas un consentement a
//    etre suivi.
//  . "coach" dit la verite : il reste un encadrant du club (`CLUB_STAFF_ROLES`
//    contient "owner" et "coach"), il garde le cadre de semaine, la note privee,
//    la directive, l'effectif et l'emission de code. Il PERD exactement ce qui
//    appartient au proprietaire : modifier le document club, supprimer un cadre
//    ou une directive, et initier un nouveau transfert.
//
// ─── QUI EST UN "MEMBRE ADMISSIBLE" ─────────────────────────────────────────
// Exactement : une appartenance EXISTANTE dans CE club, portant un role ACTIF
// (owner / coach / player). Donc :
//  . un JOUEUR est admissible. C'est volontaire, et c'est meme le cas nominal :
//    aujourd'hui aucun chemin — client ou serveur — ne cree un second coach.
//    Exiger un coach rendrait le transfert inutilisable dans la seule situation
//    ou on en a besoin.
//  . une PIERRE TOMBALE (role "removed") n'est PAS admissible : elle n'ouvre
//    rien, nulle part, et surement pas la propriete du club.
//  . un compte qui n'a JAMAIS rejoint n'est pas admissible : aucun document.
//  . la CIBLE devient encadrante, donc elle sort de la projection joueur. Sa
//    projection residuelle est supprimee dans la meme transaction, et son
//    `coachAccess` passe a "revoked" — deux verrous independants, exactement
//    comme au retrait, pour que son suivi personnel cesse d'etre lisible meme si
//    une reprojection en vol repassait par la.
//
// ─── ANTI-ORACLE : POURQUOI LE REFUS DE CIBLE PEUT ETRE PARLANT ─────────────
// Meme raisonnement qu'au retrait, refait et non recopie. Il n'y a rien a
// enumerer ici : l'autorite de l'appelant est verifiee AVANT toute lecture de la
// cible, donc seul le PROPRIETAIRE de CE club atteint la reponse « cette personne
// n'est pas dans l'effectif actif », a propos d'un uid qu'il a lu dans SON PROPRE
// effectif (il est le seul, avec les coachs, a pouvoir lister `members`). Il
// n'apprend rien qu'il ne sache deja. Le refus de cible est donc PARLANT — il
// indique le geste a faire — tandis que TOUS les refus d'AUTORITE restent
// fondus en un seul message opaque.
// Une nuance en plus : « absente » et « pierre tombale » ne sont PAS distinguees.
// Le proprietaire pourrait les distinguer lui-meme en lisant l'effectif ; en
// fondre deux en une n'enleve donc aucune information utile, et evite un message
// de plus a maintenir.

import {
  CLUB_ROLE_COACH,
  CLUB_ROLE_OWNER,
  clubAuthoritySignal,
  hasOwnerMembership,
  isActiveMembership,
  normalizeClubRole,
  readOwnerUid,
  resolveOwnerAuthority,
  type ClubAuthoritySignal,
  type ClubRole,
} from "./clubAuthority";
import {
  ClubMemberError,
  isPlausibleId,
  memberPaths,
  type ClubMemberDeps,
  type ClubMemberErrorCode,
  type MemberDocData,
  type MemberTx,
} from "./clubMembers";
import { COACH_ACCESS_FIELD } from "./coachAccess";

// ─── Ce que le transfert ecrit, nomme une fois ──────────────────────────────

/** Le role EXPLICITE recu par l'ancien proprietaire. Jamais implicite, jamais vide. */
export const PREVIOUS_OWNER_ROLE: ClubRole = CLUB_ROLE_COACH;

/**
 * Champs d'AUDIT poses sur le document club. Volontairement TROIS, et pas un de
 * plus : quand, depuis qui, et par quel chemin (proprietaire ou outil
 * administrateur). Ni nom de club, ni donnee de membre, ni secret — un journal
 * ne doit pas devenir la surface qu'on vient de fermer ailleurs.
 *
 * `ownershipTransferredFrom` est un uid, et il devient lisible par les membres
 * actifs du club (le document club leur est lisible). C'est assume : l'identite
 * du proprietaire l'est deja (`ownerUid`), donc celle du precedent n'ajoute rien
 * de substantiel — et c'est ce champ qui rend la FENETRE DE REJEU EXACTE plutot
 * qu'approximative.
 */
export const OWNERSHIP_TRANSFERRED_AT = "ownershipTransferredAt";
export const OWNERSHIP_TRANSFERRED_FROM = "ownershipTransferredFrom";
export const OWNERSHIP_TRANSFERRED_MODE = "ownershipTransferredMode";

/** Horodatages poses sur les appartenances. Audit, jamais autorite. */
export const OWNER_SINCE = "ownerSince";
export const OWNER_UNTIL = "ownerUntil";

// ─── Erreurs ────────────────────────────────────────────────────────────────
//
// Le type d'erreur est celui du retrait (`ClubMemberError`) : meme domaine, meme
// enveloppe callable, meme traduction. En creer un second n'aurait rien apporte
// qu'un second endroit ou se tromper.

/**
 * REFUS UNIQUE de tout ce qui touche a l'AUTORITE : appelant non proprietaire,
 * proprietaire d'un autre club, club inexistant, identifiants malformes, etat
 * d'autorite incoherent. Un seul objet, un seul message.
 */
export const TRANSFER_DENIED_CODE: ClubMemberErrorCode = "permission-denied";
export const TRANSFER_DENIED_MESSAGE =
  "Transfert impossible : cette action demande d'etre le proprietaire de ce club.";

export const TRANSFER_UNAVAILABLE_CODE: ClubMemberErrorCode = "unavailable";
export const TRANSFER_UNAVAILABLE_MESSAGE =
  "Le transfert est momentanement indisponible. Reessaie.";

/**
 * Jetons machine des DEUX echecs parlants. Litteraux, verrouilles par test : ils
 * indiquent le geste a faire, et le front a besoin de les distinguer d'un refus
 * generique. Meme role que OWNER_TRANSFER_REQUIRED cote retrait.
 */
export const TRANSFER_TARGET_INELIGIBLE = "TRANSFER_TARGET_INELIGIBLE";
export const TRANSFER_TARGET_IS_SELF = "TRANSFER_TARGET_IS_SELF";

export const TRANSFER_PRECONDITION_CODE: ClubMemberErrorCode = "failed-precondition";
export const TARGET_INELIGIBLE_MESSAGE =
  "Cette personne ne fait pas partie de l'effectif actif de ce club. Elle doit avoir rejoint le club avant de pouvoir en devenir proprietaire.";
export const TARGET_IS_SELF_MESSAGE =
  "Ce club vous appartient deja : choisis une autre personne comme nouveau proprietaire.";

/** Raisons INTERNES d'un refus d'autorite. Elles ne sortent JAMAIS de ce module. */
export type TransferDenialReason =
  | "malformed-club-id"
  | "malformed-target-id"
  | "club-missing"
  | "not-owner"
  | "authority-inconsistent";

/**
 * Traduit une raison interne en erreur publique. `reason` est volontairement
 * IGNORE : la signature l'exige pour que l'appelant NOMME ce qu'il refuse, mais
 * toutes les raisons produisent le meme objet.
 */
export function transferDeniedError(_reason: TransferDenialReason): ClubMemberError {
  return new ClubMemberError(TRANSFER_DENIED_CODE, TRANSFER_DENIED_MESSAGE);
}

export function targetIneligibleError(): ClubMemberError {
  return new ClubMemberError(
    TRANSFER_PRECONDITION_CODE,
    TARGET_INELIGIBLE_MESSAGE,
    TRANSFER_TARGET_INELIGIBLE,
  );
}

export function targetIsSelfError(): ClubMemberError {
  return new ClubMemberError(
    TRANSFER_PRECONDITION_CODE,
    TARGET_IS_SELF_MESSAGE,
    TRANSFER_TARGET_IS_SELF,
  );
}

// ─── Resultat ───────────────────────────────────────────────────────────────

/**
 * Chemin emprunte.
 *  - "owner" : le proprietaire courant, seul chemin ouvert a un client ;
 *  - "admin" : outil administrateur SEPARE (clubOwnershipCli.ts), qui ne verifie
 *    aucune autorite d'appelant parce qu'il sert precisement les cas ou personne
 *    n'est autorise — un club dont l'autorite est incoherente.
 */
export type TransferMode = "owner" | "admin";

export type TransferOwnershipResult = {
  clubId: string;
  newOwnerUid: string;
  /** Proprietaire sortant (la DESIGNATION lue avant l'ecriture), ou null. */
  previousOwnerUid: string | null;
  /** Role EXPLICITE porte par l'ancien proprietaire APRES le transfert, ou null. */
  previousOwnerRole: ClubRole | null;
  /** Role que la cible portait AVANT (utile pour dire « un joueur est devenu proprietaire »). */
  newOwnerPreviousRole: ClubRole | null;
  /**
   * `true` si l'etat cible etait DEJA en place : AUCUNE ecriture n'a eu lieu, pas
   * meme un horodatage. Un double appui ne reecrit pas l'histoire de l'audit.
   */
  alreadyTransferred: boolean;
  mode: TransferMode;
  /** Mode administrateur : appartenance proprietaire ORPHELINE retrogradee, ou null. */
  demotedUid: string | null;
  /** Mode administrateur : `users/{newOwnerUid}.role` bascule sur "coach". */
  grantedCoachSpace: boolean;
};

type TransferTxOutcome =
  | { ok: true; result: TransferOwnershipResult }
  | { ok: false; kind: "denied"; reason: TransferDenialReason; signal: ClubAuthoritySignal | null }
  | { ok: false; kind: "target-ineligible" }
  | { ok: false; kind: "target-is-self" };

type TransferParams = {
  mode: TransferMode;
  /** uid du JETON de l'appelant. `null` en mode administrateur (il n'y a pas d'appelant). */
  actorUid: string | null;
  clubId: unknown;
  newOwnerUid: unknown;
  /** Mode administrateur uniquement : appartenance proprietaire orpheline a retrograder. */
  demoteUid?: unknown;
  /** Mode administrateur uniquement : basculer l'espace applicatif de la cible sur "coach". */
  grantCoachSpace?: boolean;
};

/** Chaine non vide, ou `null`. Recopiee de clubAuthority (fonction privee la-bas). */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * FENETRE DE REJEU — le piege de ce lot, traite explicitement.
 *
 * Une fois le transfert fait, l'ancien proprietaire N'EST PLUS AUTORISE a
 * initier : un rejeu naif (double appui, reseau qui bafouille, retransmission
 * de la requete) tomberait donc sur un refus d'autorite, et l'appelant croirait
 * avoir echoue alors qu'il a reussi.
 *
 * On reconnait donc l'etat « ce que tu demandes est deja fait », et on le fait
 * de la maniere la plus ETROITE possible. Les quatre conditions, toutes exigees :
 *   1. le club designe DEJA la cible demandee comme proprietaire ;
 *   2. la cible porte DEJA le role proprietaire (etat final COHERENT — on ne
 *      declare pas « deja fait » sur un club a moitie transfere) ;
 *   3. l'appelant est EXACTEMENT celui que l'audit enregistre comme proprietaire
 *      sortant du dernier transfert (`ownershipTransferredFrom`) ;
 *   4. il est encore un membre ACTIF de ce club (un ancien proprietaire retire
 *      depuis n'obtient rien, pas meme un succes vide).
 *
 * Ce que ce chemin accorde : RIEN. Zero ecriture, et une reponse qui decrit un
 * etat que l'appelant peut deja lire (il liste l'effectif). Ce qu'il evite : une
 * fausse erreur sur un geste reussi.
 */
async function isReplayOfCompletedTransfer(
  tx: MemberTx,
  params: {
    clubId: string;
    club: MemberDocData;
    actorUid: string;
    actorMembership: MemberDocData | null;
    newOwnerUid: string;
  },
): Promise<MemberDocData | null> {
  if (readOwnerUid(params.club) !== params.newOwnerUid) return null;
  const from = str(params.club[OWNERSHIP_TRANSFERRED_FROM]);
  if (from === null || from !== params.actorUid) return null;
  if (!isActiveMembership(params.actorMembership)) return null;
  const target = await tx.get(memberPaths.member(params.clubId, params.newOwnerUid));
  return hasOwnerMembership(target) ? target : null;
}

/**
 * Coeur commun aux deux chemins. VOLONTAIREMENT NON EXPORTE : le mode ne peut
 * donc pas etre injecte depuis l'exterieur, et surement pas depuis une charge
 * utile client. Les deux seules portes sont `transferClubOwnership` (autorite
 * complete) et `adminTransferClubOwnership` (outil separe, jamais exporte dans
 * index.ts).
 *
 * Sequence, dans cet ORDRE EXACT — l'ordre fait partie du contrat :
 *   1. identite de l'appelant (jamais un parametre client) ;
 *   2. forme des identifiants, sans aucune lecture ;
 *   3. transaction :
 *      a. le club existe ;
 *      b. AUTORITE de l'appelant sur CE club, AVANT toute lecture de la cible ;
 *      c. fenetre de rejeu (uniquement si l'autorite est refusee sans incoherence) ;
 *      d. la cible n'est pas l'appelant ;
 *      e. la cible est un membre ADMISSIBLE de CE club ;
 *      f. etat cible deja en place -> succes sans aucune ecriture ;
 *      g. ecritures : designation + role de la cible + role de l'ancien +
 *         suppression de la projection residuelle.
 *
 * Tout est dans UNE transaction : ou toutes les ecritures passent, ou aucune. Il
 * n'existe donc AUCUN instant observable ou le club aurait zero proprietaire.
 */
async function runOwnershipTransfer(
  deps: ClubMemberDeps,
  params: TransferParams,
): Promise<TransferOwnershipResult> {
  const mode = params.mode;
  const actorUid = mode === "owner" ? str(params.actorUid) : null;
  if (mode === "owner" && actorUid === null) {
    throw new ClubMemberError("unauthenticated", "Connexion requise.");
  }

  if (!isPlausibleId(params.clubId)) throw transferDeniedError("malformed-club-id");
  if (!isPlausibleId(params.newOwnerUid)) throw transferDeniedError("malformed-target-id");
  const clubId = params.clubId.trim();
  const newOwnerUid = params.newOwnerUid.trim();
  const demoteUid = mode === "admin" && isPlausibleId(params.demoteUid)
    ? params.demoteUid.trim()
    : null;
  const grantCoachSpace = mode === "admin" && params.grantCoachSpace === true;

  const now = deps.now();

  let outcome: TransferTxOutcome;
  try {
    outcome = await deps.store.runTransaction<TransferTxOutcome>(async (tx) => {
      // ── Lectures d'abord (contrainte Firestore) ────────────────────────────
      const club = await tx.get(memberPaths.club(clubId));
      if (!club) {
        // Club inexistant : MEME refus que « pas proprietaire ». Le distinguer
        // apprendrait a un curieux qu'un identifiant de club existe.
        return { ok: false, kind: "denied", reason: "club-missing", signal: null };
      }

      let previousOwnerUid: string | null;
      let previousOwnerMembership: MemberDocData | null = null;

      if (mode === "owner") {
        const uid = actorUid as string;
        const actorMembership = await tx.get(memberPaths.member(clubId, uid));

        // b. AUTORITE — LE PREDICAT PARTAGE, ET RIEN D'AUTRE. Verifiee AVANT de
        //    toucher a la cible (cf. anti-oracle, en-tete de fichier).
        const authority = resolveOwnerAuthority(club, actorMembership, uid);
        const signal = clubAuthoritySignal(
          { clubId, uid, action: "transferClubOwnership" },
          authority,
        );
        if (signal) {
          // Etat incoherent : on REFUSE et on signale. Un club dont l'autorite est
          // douteuse ne doit surtout pas etre le chemin par lequel la propriete
          // change de main — c'est justement le cas que l'outil administrateur
          // debloque, en connaissance de cause.
          return { ok: false, kind: "denied", reason: "authority-inconsistent", signal };
        }

        if (authority !== "authorized") {
          // c. Est-ce le rejeu d'un transfert deja abouti ? Sinon, refus.
          const target = await isReplayOfCompletedTransfer(tx, {
            clubId,
            club,
            actorUid: uid,
            actorMembership,
            newOwnerUid,
          });
          if (target) {
            return {
              ok: true,
              result: {
                clubId,
                newOwnerUid,
                previousOwnerUid: uid,
                previousOwnerRole: normalizeClubRole(actorMembership?.role),
                newOwnerPreviousRole: normalizeClubRole(target.role),
                alreadyTransferred: true,
                mode,
                demotedUid: null,
                grantedCoachSpace: false,
              },
            };
          }
          return { ok: false, kind: "denied", reason: "not-owner", signal: null };
        }

        // d. Se transferer a soi-meme n'est pas un rejeu : c'est une demande qui
        //    n'a pas de sens, et le dire est honnete (l'appelant sait deja qu'il
        //    est proprietaire, on ne lui apprend rien).
        if (newOwnerUid === uid) return { ok: false, kind: "target-is-self" };

        previousOwnerUid = uid;
        previousOwnerMembership = actorMembership;
      } else {
        // Mode administrateur : aucune autorite d'appelant a verifier. Le sortant
        // est celui que la DESIGNATION nomme — il peut n'y en avoir aucun, ou
        // n'avoir aucune appartenance : c'est precisement l'etat a reparer.
        previousOwnerUid = readOwnerUid(club);
      }

      // e. La cible est-elle un membre ADMISSIBLE de CE club ?
      const targetMembership = await tx.get(memberPaths.member(clubId, newOwnerUid));
      if (!targetMembership || !isActiveMembership(targetMembership)) {
        return { ok: false, kind: "target-ineligible" };
      }
      const newOwnerPreviousRole = normalizeClubRole(targetMembership.role);

      // f. Etat cible DEJA en place et COHERENT : succes, zero ecriture.
      //    Inatteignable en mode proprietaire (la cible serait alors l'appelant,
      //    deja refuse en d) ; c'est l'idempotence du mode administrateur.
      if (readOwnerUid(club) === newOwnerUid && hasOwnerMembership(targetMembership)) {
        return {
          ok: true,
          result: {
            clubId,
            newOwnerUid,
            previousOwnerUid,
            previousOwnerRole: null,
            newOwnerPreviousRole,
            alreadyTransferred: true,
            mode,
            demotedUid: null,
            grantedCoachSpace: false,
          },
        };
      }

      // L'ancien proprietaire n'est retrograde que s'il porte REELLEMENT le role
      // proprietaire. En mode administrateur sur un club incoherent, il peut n'y
      // avoir personne a retrograder : on n'invente pas une ecriture.
      if (previousOwnerUid !== null && previousOwnerUid !== newOwnerUid) {
        if (previousOwnerMembership === null) {
          previousOwnerMembership = await tx.get(memberPaths.member(clubId, previousOwnerUid));
        }
      } else {
        previousOwnerMembership = null;
      }
      const demotesPreviousOwner = hasOwnerMembership(previousOwnerMembership);

      // Mode administrateur : une appartenance proprietaire ORPHELINE (role
      // "owner" sans designation) n'accorde aucun droit, mais elle reste un etat
      // a reparer. On la retrograde si l'operateur la NOMME — jamais par
      // decouverte automatique, le port de stockage ne sait pas enumerer.
      let demotedUid: string | null = null;
      if (demoteUid !== null && demoteUid !== newOwnerUid && demoteUid !== previousOwnerUid) {
        const stray = await tx.get(memberPaths.member(clubId, demoteUid));
        if (hasOwnerMembership(stray)) demotedUid = demoteUid;
      }

      // ── Ecritures ──────────────────────────────────────────────────────────
      // 1. LA DESIGNATION. Elle bouge dans la meme transaction que les deux
      //    roles : c'est ce qui interdit toute fenetre a zero ou deux
      //    proprietaires.
      tx.set(
        memberPaths.club(clubId),
        {
          ownerUid: newOwnerUid,
          [OWNERSHIP_TRANSFERRED_AT]: now,
          [OWNERSHIP_TRANSFERRED_FROM]: previousOwnerUid,
          [OWNERSHIP_TRANSFERRED_MODE]: mode,
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. L'appartenance de la CIBLE. `coachAccess: "revoked"` est un second
      //    verrou, independant du role : la nouvelle proprietaire n'est plus une
      //    joueuse projetee, et son suivi personnel cesse d'etre lisible par
      //    l'encadrement meme si une reprojection en vol repassait par la.
      tx.set(
        memberPaths.member(clubId, newOwnerUid),
        {
          uid: newOwnerUid,
          role: CLUB_ROLE_OWNER,
          [COACH_ACCESS_FIELD]: "revoked",
          [OWNER_SINCE]: now,
          updatedAt: now,
        },
        { merge: true },
      );

      // 3. L'appartenance de l'ANCIEN proprietaire : un role EXPLICITE, jamais un
      //    trou. Apres cette ecriture, `removeClubMember` fonctionne sur lui
      //    NORMALEMENT — il n'est plus ni designe, ni porteur du role.
      if (demotesPreviousOwner && previousOwnerUid !== null) {
        tx.set(
          memberPaths.member(clubId, previousOwnerUid),
          {
            uid: previousOwnerUid,
            role: PREVIOUS_OWNER_ROLE,
            [OWNER_UNTIL]: now,
            updatedAt: now,
          },
          { merge: true },
        );
      }

      // 4. Projection residuelle de la cible. Supprimee ICI plutot que confiee au
      //    trigger : un trigger est asynchrone, et la donnee doit disparaitre avec
      //    le geste. Inconditionnelle, comme au retrait : une projection laissee
      //    par un passage anterieur en "player" doit partir aussi.
      tx.delete(memberPaths.playerSummary(clubId, newOwnerUid));

      // 5. Reparation nommee (mode administrateur).
      if (demotedUid !== null) {
        tx.set(
          memberPaths.member(clubId, demotedUid),
          { role: PREVIOUS_OWNER_ROLE, [OWNER_UNTIL]: now, updatedAt: now },
          { merge: true },
        );
      }

      // 6. ESPACE APPLICATIF (mode administrateur, sur demande explicite).
      //
      //    ATTENTION : DEVENUE SANS EFFET (juillet 2026), laissee en place a dessein.
      //    `users/{uid}.role` ne decide PLUS de l'espace affiche par l'app :
      //    celui-ci est desormais DERIVE de l'appartenance ecrite juste au-dessus
      //    (front : domain/appSpace.ts, hooks/useAppSpace.ts). Le successeur
      //    obtient donc l'espace coach tout seul, immediatement, et cette
      //    ecriture ne produit plus aucun effet visible.
      //    On ne la retire pas ICI : ce serait toucher au comportement et aux
      //    tests du transfert dans un lot qui n'a pas ce mandat. Un lot dedie
      //    peut la solder (cf. docs/coach-pilote-2026-07/ESPACE_ET_ROLES.md).
      //
      //    Ce qui reste VRAI et important : un compte voit un seul espace. Un
      //    joueur qui devient proprietaire perd l'acces a sa propre app
      //    d'entrainement — decision produit non tranchee, documentee, jamais
      //    masquee.
      if (grantCoachSpace) {
        tx.set(memberPaths.user(newOwnerUid), { role: "coach", updatedAt: now }, { merge: true });
      }

      return {
        ok: true,
        result: {
          clubId,
          newOwnerUid,
          previousOwnerUid,
          previousOwnerRole: demotesPreviousOwner ? PREVIOUS_OWNER_ROLE : null,
          newOwnerPreviousRole,
          alreadyTransferred: false,
          mode,
          demotedUid,
          grantedCoachSpace: grantCoachSpace,
        },
      };
    });
  } catch (err) {
    if (err instanceof ClubMemberError) throw err;
    throw new ClubMemberError(TRANSFER_UNAVAILABLE_CODE, TRANSFER_UNAVAILABLE_MESSAGE);
  }

  if (outcome.ok) return outcome.result;

  if (outcome.kind === "target-ineligible") throw targetIneligibleError();
  if (outcome.kind === "target-is-self") throw targetIsSelfError();

  // Signalement HORS transaction : un rejeu pour contention ne doit pas
  // multiplier les lignes de journal.
  if (outcome.signal) deps.onInconsistency?.(outcome.signal);
  throw transferDeniedError(outcome.reason);
}

/**
 * LE CHEMIN NOMINAL : le proprietaire courant transfere sa propriete a un membre
 * admissible de son club. C'est le seul chemin joignable par un client.
 */
export async function transferClubOwnership(
  deps: ClubMemberDeps,
  params: { actorUid: string; clubId: unknown; newOwnerUid: unknown },
): Promise<TransferOwnershipResult> {
  return runOwnershipTransfer(deps, {
    mode: "owner",
    actorUid: String(params.actorUid ?? ""),
    clubId: params.clubId,
    newOwnerUid: params.newOwnerUid,
  });
}

/**
 * L'OUTIL ADMINISTRATEUR, EXPLICITEMENT SEPARE. Il n'est branche sur aucune
 * Cloud Function (cf. index.ts) : il ne s'execute qu'en ligne de commande, avec
 * les identifiants d'un operateur qui a deja tous les droits sur la base.
 *
 * Sa raison d'etre : les clubs dont l'autorite est INCOHERENTE. Dans cet etat,
 * PERSONNE n'est autorise — pas meme celui que `ownerUid` designe — donc le
 * chemin nominal ne peut par construction rien debloquer. Sans cet outil, un
 * club incoherent resterait coince pour toujours.
 *
 * Il applique EXACTEMENT les memes garanties que le chemin nominal (transaction
 * unique, cible admissible, role explicite pour le sortant, un seul proprietaire
 * final) — il ne saute QUE la verification d'autorite de l'appelant.
 */
export async function adminTransferClubOwnership(
  deps: ClubMemberDeps,
  params: {
    clubId: unknown;
    newOwnerUid: unknown;
    /** Appartenance proprietaire orpheline a retrograder, si l'operateur en connait une. */
    demoteUid?: unknown;
    /** Basculer `users/{newOwnerUid}.role` sur "coach". Voir la mise en garde ci-dessus. */
    grantCoachSpace?: boolean;
  },
): Promise<TransferOwnershipResult> {
  return runOwnershipTransfer(deps, {
    mode: "admin",
    actorUid: null,
    clubId: params.clubId,
    newOwnerUid: params.newOwnerUid,
    demoteUid: params.demoteUid,
    grantCoachSpace: params.grantCoachSpace,
  });
}
