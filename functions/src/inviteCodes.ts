// functions/src/inviteCodes.ts
//
// COEUR METIER du nouveau contrat d'invitation club. Ce fichier ne connait NI
// firebase-admin NI firebase-functions : il travaille sur un port minimal
// (`InviteStore`), ce qui le rend testable sans emulateur — y compris la
// concurrence, en fournissant un faux magasin qui rejoue la semantique
// optimiste des transactions Firestore.
//
// Ce que ce contrat garantit, et pourquoi :
//
//  1. ENTROPIE. Le code n'est plus derive du nom du club (ancien systeme :
//     ~13 bits reels, 10 000 combinaisons). Il est tire de crypto.randomBytes
//     sur un alphabet sans caracteres ambigus. 10 caracteres sur 31 symboles =
//     log2(31^10) ~= 49,5 bits. Math.random() n'est plus utilise nulle part.
//
//  2. NON REVERSIBILITE. La base ne stocke QUE l'empreinte SHA-256 du code
//     normalise ; le code en clair n'existe qu'en memoire, le temps de la
//     reponse a l'emission. Un acces en lecture a la base ne rend donc aucun
//     code utilisable.
//
//     POURQUOI UN SHA-256 SIMPLE ET PAS UN KDF LENT (bcrypt/scrypt/argon2) :
//     un KDF lent existe pour compenser la FAIBLE entropie d'un mot de passe
//     choisi par un humain (quelques dizaines de bits au mieux, souvent moins).
//     Ici l'entree est un secret tire au hasard a ~49,5 bits, jamais choisi par
//     un humain, jamais reutilise ailleurs. Un attaquant qui volerait la base
//     devrait parcourir ~8,2e14 candidats : a 1e11 hachages/seconde (GPU haut
//     de gamme) cela reste des heures pour UN code, qui expire de toute facon.
//     Le cout d'un KDF lent porterait au contraire sur CHAQUE tentative
//     legitime (latence + facture), pour un gain marginal. Le vrai garde-fou
//     ici, c'est l'expiration + la revocation + la limitation de tentatives.
//
//  3. VERIFICATION SERVEUR UNIQUEMENT. Le front n'a plus le droit de dire si un
//     code est valide : les regles Firestore ferment toute lecture cliente de
//     `inviteCodes`. La seule porte d'entree est la callable qui appelle ce
//     coeur.
//
//  4. AUCUN ORACLE, DES DEUX COTES DE LA PORTE.
//     - Au RATTACHEMENT : code inconnu, expire, revoque, epuise, ou club disparu
//       produisent EXACTEMENT la meme erreur (meme code, meme message) — voir
//       `inviteRejectedError`, verrouille par un test d'egalite stricte.
//     - A l'EMISSION : identifiant de club malforme, club inexistant, et club
//       existant dont l'appelant n'est pas coach produisent eux aussi la meme
//       erreur — voir `issueRejectedError`. Avant, l'emission repondait
//       `not-found` sur un club inexistant et `permission-denied` sur un club
//       existant : c'etait un oracle d'existence de club. Sa portee etait
//       faible (un identifiant Firestore est une chaine aleatoire de 20
//       caracteres, on ne le devine pas) mais c'etait le MEME defaut de
//       conception que celui deja ferme au rattachement, et il ne subsiste pas.
//
//  5. LIMITATION DES TENTATIVES SUR LES DEUX PORTES. Le rattachement etait
//     borne, pas l'emission (50 essais consecutifs passaient sans qu'aucun
//     compteur soit ecrit). Les deux partagent desormais le MEME mecanisme
//     (fenetre glissante, portees utilisateur et origine, fail-closed), avec des
//     seuils DISTINCTS et des compteurs SEPARES — voir `AttemptPolicy`.

import { createHash, randomBytes as cryptoRandomBytes } from "crypto";
import {
  COACH_ACCESS_FIELD,
  initialCoachAccess,
  normalizeCoachAccess,
  type CoachAccessState,
} from "./coachAccess";
import { COACH_ACCESS_POLICY_FIELD } from "./coachAccessPolicy";

// ─── Format du code ─────────────────────────────────────────────────────────

/**
 * Alphabet de saisie : 23 lettres + 8 chiffres = 31 symboles.
 * Sont EXCLUS les caracteres visuellement ambigus a l'oral comme a l'ecrit :
 * I, L, O (confondus avec 1 et 0) et 0, 1 eux-memes. Un code dicte au telephone
 * dans un vestiaire ne doit jamais dependre de la police de caracteres.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Longueur du code canonique (sans separateur). 31^10 ~= 8,2e14 ~= 49,5 bits. */
