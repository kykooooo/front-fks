// App.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { useSettingsStore } from "./state/settingsStore";
import { setThemeMode } from "./constants/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "./utils/globalErrorHandler";
import { initSentry } from "./services/monitoring";
import { initAnalytics } from "./services/analytics";

// Configurer les gestionnaires d'erreurs globales une seule fois
setupGlobalErrorHandlers();
initSentry();

export default function App() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setThemeMode(themeMode);
    const Root = require("./navigation/RootNavigator").default;
    setNavigator(() => Root);
    initAnalytics();
  }, [hydrated, themeMode]);

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
        <Navigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
