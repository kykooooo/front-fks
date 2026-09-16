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
import { initAnalytics, setAnalyticsEnabled } from "./services/analytics";
import { ToastHost } from "./components/ui/ToastHost";
import { OfflineBanner } from "./components/OfflineBanner";
import { setupAutoSync, teardownAutoSync } from "./utils/offlineQueue";
import { createNotificationSync, installNotificationSync } from "./services/notificationSync";
import { auth } from "./services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { applyFeedback } from "./state/orchestrators/applyFeedback";
import { armerMigrationBlessures } from "./state/migration/migrateInjuries";
import { navigationRef } from "./navigation/navigationRef";
import { useNotificationHandler } from "./hooks/useNotificationHandler";
import type { AppStackParamList } from "./navigation/RootNavigator";

// Configurer les gestionnaires d'erreurs globales une seule fois
setupGlobalErrorHandlers();
initSentry();

// « Mon corps » : reprise unique des blessures declarees a l'ancienne (dans le
// feedback de fin de seance) vers l'espace dedie. Armee ici parce qu'elle a
// besoin de DEUX stores hydrates ; elle attend d'elle-meme et ne tourne qu'une
// fois. Rejouee apres un changement d'utilisateur (resetUser).
armerMigrationBlessures();

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
  const sessionReminders = useSettingsStore((s) => s.sessionReminders);
  const privacyAnalytics = useSettingsStore((s) => s.privacyAnalytics);
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
  // `authResolved` : Firebase a répondu au moins une fois. Avant, `null` veut
  // dire « on ne sait pas encore », pas « déconnecté » — on n'annule rien dessus.
  const [authResolved, setAuthResolved] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setAuthUid(u?.uid ?? null);
        setAuthResolved(true);
      }),
    [],
  );

  // ── RAPPELS : UNE SEULE COORDINATION, QUI RELIT L'ÉTAT COURANT ──────────
  // Le contexte est lu par référence (jamais capturé) : une opération lancée
  // avant une déconnexion ou une bascule OFF se voit périmée et n'écrit rien
  // (cf. services/notificationSync). Le token push est lancé à côté, jamais
  // attendu.
  // Le contexte est PUBLIÉ à la coordination après chaque rendu (jamais lu
  // pendant), avant l'effet de réconciliation : les opérations en vol relisent
  // l'état du moment, jamais celui capturé à leur départ.
  const [sync] = useState(() => createNotificationSync());
  useEffect(() => {
    sync.setContext({ authResolved, uid: authUid, notificationsEnabled, sessionReminders });
  });
  useEffect(() => {
    installNotificationSync(sync);
  }, [sync]);

  useEffect(() => {
    if (!hydrated || !authResolved) return;
    // Réconciliation à CHAQUE changement pertinent, état OFF et déconnexion
    // compris : des rappels programmés par une ancienne version ou une session
    // précédente ne survivent pas à un démarrage où ils ne sont plus voulus.
    // À la connexion avec la préférence ON, la permission est demandée si elle
    // ne l'a jamais été (jamais avant qu'un compte soit connecté).
    void sync.reconcile({
      requestPermission: Boolean(authUid && notificationsEnabled),
      onPermissionDenied: () => {
        // Permission refusée : refléter l'état réel dans Réglages plutôt que
        // d'afficher « Notifications » ON pour des rappels qui ne partiront
        // jamais. Un OFF→ON manuel depuis Réglages redemandera la permission.
        useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
      },
    });
  }, [sync, hydrated, authResolved, authUid, notificationsEnabled, sessionReminders]);

  // ANALYTICS — jamais avant l'hydratation des préférences, et toujours avec la
  // préférence RESTAURÉE : un joueur qui a refusé les statistiques ne voit pas
  // le SDK démarrer « par défaut » pendant la seconde où le disque répond.
  // Un changement ultérieur (Réglages) est répercuté sans réinitialiser.
  useEffect(() => {
    if (!hydrated) return;
    initAnalytics({ enabled: privacyAnalytics });
    setAnalyticsEnabled(privacyAnalytics);
  }, [hydrated, privacyAnalytics]);

  useEffect(() => {
    if (!hydrated) return;
    setThemeMode(themeMode);
    const Root = require("./navigation/RootNavigator").default;
    setNavigator(() => Root);
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