export const INVITE_CODE_LENGTH = 10;

/** Taille des groupes a l'affichage ("ABCDE-FGHJK"). Pure lisibilite. */
export const INVITE_CODE_GROUP_SIZE = 5;

/** Duree de validite d'un code emis : 14 jours. */
export const INVITE_CODE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Nombre d'usages autorises par code. Borne EXPLICITE (jamais illimitee) :
 * un effectif de club amateur depasse rarement 30 joueurs, et un code qui a
 * fuite sur un groupe de messagerie cesse de servir une fois l'effectif entre.
 */
export const INVITE_CODE_MAX_USES = 30;

// ─── Limitation de tentatives ───────────────────────────────────────────────
// Fenetre glissante, deux portees INDEPENDANTES : l'utilisateur connecte (un
// compte qui essaie en boucle) et l'origine reseau (un script qui change de
// compte a chaque essai). Franchir un seuil bloque la portee concernee.

/** Largeur de la fenetre glissante d'observation des echecs. */
export const INVITE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** Echecs toleres dans la fenetre pour UN utilisateur avant blocage. */
export const INVITE_ATTEMPT_MAX_PER_USER = 5;

/** Echecs toleres dans la fenetre pour UNE origine reseau avant blocage. */
export const INVITE_ATTEMPT_MAX_PER_ORIGIN = 20;

/** Duree du blocage une fois le seuil franchi. */
export const INVITE_ATTEMPT_BLOCK_MS = 60 * 60 * 1000;

/** Borne dure de la liste d'horodatages conservee (anti-doc qui enfle). */
const ATTEMPT_HISTORY_CAP = 64;

// ─── Limitation de tentatives A L'EMISSION ──────────────────────────────────
// Seuils DISTINCTS de ceux du rattachement, et assumes comme tels : emettre est
// un geste de coach, rare et delibere (quelques fois par saison), alors que
// saisir un code est un geste de joueur, frequent et faillible.
//
// Ce qui est compte : les REFUS. Un coach legitime n'obtient jamais un refus
// depuis l'application — l'identifiant de club qu'elle envoie vient de son
// propre rattachement. Un refus repete signifie donc soit une application dans
// un etat perime, soit quelqu'un qui sonde des identifiants de club.
//
// Ce qui n'est PAS compte : les emissions REUSSIES. Elles sont le geste
// autorise lui-meme, elles n'apprennent rien a personne sur un autre club, et
// chacune revoque la precedente (le nombre de codes vivants reste de 1 par
// club). Les compter reviendrait a rationner un coach qui fait son travail.

/**
 * Fenetre d'observation des refus d'emission : 1 heure, soit QUATRE FOIS plus
 * large qu'au rattachement. Sonder des identifiants de club est un jeu patient,
 * pas une rafale ; une fenetre courte se contournerait en espacant les essais.
 */
export const ISSUE_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Refus toleres dans la fenetre pour UN utilisateur. Plus haut que les 5 du
 * rattachement : un coach dont l'ecran est perime peut re-tenter de bonne foi
 * plusieurs fois avant de comprendre, et le bloquer trop vite lui couperait
 * l'unique moyen de faire entrer son effectif.
 */
export const ISSUE_ATTEMPT_MAX_PER_USER = 8;

/**
 * Refus toleres dans la fenetre pour UNE origine reseau. Le wifi d'un club
 * abrite plusieurs comptes coach : la marge couvre ce cas sans laisser de place
 * a un balayage.
 */
export const ISSUE_ATTEMPT_MAX_PER_ORIGIN = 24;

/** Duree du blocage d'emission une fois le seuil franchi. */
export const ISSUE_ATTEMPT_BLOCK_MS = 60 * 60 * 1000;

/**
 * Politique de limitation d'un geste. Les deux portes partagent le MEME code
 * (une seule fenetre glissante, un seul fail-closed, un seul chemin de
 * journalisation) et se distinguent uniquement par ces valeurs.
 */
export type AttemptPolicy = {
  /**
   * Prefixe des documents compteurs. Il SEPARE les gestes, et ce n'est pas un
   * detail : sans lui, un joueur qui se trompe cinq fois de code sur le wifi du
   * club bloquerait l'emission de son propre coach.
   */
  keyPrefix: string;
  windowMs: number;
  blockMs: number;
  maxPerUser: number;
  maxPerOrigin: number;
};

/** Rattachement. Prefixe VIDE : les compteurs deja en base gardent leur nom. */
export const JOIN_ATTEMPT_POLICY: AttemptPolicy = {
  keyPrefix: "",
  windowMs: INVITE_ATTEMPT_WINDOW_MS,
  blockMs: INVITE_ATTEMPT_BLOCK_MS,
  maxPerUser: INVITE_ATTEMPT_MAX_PER_USER,
  maxPerOrigin: INVITE_ATTEMPT_MAX_PER_ORIGIN,
};

