// services/accountDeletion.ts
// Flux de suppression de compte (exigence Apple/Google) :
//   ré-authentification par mot de passe → Cloud Function `deleteAccount`
//   (purge Firestore + compte Auth, côté serveur) → purge locale complète →
//   retour à l'écran Welcome.
// La purge serveur vit dans functions/src/deleteAccount.ts ; ici on ne fait
// QUE l'orchestration côté client.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

import { app, auth } from "./firebase";
import { cancelAllScheduled } from "./notifications";
import { localAccountKeysToPurge } from "./accountDeletionHelpers";
import { useSyncStore } from "../state/stores/useSyncStore";

/** Région des Cloud Functions — alignée sur functions/src/config.ts (REGION). */
const FUNCTIONS_REGION = "europe-west4";

/** Nom de la callable — alignée sur functions/src/index.ts. */
const DELETE_ACCOUNT_CALLABLE = "deleteAccount";

// Événement interne : le RootNavigator garde `welcomeDone` en mémoire (lu une
// fois au boot) ; après suppression du compte on veut atterrir sur Welcome
// SANS redémarrage. Même pattern que utils/toast.ts (DeviceEventEmitter).
const WELCOME_RESET_EVENT = "fks_welcome_reset_event";

export const onWelcomeReset = (listener: () => void) => {
  const sub = DeviceEventEmitter.addListener(WELCOME_RESET_EVENT, listener);
  return () => sub.remove();
};

/**
 * Ré-authentifie l'utilisateur courant avec son mot de passe (seule méthode
 * d'auth de l'app). Lève les codes Firebase habituels (auth/wrong-password,
 * auth/invalid-credential, …) mappés en FR par deletionErrorMessage.
 */
export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) {
    const err = new Error("Aucun utilisateur connecté.");
    (err as Error & { code: string }).code = "functions/unauthenticated";
    throw err;
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

/**
 * Appelle la Cloud Function `deleteAccount` (purge Firestore + compte Auth).
 * Si la function n'est pas déployée, la callable rejette avec
 * `functions/not-found` → message propre, aucun crash (voir
 * DEPLOIEMENT_SUPPRESSION_COMPTE.md).
 */
export async function requestServerAccountDeletion(): Promise<void> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const call = httpsCallable(functions, DELETE_ACCOUNT_CALLABLE);
  await call({});
}

/**
 * Purge locale complète APRÈS succès serveur, puis bascule sur le flux auth.
 * `uid` doit être capturé AVANT l'appel (auth.currentUser devient null).
 * Ordre voulu :
 *   1. signOut → RootNavigator bascule sur le flux auth (flux logout existant) ;
 *   2. resetForUser(null) → wipe des 6 stores (il sauvegarde au passage un
 *      snapshot du uid sortant, purgé à l'étape 3) ;
 *   3. purge AsyncStorage (snapshots per-user, tests terrain, file offline,
 *      flags onboarding/welcome) ;
 *   4. annulation des notifications locales planifiées (rappels séance/streak) ;
 *   5. événement Welcome → retour à l'écran d'accueil sans redémarrage.
 * Chaque étape est tolérante : le compte serveur est déjà supprimé, on ne
 * bloque jamais l'utilisateur sur un nettoyage local.
 */
export async function finalizeLocalAccountDeletion(uid: string | null): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Le compte n'existe plus côté serveur : un signOut qui râle est sans enjeu.
  }

  try {
    await useSyncStore.getState().resetForUser(null);
  } catch {
    // Best effort — les stores persistés seront de toute façon réécrits aux défauts.
  }

  try {
    await AsyncStorage.multiRemove(localAccountKeysToPurge(uid));
  } catch {
    // Best effort.
  }

  try {
    await cancelAllScheduled();
  } catch {
    // Best effort.
  }

  DeviceEventEmitter.emit(WELCOME_RESET_EVENT);
}
