// utils/globalErrorHandler.ts
// Gestionnaire global pour les erreurs non capturées (async, promises, etc.)

import { classifyError } from './errorHandler';
import { showToast } from './toast';
// Sentry temporarily disabled for Expo SDK 54 compatibility

const toastError = (title: string, message?: string) => {
  showToast({
    type: 'error',
    title,
    message,
    durationMs: 2800,
  });
};

/**
 * Configure les gestionnaires d'erreurs globales pour l'app
 * À appeler une seule fois au démarrage de l'app
 */
export function setupGlobalErrorHandlers() {
  // Gestionnaire pour les erreurs JavaScript non capturées
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const appError = classifyError(error);

    if (__DEV__) {
      console.error('[GlobalErrorHandler] Uncaught error:', {
        fatal: isFatal,
        type: appError.type,
        message: error.message,
        stack: error.stack,
      });
    }

    if (isFatal) {
      // Erreur fatale : l'app va probablement crasher
      toastError('Erreur critique', `${appError.userMessage} L'application va redémarrer.`);
    } else {
      // Erreur non fatale : on peut continuer
      toastError('Erreur', appError.userMessage);
    }
  });

  // Note: React Native gère déjà les Promise rejections non gérées via ErrorUtils
  // Pas besoin de configuration supplémentaire, elles seront capturées par le handler global ci-dessus

  if (__DEV__) {
    console.log('[GlobalErrorHandler] Global error handlers configured');
  }
}

/**
 * Wrapper pour exécuter du code async avec gestion d'erreur automatique
 * Utile pour les event handlers où on ne peut pas await
 *
 * Usage:
 * <Button onPress={safeAsync(async () => {
 *   await doSomething();
 * })} />
 */
export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  onError?: (error: Error) => void
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    asyncFn(...args).catch((error) => {
      const appError = classifyError(error);

      if (__DEV__) {
        console.error('[safeAsync] Error in async function:', error);
      }

      if (onError) {
        onError(error);
      } else {
        // Afficher l'erreur par défaut
        toastError('Erreur', appError.userMessage);
      }
    });
  };
}

/**
 * Helper pour logger les erreurs de manière uniforme
 * Utile pour envoyer les erreurs à un service de monitoring (Sentry, etc.)
 */
export function logError(
  error: Error,
  context?: string,
  metadata?: Record<string, any>
) {
  const appError = classifyError(error);

  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    type: appError.type,
    message: error.message,
    userMessage: appError.userMessage,
    stack: error.stack,
    metadata,
  };

  if (__DEV__) {
    console.error('[ErrorLog]', errorLog);
  }
  // TODO: Re-enable Sentry when compatible with Expo SDK 54
}