/** Emission. */
export const ISSUE_ATTEMPT_POLICY: AttemptPolicy = {
  keyPrefix: "issue_",
  windowMs: ISSUE_ATTEMPT_WINDOW_MS,
  blockMs: ISSUE_ATTEMPT_BLOCK_MS,
  maxPerUser: ISSUE_ATTEMPT_MAX_PER_USER,
  maxPerOrigin: ISSUE_ATTEMPT_MAX_PER_ORIGIN,
};

// ─── Erreurs ────────────────────────────────────────────────────────────────

/** Codes d'erreur transportables tels quels vers une HttpsError callable. */
export type InviteErrorCode =
  | "unauthenticated"
  | "invalid-argument"
  | "permission-denied"
  | "not-found"
  | "resource-exhausted"
  | "unavailable";

export class InviteError extends Error {
  constructor(
    readonly code: InviteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

/**
 * REPONSE UNIQUE de tout refus de code, quelle qu'en soit la cause.
 * Ces deux constantes sont la definition de "pas d'oracle" : les separer, ou
 * enrichir le message avec la raison, rouvrirait la fuite fermee ici.
 */
export const INVITE_REJECTED_CODE: InviteErrorCode = "permission-denied";
export const INVITE_REJECTED_MESSAGE = "Ce code d'invitation n'est pas valide.";

export const INVITE_RATE_LIMITED_CODE: InviteErrorCode = "resource-exhausted";
export const INVITE_RATE_LIMITED_MESSAGE =
  "Trop de tentatives. Reessaie dans un moment.";

export const INVITE_UNAVAILABLE_CODE: InviteErrorCode = "unavailable";
export const INVITE_UNAVAILABLE_MESSAGE =
  "La verification du code est momentanement indisponible. Reessaie.";

/** Raisons INTERNES d'un refus. Elles ne sortent JAMAIS de ce module. */
export type InviteRejectionReason =
  | "malformed"
  | "unknown"
  | "expired"
  | "revoked"
  | "exhausted"
  | "club-missing";

/**
 * Traduit une raison interne en erreur publique. Le parametre `reason` est
 * volontairement IGNORE : la signature le prend pour que l'appelant n'ait pas a
 * y penser, mais toutes les raisons produisent le meme objet.
 */
export function inviteRejectedError(_reason: InviteRejectionReason): InviteError {
  return new InviteError(INVITE_REJECTED_CODE, INVITE_REJECTED_MESSAGE);
}

/**
 * REPONSE UNIQUE de tout refus d'EMISSION.
 *
 * `permission-denied` est retenu plutot que `not-found` parce que c'est le cas
 * de tres loin le plus frequent en pratique (quelqu'un qui n'est pas coach du
 * club vise), et parce qu'il ne suggere rien sur l'existence de la cible.
 */
export const ISSUE_REJECTED_CODE: InviteErrorCode = "permission-denied";
export const ISSUE_REJECTED_MESSAGE =
  "Impossible d'emettre un code d'invitation pour ce club.";

/** Raisons INTERNES d'un refus d'emission. Elles ne sortent JAMAIS de ce module. */
export type IssueRejectionReason = "invalid-club-id" | "club-missing" | "not-coach";

/**
 * Traduit une raison interne d'emission en erreur publique. Comme pour le
 * rattachement, `reason` est volontairement IGNORE : la signature l'exige pour
 * que l'appelant nomme ce qu'il refuse, mais toutes les raisons produisent le
 * meme objet. Separer ces trois cas rouvrirait l'oracle d'existence de club.
 */
export function issueRejectedError(_reason: IssueRejectionReason): InviteError {
  return new InviteError(ISSUE_REJECTED_CODE, ISSUE_REJECTED_MESSAGE);
}

/**
 * Borne de forme d'un identifiant de club. Un identifiant Firestore fait 20
 * caracteres ; tout ce qui depasse largement, ou qui contient un separateur de
 * chemin, est une saisie forgee — refusee AVANT toute lecture, donc sans meme
 * couter une requete.
 */
export const MAX_CLUB_ID_LENGTH = 128;

/** Forme acceptable d'un identifiant de club (jamais un verdict d'existence). */
export function isPlausibleClubId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CLUB_ID_LENGTH) return false;
  // Un "/" transformerait `clubs/{id}` en un autre chemin que celui prevu.
  return !trimmed.includes("/") && !trimmed.includes("..");
}

