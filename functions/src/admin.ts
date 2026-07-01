// functions/src/admin.ts
// Initialisation paresseuse de l'Admin SDK (une seule app par défaut). Partagée
// par les triggers, le rebuild et les tests d'intégration (émulateur).

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function getDb(): Firestore {
  if (!getApps().length) initializeApp();
  return getFirestore();
}
