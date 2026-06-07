import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  normalizeAgeCategory,
  normalizeClubTrainingIntensity,
  normalizeClubWeekGoal,
  normalizeTeamGender,
  type AgeCategory,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import { pickCoachSessionToDisplay, collectAdaptationTokens } from "../domain/coachLabels";
import { toDateKey } from "../utils/dateHelpers";

export type ClubDoc = {
  id: string;
  name: string;
  inviteCode: string;
  ownerUid: string;
};

export type ClubRole = "coach" | "player";

export type ClubMember = {
  uid: string;
  role: ClubRole;
};

export type ClubPlayer = {
  uid: string;
  firstName: string | null;
  position: string | null;
  level: string | null;
  ageCategory: AgeCategory | null;
  profileIncomplete: boolean;
};

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

/** Liste les membres d'un club (coachs + joueurs). */
export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const snap = await getDocs(collection(db, "clubs", clubId, "members"));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      role: data?.role === "coach" ? "coach" : "player",
    };
  });
}

/**
 * Récupère les joueurs d'un club avec leurs infos profil (lecture seule).
 * Le coach ne lit que prénom / poste / niveau — aucune donnée sensible
 * (douleurs, blessures) n'est exposée ici.
 */
export async function fetchClubPlayers(clubId: string): Promise<ClubPlayer[]> {
  const members = await listClubMembers(clubId);
  const players = members.filter((m) => m.role === "player");

  const profiles = await Promise.all(
    players.map(async (m) => {
      try {
        const snap = await getDoc(doc(db, "users", m.uid));
        const data = snap.exists() ? (snap.data() as any) : undefined;
        const firstName = typeof data?.firstName === "string" ? data.firstName.trim() || null : null;
        return {
          uid: m.uid,
          firstName,
          position: typeof data?.position === "string" ? data.position : null,
          level: typeof data?.level === "string" ? data.level : null,
          ageCategory: normalizeAgeCategory(data?.ageCategory),
          profileIncomplete: !data?.profileCompleted || !firstName,
        } as ClubPlayer;
      } catch {
        // Permissions / réseau : on garde le joueur dans la liste mais en "incomplet".
        return {
          uid: m.uid,
          firstName: null,
          position: null,
          level: null,
          ageCategory: null,
          profileIncomplete: true,
        } as ClubPlayer;
      }
    })
  );

  return profiles;
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

// ─── Vue coach : séances d'un joueur (lecture seule, coach-safe) ────────────
// On NE renvoie JAMAIS de données médicales (douleurs/blessures détaillées) ni
// de métriques brutes (TSB/ATL/CTL). Les tokens d'adaptation sont renvoyés bruts
// et traduits en langage coach par domain/coachLabels.ts côté écran.

export type CoachPlayerSession = {
  id: string | null;
  dateKey: string | null; // "YYYY-MM-DD" — pour choisir planned vs completed
  title: string | null;
  focus: string | null;
  phase: string | null;
  durationMin: number | null;
  intensity: string | null;
  blockCount: number | null;
  status: "planned" | "done" | "unknown";
  adaptationTokens: string[];
};

export type CoachPlayerActivity = {
  dateISO: string | null;
  rpe: number | null;
  durationMin: number | null;
};

export type CoachPlayerOverview = {
  session: CoachPlayerSession | null; // dernière séance FKS (planifiée, sinon faite)
  lastActivity: CoachPlayerActivity | null; // dernière séance réellement faite
  detailsUnavailable: boolean; // true si lecture refusée (permissions) — pas de crash
};

const cpNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const cpStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const cpDateOf = (d: any): string => cpStr(d?.dateISO) ?? cpStr(d?.date) ?? "";

const cpPickLatest = (docs: any[]): any | null => {
  if (!docs.length) return null;
  return [...docs].sort((a, b) => {
    const da = cpDateOf(a);
    const dbb = cpDateOf(b);
    return da < dbb ? 1 : da > dbb ? -1 : 0;
  })[0];
};

// Lit au plus N docs récents via orderBy("date","desc") pour éviter de scanner
// tout l'historique. Garde un tri client (cpPickLatest) en sécurité.
// Limite connue : un doc SANS champ `date` n'est pas renvoyé par la requête —
// tous les chemins d'écriture actuels (planned/completed) écrivent `date`.
const COACH_SESSION_FETCH_LIMIT = 8;

async function fetchRecentDocs(uid: string, sub: "plannedSessions" | "sessions"): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, sub), orderBy("date", "desc"), limit(COACH_SESSION_FETCH_LIMIT)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as any), __docId: d.id }));
}

