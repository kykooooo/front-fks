// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HomeScreen from "../screens/HomeScreen";
import NewSessionScreen from "../screens/NewSessionScreen";
import FeedbackScreen from "../screens/FeedbackScreen";
import ExternalLoadScreen from "../screens/ExternalLoadScreen";
import RegisterScreen from "../screens/RegisterScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileSetupScreen from "../screens/ProfileSetupScreen";
import VideoLibraryScreen from "../screens/VideoLibraryScreen";
import SessionPreviewScreen from "../screens/SessionPreviewScreen";
import SessionHubScreen from "../screens/SessionHubScreen";
import SessionHistoryScreen from "../screens/SessionHistoryScreen";
import PrebuiltSessionsScreen from "../screens/PrebuiltSessionsScreen";
import PrebuiltSessionDetailScreen from "../screens/PrebuiltSessionDetailScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TestsScreen from "../screens/TestsScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import SessionLiveScreen from "../screens/SessionLiveScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LegalNoticeScreen from "../screens/LegalNoticeScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import RoutineScreen from "../screens/RoutineScreen";
import CoachDashboardScreen from "../screens/CoachDashboardScreen";
import CoachPlayerDetailScreen from "../screens/CoachPlayerDetailScreen";
import ChatScreen from "../screens/ChatScreen";
import CycleModalScreen from "../screens/CycleModalScreen";
import ProgressScreen from "../screens/ProgressScreen";
import { theme } from "../constants/theme";
import { DEV_FLAGS } from "../config/devFlags";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "../state/stores/useSyncStore";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { useAppModeStore } from "../state/appModeStore";
import { setAnalyticsUserId } from "../services/analytics";
import { setSentryUser } from "../services/monitoring";

// Firebase
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// Types
import type { FKS_NextSessionV2 } from "../screens/newSession/types";

