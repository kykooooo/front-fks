// App.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSettingsStore } from "./state/settingsStore";
import { setThemeMode } from "./constants/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler";
import { initSentry } from "./services/monitoring";
import { initAnalytics } from "./services/analytics";
import { ToastHost } from "./components/ui/ToastHost";
import { registerForPushNotifications, scheduleAllNotifications } from "./services/notifications";
import { auth } from "./services/firebase";

// Configurer les gestionnaires d'erreurs globales une seule fois
setupGlobalErrorHandlers();
initSentry();

export default function App() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);

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
      <NavigationContainer>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Navigator />
        </GestureHandlerRootView>
        <ToastHost />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
