// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HomeScreen from "../screens/HomeScreen";
import { HomeVNextContainer } from "../screens/homeVNext/HomeVNextContainer";
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
import MonCorpsScreen from "../screens/MonCorpsScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import SessionLiveScreen from "../screens/SessionLiveScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import LegalNoticeScreen from "../screens/LegalNoticeScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import RoutineScreen from "../screens/RoutineScreen";
import CycleModalScreen from "../screens/CycleModalScreen";
import ProgressScreen from "../screens/ProgressScreen";
import { theme } from "../constants/theme";
import { STORAGE_KEYS } from "../constants/storage";
import { DEV_FLAGS } from "../config/devFlags";
import { HOME_FEATURES } from "../config/homeFeatures";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "../state/stores/useSyncStore";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { setAnalyticsUserId } from "../services/analytics";
import { setSentryUser } from "../services/monitoring";
import { onWelcomeReset } from "../services/accountDeletion";
import { isPlayerProfileComplete } from "../domain/playerProfile";

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
  Profile: undefined;
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
  DeleteAccount: undefined;
  Routine: undefined;
  GenerateSession: undefined;
  SessionHistory: undefined;
  PrebuiltSessions: undefined;
  PrebuiltSessionDetail: { session: FKS_NextSessionV2 };
  ProfileSetup: undefined;
  ProfileSetupGate: undefined;
  Tests: { initialPlaylist?: string } | undefined;
  /**
   * « Mon corps ». `ouvrirAjout` déplie directement le formulaire (arrivée
   * depuis la passerelle du feedback) ; `source` trace d'où vient la
   * déclaration — jamais utilisée pour un calcul, seulement pour l'afficher.
   */
  MonCorps: { ouvrirAjout?: boolean; source?: "feedback" | "manual" | "setup" } | undefined;
  ExerciseDetail: { highlightId: string };
  Progression: undefined;
  LegalNotice: undefined;
  PrivacyPolicy: undefined;
  CycleModal: { mode?: "select" | "manage"; origin?: "home" | "profile" | "newSession" | "feedback" } | undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  LegalNotice: undefined;
  PrivacyPolicy: undefined;
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const WELCOME_KEY = STORAGE_KEYS.WELCOME_DONE;
const PLAYER_TAB_ORDER: Array<keyof TabParamList> = ["Home", "NewSession", "Profile"];

function MainTabs() {
  const tabOrder = PLAYER_TAB_ORDER;

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
          if (route.name === "Profile") return <Ionicons name="person" size={size} color={color} />;
          return null;
        },
      })}
    >
      {/*
        L'ACCUEIL — UN SEUL NOM DE ROUTE, DEUX CONTENUS POSSIBLES.

        Le flag change le COMPOSANT RENDU, jamais le nom de la route ni l'ordre
        des onglets. C'est volontaire et ce n'est pas cosmetique : `PLAYER_TAB_ORDER`
        pilote le swipe entre onglets, et le NavigationContainer restaure l'etat
        par NOM de route. Introduire un "HomeVNext" a cote de "Home" ferait
        exactement la faute deja payee plus bas dans ce fichier avec
        `ProfileSetup` / `ProfileSetupGate` (voir le commentaire des deux arbres
        `key="nav-app"` / `key="nav-gate"`) : deux routes homonymes-distinctes
        qu'il faut ensuite desambiguiser a la main.

        Repli : `HOME_FEATURES.VNEXT = false` (config/homeFeatures.ts) remet
        l'ancien accueil et ne laisse aucune autre difference.
      */}
      <Tab.Screen name="Home" options={{ title: "Accueil" }}>
        {() => (
          <SwipeTabsWrapper currentTab="Home" tabOrder={tabOrder}>
            {HOME_FEATURES.VNEXT ? <HomeVNextContainer /> : <HomeScreen />}
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
      <Tab.Screen name="Profile" options={{ title: "Profil" }}>
        {() => (
          <SwipeTabsWrapper currentTab="Profile" tabOrder={tabOrder}>
            <ProfileScreen />
          </SwipeTabsWrapper>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      key="nav-app"
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
      <AppStack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: true, title: "Supprimer mon compte" }} />
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
      {/* « Mon corps » : écran plein en route stack, atteint depuis la carte du
          hub Séance et depuis la passerelle du feedback. */}
      <AppStack.Screen name="MonCorps" component={MonCorpsScreen} options={{ headerShown: true, title: "Mon corps" }} />
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
      key="nav-auth"
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
              props.navigation.reset({
                index: 0,
                routes: [{ name: entry === "register" ? "Register" : "Login" }],
              });
              onWelcomeComplete?.();
            }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      {/* Consultables AVANT création de compte (RGPD / App Store 5.1.1) */}
      <AuthStack.Screen
        name="LegalNotice"
        component={LegalNoticeScreen}
        options={{
          headerShown: true,
          title: "Mentions légales",
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
        }}
      />
      <AuthStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          headerShown: true,
          title: "Confidentialité",
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
        }}
      />
    </AuthStack.Navigator>
  );
}

