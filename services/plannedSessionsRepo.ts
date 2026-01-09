// src/services/plannedSessionsRepo.ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';

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
    status: 'planned',
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, docData, { merge: true });
}