// ─── Normalisation / format / hachage ───────────────────────────────────────

/**
 * Forme CANONIQUE d'un code saisi : majuscules, tout ce qui n'est pas
 * alphanumerique retire (espaces, tirets, points, insecables colles par un
 * copier-coller). C'est cette forme qui est hachee, des deux cotes.
 *
 * Corrige au passage le piege signale par l'audit : "ABCDE FGHJK" (espace au
 * lieu du tiret) et "abcde-fghjk" donnent desormais le meme code.
 */
export function normalizeInviteCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Forme AFFICHEE ("ABCDE-FGHJK"). Jamais hachee, jamais comparee. */
export function formatInviteCode(canonical: string): string {
  const groups: string[] = [];
  for (let i = 0; i < canonical.length; i += INVITE_CODE_GROUP_SIZE) {
    groups.push(canonical.slice(i, i + INVITE_CODE_GROUP_SIZE));
  }
  return groups.join("-");
}

/** Empreinte stockee en base (hexadecimal minuscule). Voir l'entete pour le choix SHA-256. */
export function hashInviteCode(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Tirage du code. `randomBytes` est injectable POUR LES TESTS uniquement — la
 * valeur par defaut est le generateur cryptographique de Node. Math.random()
 * n'apparait nulle part.
 *
 * Anti-biais : chaque octet est reduit a 5 bits (0..31) ; les valeurs 31 (hors
 * alphabet, qui en compte 31 → indices 0..30) sont REJETEES et non repliees par
 * un modulo, qui rendrait les premiers symboles plus probables.
 */
export function generateInviteCode(
  randomBytes: (n: number) => Uint8Array = cryptoRandomBytes,
): string {
  let out = "";
  let guard = 0;
  while (out.length < INVITE_CODE_LENGTH) {
    if (++guard > 64) {
      // Source d'alea pathologique (ne renvoie que des octets rejetes) : mieux
      // vaut echouer bruyamment que produire un code previsible.
      throw new InviteError(INVITE_UNAVAILABLE_CODE, INVITE_UNAVAILABLE_MESSAGE);
    }
    const chunk = randomBytes(INVITE_CODE_LENGTH * 2);
    for (let i = 0; i < chunk.length && out.length < INVITE_CODE_LENGTH; i++) {
      const index = chunk[i] & 0b11111;
      if (index >= INVITE_CODE_ALPHABET.length) continue;
      out += INVITE_CODE_ALPHABET[index];
    }
  }
  return out;
}

/**
 * Cle de portee "origine" : l'IP n'est jamais stockee en clair.
 * Le prefixe vient de la politique du geste (vide pour le rattachement, afin de
 * ne pas renommer les compteurs deja en base).
 */
export function originScopeKey(origin: string, prefix = ""): string {
  return `${prefix}ip_${createHash("sha256").update(origin, "utf8").digest("hex").slice(0, 32)}`;
}

/** Cle de portee "utilisateur". Meme regle de prefixe. */
export function userScopeKey(uid: string, prefix = ""): string {
  return `${prefix}uid_${uid}`;
}

// ─── Etat d'un code stocke ──────────────────────────────────────────────────

export type InviteRecord = {
  clubId: string;
  expiresAt: number;
  maxUses: number;
  uses: number;
  revokedAt: number | null;
};

export type InviteEvaluation =
  | { ok: true; record: InviteRecord }
  | { ok: false; reason: InviteRejectionReason };

/**
 * Lit et juge un document d'invitation. Un document malforme (champs absents ou
 * de mauvais type) est traite comme un code inconnu : fail-closed.
 */
export function evaluateInviteRecord(raw: unknown, now: number): InviteEvaluation {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "unknown" };
  const data = raw as Record<string, unknown>;

  const clubId = typeof data.clubId === "string" ? data.clubId.trim() : "";
  const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : NaN;
  const maxUses = typeof data.maxUses === "number" ? data.maxUses : NaN;
  const uses = typeof data.uses === "number" ? data.uses : NaN;
  const revokedAt = typeof data.revokedAt === "number" ? data.revokedAt : null;

  if (!clubId || !Number.isFinite(expiresAt) || !Number.isFinite(maxUses) || !Number.isFinite(uses)) {
    return { ok: false, reason: "malformed" };
  }
  if (revokedAt !== null) return { ok: false, reason: "revoked" };
  if (now >= expiresAt) return { ok: false, reason: "expired" };
  if (uses >= maxUses) return { ok: false, reason: "exhausted" };

  return { ok: true, record: { clubId, expiresAt, maxUses, uses, revokedAt } };
}

// ─── Etat de limitation de tentatives ───────────────────────────────────────