// AUDIT tactile/enchaînement (2026-07) : cet écran s'affiche pendant les
// transitions post-auth (inscription/connexion, restauration de session au
// boot) le temps que Firestore confirme l'état du profil. Sans texte, un
// spinner nu se lit comme un écran figé — `label` rend l'attente explicite
// (cf. CLAUDE.md "Un chargement doit être explicite").
function Splash({ label }: { label?: string }) {
  return (
    <View style={[splashStyles.container, { backgroundColor: theme.colors.bg }]}>
      <ActivityIndicator color={theme.colors.accent} />
      {label ? <Text style={[splashStyles.label, { color: theme.colors.sub }]}>{label}</Text> : null}
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  label: { fontSize: 13, fontWeight: "600" },
});

export default function RootNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  // P1-06 (inventaire clubs) : au démarrage à froid HORS LIGNE, le premier
  // snapshot du profil est un cache VIDE (fromCache, exists=false — aucun
  // persistentLocalCache configuré). Le traiter comme « pas de profil »
  // montrait le questionnaire VIERGE à un joueur déjà configuré, qui croyait
  // son compte effacé. Ce flag garde l'attente honnête à la place.
  const [profilIllisibleHorsLigne, setProfilIllisibleHorsLigne] = useState(false);
  // AUDIT P0-2 : true dès que onAuthStateChanged a répondu UNE première fois.
  // Distinct de `initializing` (qui repasse à true pendant l'attente du profil).
  const [authResolved, setAuthResolved] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  // Les trois champs de dosage (catégorie / poste / niveau), constatés dans
  // l'instantané du profil — cf. domain/playerProfile. `null` = pas encore lu.
  const [profilJoueurComplet, setProfilJoueurComplet] = useState<boolean | null>(null);
  const [welcomeDone, setWelcomeDone] = useState<boolean | null>(null);
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);

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
      setAuthResolved(true);
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

  // Nettoie l'état local quand l'utilisateur change.
  // AUDIT P0-2 : JAMAIS avant la PREMIÈRE résolution de onAuthStateChanged.
  // Au boot, `user` vaut null par défaut alors que Firebase n'a pas encore
  // répondu : appeler resetForUser(null) ici déclenchait un wipe "logout" sur
  // un état indéterminé (snapshot sauvegardé puis stores vidés, restauration
  // perdue si l'auth résolvait pendant la fenêtre). Le wipe logout n'a lieu
  // que sur un null CONFIRMÉ par Firebase (vrai logout / session expirée).
  useEffect(() => {
    if (!authResolved) return;
    resetTrainingStore(user?.uid ?? null);
  }, [authResolved, resetTrainingStore, user?.uid]);

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

  // 1ter) Suppression de compte : la purge locale efface WELCOME_DONE dans
  // AsyncStorage, mais `welcomeDone` (lu UNE fois au boot) resterait `true` en
  // mémoire → l'utilisateur atterrirait sur Login au lieu de Welcome. Le
  // service émet cet événement après la purge pour resynchroniser l'état.
  useEffect(() => onWelcomeReset(() => setWelcomeDone(false)), []);

  // 2) Écoute temps réel du doc profil: users/{uid}
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(
      ref,
      (snap) => {
        // Cache vide hors-ligne = on ne SAIT pas (ni « pas de profil », ni
        // « profil complet »). On ne conclut rien : initializing reste vrai et
        // la branche d'attente affiche pourquoi. Dès que le réseau revient, le
        // listener re-tire avec la vraie réponse. Un compte réellement neuf,
        // lui, arrive ici EN LIGNE (l'inscription exige le réseau) : son
        // snapshot serveur (fromCache=false, exists=false) passe ce garde et
        // ouvre le questionnaire normalement.
        if (snap.metadata.fromCache && !snap.exists()) {
          setProfilIllisibleHorsLigne(true);
          return;
        }
        setProfilIllisibleHorsLigne(false);
        const data = snap.data();
        setProfileCompleted(!!data?.profileCompleted);
        // LA COMPLÉTUDE JOUEUR, LUE À PART DU DRAPEAU `profileCompleted`.
        // Ce drapeau dit deux choses depuis l'espace coach (« questionnaire
        // rempli » ET « coach installé ») : `createClubAsCoach` le pose à vrai
        // sans écrire un seul champ joueur. Un coach qui bascule ensuite en
        // « Je m'entraîne aussi » entrait donc dans l'app joueur avec un profil
        // vide, et le moteur dosait sans aucun plafond d'âge (audit 2026-09,
        // P1-04 + erratum 4). On constate les champs eux-mêmes.
        setProfilJoueurComplet(isPlayerProfileComplete(data));
        setInitializing(false);
      },
      (err) => {
        if (__DEV__) {
          console.warn("Erreur lors du check profil:", err);
        }
        setProfileCompleted(false);
        setProfilJoueurComplet(false);
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
  if (welcomeDone === null) return <Splash label="Chargement…" />;

  // 5) Restauration de session Firebase en cours → Splash.
  //    IMPORTANT : ce check doit précéder `!user`, sinon un utilisateur déjà
  //    connecté voit flasher l'écran Login à chaque démarrage à froid
  //    (user reste null tant que onAuthStateChanged n'a pas résolu).
  // Couvre aussi la fenêtre post-inscription/connexion (onAuthStateChanged
  // a déjà un user, on attend la 1ère réponse Firestore sur profileCompleted).
  // Cette branche se déclenche à CHAQUE démarrage à froid pour un utilisateur
  // déjà inscrit (pas seulement à l'inscription) : libellé neutre, vrai pour
  // tous les cas de cette branche (pas de nouvel état à faire courir avec la
  // logique auth pour distinguer inscription/login/restauration).
  if (initializing) {
    return (
      <Splash
        label={
          profilIllisibleHorsLigne
            ? "Hors connexion — ton profil ne peut pas être chargé. L'app reprendra dès que le réseau revient."
            : "Chargement de ton profil…"
        }
      />
    );
  }

  // 5bis) Pas connecté → Auth stack (Welcome intégré dans le stack pour back navigation)
  if (!user) {
    return (
      <AuthNavigator
        initialRouteName={welcomeDone ? "Login" : "Welcome"}
        onWelcomeComplete={() => setWelcomeDone(true)}
      />
    );
  }

  // 6) Connecté mais profil joueur non complété → questionnaire joueur.
  //
  //    DEUX FAÇONS D'ÊTRE « PAS PRÊT ». Le drapeau `profileCompleted` ne suffit
  //    pas : les comptes créés par l'ancien espace coach (retiré en 2026-09) le
  //    portent à vrai sans un seul champ joueur. On regarde donc aussi les
  //    champs eux-mêmes (`isPlayerProfileComplete`) : un ancien compte coach
  //    est ainsi renvoyé compléter son profil joueur, sans qu'aucune donnée ne
  //    soit inventée pour lui. Le questionnaire n'écrit jamais de pointeur de
  //    club : un rattachement historique reste intact en base (merge), sans
  //    peser sur la navigation.
  if (profileCompleted === false || profilJoueurComplet === false) {
    // Nom de route volontairement distinct du "ProfileSetup" de AppNavigator :
    // ces deux arbres sont échangés conditionnellement, mais le
    // NavigationContainer n'y voit qu'un seul navigateur qui change de contenu et
    // restaurait son état sur la route homonyme — il réaffichait le setup au lieu
    // du Home après la complétion. Nom distinct + key par arbre = plus de
    // rapprochement possible.
    return (
      <AppStack.Navigator
        key="nav-gate"
        initialRouteName="ProfileSetupGate"
        screenOptions={{ headerShown: false }}
      >
          <AppStack.Screen name="ProfileSetupGate" options={{ headerShown: false }}>
            {() => (
              <ProfileSetupScreen
                onProfileCompleted={() => {
                  // Pont local, les DEUX conditions du portillon : sans la
                  // seconde, un profil qui vient d'être rempli resterait bloqué
                  // sur le questionnaire jusqu'à ce que l'instantané Firestore
                  // revienne. Le listener reste la source durable.
                  setProfileCompleted(true);
                  setProfilJoueurComplet(true);
                }}
              />
            )}
          </AppStack.Screen>
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
          <AppStack.Screen name="Tests" component={TestsScreen} options={{ headerShown: true, title: "Tests terrain" }} />
          {/* Le setup profil peut envoyer ici (D6) : la route doit exister AUSSI
              dans cette pile, sinon la question de fin de setup mènerait nulle part. */}
          <AppStack.Screen name="MonCorps" component={MonCorpsScreen} options={{ headerShown: true, title: "Mon corps" }} />
      </AppStack.Navigator>
    );
  }

  // 7) Profil joueur complet → app joueur.
  return <AppNavigator />;
}
