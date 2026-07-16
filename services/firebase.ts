// src/services/firebase.ts
import { Platform } from "react-native";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { firebaseWebConfig } from "../config/firebaseConfig";

// ✅ On reste sur 'firebase/auth' (pas de '/react-native')
import { initializeAuth, getAuth } from "firebase/auth";
// @ts-ignore — manquant dans les d.ts mais présent au runtime (RN uniquement, absent sur web)
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";

const apps = getApps();
const app: FirebaseApp = apps.length ? (apps[0] as FirebaseApp) : initializeApp(firebaseWebConfig);

// Auth : persistance AsyncStorage sur iOS/Android, persistance web par defaut sur web
// (getReactNativePersistence n'existe pas dans le build web de firebase/auth).
export const auth =
  (globalThis as any).__FKS_AUTH__ ||
  ((globalThis as any).__FKS_AUTH__ =
    Platform.OS === "web"
      ? getAuth(app)
      : initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        }));

// Firestore (singleton). Force long-polling pour RN/Expo.
export const db =
  (globalThis as any).__FKS_DB__ ||
  ((globalThis as any).__FKS_DB__ = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }));

// Emulateurs en dev (optionnel)
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === "1") {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  } catch (err) {
    if (__DEV__) {
      console.warn('[Firebase] Emulator connection failed (expected if emulator is not running):', err);
    }
  }
}

export { app };