export type AttemptState = {
  /** Horodatages (ms) des echecs retenus, deja bornes. */
  failures: number[];
  /** ms epoch de fin de blocage, ou null. */
  blockedUntil: number | null;
};

export const EMPTY_ATTEMPT_STATE: AttemptState = { failures: [], blockedUntil: null };

/** Lecture defensive d'un compteur (doc absent / champs pourris → etat vide). */
export function readAttemptState(raw: unknown): AttemptState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ATTEMPT_STATE };
  const data = raw as Record<string, unknown>;
  const failures = Array.isArray(data.failures)
    ? data.failures.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    : [];
  const blockedUntil =
    typeof data.blockedUntil === "number" && Number.isFinite(data.blockedUntil)
      ? data.blockedUntil
      : null;
  return { failures, blockedUntil };
}

/** Le blocage est-il ENCORE actif ? (une fenetre de blocage expiree ne bloque plus) */
export function isAttemptBlocked(state: AttemptState, now: number): boolean {
  return state.blockedUntil !== null && state.blockedUntil > now;
}

/**
 * Enregistre un echec et dit si le seuil vient d'etre franchi.
 * Seuls les echecs DANS la fenetre comptent : un compte qui se trompe deux fois
 * par mois n'est jamais bloque.
 */
export function registerAttemptFailure(
  state: AttemptState,
  now: number,
  max: number,
  opts?: { windowMs?: number; blockMs?: number },
): { next: AttemptState; thresholdReached: boolean } {
  const windowMs = opts?.windowMs ?? INVITE_ATTEMPT_WINDOW_MS;
  const blockMs = opts?.blockMs ?? INVITE_ATTEMPT_BLOCK_MS;

  const recent = state.failures.filter((t) => now - t < windowMs);
  recent.push(now);
  const trimmed = recent.slice(-ATTEMPT_HISTORY_CAP);
  const thresholdReached = trimmed.length >= max;

  return {
    next: {
      failures: trimmed,
      blockedUntil: thresholdReached
        ? now + blockMs
        : isAttemptBlocked(state, now)
          ? state.blockedUntil
          : null,
    },
    thresholdReached,
  };
}

// ─── Port de persistance ────────────────────────────────────────────────────

export type DocData = Record<string, unknown>;

export type InviteTx = {
  /** Toutes les lectures d'une transaction doivent preceder toutes les ecritures. */
  get(path: string): Promise<DocData | null>;
  set(path: string, data: DocData, opts?: { merge?: boolean }): void;
};

export type InviteStore = {
  get(path: string): Promise<DocData | null>;
  set(path: string, data: DocData, opts?: { merge?: boolean }): Promise<void>;
  runTransaction<T>(fn: (tx: InviteTx) => Promise<T>): Promise<T>;
};

export const invitePaths = {
  code: (hash: string) => `inviteCodes/${hash}`,
  meta: (clubId: string) => `clubInviteMeta/${clubId}`,
  attempt: (scopeKey: string) => `inviteAttempts/${scopeKey}`,
  club: (clubId: string) => `clubs/${clubId}`,
  member: (clubId: string, uid: string) => `clubs/${clubId}/members/${uid}`,
  user: (uid: string) => `users/${uid}`,
} as const;

export type AbuseSignal = {
  scope: "user" | "origin";
  uid: string;
  at: number;
};

export type InviteDeps = {
  store: InviteStore;
  now: () => number;
  /** Journalisation SOBRE : appelee UNIQUEMENT au franchissement d'un seuil. */
  onAbuse?: (signal: AbuseSignal) => void;
  /** Injection de l'alea (tests). */
  randomBytes?: (n: number) => Uint8Array;
};

// ─── Garde de limitation, PARTAGEE par les deux portes ──────────────────────
// Un seul mecanisme, deux politiques. Ecrire un second compteur en parallele
// aurait garanti qu'ils divergent : c'est exactement ce qu'on evite ici.

type AttemptScopeState = {
  key: string;
  scope: "user" | "origin";
  max: number;
  state: AttemptState;
};

/**
 * Lit les compteurs des deux portees et REFUSE tout de suite si l'une est
 * bloquee.
 *
 * FAIL-CLOSED : un compteur illisible leve `unavailable`. Une panne de la
 * limitation ne vaut JAMAIS permission d'essayer a l'infini — c'est le seul
 * comportement acceptable pour un garde-fou anti-enumeration.
 */