const cpIdOf = (d: any): string | null => cpStr(d?.id) ?? cpStr(d?.__docId);
const cpDateKeyOf = (d: any): string | null => {
  const raw = cpDateOf(d);
  return raw ? toDateKey(raw) || null : null;
};

export async function fetchPlayerSessionOverview(uid: string): Promise<CoachPlayerOverview> {
  try {
    const [plannedDocs, completedDocs] = await Promise.all([
      fetchRecentDocs(uid, "plannedSessions"),
      fetchRecentDocs(uid, "sessions"),
    ]);

    const latestPlanned = cpPickLatest(plannedDocs);
    const latestCompleted = cpPickLatest(completedDocs);

    let plannedSession: CoachPlayerSession | null = null;
    if (latestPlanned) {
      const ai = latestPlanned.ai && typeof latestPlanned.ai === "object" ? latestPlanned.ai : {};
      plannedSession = {
        id: cpIdOf(latestPlanned),
        dateKey: cpDateKeyOf(latestPlanned),
        title: cpStr(ai.title) ?? cpStr(latestPlanned.title),
        focus: cpStr(latestPlanned.focus) ?? cpStr(ai.focusPrimary) ?? cpStr(ai.focus_primary),
        phase: cpStr(latestPlanned.phase),
        durationMin: cpNum(ai.durationMin) ?? cpNum(ai.duration_min) ?? cpNum(latestPlanned.durationMin),
        intensity: cpStr(latestPlanned.intensity) ?? cpStr(ai.intensity),
        blockCount: Array.isArray(ai.blocks) ? ai.blocks.length : null,
        status: "planned",
        adaptationTokens: collectAdaptationTokens(
          ai.guardrailsApplied, // tokens backend (camelCase)
          ai.guardrails_applied, // tokens backend (snake_case)
          latestPlanned.clientGuardrailsApplied, // tokens client stables (nouveau)
          latestPlanned.guardrailsApplied, // legacy FR top-level (vieux docs) — traduit/filtré
        ),
      };
    }

    let completedSession: CoachPlayerSession | null = null;
    let lastActivity: CoachPlayerActivity | null = null;
    if (latestCompleted) {
      const v2 = latestCompleted.aiV2 && typeof latestCompleted.aiV2 === "object" ? latestCompleted.aiV2 : {};
      const fb = latestCompleted.feedback && typeof latestCompleted.feedback === "object" ? latestCompleted.feedback : {};
      completedSession = {
        id: cpIdOf(latestCompleted),
        dateKey: cpDateKeyOf(latestCompleted),
        title: cpStr(latestCompleted.title) ?? cpStr(v2.title),
        focus: cpStr(latestCompleted.focus) ?? cpStr(v2.focusPrimary) ?? cpStr(v2.focus_primary),
        phase: cpStr(latestCompleted.phase),
        durationMin: cpNum(fb.durationMin) ?? cpNum(v2.durationMin) ?? cpNum(v2.duration_min),
        intensity: cpStr(latestCompleted.intensity) ?? cpStr(v2.intensity),
        blockCount: Array.isArray(v2.blocks) ? v2.blocks.length : null,
        status: "done",
        adaptationTokens: collectAdaptationTokens(v2.guardrailsApplied, v2.guardrails_applied),
      };
      lastActivity = {
        dateISO: cpDateOf(latestCompleted) || null,
        rpe: cpNum(fb.rpe) ?? cpNum(latestCompleted.rpe),
        durationMin: cpNum(fb.durationMin),
      };
    }

    return {
      // Choix temporel planned vs completed (évite qu'une vieille planifiée masque
      // une séance faite plus récente).
      session: pickCoachSessionToDisplay(plannedSession, completedSession),
      lastActivity,
      detailsUnavailable: false,
    };
  } catch {
    // Permissions Firestore refusées / réseau : joueur visible mais détails indispo.
    return { session: null, lastActivity: null, detailsUnavailable: true };
  }
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
