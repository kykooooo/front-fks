// App.tsx
import "./config/textScaling"; // cap global du scaling police — doit s'appliquer avant tout rendu
import React, { useEffect, useState } from "react";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSettingsStore } from "./state/settingsStore";
import { setThemeMode } from "./constants/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler";
import { initSentry } from "./services/monitoring";
import { initAnalytics } from "./services/analytics";
import { ToastHost } from "./components/ui/ToastHost";
import { OfflineBanner } from "./components/OfflineBanner";
import { setupAutoSync, teardownAutoSync } from "./utils/offlineQueue";
import { registerForPushNotifications, scheduleAllNotifications, isNotificationPermissionGranted } from "./services/notifications";
import { auth } from "./services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { applyFeedback } from "./state/orchestrators/applyFeedback";
import { navigationRef } from "./navigation/navigationRef";
import { useNotificationHandler } from "./hooks/useNotificationHandler";
import type { AppStackParamList } from "./navigation/RootNavigator";

// Configurer les gestionnaires d'erreurs globales une seule fois
setupGlobalErrorHandlers();
initSentry();

const linking: LinkingOptions<AppStackParamList> = {
  prefixes: ["fks://"],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: "home",
          NewSession: "new-session",
          Profile: "profile",
        },
      },
      Feedback: "feedback",
      SessionPreview: "session-preview",
      SessionHistory: "history",
      Tests: "tests",
      Progression: "progress",
      Settings: "settings",
    },
  },
};

export default function App() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);

  // Handle notification taps → navigate to the correct screen
  useNotificationHandler();

  // Auto-sync de la queue hors-ligne au retour réseau
  useEffect(() => {
    if (!hydrated) return;
    setupAutoSync({
      feedback: async (data) => {
        const ok = await applyFeedback(data.sessionId, data.feedback);
        if (!ok) throw new Error("Feedback sync failed");
      },
    });
    return () => teardownAutoSync();
  }, [hydrated]);

  // P1-26 (inventaire clubs) : `auth.currentUser` lu une seule fois au boot
  // est null pour un compte NEUF (l'inscription arrive après cet effet) et
  // souvent null au démarrage à froid (restauration auth asynchrone) — la
  // permission notifications n'était JAMAIS demandée de toute la première
  // session, aucun rappel programmé, pendant que Réglages affichait « Notifs
  // activées ». On suit l'état auth réel : l'effet rejoue quand l'utilisateur
  // se connecte.
  const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  useEffect(() => onAuthStateChanged(auth, (u) => setAuthUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!hydrated) return;
    setThemeMode(themeMode);
    const Root = require("./navigation/RootNavigator").default;
    setNavigator(() => Root);
    initAnalytics();
    if (authUid && notificationsEnabled) {
      // Ne pas afficher la popup permissions avant connexion utilisateur.
      registerForPushNotifications().then(async () => {
        // Le token push peut être null pour d'autres raisons (web, projectId
        // absent) : c'est la PERMISSION qui décide des rappels locaux.
        const granted = await isNotificationPermissionGranted();
        if (granted === true) {
          scheduleAllNotifications();
        } else if (granted === false) {
          // Permission refusée : refléter l'état réel dans Réglages plutôt
          // que d'afficher « Notifs activées » pour des notifications qui ne
          // partiront jamais. Un OFF→ON manuel depuis Réglages redemandera
          // la permission (chemin déjà géré là-bas).
          useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
        }
      });
    }
  }, [hydrated, themeMode, notificationsEnabled, authUid]);

  if (!hydrated || !Navigator) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      {/* SafeAreaProvider unique, a la racine : couvre le NavigationContainer
          ET l'OfflineBanner (qui vit hors des navigators). */}
      <SafeAreaProvider>
        {/* StatusBar globale unique — adaptee au theme (defaut = clair). */}
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        <NavigationContainer ref={navigationRef} linking={linking}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Navigator />
            <OfflineBanner />
          </GestureHandlerRootView>
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