async function loadAttemptScopes(
  deps: InviteDeps,
  policy: AttemptPolicy,
  uid: string,
  originKey: unknown,
  now: number,
): Promise<AttemptScopeState[]> {
  const planned: { key: string; scope: "user" | "origin"; max: number }[] = [
    { key: userScopeKey(uid, policy.keyPrefix), scope: "user", max: policy.maxPerUser },
  ];

  const origin = typeof originKey === "string" ? originKey.trim() : "";
  if (origin) {
    planned.push({
      key: originScopeKey(origin, policy.keyPrefix),
      scope: "origin",
      max: policy.maxPerOrigin,
    });
  }

  const states: AttemptScopeState[] = [];
  for (const s of planned) {
    let raw: DocData | null;
    try {
      raw = await deps.store.get(invitePaths.attempt(s.key));
    } catch {
      throw new InviteError(INVITE_UNAVAILABLE_CODE, INVITE_UNAVAILABLE_MESSAGE);
    }
    states.push({ ...s, state: readAttemptState(raw) });
  }

  if (states.some((s) => isAttemptBlocked(s.state, now))) {
    throw new InviteError(INVITE_RATE_LIMITED_CODE, INVITE_RATE_LIMITED_MESSAGE);
  }

  return states;
}

/**
 * Incremente les compteurs des deux portees et signale UNE FOIS le
 * franchissement de seuil.
 *
 * Journalisation sobre : le signal ne porte que la portee, l'uid et l'instant.
 * JAMAIS le code tente, JAMAIS son empreinte, JAMAIS l'identifiant de club
 * vise — un journal qui contiendrait ces valeurs serait exactement
 * l'enumeration qu'on vient de fermer, ecrite de notre propre main. Le geste
 * concerne (emission ou rattachement) est connu de l'APPELANT, qui choisit son
 * callback : il n'a pas besoin de transiter par le signal.
 *
 * Une ecriture de compteur qui echoue ne renvoie PAS l'utilisateur vers un
 * succes : on est deja sur le chemin du refus, l'erreur generique est levee par
 * l'appelant quoi qu'il arrive.
 */
async function recordAttemptFailure(
  deps: InviteDeps,
  policy: AttemptPolicy,
  scopes: AttemptScopeState[],
  uid: string,
  now: number,
): Promise<void> {
  for (const s of scopes) {
    const { next, thresholdReached } = registerAttemptFailure(s.state, now, s.max, {
      windowMs: policy.windowMs,
      blockMs: policy.blockMs,
    });
    try {
      await deps.store.set(invitePaths.attempt(s.key), {
        failures: next.failures,
        blockedUntil: next.blockedUntil,
        updatedAt: now,
      });
    } catch {
      // Compteur non ecrit : on continue vers le refus. Rien n'est ouvert.
    }
    if (thresholdReached) {
      deps.onAbuse?.({ scope: s.scope, uid, at: now });
    }
  }
}

// ─── Emission d'un code (coach / owner) ─────────────────────────────────────

export type IssueResult = {
  /** Code AFFICHABLE. Renvoye une seule fois, jamais relisible ensuite. */
  code: string;
  expiresAt: number;
  maxUses: number;
  /** true si un code precedent vient d'etre revoque par cette emission. */
  replacedPrevious: boolean;
};

type IssueTxOutcome =
  | { ok: true; result: IssueResult }
  | { ok: false; reason: IssueRejectionReason };

/**
 * Emet un code pour un club. AUTORISATION VERIFIEE SERVEUR : owner du club, ou
 * membre portant le role "coach". Un joueur, meme membre, ne peut pas emettre.
 *
 * Emettre revoque le code precedent du meme club (un seul code vivant a la
 * fois) — c'est aussi le chemin de secours quand le coach a perdu son code.
 *
 * Sequence, dans cet ordre exact :
 *   1. limitation de tentatives (utilisateur ET origine) — fail-closed ;
 *   2. forme de l'identifiant de club, sans aucune lecture ;
 *   3. transaction : club, autorisation, tirage, ecritures ;
 *   4. tout refus incremente les compteurs et renvoie la MEME erreur.
 *
 * `unauthenticated` reste distinct des trois refus : il parle de la session de
 * l'appelant, pas de la cible. Il n'apprend donc rien sur l'existence d'un club.
 */
