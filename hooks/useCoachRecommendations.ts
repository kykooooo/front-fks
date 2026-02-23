// hooks/useCoachRecommendations.ts
// Hook pour écouter les recommandations coach pour le joueur actuel

import { useEffect, useState } from "react";
import { auth } from "../services/firebase";
import { subscribeToPlayerRecommendations } from "../repositories/coachRecommendationsRepo";
import type { CoachRecommendation } from "../domain/coachRecommendations";

export function useCoachRecommendations(): {
  recommendations: CoachRecommendation[];
  unreadCount: number;
  loading: boolean;
} {
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const playerId = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!playerId) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToPlayerRecommendations(playerId, (recs) => {
      setRecommendations(recs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [playerId]);

  const unreadCount = recommendations.filter((r) => !r.readAt).length;

  return { recommendations, unreadCount, loading };
}
