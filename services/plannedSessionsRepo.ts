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

/**
 * AUDIT P0-1b — Marque une séance planifiée comme complétée après le feedback.
 *
 * On ne supprime PAS le doc : un marqueur `status: 'completed'` (setDoc merge)
 * est idempotent, fonctionne hors-ligne (latency compensation Firestore) et
 * garde l'historique de planification. Le watcher plannedSessions ne redescend
 * que les docs `status === 'planned'` (ou sans status, compat) : une séance
 * faite ne réapparaît donc plus jamais comme "à faire".
 *
 * Silencieux si non connecté ou id manquant (jamais bloquant pour le feedback).
 */
export async function markPlannedSessionCompleted(sessionId: string): Promise<void> {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid || !sessionId) return;

  const ref = doc(db, 'users', uid, 'plannedSessions', String(sessionId));
  await setDoc(ref, { status: 'completed', completedAt: serverTimestamp() }, { merge: true });
}
