// utils/errorHandler.ts
// Système centralisé de gestion des erreurs avec messages clairs pour l'utilisateur

import { Alert } from 'react-native';

/**
 * Types d'erreurs possibles dans l'app
 */
export enum ErrorType {
  NETWORK = 'NETWORK',           // Pas de connexion internet
  SERVER = 'SERVER',             // Serveur down ou erreur 500
  VALIDATION = 'VALIDATION',     // Données invalides
  AUTH = 'AUTH',                 // Problème d'authentification
  FIREBASE = 'FIREBASE',         // Erreur Firestore/Firebase
  TIMEOUT = 'TIMEOUT',           // Requête trop longue
  UNKNOWN = 'UNKNOWN',           // Erreur inconnue
}

/**
 * Interface pour une erreur enrichie
 */
export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  technicalDetails?: string;
  retryable: boolean;
}

/**
 * Classifier automatiquement une erreur
 */
export function classifyError(error: any): AppError {
  // Erreur réseau (pas de connexion)
  if (error.message?.includes('Network request failed') ||
      error.message?.includes('fetch failed') ||
      error.code === 'NETWORK_ERROR') {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      userMessage: 'Pas de connexion internet. Vérifie que tu es bien connecté au WiFi ou aux données mobiles.',
      technicalDetails: error.stack,
      retryable: true,
    };
  }

  // Timeout
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    return {
      type: ErrorType.TIMEOUT,
      message: error.message,
      userMessage: 'La requête a pris trop de temps. Le serveur est peut-être surchargé. Réessaie dans quelques secondes.',
      technicalDetails: error.stack,
      retryable: true,
    };
  }

  // Erreurs Firebase Auth
  if (error.code?.startsWith('auth/')) {
    return classifyFirebaseAuthError(error);
  }

  // Erreurs Firebase Firestore
  if (error.code?.startsWith('firestore/') || error.name === 'FirebaseError') {
    return {
      type: ErrorType.FIREBASE,
      message: error.message,
      userMessage: getFirestoreErrorMessage(error.code),
      technicalDetails: error.stack,
      retryable: error.code === 'firestore/unavailable',
    };
  }

  // Erreur serveur backend (status 5xx)
  if (error.status >= 500 && error.status < 600) {
    return {
      type: ErrorType.SERVER,
      message: error.message,
      userMessage: 'Le serveur rencontre un problème technique. Réessaie dans quelques minutes.',
      technicalDetails: `Status ${error.status}: ${error.statusText}`,
      retryable: true,
    };
  }

  // Erreur validation (status 4xx)
  if (error.status >= 400 && error.status < 500) {
    return {
      type: ErrorType.VALIDATION,
      message: error.message,
      userMessage: error.userMessage || 'Les données envoyées sont incorrectes. Vérifie ton formulaire.',
      technicalDetails: `Status ${error.status}: ${error.statusText}`,
      retryable: false,
    };
  }

  // Erreur inconnue
  return {
    type: ErrorType.UNKNOWN,
    message: error.message || String(error),
    userMessage: 'Une erreur inattendue s\'est produite. Si le problème persiste, contacte le support.',
    technicalDetails: error.stack,
    retryable: false,
  };
}

/**
 * Messages spécifiques pour les erreurs Firebase Auth
 */
function classifyFirebaseAuthError(error: any): AppError {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé. Essaie de te connecter ou utilise un autre email.',
    'auth/invalid-email': 'L\'adresse email n\'est pas valide. Vérifie ta saisie.',
    'auth/operation-not-allowed': 'Cette opération n\'est pas autorisée. Contacte le support.',
    'auth/weak-password': 'Ton mot de passe est trop faible. Utilise au moins 6 caractères.',
    'auth/user-disabled': 'Ce compte a été désactivé. Contacte le support.',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email. Vérifie ta saisie ou inscris-toi.',
    'auth/wrong-password': 'Mot de passe incorrect. Réessaie ou utilise "Mot de passe oublié".',
    'auth/invalid-credential': 'Email ou mot de passe incorrect. Vérifie ta saisie.',
    'auth/too-many-requests': 'Trop de tentatives. Attends quelques minutes avant de réessayer.',
    'auth/network-request-failed': 'Pas de connexion internet. Vérifie ta connexion.',
  };

  return {
    type: ErrorType.AUTH,
    message: error.message,
    userMessage: errorMessages[error.code] || 'Problème d\'authentification. Réessaie ou contacte le support.',
    technicalDetails: `${error.code}: ${error.message}`,
    retryable: error.code === 'auth/network-request-failed' || error.code === 'auth/too-many-requests',
  };
}