// --- Types
type TabParamList = {
  Home: undefined;
  NewSession: undefined;
  VideoLibrary: { highlightId?: string; startInFavorites?: boolean } | undefined;
  Chat: undefined;
  Profile: undefined;
  Coach: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Feedback: { sessionId?: string; prefill?: { rpe?: number; durationMin?: number } } | undefined;
  ExternalLoad: undefined;
  SessionPreview: { v2: FKS_NextSessionV2; plannedDateISO: string; sessionId?: string };
  SessionLive: { v2: FKS_NextSessionV2; plannedDateISO: string; sessionId?: string };
  SessionSummary: {
    sessionId?: string;
    summary: {
      title: string;
      subtitle?: string | null;
      plannedDateISO?: string;
      completedItems: number;
      totalItems: number;
      durationMin?: number;
      rpe?: number;
      intensity?: string;
      focus?: string;
      location?: string;
      srpe?: number;
      recoveryTips?: string[];
    };
  };
  Settings: undefined;
  Routine: undefined;
  GenerateSession: undefined;
  SessionHistory: undefined;
  PrebuiltSessions: undefined;
  PrebuiltSessionDetail: { session: FKS_NextSessionV2 };
  ProfileSetup: undefined;
  Tests: { initialPlaylist?: string } | undefined;
  ExerciseDetail: { highlightId: string };
  Progression: undefined;
  LegalNotice: undefined;
  PrivacyPolicy: undefined;
  CycleModal: { mode?: "select" | "manage"; origin?: "home" | "profile" | "newSession" | "feedback" } | undefined;
  CoachPlayerDetail: { userId: string; userName?: string } | undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const WELCOME_KEY = "fks_welcome_done";
const PLAYER_TAB_ORDER: Array<keyof TabParamList> = ["Home", "NewSession", "Chat", "VideoLibrary", "Profile"];
const COACH_TAB_ORDER: Array<keyof TabParamList> = ["Coach", "Chat", "Profile"];

function MainTabs() {
  const mode = useAppModeStore((s) => s.mode);
  const tabOrder = mode === "coach" ? COACH_TAB_ORDER : PLAYER_TAB_ORDER;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.sub,
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Home") return <Ionicons name="home" size={size} color={color} />;
          if (route.name === "NewSession") return <Ionicons name="flash" size={size} color={color} />;
          if (route.name === "VideoLibrary") return <Ionicons name="play-circle" size={size} color={color} />;
          if (route.name === "Chat") return <Ionicons name="chatbubble-ellipses" size={size} color={color} />;
          if (route.name === "Profile") return <Ionicons name="person" size={size} color={color} />;
          if (route.name === "Coach") return <Ionicons name="people" size={size} color={color} />;
          return null;
        },
      })}
    >
      {mode === "coach" ? (
        <>
          <Tab.Screen name="Coach" options={{ title: "Coach" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Coach" tabOrder={tabOrder}>
                <CoachDashboardScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="Chat" options={{ title: "Assistant" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Chat" tabOrder={tabOrder}>
                <ChatScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ title: "Profil" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Profile" tabOrder={tabOrder}>
                <ProfileScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
        </>
      ) : (
        <>
          <Tab.Screen name="Home" options={{ title: "Accueil" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Home" tabOrder={tabOrder}>
                <HomeScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="NewSession" options={{ title: "Séance" }}>
            {() => (
              <SwipeTabsWrapper currentTab="NewSession" tabOrder={tabOrder}>
                <SessionHubScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="Chat" options={{ title: "Assistant" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Chat" tabOrder={tabOrder}>
                <ChatScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="VideoLibrary" options={{ title: "Vidéos" }}>
            {() => (
              <SwipeTabsWrapper currentTab="VideoLibrary" tabOrder={tabOrder}>
                <VideoLibraryScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ title: "Profil" }}>
            {() => (
              <SwipeTabsWrapper currentTab="Profile" tabOrder={tabOrder}>
                <ProfileScreen />
              </SwipeTabsWrapper>
            )}
          </Tab.Screen>
        </>
      )}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text },
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
        headerBackTitle: "Retour",
      }}
    >
      <AppStack.Screen name="Tabs" component={MainTabs} options={{ gestureEnabled: false }} />
      <AppStack.Screen
        name="CoachPlayerDetail"
        component={CoachPlayerDetailScreen}
        options={{ headerShown: true, title: "Joueur" }}
      />
      <AppStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ headerShown: false, presentation: "transparentModal", animation: "fade", gestureEnabled: false }}
      />
      <AppStack.Screen
        name="ExternalLoad"
        component={ExternalLoadScreen}
        options={{ headerShown: false, presentation: "transparentModal", animation: "fade", gestureEnabled: false }}
      />
      <AppStack.Screen
        name="SessionPreview"
        component={SessionPreviewScreen}
        options={{ headerShown: false, presentation: "transparentModal", animation: "fade", gestureEnabled: false }}
      />
      <AppStack.Screen name="SessionLive" component={SessionLiveScreen} options={{ headerShown: true, title: "Séance en cours" }} />
      <AppStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ headerShown: true, title: "Résumé" }} />
      <AppStack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Paramètres" }} />
      <AppStack.Screen name="LegalNotice" component={LegalNoticeScreen} options={{ headerShown: true, title: "Mentions légales" }} />
      <AppStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: true, title: "Confidentialité" }} />
      <AppStack.Screen name="Routine" component={RoutineScreen} options={{ headerShown: true, title: "Routine" }} />
      <AppStack.Screen name="Progression" component={ProgressScreen} options={{ headerShown: true, title: "Progression" }} />
      <AppStack.Screen name="GenerateSession" component={NewSessionScreen} options={{ headerShown: true, title: "Créer une séance" }} />
      <AppStack.Screen name="SessionHistory" component={SessionHistoryScreen} options={{ headerShown: true, title: "Historique" }} />
      <AppStack.Screen name="PrebuiltSessions" component={PrebuiltSessionsScreen} options={{ headerShown: true, title: "Séances pré-construites" }} />
      <AppStack.Screen name="PrebuiltSessionDetail" component={PrebuiltSessionDetailScreen} options={{ headerShown: true, title: "Détails séance" }} />
      <AppStack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ headerShown: true, title: "Profil" }} />
      <AppStack.Screen name="Tests" component={TestsScreen} options={{ headerShown: true, title: "Tests terrain" }} />
      <AppStack.Screen name="ExerciseDetail" component={VideoLibraryScreen} options={{ headerShown: true, title: "Fiche exercice" }} />
      <AppStack.Screen
        name="CycleModal"
        component={CycleModalScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "fade",
          gestureEnabled: false,
        }}
      />
    </AppStack.Navigator>
  );
}

