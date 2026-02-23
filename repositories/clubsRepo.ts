import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";

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