/**
 * Messages pour les erreurs Firestore
 */
function getFirestoreErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'firestore/permission-denied': 'Tu n\'as pas les permissions pour cette action. Vérifie que tu es bien connecté.',
    'firestore/unavailable': 'La base de données est temporairement indisponible. Réessaie dans un instant.',
    'firestore/unauthenticated': 'Tu dois te connecter pour effectuer cette action.',
    'firestore/not-found': 'Les données demandées n\'existent pas ou ont été supprimées.',
    'firestore/already-exists': 'Ces données existent déjà.',
    'firestore/resource-exhausted': 'Quota dépassé. Réessaie plus tard.',
    'firestore/cancelled': 'L\'opération a été annulée.',
    'firestore/data-loss': 'Perte de données détectée. Contacte le support immédiatement.',
  };

  return messages[code] || 'Problème avec la base de données. Réessaie dans un instant.';
}

/**
 * Afficher une erreur à l'utilisateur avec un message clair
 */
export function showError(error: any, context?: string) {
  const appError = classifyError(error);

  // Log technique pour le debug (uniquement en dev)
  if (__DEV__) {
    console.error(`[ERROR ${context ? `- ${context}` : ''}]`, {
      type: appError.type,
      message: appError.message,
      technical: appError.technicalDetails,
      retryable: appError.retryable,
    });
  }

  // Message utilisateur
  const title = getErrorTitle(appError.type);
  const message = appError.userMessage;
  const buttons: any[] = [{ text: 'OK', style: 'cancel' }];

  Alert.alert(title, message, buttons);
}

/**
 * Obtenir un titre approprié selon le type d'erreur
 */
function getErrorTitle(type: ErrorType): string {
  const titles: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: 'Pas de connexion',
    [ErrorType.SERVER]: 'Serveur indisponible',
    [ErrorType.VALIDATION]: 'Données invalides',
    [ErrorType.AUTH]: 'Problème de connexion',
    [ErrorType.FIREBASE]: 'Erreur base de données',
    [ErrorType.TIMEOUT]: 'Temps d\'attente dépassé',
    [ErrorType.UNKNOWN]: 'Erreur',
  };

  return titles[type] || 'Erreur';
}

/**
 * Helper pour créer une erreur backend avec status
 */
export class BackendError extends Error {
  status: number;
  statusText: string;
  userMessage?: string;

  constructor(status: number, statusText: string, message: string, userMessage?: string) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.statusText = statusText;
    this.userMessage = userMessage;
  }
}

/**
 * Wrapper pour les appels fetch avec gestion d'erreur améliorée
 */
export async function safeFetch(
  url: string,
  options?: RequestInit,
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No response body');
      throw new BackendError(
        response.status,
        response.statusText,
        errorBody,
        response.status >= 500
          ? 'Le serveur rencontre un problème. Réessaie dans quelques minutes.'
          : undefined
      );
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Erreur d'abort (timeout)
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      throw timeoutError;
    }

    // Erreur réseau
    if (error.message === 'Failed to fetch' || error.message?.includes('Network')) {
      const networkError = new Error('Network request failed');
      (networkError as any).code = 'NETWORK_ERROR';
      throw networkError;
    }

    throw error;
  }
}

/**
 * Helper pour afficher une erreur avec possibilité de retry
 */
export function showErrorWithRetry(
  error: any,
  context: string,
  onRetry: () => void
) {
  const appError = classifyError(error);

  // Log technique
  if (__DEV__) {
    console.error(`[ERROR - ${context}]`, {
      type: appError.type,
      message: appError.message,
      technical: appError.technicalDetails,
    });
  }

  const title = getErrorTitle(appError.type);
  const buttons: any[] = [{ text: 'Annuler', style: 'cancel' }];

  if (appError.retryable) {
    buttons.push({
      text: 'Réessayer',
      onPress: onRetry,
      style: 'default',
    });
  }

  Alert.alert(title, appError.userMessage, buttons);
}