export async function issueInviteCode(
  deps: InviteDeps,
  params: { uid: string; clubId: unknown; originKey?: string | null },
): Promise<IssueResult> {
  const uid = String(params.uid ?? "").trim();
  if (!uid) throw new InviteError("unauthenticated", "Connexion requise.");

  const now = deps.now();

  // 1. Limitation AVANT toute lecture de club : un balayage ne doit pas pouvoir
  //    s'acheter une requete Firestore par essai.
  const scopes = await loadAttemptScopes(deps, ISSUE_ATTEMPT_POLICY, uid, params.originKey, now);

  // 2. Forme de l'identifiant. Un identifiant vide, non-chaine, structure ou
  //    demesure est refuse EXACTEMENT comme un club inexistant.
  if (!isPlausibleClubId(params.clubId)) {
    await recordAttemptFailure(deps, ISSUE_ATTEMPT_POLICY, scopes, uid, now);
    throw issueRejectedError("invalid-club-id");
  }
  const clubId = params.clubId.trim();

  // 3. Transaction. Comme au rattachement, elle ne LEVE pas sur un refus
  //    metier : elle renvoie la raison, pour que l'increment des compteurs se
  //    fasse HORS transaction (un rejeu pour contention ne doit pas compter
  //    plusieurs echecs).
  let outcome: IssueTxOutcome;
  try {
    outcome = await deps.store.runTransaction<IssueTxOutcome>(async (tx) => {
      // ── Lectures d'abord (contrainte Firestore) ──────────────────────────
      const club = await tx.get(invitePaths.club(clubId));
      if (!club) return { ok: false, reason: "club-missing" };

      const isOwner = typeof club.ownerUid === "string" && club.ownerUid === uid;
      let isCoach = false;
      if (!isOwner) {
        const member = await tx.get(invitePaths.member(clubId, uid));
        isCoach = !!member && member.role === "coach";
      }
      if (!isOwner && !isCoach) return { ok: false, reason: "not-coach" };

      const meta = await tx.get(invitePaths.meta(clubId));
      const previousHash = typeof meta?.activeCodeHash === "string" ? meta.activeCodeHash : null;

      // Le tirage est fait DANS la transaction : si celle-ci est rejouee pour
      // cause de contention, le code renvoye est toujours celui reellement
      // commite (jamais un code fantome tire avant un rejeu).
      const canonical = generateInviteCode(deps.randomBytes);
      const hash = hashInviteCode(canonical);
      const expiresAt = now + INVITE_CODE_TTL_MS;

      // ── Ecritures ────────────────────────────────────────────────────────
      const replacedPrevious = previousHash !== null && previousHash !== hash;
      if (replacedPrevious) {
        tx.set(invitePaths.code(previousHash as string), { revokedAt: now }, { merge: true });
      }

      tx.set(invitePaths.code(hash), {
        clubId,
        createdBy: uid,
        createdAt: now,
        expiresAt,
        maxUses: INVITE_CODE_MAX_USES,
        uses: 0,
        revokedAt: null,
      });

      tx.set(invitePaths.meta(clubId), { activeCodeHash: hash, updatedAt: now });

      return {
        ok: true,
        result: {
          code: formatInviteCode(canonical),
          expiresAt,
          maxUses: INVITE_CODE_MAX_USES,
          replacedPrevious,
        },
      };
    });
  } catch (err) {
    if (err instanceof InviteError) throw err;
    throw new InviteError(INVITE_UNAVAILABLE_CODE, INVITE_UNAVAILABLE_MESSAGE);
  }

  if (!outcome.ok) {
    await recordAttemptFailure(deps, ISSUE_ATTEMPT_POLICY, scopes, uid, now);
    throw issueRejectedError(outcome.reason);
  }

  return outcome.result;
}

// ─── Rattachement d'un joueur ───────────────────────────────────────────────

export type JoinResult = {
  clubId: string;
  clubName: string | null;
  /** true si l'utilisateur etait DEJA membre (rejeu) : aucun usage consomme. */
  alreadyMember: boolean;
  /**
   * Etat d'autorisation d'acces AU MOMENT du rattachement.
   *
   * Renvoye au joueur pour que l'app puisse lui dire honnetement ce qui se passe
   * ("ton coach verra ton suivi" vs "une etape reste a faire"). Ce n'est PAS une
   * valeur que le client peut choisir : elle est calculee et ecrite ici, cote
   * serveur, et aucun client ne peut la modifier ensuite.
   *
   * Sur un rejeu (`alreadyMember`), c'est l'etat DEJA en base qui est renvoye :
   * rejoindre deux fois ne remet jamais une autorisation a zero.
   */
  coachAccess: CoachAccessState;
};

type JoinTxOutcome =
  | { ok: true; result: JoinResult }
  | { ok: false; reason: InviteRejectionReason };

/**
 * Unique chemin de rattachement d'un joueur a un club.
 *
 * Sequence, dans cet ordre exact :
 *   1. limitation de tentatives (utilisateur ET origine) — fail-closed ;
 *   2. normalisation + hachage cote serveur ;
 *   3. transaction : lecture du code, du membership existant et du club, puis
 *      increment BORNE de `uses` et ecriture du membership ;
 *   4. tout refus incremente les compteurs et renvoie la MEME erreur.
 */
