import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  normalizeClubTrainingIntensity,
  normalizeClubWeekGoal,
  normalizeTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import { parseCoachPlayerSummary, type CoachPlayerSummary } from "../domain/coachSummary";

export type ClubDoc = {
  id: string;
  name: string;
  inviteCode: string;
  ownerUid: string;
};

export type ClubRole = "coach" | "player";

export const normalizeInviteCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");

const randomDigits = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

const randomLetters = (n: number) => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ"; // sans I/L/O (lisibilité)
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

export const generateInviteCode = (clubName?: string) => {
  const base = String(clubName ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const prefix = (base.length >= 3 ? base : randomLetters(4)).slice(0, 4);
  return `${prefix}-${randomDigits(4)}`;
};

/**
 * Résout un code d'invitation via l'annuaire /inviteCodes/{code} (doc ID = code).
 * Sécurité : plus AUCUNE query sur la collection clubs (les rules interdisent
 * désormais toute list sur clubs → énumération fermée). Le get par code exact est
 * la seule découverte possible : connaître le code EST la capability.
 * `ownerUid` n'est volontairement pas exposé par l'annuaire → toujours "".
 */
export async function findClubByInviteCode(inviteCodeRaw: string): Promise<ClubDoc | null> {
  const inviteCode = normalizeInviteCode(inviteCodeRaw);
  if (!inviteCode) return null;

  const snap = await getDoc(doc(db, "inviteCodes", inviteCode));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const clubId = typeof data?.clubId === "string" ? data.clubId.trim() : "";
  if (!clubId) return null;

  return {
    id: clubId,
    name: typeof data?.name === "string" ? data.name : "Club",
    inviteCode,
    ownerUid: "",
  };
}

export async function createClub(opts: { name: string; ownerUid: string }): Promise<ClubDoc> {
  const name = String(opts.name ?? "").trim();
  if (!name) throw new Error("CLUB_NAME_REQUIRED");

  const clubRef = doc(collection(db, "clubs"));
  // Unicité du code via l'annuaire (doc ID = code) : un get exact remplace
  // l'ancienne query sur clubs (interdite par les rules anti-énumération).
  let inviteCode = generateInviteCode(name);
  for (let i = 0; i < 5; i++) {
    const snap = await getDoc(doc(db, "inviteCodes", inviteCode));
    if (!snap.exists()) break;
    inviteCode = generateInviteCode(name);
  }

  await setDoc(
    clubRef,
    {
      name,
      inviteCode,
      ownerUid: opts.ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Annuaire code→club. Les rules exigent : owner du club + code cohérent avec
  // clubs/{id}.inviteCode (d'où l'ordre club PUIS annuaire). Si le code a été
  // pris entre le check et l'écriture (setDoc sur doc existant = update → refusé),
  // on régénère un code, on met à jour le club, et on retente.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await setDoc(doc(db, "inviteCodes", inviteCode), {
        clubId: clubRef.id,
        name,
        createdAt: serverTimestamp(),
      });
      return { id: clubRef.id, name, inviteCode, ownerUid: opts.ownerUid };
    } catch (err) {
      lastError = err;
      inviteCode = generateInviteCode(name);
      await setDoc(clubRef, { inviteCode, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("INVITE_CODE_REGISTRATION_FAILED");
}

/**
 * Écrit le membership. Pour un `role: "player"`, `inviteCode` est OBLIGATOIRE :
 * les rules ne créent/mettent à jour un membership player que si le doc porte
 * le code d'invitation EXACT du club (preuve d'invitation — anti self-join).
 * Le rôle coach reste réservé à l'owner du club (vérifié par les rules).
 */
export async function setClubMembership(opts: {
  clubId: string;
  uid: string;
  role: ClubRole;
  inviteCode?: string;
}) {
  const memberRef = doc(db, "clubs", opts.clubId, "members", opts.uid);
  const inviteCode = opts.inviteCode ? normalizeInviteCode(opts.inviteCode) : "";
  await setDoc(
    memberRef,
    {
      uid: opts.uid,
      role: opts.role,
      ...(inviteCode ? { inviteCode } : {}),
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function attachUserToClub(opts: { uid: string; clubId: string; role: ClubRole }) {
  const userRef = doc(db, "users", opts.uid);
  await setDoc(
    userRef,
    {
      uid: opts.uid,
      clubId: opts.clubId,
      role: opts.role,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeClubMembership(opts: { clubId: string; uid: string }) {
  const memberRef = doc(db, "clubs", opts.clubId, "members", opts.uid);
  await deleteDoc(memberRef);
}

/**
 * Crée un club et rattache l'utilisateur comme coach en une seule opération :
 *  - clubs/{clubId}
 *  - clubs/{clubId}/members/{uid} (role: "coach")
 *  - users/{uid} { clubId, role: "coach", profileCompleted: true }
 * Le coach n'a pas besoin du questionnaire joueur : on marque profileCompleted
 * pour qu'il atterrisse directement sur son espace coach.
 */
export async function createClubAsCoach(opts: {
  name: string;
  uid: string;
  coachName?: string | null;
}): Promise<ClubDoc> {
  const club = await createClub({ name: opts.name, ownerUid: opts.uid });
  await setClubMembership({ clubId: club.id, uid: opts.uid, role: "coach" });

  const coachName = String(opts.coachName ?? "").trim();
  await setDoc(
    doc(db, "users", opts.uid),
    {
      uid: opts.uid,
      clubId: club.id,
      role: "coach",
      ...(coachName ? { firstName: coachName } : {}),
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return club;
}

// ─── Vue coach : projection coach-safe (lecture SEULE) ──────────────────────
// Le coach ne lit QUE clubs/{clubId}/members (pour connaître l'effectif player)
// et clubs/{clubId}/playerSummaries/{memberId} — jamais users/{uid}, jamais
// users/{uid}/sessions ni /plannedSessions. La projection est produite serveur
// (Cloud Function, PR-2) : labels déjà traduits, aucune donnée médicale / RPE /
// TSB / token brut. Un doc malformé/absent → "projection non prête" (pending),
// jamais dropé en silence ; une lecture refusée (permissions/réseau) → comptée
// dans `unreadableCount` et annoncée telle quelle, sans crash ni fallback vers
// les lectures brutes. Trois compteurs DISTINCTS, jamais confondus :
//   prêt (summaries) · pas encore projeté (pendingCount) · non lu (unreadableCount).
//
// POURQUOI members → summaries (et pas un getDocs de collection) : la règle
// Firestore de playerSummaries exige que la JOUEUSE ciblée soit ENCORE membre
// player (anti-projection stale). Cette contrainte porte sur l'ID du document,
// donc une lecture de COLLECTION (list) est refusée en bloc par les rules
// (impossible à évaluer par doc). On lit donc l'effectif via members, puis
// CHAQUE summary directement par son ID.
//
// Coût Firestore (à assumer) : 1 requête members (facturée ~1 lecture par doc
// member) + 1 getDoc par joueuse active. Pour 15 joueuses + 1 coach ≈ 16 + 15 =
// ~31 lectures/refresh (vs ~15 pour l'ancien getDocs de collection). C'est le
// prix du garde-fou anti-stale. Bornes : MEMBERS_FETCH_LIMIT plafonne l'effectif
// lu ; SUMMARY_READ_CONCURRENCY borne le parallélisme (pas de rafale simultanée).

// Garde-fou anti-scan : un effectif club reste raisonnable. Borne haute large.
//
// EXPORTÉE parce que l'écran Effectif ANNONCE ce plafond en pied de liste
// ("seuls les 200 premiers membres sont lus"). Recopié à la main, ce nombre
// mentirait au premier changement de valeur ici : le plafond affiché doit être
// le plafond réellement appliqué, jamais un jumeau.
export const MEMBERS_FETCH_LIMIT = 200;
// Parallélisme borné des lectures de summary (évite N getDoc simultanés).
const SUMMARY_READ_CONCURRENCY = 8;

export type CoachSummariesResult = {
  summaries: CoachPlayerSummary[]; // projections prêtes & valides (playerUid === memberId)
  // Nombre de membres player actifs SANS summary prêt (projection non prête). On
  // expose un COMPTEUR, jamais les UIDs : aucun identifiant technique côté UI.
  pendingCount: number;
  // Nombre de membres player actifs dont la LECTURE a échoué (permissions/réseau,
  // ou départ du club pendant le refresh). SÉMANTIQUE DISTINCTE de pendingCount :
  // "pas encore préparé par le serveur" ≠ "je n'ai pas réussi à lire". L'écran
  // annonce explicitement "N profils non lus" → l'honnêteté est préservée sans
  // vider tout l'effectif pour un seul échec.
  unreadableCount: number;
  // true UNIQUEMENT si l'effectif est globalement illisible : échec de la lecture
  // de `members` (on ne connaît même pas le roster), ou échec de TOUTES les
  // lectures de summary. Un échec PARTIEL ne bascule plus l'écran en vide.
  unavailable: boolean;
  // Horodatage (ms epoch) de fin de lecture — sert l'affichage de fraîcheur et
  // l'anti-rebond côté hook. Injectable (`opts.now`) pour rester testable.
  fetchedAt: number;
};

export type CoachSummaryResult = {
  summary: CoachPlayerSummary | null; // null = absent, malformé, OU doc-id/playerUid incohérent
  unavailable: boolean; // true si la lecture du doc a échoué (permissions/réseau)
};

/**
 * map bornée en concurrence : au plus `limit` promesses actives à la fois.
 * (Évite un Promise.all de 200 lectures simultanées.)
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Effectif → résumés joueurs, aligné sur la règle stricte playerSummaries.
 *  1. lit clubs/{clubId}/members (borné) ;
 *  2. ne garde que role === "player" (exclut coach / rôle invalide) ;
 *  3. lit CHAQUE clubs/{clubId}/playerSummaries/{memberId} directement (concurrence bornée),
 *     via le lecteur doc unique (intégrité playerUid === memberId, parse défensif, zéro fallback) ;
 *  4. membre sans summary / payload malformé → compté dans `pendingCount` (projection non prête, jamais dropé) ;
 *  5. lecture d'un summary refusée → compté dans `unreadableCount`, les AUTRES sont conservés ;
 *  6. `unavailable` (roster globalement illisible) UNIQUEMENT si `members` échoue,
 *     ou si TOUTES les lectures de summary échouent.
 *
 * POURQUOI on ne vide plus tout au premier échec : avec N+1 requêtes sur un réseau
 * de stade, et le cas NORMAL d'un joueur qui quitte le club pendant le refresh
 * (la rule refuse alors son summary), la règle "un échec = roster vide" transformait
 * 29 projections lisibles sur 30 en écran vide. L'honnêteté n'est pas sacrifiée :
 * elle est déplacée dans un compteur explicite (`unreadableCount`) que l'écran
 * annonce ("N profils non lus"), au lieu d'un silence total.
 */
export async function fetchClubPlayerSummaries(
  clubId: string,
  opts?: { now?: () => number },
): Promise<CoachSummariesResult> {
  // Horloge injectable : le repository ne décide de rien de temporel, il HORODATE
  // seulement sa lecture (le calcul de fraîcheur reste côté front, avec l'horloge du coach).
  const now = opts?.now ?? Date.now;

  // 1–2. Effectif player actif (source de vérité du roster). Échec → indisponible global :
  //      sans `members`, on ne connaît même pas la liste des joueurs à lire.
  let playerMemberIds: string[];
  try {
    const snap = await getDocs(
      query(collection(db, "clubs", clubId, "members"), limit(MEMBERS_FETCH_LIMIT)),
    );
    playerMemberIds = snap.docs
      .filter((d) => (d.data() as { role?: unknown })?.role === "player")
      .map((d) => d.id);
  } catch {
    return {
      summaries: [],
      pendingCount: 0,
      unreadableCount: 0,
      unavailable: true,
      fetchedAt: now(),
    };
  }

  // 3. Une lecture directe de summary par membre actif (parallélisme borné).
  const reads = await mapWithConcurrency(playerMemberIds, SUMMARY_READ_CONCURRENCY, (memberId) =>
    fetchClubPlayerSummary(clubId, memberId).then((res) => ({ memberId, ...res })),
  );

  const summaries: CoachPlayerSummary[] = [];
  let pendingCount = 0;
  let unreadableCount = 0;
  for (const r of reads) {
    // 5. Lecture refusée (permissions/réseau, ex: départ entre members et get) :
    //    on la COMPTE et on continue — les autres projections restent affichables.
    if (r.unavailable) {
      unreadableCount += 1;
      continue;
    }
    // 4. Prêt & valide vs projection non prête (absent/malformé/mismatch → null).
    //    On ne garde que le COMPTEUR (jamais l'UID) → rien de technique à l'écran.
    if (r.summary) summaries.push(r.summary);
    else pendingCount += 1;
  }

  // 6. Tout l'effectif illisible = état global honnête. Un effectif VIDE (0 membre
  //    player) n'est pas une indisponibilité : c'est un vrai club sans joueur.
  const unavailable = playerMemberIds.length > 0 && unreadableCount === playerMemberIds.length;

  return { summaries, pendingCount, unreadableCount, unavailable, fetchedAt: now() };
}

/** Lit le résumé d'un seul joueur (doc unique). */
export async function fetchClubPlayerSummary(
  clubId: string,
  playerUid: string,
): Promise<CoachSummaryResult> {
  try {
    const snap = await getDoc(doc(db, "clubs", clubId, "playerSummaries", playerUid));
    if (!snap.exists()) return { summary: null, unavailable: false };
    const parsed = parseCoachPlayerSummary(snap.data());
    // Intégrité : le payload doit décrire EXACTEMENT le joueur demandé. Sinon on
    // renvoie null (jamais afficher/ouvrir un autre UID que celui de la route).
    if (!parsed || parsed.playerUid !== playerUid) return { summary: null, unavailable: false };
    return { summary: parsed, unavailable: false };
  } catch {
    return { summary: null, unavailable: true };
  }
}

// ─── Contexte de semaine club ──────────────────────────────────────────────
// "Le coach donne le terrain. FKS construit la prépa." Le coach renseigne
// l'intensité de la semaine + l'objectif ; il n'écrit jamais de séance.

export type ClubWeekContext = {
  weekKey: string;
  clubId: string;
  createdBy: string;
  trainingIntensity: ClubTrainingIntensity;
  weekGoal: ClubWeekGoal;
  note?: string | null;
  /** Match prévu ce week-end (info coach). null = non renseigné. */
  matchThisWeekend?: boolean | null;
};

/** Type d'équipe (genre) — attribut club stable, posé par le coach. Pas de donnée individuelle. */
export async function setClubTeamGender(clubId: string, gender: ClubTeamGender): Promise<void> {
  await setDoc(doc(db, "clubs", clubId), { teamGender: gender, updatedAt: serverTimestamp() }, { merge: true });
}

/** Lit le type d'équipe du club (null si absent/invalide). */
export async function getClubTeamGender(clubId: string): Promise<ClubTeamGender | null> {
  const snap = await getDoc(doc(db, "clubs", clubId));
  return snap.exists() ? normalizeTeamGender((snap.data() as any)?.teamGender) : null;
}

/** Sauvegarde (merge) le contexte de la semaine. Coach uniquement (cf. règles Firestore). */
export async function saveClubWeekContext(opts: {
  clubId: string;
  weekKey: string;
  uid: string;
  trainingIntensity: ClubTrainingIntensity;
  weekGoal: ClubWeekGoal;
  note?: string | null;
  matchThisWeekend?: boolean | null;
}): Promise<void> {
  const ref = doc(db, "clubs", opts.clubId, "weekContexts", opts.weekKey);
  const note = typeof opts.note === "string" ? opts.note.trim().slice(0, 200) : "";
  await setDoc(
    ref,
    {
      weekKey: opts.weekKey,
      clubId: opts.clubId,
      createdBy: opts.uid,
      trainingIntensity: opts.trainingIntensity,
      weekGoal: opts.weekGoal,
      note: note || null,
      matchThisWeekend: typeof opts.matchThisWeekend === "boolean" ? opts.matchThisWeekend : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Lit le contexte de semaine d'un club pour une weekKey. Null si absent/invalide. */
export async function getClubWeekContext(clubId: string, weekKey: string): Promise<ClubWeekContext | null> {
  const snap = await getDoc(doc(db, "clubs", clubId, "weekContexts", weekKey));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const trainingIntensity = normalizeClubTrainingIntensity(data?.trainingIntensity);
  const weekGoal = normalizeClubWeekGoal(data?.weekGoal);
  if (!trainingIntensity && !weekGoal) return null;
  return {
    weekKey,
    clubId,
    createdBy: typeof data?.createdBy === "string" ? data.createdBy : "",
    trainingIntensity: trainingIntensity ?? "normal",
    weekGoal: weekGoal ?? "freshness",
    note: typeof data?.note === "string" ? data.note : null,
    matchThisWeekend: typeof data?.matchThisWeekend === "boolean" ? data.matchThisWeekend : null,
  };
}
