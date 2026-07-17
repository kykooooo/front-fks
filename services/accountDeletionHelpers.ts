// services/accountDeletionHelpers.ts
// Helpers PURS de la suppression de compte : liste des clés locales à purger
// + messages d'erreur FR actionnables. Aucune dépendance Firebase/RN → testés
// unitairement (services/__tests__/accountDeletionHelpers.test.ts).

import { STORAGE_KEYS } from "../constants/storage";

// Alignées sur services/notifications.ts (constantes locales là-bas — on ne les
// importe pas ici pour garder ce module pur, sans effet de bord expo-notifications).
const NOTIF_KEYS = ["fks_push_token", "fks_notif_prefs"] as const;

// Préfixe des snapshots cross-stores — aligné sur state/orchestrators/resetUser.ts.
const SNAPSHOT_PREFIX = "fks-snapshot-v2-";

/**
 * Clés AsyncStorage à effacer quand le compte est supprimé.
 * NB : les stores Zustand persistés (fks-load-v1, fks-sessions-v1, …) sont
 * remis à leurs défauts par resetForUser(null) — pas besoin de les lister.
 * WELCOME_DONE est retiré exprès : au prochain démarrage à froid, l'app
 * repart sur l'écran Welcome (plus de compte).
 */
export function localAccountKeysToPurge(uid: string | null | undefined): string[] {
  const keys = new Set<string>([
    STORAGE_KEYS.OFFLINE_QUEUE,
    STORAGE_KEYS.WELCOME_DONE,
    STORAGE_KEYS.ONBOARDING_START_TS,
    STORAGE_KEYS.TESTS_V1, // tests terrain, clé legacy sans uid (useTestsStorage)
    ...NOTIF_KEYS,
  ]);
  const cleanUid = typeof uid === "string" ? uid.trim() : "";
  if (cleanUid) {
    keys.add(`${SNAPSHOT_PREFIX}${cleanUid}`); // snapshot cross-stores du compte supprimé
    keys.add(STORAGE_KEYS.TRAINING_SNAPSHOT(cleanUid)); // ancien format de snapshot
    keys.add(`${STORAGE_KEYS.TESTS_V1}_${cleanUid}`); // tests terrain par uid
  }
  return [...keys];
}

export type DeletionErrorCopy = { title: string; message: string };

const asCode = (err: unknown): string =>
  err != null && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
    ? (err as { code: string }).code
    : "";

const asMessage = (err: unknown): string =>
  err != null && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
    ? (err as { message: string }).message
    : "";

/**
 * Erreur du flux de suppression → message FR actionnable.
 * Couvre les deux étapes : ré-authentification (codes auth/*) et appel de la
 * Cloud Function (codes functions/*). Le cas "function pas encore déployée"
 * (functions/not-found) échoue proprement, sans crash ni jargon.
 */
export function deletionErrorMessage(err: unknown): DeletionErrorCopy {
  const code = asCode(err);
  const message = asMessage(err);

  // Ré-authentification : mot de passe refusé.
  if (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/missing-password" ||
    code === "auth/invalid-login-credentials"
  ) {
    return {
      title: "Mot de passe incorrect",
      message: "Vérifie ta saisie puis réessaie. Rien n'a été supprimé.",
    };
  }

  if (code === "auth/too-many-requests") {
    return {
      title: "Trop de tentatives",
      message: "Attends quelques minutes avant de réessayer. Rien n'a été supprimé.",
    };
  }

  // Réseau (les deux étapes).
  if (
    code === "auth/network-request-failed" ||
    code === "functions/unavailable" ||
    code === "functions/deadline-exceeded" ||
    message.includes("Network request failed") ||
    message.includes("Failed to fetch")
  ) {
    return {
      title: "Pas de connexion",
      message: "Vérifie ta connexion internet puis réessaie.",
    };
  }

  // Cloud Function pas (encore) déployée sur le projet.
  if (code === "functions/not-found" || code === "functions/unimplemented") {
    return {
      title: "Service indisponible",
      message:
        "La suppression de compte n'est pas encore activée côté serveur. Réessaie plus tard ou écris à kyllian@fks-app.com.",
    };
  }

  // Session côté serveur expirée / incohérente.
  if (code === "functions/unauthenticated" || code === "auth/requires-recent-login" || code === "auth/user-token-expired") {
    return {
      title: "Session expirée",
      message: "Déconnecte-toi, reconnecte-toi, puis réessaie.",
    };
  }

  // Échec serveur (purge interrompue côté backend) — le compte reste utilisable.
  return {
    title: "Suppression échouée",
    message: "Ton compte n'a pas été supprimé. Réessaie dans un instant.",
  };
}
