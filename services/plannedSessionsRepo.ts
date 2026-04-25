// src/services/plannedSessionsRepo.ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { SessionStatus } from '../domain/types';
import { db } from './firebase';
import { sanitizeFirestorePayload } from '../utils/firestorePayload';

/**
 * Sauvegarde une séance planifiée sous:
 *   users/{uid}/plannedSessions/{sessionId}
 * - Jette une erreur "AUTH_REQUIRED" si l'utilisateur n'est pas connecté
 */
export async function savePlannedSessionToFirestore(payload: any) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const err: any = new Error('User must be authenticated');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const sessionId = String(payload.id);
  const ref = doc(db, 'users', uid, 'plannedSessions', sessionId);

  const docData = {
    ...payload,
    userId: uid,
    status: payload?.status ?? 'planned',
    updatedAt: serverTimestamp(),
    ...(payload?.createdAt == null ? { createdAt: serverTimestamp() } : {}),
  };

  await setDoc(ref, sanitizeFirestorePayload(docData), { merge: true });
}

export async function updatePlannedSessionStatusInFirestore(
  sessionId: string,
  status: SessionStatus,
  meta?: { startedAt?: string | null; completedAt?: string | null }
) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  if (!uid) {
    const err: any = new Error('User must be authenticated');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const ref = doc(db, 'users', uid, 'plannedSessions', sessionId);
  const patch: Record<string, unknown> = {
    userId: uid,
    status,
    updatedAt: serverTimestamp(),
  };

  if (meta && "startedAt" in meta) {
    patch.startedAt = meta.startedAt ?? null;
  } else if (status === 'in_progress') {
    patch.startedAt = serverTimestamp();
  }

  if (meta && "completedAt" in meta) {
    patch.completedAt = meta.completedAt ?? null;
  } else if (status === 'completed') {
    patch.completedAt = serverTimestamp();
  }

  await setDoc(ref, sanitizeFirestorePayload(patch), { merge: true });
}
