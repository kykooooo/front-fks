// src/services/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { firebaseWebConfig } from "../config/firebaseConfig";

// ✅ On reste sur 'firebase/auth' (pas de '/react-native')
import { initializeAuth } from "firebase/auth";
// @ts-ignore — manquant dans les d.ts mais présent au runtime
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  initializeFirestore,
  connectFirestoreEmulator,
  // Tip: si tu veux la persistance offline plus tard
  // memoryLocalCache,
  // persistentLocalCache,
} from "firebase/firestore";

const apps = getApps();
const app: FirebaseApp = apps.length ? (apps[0] as FirebaseApp) : initializeApp(firebaseWebConfig);

// Auth avec persistance AsyncStorage (singleton global pour éviter les doubles inits en Fast Refresh)
export const auth =
  (globalThis as any).__FKS_AUTH__ ||
  ((globalThis as any).__FKS_AUTH__ = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  }));

// Firestore (singleton). Force long-polling pour RN/Expo.
export const db =
  (globalThis as any).__FKS_DB__ ||
  ((globalThis as any).__FKS_DB__ = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // localCache: memoryLocalCache(), // ← active si tu veux un cache simple en mémoire
    // localCache: persistentLocalCache(), // ← pour une vraie persistance offline (à tester selon SDK)
  }));

// Emulateurs en dev (optionnel)
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === "1") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  } catch {}
}

export { app };
