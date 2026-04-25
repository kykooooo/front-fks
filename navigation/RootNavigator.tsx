// navigation/RootNavigator.tsx
// State machine d'authentification : Splash → Auth → ProfileGate → App

import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { setAnalyticsUserId } from "../services/analytics";
import { setSentryUser } from "../services/monitoring";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useAppModeStore } from "../state/appModeStore";
import { useAuthFlowStore } from "../state/authFlowStore";

import { ProfileGateStack, WELCOME_KEY } from "./types";
import { AppNavigator } from "./AppNavigator";
import { AuthNavigator, Splash } from "./AuthNavigator";

import ProfileSetupScreen from "../screens/ProfileSetupScreen";
import CycleModalScreen from "../screens/CycleModalScreen";

// Re-export des types pour retrocompatibilite (imports existants dans les screens)
export type { AppStackParamList, AuthStackParamList } from "./types";

export default function RootNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [welcomeDone, setWelcomeDone] = useState<boolean | null>(null);
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);
  const modeLoading = useAppModeStore((s) => s.loading);
  const loadModeForUid = useAppModeStore((s) => s.loadForUid);
  const completedProfileUid = useAuthFlowStore((s) => s.completedProfileUid);
  const clearProfileCompleted = useAuthFlowStore((s) => s.clearProfileCompleted);

  // 0) DEV: force welcome screen (deconnecte + reset flag)
  useEffect(() => {
    if (!DEV_FLAGS.FORCE_WELCOME) return;
    (async () => {
      await AsyncStorage.removeItem(WELCOME_KEY);
      try { await auth.signOut(); } catch {}
    })();
  }, []);

  // 1) Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfileCompleted(null);
        clearProfileCompleted();
        setInitializing(false);
      } else {
        setInitializing(true);
      }
      setAnalyticsUserId(u?.uid ?? null);
      setSentryUser(u?.uid ?? null);
    });
    return unsubAuth;
  }, [clearProfileCompleted]);

  // Nettoie l'etat local quand l'utilisateur change
  useEffect(() => {
    resetTrainingStore(user?.uid ?? null);
  }, [resetTrainingStore, user?.uid]);

  // Mode (coach/joueur) par utilisateur
  useEffect(() => {
    loadModeForUid(user?.uid ?? null);
  }, [loadModeForUid, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (completedProfileUid === user.uid) return;
    clearProfileCompleted(user.uid);
  }, [clearProfileCompleted, completedProfileUid, user?.uid]);

  // 1bis) Welcome local flag
  useEffect(() => {
    (async () => {
      try {
        const welcomeFlag = await AsyncStorage.getItem(WELCOME_KEY);
        setWelcomeDone(welcomeFlag === "true");
      } catch {
        setWelcomeDone(false);
      }
    })();
  }, []);

  // 2) Ecoute temps reel du doc profil: users/{uid}
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsubProfile = onSnapshot(
      ref,
      (snap) => {
        const ok = !!snap.data()?.profileCompleted;
        setProfileCompleted(ok);
        if (ok) clearProfileCompleted(uid);
        setInitializing(false);
      },
      (err) => {
        if (__DEV__) {
          console.warn("Erreur lors du check profil:", err);
        }
        setProfileCompleted(false);
        setInitializing(false);
      }
    );
    return unsubProfile;
  }, [clearProfileCompleted, user?.uid]);

  // 3) Loading initial
  useEffect(() => {
    if (!storeHydrated) return;
    if (!user) return;
    startFirestoreWatch();
  }, [storeHydrated, user, startFirestoreWatch]);

  // --- Render gates ---

  if (welcomeDone === null) return <Splash />;

  if (!user) {
    return (
      <AuthNavigator
        initialRouteName={welcomeDone ? "Login" : "Welcome"}
        onWelcomeComplete={() => setWelcomeDone(true)}
      />
    );
  }

  const hasLocalProfileCompletion = !!user?.uid && completedProfileUid === user.uid;
  const effectiveProfileCompleted = profileCompleted === true || hasLocalProfileCompletion;

  if (initializing || modeLoading) return <Splash />;

  if (!effectiveProfileCompleted) {
    return (
      <SafeAreaProvider>
        <ProfileGateStack.Navigator>
          <ProfileGateStack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ headerShown: false }}
          />
          <ProfileGateStack.Screen
            name="CycleModal"
            component={CycleModalScreen}
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animation: "fade",
              gestureEnabled: false,
            }}
          />
        </ProfileGateStack.Navigator>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
