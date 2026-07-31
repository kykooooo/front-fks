// functions/src/admin.ts
// Initialisation paresseuse de l'Admin SDK (une seule app par défaut). Partagée
// par les triggers, le rebuild, la suppression de compte et les tests
// d'intégration (émulateur).

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function getDb(): Firestore {
  if (!getApps().length) initializeApp();
  return getFirestore();
}

export function getAdminAuth(): Auth {
  if (!getApps().length) initializeApp();
  return getAuth();
}
