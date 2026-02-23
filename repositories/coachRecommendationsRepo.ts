// repositories/coachRecommendationsRepo.ts
// Gestion des recommandations coach dans Firestore

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import type { CoachRecommendation, RecommendationType } from "../domain/coachRecommendations";

// Envoyer une recommandation à un joueur
export async function sendRecommendation(params: {
  coachId: string;
  coachName?: string;
  playerId: string;
  type: RecommendationType;
  message: string;
  suggestedCycleId?: string | null;
}): Promise<string> {
  const ref = collection(db, "users", params.playerId, "coachRecommendations");
  const docRef = await addDoc(ref, {
    coachId: params.coachId,
    coachName: params.coachName ?? null,
    type: params.type,
    message: params.message,
    suggestedCycleId: params.suggestedCycleId ?? null,
    createdAt: serverTimestamp(),
    readAt: null,
    dismissedAt: null,
  });
  return docRef.id;
}

// Marquer une recommandation comme lue
export async function markRecommendationAsRead(
  playerId: string,
  recommendationId: string
): Promise<void> {
  const ref = doc(db, "users", playerId, "coachRecommendations", recommendationId);
  await updateDoc(ref, { readAt: serverTimestamp() });
}

// Masquer/fermer une recommandation
export async function dismissRecommendation(
  playerId: string,
  recommendationId: string
): Promise<void> {
  const ref = doc(db, "users", playerId, "coachRecommendations", recommendationId);
  await updateDoc(ref, { dismissedAt: serverTimestamp() });
}

// Écouter les recommandations actives pour un joueur (non masquées)
export function subscribeToPlayerRecommendations(
  playerId: string,
  callback: (recommendations: CoachRecommendation[]) => void
): () => void {
  const ref = collection(db, "users", playerId, "coachRecommendations");
  const q = query(
    ref,
    where("dismissedAt", "==", null),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        coachId: data.coachId ?? "",
        coachName: data.coachName ?? null,
        playerId,
        type: data.type ?? "custom",
        message: data.message ?? "",
        suggestedCycleId: data.suggestedCycleId ?? null,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt ?? new Date().toISOString(),
        readAt:
          data.readAt instanceof Timestamp
            ? data.readAt.toDate().toISOString()
            : data.readAt ?? null,
        dismissedAt: null,
      } satisfies CoachRecommendation;
    });
    callback(list);
  });
}

// Écouter les recommandations envoyées par un coach (pour historique)
export function subscribeToCoachSentRecommendations(
  coachId: string,
  clubId: string,
  callback: (recommendations: (CoachRecommendation & { playerName?: string })[]) => void
): () => void {
  // Note: Cette fonction nécessite une structure de données différente ou
  // une collection séparée pour être efficace. Pour l'instant, on ne l'implémente pas.
  // À améliorer avec une collection "coachRecommendations" globale.
  callback([]);
  return () => {};
}