function AuthNavigator({
  initialRouteName = "Login",
  onWelcomeComplete,
}: {
  initialRouteName?: keyof AuthStackParamList;
  onWelcomeComplete?: () => void;
}) {
  return (
    <AuthStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <AuthStack.Screen name="Welcome">
        {(props) => (
          <WelcomeScreen
            onComplete={(entry) => {
              props.navigation.navigate(entry === "register" ? "Register" : "Login");
              // Marquer après navigation pour éviter le re-render avant navigate
              setTimeout(() => onWelcomeComplete?.(), 100);
            }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

export default function RootNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [welcomeDone, setWelcomeDone] = useState<boolean | null>(null);
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);
  const mode = useAppModeStore((s) => s.mode);
  const modeLoading = useAppModeStore((s) => s.loading);
  const loadModeForUid = useAppModeStore((s) => s.loadForUid);

  // 0) DEV: force welcome screen (déconnecte + reset flag)
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
        setInitializing(false);
      } else {
        // Nouveau user (login/register) → attendre le profile listener Firestore
        setInitializing(true);
      }
      setAnalyticsUserId(u?.uid ?? null);
      setSentryUser(u?.uid ?? null);
    });
    return unsubAuth;
  }, []);

  // Nettoie l'état local quand l'utilisateur change
  useEffect(() => {
    resetTrainingStore(user?.uid ?? null);
  }, [resetTrainingStore, user?.uid]);

  // Mode (coach/joueur) par utilisateur
  useEffect(() => {
    loadModeForUid(user?.uid ?? null);
  }, [loadModeForUid, user?.uid]);

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

  // 2) Écoute temps réel du doc profil: users/{uid}
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(
      ref,
      (snap) => {
        const ok = !!snap.data()?.profileCompleted;
        setProfileCompleted(ok);
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
  }, [user?.uid]);

  // 3) Loading initial
  useEffect(() => {
    if (!storeHydrated) return;
    if (!user) return;
    startFirestoreWatch();
  }, [storeHydrated, user, startFirestoreWatch]);

  // 4) Chargement des flags locaux
  if (welcomeDone === null) return <Splash />;

  // 5) Pas connecté → Auth stack (Welcome intégré dans le stack pour back navigation)
  if (!user) {
    return (
      <AuthNavigator
        initialRouteName={welcomeDone ? "Login" : "Welcome"}
        onWelcomeComplete={() => setWelcomeDone(true)}
      />
    );
  }

  // 6) Connecté → on attend profil + mode
  if (initializing || modeLoading) return <Splash />;

  // 6) Connecté mais profil non complété → écran profil
  if (profileCompleted === false) {
    return (
      <SafeAreaProvider>
        <AppStack.Navigator>
          <AppStack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ headerShown: false }}
          />
          <AppStack.Screen
            name="CycleModal"
            component={CycleModalScreen}
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animation: "fade",
              gestureEnabled: false,
            }}
          />
        </AppStack.Navigator>
      </SafeAreaProvider>
    );
  }

  // 6) Profil complet → app (mode déjà choisi dans le questionnaire profil)
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
