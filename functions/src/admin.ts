// functions/src/admin.ts
// Initialisation paresseuse de l'Admin SDK (une seule app par défaut). Partagée
// par les triggers, le rebuild, la suppression de compte et les tests
// d'intégration (émulateur).

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Nom que firebase-admin donne à l'app créée par `initializeApp()` sans nom. */
const DEFAULT_APP_NAME = "[DEFAULT]";

/**
 * Garantit l'app PAR DÉFAUT — et pas « une app quelconque ».
 *
 * L'ancienne garde (`!getApps().length`) était fausse en production : avant de
 * donner la main à notre code, le SDK firebase-functions crée SA propre app,
 * nommée `__FIREBASE_FUNCTIONS_SDK__` (vérification du jeton d'un callable,
 * instantané d'un déclencheur). La liste n'était donc jamais vide, on sautait
 * `initializeApp()`, et `getFirestore()` / `getAuth()` — qui exigent l'app par
 * défaut — levaient `app/no-app`. Résultat : TOUTES les fonctions en 500
 * (recette du 17/09/2026, verrou : tests/adminDefaultApp.test.ts).
 */
function ensureDefaultApp(): void {
  if (!getApps().some((app) => app.name === DEFAULT_APP_NAME)) initializeApp();
}

export function getDb(): Firestore {
  ensureDefaultApp();
  return getFirestore();
}

export function getAdminAuth(): Auth {
  ensureDefaultApp();
  return getAuth();
}
