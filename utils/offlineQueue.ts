// utils/offlineQueue.ts
// Système de queue pour gérer les actions hors-ligne (feedback, sessions, etc.)

import NetInfo from '@react-native-community/netinfo';
import { getEncryptedItem, setEncryptedItem, removeEncryptedItem } from '../services/encryptedStorage';
import { showToast } from './toast';
import { STORAGE_KEYS } from '../constants/storage';

const QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE;

export type QueuedAction = {
  id: string;
  type: 'feedback' | 'session' | 'profile';
  timestamp: string;
  data: Record<string, unknown>;
  retries: number;
  maxRetries: number;
};

/**
 * Ajouter une action à la queue hors-ligne
 */
export async function enqueueAction(
  type: QueuedAction['type'],
  data: Record<string, unknown>,
  maxRetries: number = 3
): Promise<void> {
  try {
    const queue = await getQueue();
    const dedupeKey =
      type === 'feedback' && typeof data.sessionId === 'string'
        ? `feedback:${data.sessionId}`
        : type === 'session' &&
            data.session != null &&
            typeof data.session === 'object' &&
            'id' in data.session &&
            typeof (data.session as { id?: unknown }).id === 'string'
          ? `session:${(data.session as { id: string }).id}`
          : null;

    const nextQueue = dedupeKey
      ? queue.filter((action) => {
          if (action.type === 'feedback' && dedupeKey.startsWith('feedback:')) {
            return `feedback:${String(action.data.sessionId ?? '')}` !== dedupeKey;
          }
          if (action.type === 'session' && dedupeKey.startsWith('session:')) {
            const queuedSession = action.data.session;
            const queuedId =
              queuedSession != null &&
              typeof queuedSession === 'object' &&
              'id' in queuedSession
                ? String((queuedSession as { id?: unknown }).id ?? '')
                : '';
            return `session:${queuedId}` !== dedupeKey;
          }
          return true;
        })
      : queue;

    const action: QueuedAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      data,
      retries: 0,
      maxRetries,
    };

    nextQueue.push(action);
    await saveQueue(nextQueue);

    if (__DEV__) {
      console.log('[OfflineQueue] Action enqueued:', action.type, action.id);
    }
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to enqueue action:', error);
  }
}

/**
 * Récupérer toutes les actions en attente
 */
export async function getQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await getEncryptedItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedAction[];
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to get queue:', error);
    return [];
  }
}

/**
 * Sauvegarder la queue
 */
async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await setEncryptedItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to save queue:', error);
  }
}

/**
 * Retirer une action de la queue
 */
export async function removeFromQueue(actionId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const filtered = queue.filter((a) => a.id !== actionId);
    await saveQueue(filtered);

    if (__DEV__) {
      console.log('[OfflineQueue] Action removed:', actionId);
    }
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to remove from queue:', error);
  }
}

/**
 * Incrémenter le compteur de retry pour une action
 */
async function incrementRetry(actionId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const updated = queue.map((action) => {
      if (action.id === actionId) {
        return { ...action, retries: action.retries + 1 };
      }
      return action;
    });
    await saveQueue(updated);
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to increment retry:', error);
  }
}

/**
 * Vider complètement la queue (utile pour le debug)
 */
export async function clearQueue(): Promise<void> {
  try {
    await removeEncryptedItem(QUEUE_KEY);
    if (__DEV__) {
      console.log('[OfflineQueue] Queue cleared');
    }
  } catch (error) {
    if (__DEV__) console.error('[OfflineQueue] Failed to clear queue:', error);
  }
}

/**
 * Obtenir le nombre d'actions en attente
 */
export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Traiter la queue : essayer d'envoyer toutes les actions en attente
 * Retourne le nombre d'actions traitées avec succès
 */
export async function processQueue(
  handlers: {
    feedback?: (data: Record<string, unknown>) => Promise<void>;
    session?: (data: Record<string, unknown>) => Promise<void>;
    profile?: (data: Record<string, unknown>) => Promise<void>;
  }
): Promise<{ success: number; failed: number; pending: number }> {
  const queue = await getQueue();
  let successCount = 0;
  let failedCount = 0;

  if (__DEV__) {
    console.log(`[OfflineQueue] Processing ${queue.length} actions...`);
  }

  for (const action of queue) {
    const handler = handlers[action.type];

    if (!handler) {
      if (__DEV__) {
        console.warn(`[OfflineQueue] No handler for type: ${action.type}`);
      }
      continue;
    }

    try {
      await handler(action.data);
      await removeFromQueue(action.id);
      successCount++;

      if (__DEV__) {
        console.log(`[OfflineQueue] Action processed successfully:`, action.id);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[OfflineQueue] Action failed:`, action.id, error);
      }

      // Vérifier si on a dépassé le max retries
      if (action.retries >= action.maxRetries) {
        await removeFromQueue(action.id);
        failedCount++;

        if (__DEV__) {
          console.warn(`[OfflineQueue] Action abandoned after ${action.retries} retries:`, action.id);
        }
      } else {
        await incrementRetry(action.id);
      }
    }
  }

  const remaining = await getQueueCount();

  if (__DEV__) {
    console.log(`[OfflineQueue] Processing complete: ${successCount} success, ${failedCount} failed, ${remaining} pending`);
  }

  return {
    success: successCount,
    failed: failedCount,
    pending: remaining,
  };
}

/**
 * Notifier l'utilisateur des actions synchronisées
 */
export function notifySyncResult(result: { success: number; failed: number; pending: number }) {
  if (result.success > 0) {
    const message =
      result.success === 1
        ? '1 élément synchronisé avec succès.'
        : `${result.success} éléments synchronisés avec succès.`;

    showToast({ type: 'success', title: 'Synchronisation réussie', message });
  }

  if (result.failed > 0 && result.pending === 0) {
    showToast({ type: 'warn', title: 'Synchronisation partielle', message: `${result.failed} action(s) n'ont pas pu être synchronisées.` });
  }

  if (result.pending > 0) {
    const pendingMsg =
      result.pending === 1
        ? '1 action en attente de synchronisation.'
        : `${result.pending} actions en attente de synchronisation.`;

    if (result.success > 0) {
      showToast({ type: 'info', title: 'Synchronisation partielle', message: `${result.success} réussies, mais ${pendingMsg}` });
    }
  }
}

// ─── Auto-sync au retour réseau via NetInfo ───

type SyncHandlers = {
  feedback?: (data: any) => Promise<void>;
  session?: (data: any) => Promise<void>;
  profile?: (data: any) => Promise<void>;
};

let _autoSyncUnsub: (() => void) | null = null;

/**
 * Démarre l'écoute NetInfo : quand la connexion revient,
 * la queue hors-ligne est automatiquement traitée + toast.
 */
export function setupAutoSync(handlers: SyncHandlers) {
  if (_autoSyncUnsub) return; // déjà actif

  let wasOffline = false;

  _autoSyncUnsub = NetInfo.addEventListener(async (state) => {
    const online = state.isConnected && state.isInternetReachable !== false;

    if (online && wasOffline) {
      const count = await getQueueCount();
      if (count > 0) {
        if (__DEV__) console.log(`[OfflineQueue] Connexion restaurée, sync de ${count} élément(s)…`);
        const result = await processQueue(handlers);
        notifySyncResult(result);
      }
    }

    wasOffline = !online;
  });
}

/**
 * Arrête l'écoute NetInfo.
 */
export function teardownAutoSync() {
  if (_autoSyncUnsub) {
    _autoSyncUnsub();
    _autoSyncUnsub = null;
  }
}
