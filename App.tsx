// App.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
          Chat: "chat",
          VideoLibrary: "videos",
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
      <NavigationContainer ref={navigationRef} linking={linking}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Navigator />
          <OfflineBanner />
        </GestureHandlerRootView>
        <ToastHost />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
