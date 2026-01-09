// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import AiContextDebugScreen from "../screens/AiContextDebugScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TestsScreen from "../screens/TestsScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTrainingStore } from "../state/trainingStore";

// Firebase
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// --- Types
export type AppStackParamList = {
  Tabs: undefined;
  Feedback: { sessionId?: string } | undefined;
  ExternalLoad: undefined;
  SessionPreview: { v2: any; plannedDateISO: string; sessionId?: string };
  GenerateSession: undefined;
  SessionHistory: undefined;
  PrebuiltSessions: undefined;
  PrebuiltSessionDetail: { session: any };
  ProfileSetup: undefined;
  AiContextDebug: undefined;
  Tests: undefined;
  Onboarding: undefined;
};

type TabParamList = {
  Home: undefined;
  NewSession: undefined;
  VideoLibrary: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const ONBOARDING_KEY = "fks_onboarding_done";

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0c0e13", borderTopColor: "#1f2430" },
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Home") return <Ionicons name="home" size={size} color={color} />;
          if (route.name === "NewSession") return <Ionicons name="flash" size={size} color={color} />;
          if (route.name === "VideoLibrary") return <Ionicons name="play-circle" size={size} color={color} />;
          if (route.name === "Profile") return <Ionicons name="person" size={size} color={color} />;
          return null;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Accueil" }} />
      <Tab.Screen name="NewSession" component={SessionHubScreen} options={{ title: "Séance" }} />
      <Tab.Screen name="VideoLibrary" component={VideoLibraryScreen} options={{ title: "Vidéos" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#050509" },
        headerTintColor: "#f9fafb",
        headerTitleStyle: { color: "#f9fafb" },
      }}
    >
      <AppStack.Screen name="Tabs" component={MainTabs} />
      <AppStack.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: true, title: "Feedback" }} />
      <AppStack.Screen name="ExternalLoad" component={ExternalLoadScreen} options={{ headerShown: true, title: "External Load" }} />
      <AppStack.Screen name="SessionPreview" component={SessionPreviewScreen} options={{ headerShown: true, title: "Séance IA" }} />
      <AppStack.Screen name="GenerateSession" component={NewSessionScreen} options={{ headerShown: true, title: "Créer une séance" }} />
      <AppStack.Screen name="SessionHistory" component={SessionHistoryScreen} options={{ headerShown: true, title: "Historique" }} />
      <AppStack.Screen name="PrebuiltSessions" component={PrebuiltSessionsScreen} options={{ headerShown: true, title: "Séances pré-construites" }} />
      <AppStack.Screen name="PrebuiltSessionDetail" component={PrebuiltSessionDetailScreen} options={{ headerShown: true, title: "Détails séance" }} />
      <AppStack.Screen name="AiContextDebug" component={AiContextDebugScreen} options={{ headerShown: true, title: "Contexte IA" }} />
      <AppStack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ headerShown: true, title: "Profil" }} />
      <AppStack.Screen name="Tests" component={TestsScreen} options={{ headerShown: true, title: "Tests terrain" }} />
    </AppStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator initialRouteName="Login">
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
    </AuthStack.Navigator>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

export default function RootNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const startFirestoreWatch = useTrainingStore((s) => s.startFirestoreWatch);
  const storeHydrated = useTrainingStore((s) => (s as any).storeHydrated ?? true);
  const resetTrainingStore = useTrainingStore((s) => s.resetForUser);

  // 1) Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfileCompleted(null);
        setInitializing(false);
      }
      // si u existe, on attend le listener Firestore ci-dessous pour finir l'init
    });
    return unsubAuth;
  }, []);

  // Nettoie l'état local quand l'utilisateur change
  useEffect(() => {
    resetTrainingStore(user?.uid ?? null);
  }, [resetTrainingStore, user?.uid]);

  // 1bis) Onboarding local
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(ONBOARDING_KEY);
        setOnboardingDone(flag === "1");
      } catch {
        setOnboardingDone(false);
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
        console.warn("Erreur lors du check profil:", err);
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

  // 4) Loading initial
  if (initializing || onboardingDone === null) return <Splash />;

  // 5) Pas connecté → Auth stack
  if (!user) return <AuthNavigator />;

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
        </AppStack.Navigator>
      </SafeAreaProvider>
    );
  }

  // Onboarding local (affiché une fois)
  if (!onboardingDone) {
    return (
      <SafeAreaProvider>
        <AppStack.Navigator>
          <AppStack.Screen
            name="Onboarding"
            options={{ headerShown: false }}
          >
            {(props) => (
              <OnboardingScreen
                {...props}
                onDone={async () => {
                  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
                  setOnboardingDone(true);
                }}
              />
            )}
          </AppStack.Screen>
        </AppStack.Navigator>
      </SafeAreaProvider>
    );
  }

  // 6) Profil complet → app
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