export async function joinClubWithCode(
  deps: InviteDeps,
  params: { uid: string; originKey?: string | null; rawCode: unknown },
): Promise<JoinResult> {
  const uid = String(params.uid ?? "").trim();
  if (!uid) throw new InviteError("unauthenticated", "Connexion requise.");

  const now = deps.now();

  // 1. Etat des compteurs (lecture + blocage), mecanisme PARTAGE avec l'emission.
  const states = await loadAttemptScopes(deps, JOIN_ATTEMPT_POLICY, uid, params.originKey, now);

  // 2. Normalisation serveur : la saisie du joueur n'est jamais crue telle quelle.
  const canonical = normalizeInviteCode(params.rawCode);
  if (!canonical) {
    await recordAttemptFailure(deps, JOIN_ATTEMPT_POLICY, states, uid, now);
    throw inviteRejectedError("malformed");
  }
  const hash = hashInviteCode(canonical);

  // 3. Transaction. Elle ne LEVE pas sur un refus metier : elle renvoie la
  //    raison, pour que l'increment des compteurs se fasse HORS transaction
  //    (un rejeu pour contention ne doit pas compter plusieurs echecs).
  let outcome: JoinTxOutcome;
  try {
    outcome = await deps.store.runTransaction<JoinTxOutcome>(async (tx) => {
      const codeDoc = await tx.get(invitePaths.code(hash));
      const evaluation = evaluateInviteRecord(codeDoc, now);
      if (!evaluation.ok) return { ok: false, reason: evaluation.reason };

      const { record } = evaluation;
      const existingMember = await tx.get(invitePaths.member(record.clubId, uid));
      const club = await tx.get(invitePaths.club(record.clubId));
      if (!club) return { ok: false, reason: "club-missing" };

      const clubName = typeof club.name === "string" ? club.name : null;
      const alreadyMember = !!existingMember;

      // ── Etat d'autorisation d'acces ────────────────────────────────────
      // Le rattachement (ce membership) et l'autorisation de consultation
      // restent DEUX choses distinctes ; c'est la POLITIQUE DU CLUB qui decide
      // de la position de l'interrupteur a l'entree :
      //  - membre deja present avec un etat VALIDE -> on le conserve tel quel
      //    (un rejeu ne doit jamais annuler une autorisation deja accordee, ni
      //    reveiller un acces revoque) ;
      //  - sinon -> etat initial de la politique du club : "not_required" en
      //    mode par defaut (automatic_safe_projection), "pending" en mode
      //    approval_required.
      //
      // AUCUNE LECTURE DU PROFIL DU JOUEUR sur ce chemin. Le document
      // users/{uid} n'est plus lu du tout ici (il n'est qu'ECRIT, plus bas,
      // pour poser le clubId) : la categorie d'age ne peut donc pas influencer
      // l'etat, meme par accident. C'est la preuve la plus simple qu'il n'y a
      // plus de verrou d'age — la donnee n'est pas dans la transaction.
      const existingAccess = normalizeCoachAccess(existingMember?.[COACH_ACCESS_FIELD]);
      const coachAccess = existingAccess ?? initialCoachAccess(club[COACH_ACCESS_POLICY_FIELD]);

      // Rejeu du meme joueur : on ne consomme PAS un usage supplementaire.
      // Sans ce garde-fou, un double-tap epuiserait le quota du club.
      if (!alreadyMember) {
        tx.set(invitePaths.code(hash), { uses: record.uses + 1 }, { merge: true });
      }

      tx.set(
        invitePaths.member(record.clubId, uid),
        {
          uid,
          role: "player",
          joinedAt: now,
          updatedAt: now,
          // ECRIT UNIQUEMENT ICI, cote serveur. Les regles Firestore interdisent
          // a tout client de poser ou de modifier ce champ.
          [COACH_ACCESS_FIELD]: coachAccess,
        },
        { merge: true },
      );

      tx.set(
        invitePaths.user(uid),
        { uid, clubId: record.clubId, updatedAt: now },
        { merge: true },
      );

      return { ok: true, result: { clubId: record.clubId, clubName, alreadyMember, coachAccess } };
    });
  } catch (err) {
    if (err instanceof InviteError) throw err;
    throw new InviteError(INVITE_UNAVAILABLE_CODE, INVITE_UNAVAILABLE_MESSAGE);
  }

  if (!outcome.ok) {
    await recordAttemptFailure(deps, JOIN_ATTEMPT_POLICY, states, uid, now);
    throw inviteRejectedError(outcome.reason);
  }

  return outcome.result;
}
