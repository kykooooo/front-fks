// hooks/useNetworkStatus.ts
// Hook pour détecter l'état de la connexion réseau et synchroniser la queue hors-ligne

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { processQueue, getQueueCount, notifySyncResult } from '../utils/offlineQueue';
import { applyFeedback } from '../state/orchestrators/applyFeedback';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const addFeedback = applyFeedback;

  // Vérifier la connexion en essayant de fetch une petite ressource
  const checkConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Petit ping vers Firebase ou un CDN rapide
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
      return true;
    } catch (error) {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Synchroniser la queue avec le backend
  const syncQueue = useCallback(async () => {
    const count = await getQueueCount();
    setQueueCount(count);

    if (count === 0) return;

    if (__DEV__) {
      console.log('[NetworkStatus] Syncing queue...');
    }

    const result = await processQueue({
      feedback: async (data) => {
        const sessionId = data.sessionId as string;
        const feedback = data.feedback as Parameters<typeof addFeedback>[1];
        // Appeler directement addFeedback du store
        const success = await addFeedback(sessionId, feedback);
        if (!success) {
          throw new Error('Failed to add feedback');
        }
      },
      // On peut ajouter d'autres handlers pour session, profile, etc.
    });

    setQueueCount(result.pending);

    // Notifier l'utilisateur uniquement s'il y a eu des actions synchronisées
    if (result.success > 0 || result.failed > 0) {
      notifySyncResult(result);
    }
  }, [addFeedback]);

  // Vérifier la connexion et synchroniser quand l'app revient au premier plan
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const online = await checkConnection();
        if (online) {
          await syncQueue();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Vérification initiale
    checkConnection().then((online) => {
      if (online) {
        syncQueue();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkConnection, syncQueue]);

  // Ref pour accéder à queueCount dans le callback sans relancer le timer
  const queueCountRef = useRef(queueCount);
  queueCountRef.current = queueCount;

  // Vérification périodique toutes les 30 secondes (seulement quand l'app est active)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (AppState.currentState === 'active') {
        const online = await checkConnection();
        if (online && queueCountRef.current > 0) {
          await syncQueue();
        }
      }
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [checkConnection, syncQueue]);

  return {
    isOnline,
    queueCount,
    syncQueue,
    checkConnection,
  };
}
