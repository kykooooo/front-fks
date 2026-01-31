// utils/globalErrorHandler.ts
// Gestionnaire global pour les erreurs non capturées (async, promises, etc.)

import { Alert } from 'react-native';
import { classifyError } from './errorHandler';

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
      Alert.alert(
        'Erreur critique',
        `${appError.userMessage}\n\nL'application va redémarrer.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // On laisse l'app crasher proprement
              // React Native va automatiquement recharger
            },
          },
        ],
        { cancelable: false }
      );
    } else {
      // Erreur non fatale : on peut continuer
      Alert.alert(
        'Erreur',
        appError.userMessage,
        [{ text: 'OK' }]
      );
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
        Alert.alert(
          'Erreur',
          appError.userMessage,
          [{ text: 'OK' }]
        );
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
  // En production, envoyer à un service de monitoring
  // TODO: Intégrer Sentry ou autre service de monitoring
  // Sentry.captureException(error, { contexts: { custom: errorLog } });
}
