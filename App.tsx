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
import { registerForPushNotifications, scheduleAllNotifications } from "./services/notifications";
import { auth } from "./services/firebase";
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

// Écrans qui imposent leurs propres icônes de StatusBar claires, quel que soit
// le themeMode global — aujourd'hui uniquement Home (hero plein écran noir,
// identité "Nike" indépendante du thème clair/sombre choisi dans Réglages).
// Piloté ICI, au même endroit que la StatusBar globale unique : pas de
// <StatusBar> locale dans l'écran (cf. CLAUDE.md > Regle d'or ecrans).
const FORCED_LIGHT_STATUS_BAR_ROUTES = new Set(["Home"]);

export default function App() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);
  // Nom de la route active (deepest focused screen, tous navigators confondus) —
  // recalculé à chaque changement de navigation pour adapter la StatusBar sans
  // que chaque écran gère la sienne.
  const [activeRouteName, setActiveRouteName] = useState<string | undefined>();
  const updateActiveRouteName = () => {
    if (navigationRef.isReady()) setActiveRouteName(navigationRef.getCurrentRoute()?.name);
  };
  const statusBarStyle = FORCED_LIGHT_STATUS_BAR_ROUTES.has(activeRouteName ?? "")
    ? "light"
    : themeMode === "dark"
      ? "light"
      : "dark";

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

  useEffect(() => {
    if (!hydrated) return;
    setThemeMode(themeMode);
    const Root = require("./navigation/RootNavigator").default;
    setNavigator(() => Root);
    initAnalytics();
    if (auth.currentUser && notificationsEnabled) {
      // Ne pas afficher la popup permissions avant connexion utilisateur.
      registerForPushNotifications().then(() => scheduleAllNotifications());
    }
  }, [hydrated, themeMode, notificationsEnabled]);

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
        {/* StatusBar globale unique — adaptee au theme, sauf ecrans a fond force
            (ex: Home, hero noir) qui imposent des icones claires (voir
            FORCED_LIGHT_STATUS_BAR_ROUTES ci-dessus). */}
        <StatusBar style={statusBarStyle} />
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onReady={updateActiveRouteName}
          onStateChange={updateActiveRouteName}
        >
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
