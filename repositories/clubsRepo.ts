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
  where,
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

export async function findClubByInviteCode(inviteCodeRaw: string): Promise<ClubDoc | null> {
  const inviteCode = normalizeInviteCode(inviteCodeRaw);
  if (!inviteCode) return null;

  const q = query(collection(db, "clubs"), where("inviteCode", "==", inviteCode), limit(1));
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  const data = first.data() as any;

  return {
    id: first.id,
    name: typeof data?.name === "string" ? data.name : "Club",
    inviteCode: typeof data?.inviteCode === "string" ? data.inviteCode : inviteCode,
    ownerUid: typeof data?.ownerUid === "string" ? data.ownerUid : "",
  };
}

export async function createClub(opts: { name: string; ownerUid: string }): Promise<ClubDoc> {
  const name = String(opts.name ?? "").trim();
  if (!name) throw new Error("CLUB_NAME_REQUIRED");

  const clubRef = doc(collection(db, "clubs"));
  let inviteCode = generateInviteCode(name);
  for (let i = 0; i < 5; i++) {
    const q = query(collection(db, "clubs"), where("inviteCode", "==", inviteCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) break;
    inviteCode = generateInviteCode(name);
  }

  const payload = {
    name,
    inviteCode,
    ownerUid: opts.ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(clubRef, payload, { merge: true });

  return { id: clubRef.id, name, inviteCode, ownerUid: opts.ownerUid };
}

export async function setClubMembership(opts: { clubId: string; uid: string; role: ClubRole }) {
  const memberRef = doc(db, "clubs", opts.clubId, "members", opts.uid);
  await setDoc(
    memberRef,
    {
      uid: opts.uid,
      role: opts.role,
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
// Le coach ne lit QUE clubs/{clubId}/playerSummaries — jamais users/{uid},
// jamais users/{uid}/sessions ni /plannedSessions. La projection est produite
// serveur (Cloud Function, PR-2) : labels déjà traduits, aucune donnée médicale
// / RPE / TSB / token brut. Un doc malformé est ignoré (parseur défensif) ; une
// lecture refusée (permissions/réseau) → état "indisponible" propre, pas de crash
// et AUCUN fallback vers les lectures brutes.
//
// Coût Firestore : `fetchClubPlayerSummaries` = UNE requête de collection, mais
// facturée ~1 lecture document par joueuse (≈15 lectures pour 15 joueuses). Le
// gain vs l'ancien flux n'est PAS un forfait magique : c'est la suppression du
// N+1 réseau (1 aller-retour au lieu de 1 par joueuse) et l'arrêt de la lecture
// des historiques sessions/plannedSessions bruts.

// Garde-fou anti-scan : un effectif club reste raisonnable. Borne haute large.
const COACH_SUMMARY_FETCH_LIMIT = 200;

export type CoachSummariesResult = {
  summaries: CoachPlayerSummary[];
  unavailable: boolean; // true si la lecture de collection a échoué (permissions/réseau)
};

export type CoachSummaryResult = {
  summary: CoachPlayerSummary | null; // null = absent, malformé, OU doc-id/playerUid incohérent
  unavailable: boolean; // true si la lecture du doc a échoué (permissions/réseau)
};

/** Lit tous les résumés joueurs d'un club en UNE requête de collection bornée. */
export async function fetchClubPlayerSummaries(clubId: string): Promise<CoachSummariesResult> {
  try {
    const snap = await getDocs(
      query(collection(db, "clubs", clubId, "playerSummaries"), limit(COACH_SUMMARY_FETCH_LIMIT)),
    );
    const summaries: CoachPlayerSummary[] = [];
    for (const d of snap.docs) {
      const parsed = parseCoachPlayerSummary(d.data());
      // Intégrité : le playerUid du payload DOIT correspondre à l'ID du document.
      // Un doc dont le contenu prétend un autre UID est ignoré (jamais de mélange
      // d'identités / de navigation vers un autre joueur).
      if (parsed && parsed.playerUid === d.id) summaries.push(parsed);
    }
    return { summaries, unavailable: false };
  } catch {
    // Permissions Firestore refusées / réseau : état indisponible honnête.
    return { summaries: [], unavailable: true };
  }
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
