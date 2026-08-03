// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import WelcomeScreen, { type WelcomeCompleteOptions } from "../screens/WelcomeScreen";
import SessionLiveScreen from "../screens/SessionLiveScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import LegalNoticeScreen from "../screens/LegalNoticeScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import RoutineScreen from "../screens/RoutineScreen";
import CycleModalScreen from "../screens/CycleModalScreen";
import ProgressScreen from "../screens/ProgressScreen";
import CoachOnboardingScreen from "../screens/CoachOnboardingScreen";
import CoachTabs, { type CoachTabsParamList } from "./CoachTabs";
import CoachPlayerScreen from "../screens/coach/CoachPlayerScreen";
import CoachAccessUnconfirmedScreen from "../screens/coach/CoachAccessUnconfirmedScreen";
import { coachColors } from "../components/coach/coachTheme";
import { theme } from "../constants/theme";
import { STORAGE_KEYS } from "../constants/storage";
import { DEV_FLAGS } from "../config/devFlags";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "../state/stores/useSyncStore";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { setAnalyticsUserId } from "../services/analytics";
import { setSentryUser } from "../services/monitoring";
import { onWelcomeReset } from "../services/accountDeletion";
import { useAppSpace } from "../hooks/useAppSpace";
import { resolveClubPointer } from "../domain/coachAuthority";
import { publishAppSpaceSwitch } from "../state/appSpaceGate";

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
  CoachOnboarding: undefined;
  Tests: { initialPlaylist?: string } | undefined;
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

export type CoachStackParamList = {
  /** Les 3 onglets coach (Aujourd'hui / Effectif / Semaine). */
  CoachHome: NavigatorScreenParams<CoachTabsParamList> | undefined;
  // Coach-safe : on ne transmet plus de profil brut, seulement les clés de lecture
  // de la projection (clubs/{clubId}/playerSummaries/{playerUid}).
  CoachPlayerDetail: { clubId: string; playerUid: string };
  DeleteAccount: undefined;
  LegalNotice: undefined;
  PrivacyPolicy: undefined;
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CoachStack = createNativeStackNavigator<CoachStackParamList>();
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
      {/* Accessible depuis l'édition de profil ("Tu fais partie du staff ?") */}
      <AppStack.Screen
        name="CoachOnboarding"
        component={CoachOnboardingScreen}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
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

function CoachNavigator() {
  return (
    <CoachStack.Navigator
      key="nav-coach"
      screenOptions={{
        headerShown: false,
        // RUPTURE VISUELLE CORRIGÉE. Ce stack posait la palette JOUEUR
        // (`theme.colors.background`, sombre et dépendante du themeMode) sur ses
        // en-têtes : « Mentions légales », « Confidentialité » et « Supprimer mon
        // compte » s'ouvraient avec une barre de titre sombre au milieu d'un
        // espace coach clair — et devenaient carrément noires en thème sombre.
        // Les couleurs coach sont désormais posées ICI, une seule fois, pour
        // tous les écrans du stack (y compris les écrans partagés avec le joueur,
        // dont seul le CORPS reste en thème joueur — hors périmètre de ce lot).
        headerStyle: { backgroundColor: coachColors.card },
        headerTintColor: coachColors.text,
        headerTitleStyle: { color: coachColors.text },
        headerShadowVisible: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        gestureDirection: "horizontal",
        headerBackTitle: "Retour",
      }}
    >
      {/* Écran d'atterrissage = la tab bar coach (Aujourd'hui / Effectif / Semaine). */}
      <CoachStack.Screen name="CoachHome" component={CoachTabs} options={{ gestureEnabled: false }} />
      {/* Titre par défaut neutre : la fiche le remplace par le prénom dès qu'elle
          l'a lu (useLayoutEffect), et n'a plus à repeindre l'en-tête elle-même. */}
      <CoachStack.Screen
        name="CoachPlayerDetail"
        component={CoachPlayerScreen}
        options={{ headerShown: true, title: "Fiche joueur" }}
      />
      <CoachStack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: true, title: "Supprimer mon compte" }} />
      <CoachStack.Screen name="LegalNotice" component={LegalNoticeScreen} options={{ headerShown: true, title: "Mentions légales" }} />
      <CoachStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: true, title: "Confidentialité" }} />
    </CoachStack.Navigator>
  );
}

function AuthNavigator({
  initialRouteName = "Login",
  onWelcomeComplete,
}: {
  initialRouteName?: keyof AuthStackParamList;
  onWelcomeComplete?: (options?: WelcomeCompleteOptions) => void;
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
            onComplete={(entry, options) => {
              props.navigation.reset({
                index: 0,
                routes: [{ name: entry === "register" ? "Register" : "Login" }],
              });
              // L'intention remonte AVEC l'entrée : coach ou joueur, on passe par
              // les mêmes écrans d'inscription (cf. WelcomeCompleteOptions).
              onWelcomeComplete?.(options);
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
  // AUDIT P0-2 : true dès que onAuthStateChanged a répondu UNE première fois.
  // Distinct de `initializing` (qui repasse à true pendant l'attente du profil).
  const [authResolved, setAuthResolved] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  // `users/{uid}.clubId` : OÙ regarder, jamais QUI on est. L'espace affiché est
  // dérivé de l'appartenance elle-même (cf. hooks/useAppSpace).
  const [clubId, setClubId] = useState<string | null>(null);
  const [welcomeDone, setWelcomeDone] = useState<boolean | null>(null);
  // ── L'INTENTION COACH, ET CE QU'ELLE N'EST PAS ────────────────────────────
  // Déclarée sur l'écran d'accueil (« Je suis coach »), elle sert à UNE chose :
  // choisir par quel écran on atterrit quand le profil n'est pas encore rempli —
  // création de club plutôt que questionnaire joueur. Elle n'accorde AUCUN droit
  // et n'ouvre AUCUN espace : l'espace coach reste dérivé de l'appartenance
  // `clubs/{clubId}/members/{uid}` (cf. domain/appSpace.ts), et cette dérivation
  // est évaluée AVANT ce portillon (branche 6bis plus bas).
  //
  // POURQUOI EN MÉMOIRE, ET PAS DANS `users/{uid}.role` : ce champ est écrivable
  // par le client, il ne décide plus de rien depuis le lot « un compte, un
  // espace », et l'y remettre rouvrirait exactement la faille refermée là-bas.
  // Une intention n'est pas une autorité : elle vit le temps de la traversée
  // Welcome → inscription → premier écran, et disparaît avec la session.
  const [intentionCoach, setIntentionCoach] = useState(false);
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);

  // ── QUEL ESPACE AFFICHER (coach ou joueur) ────────────────────────────────
  // DÉRIVÉ de l'appartenance au club — `clubs/{clubId}/members/{uid}.role` —,
  // c'est-à-dire de l'autorité que le serveur contrôle seul et que les règles
  // Firestore interdisent à tout client d'écrire.
  //
  // AVANT, on lisait `users/{uid}.role === "coach"`. Deux défauts, tous deux
  // corrigés ici : ce champ est écrivable par l'utilisateur lui-même (les règles
  // l'autorisent à écrire tout son document `users/{uid}`), et le transfert de
  // propriété ne le touche jamais — un joueur devenu propriétaire restait donc
  // enfermé dans l'espace joueur. Voir domain/appSpace.ts pour le raisonnement
  // complet, et docs/coach-pilote-2026-07/ESPACE_ET_ROLES.md pour ce que ça
  // change côté produit.
  const appSpace = useAppSpace({ uid: user?.uid ?? null, clubId });

  // ── LE SÉLECTEUR JOUEUR / COACH, DIFFUSÉ DEPUIS LA RACINE ─────────────────
  // Le droit aux deux espaces est dérivé ICI, une seule fois. Les deux écrans
  // qui affichent le sélecteur (réglages joueur, écran Semaine du coach) vivent
  // loin en dessous : ils s'abonnent au relais plutôt que de redériver l'état,
  // ce qui aurait ouvert un second abonnement Firestore et une seconde lecture
  // de la préférence — donc deux états qui se croient tous les deux vrais.
  // Voir state/appSpaceGate.ts pour le raisonnement complet.
  //
  // Le SUIVI SPORTIF (`suiviJoueur`) emprunte le même relais, et c'est délibéré :
  // il vient du même instantané d'appartenance que `peutChoisirEspace`. Le
  // diffuser par un second portillon aurait rouvert un second abonnement — ou,
  // pire, deux lectures du même document à deux instants différents.
  const peutChoisirEspace = appSpace.peutChoisirEspace;
  const espaceAffiche = appSpace.space;
  const choisirEspace = appSpace.choisirEspace;
  const suiviJoueur = appSpace.suiviJoueur;
  useEffect(() => {
    publishAppSpaceSwitch({
      peutChoisir: peutChoisirEspace,
      espace: espaceAffiche,
      suiviJoueur,
      choisir: choisirEspace,
    });
  }, [peutChoisirEspace, espaceAffiche, suiviJoueur, choisirEspace]);

  // ── L'INTENTION COACH, CONSOMMÉE UNE SEULE FOIS ───────────────────────────
  // `initialRouteName` (portillon plus bas, `key="nav-gate"`) n'est lu qu'AU
  // MONTAGE de ce navigateur — jamais après. Sans remise à zéro ici, l'intention
  // survivrait à cette première lecture pour TOUTE LA SESSION, prête à ressortir
  // bien plus tard.
  //
  // Chemin réel qui l'exposait (recette 03/08) : un coach déclare son intention
  // sur l'accueil, s'inscrit, crée son club — l'appartenance fait basculer
  // `appSpace.space` sur "coach" (branche 6bis), ce portillon se démonte, plus
  // personne ne le regarde. Puis il tape « Je m'entraîne aussi »
  // (hooks/useAppSpace) : l'espace revient à "player" alors que son profil
  // joueur n'est toujours pas rempli. Ce portillon se REMONTE — pour la
  // première fois depuis la création du club — et relirait une intention
  // vieille de l'inscription, reposant un coach déjà membre d'un club sur la
  // création de club au lieu du questionnaire joueur qu'il vient précisément
  // de demander.
  //
  // La condition ci-dessous est exactement celle qui fait atteindre ce
  // portillon (`profileCompleted === false` et `appSpace.space !== "coach"`,
  // seul cas où la branche 6bis n'a pas déjà retourné `<CoachNavigator />`) :
  // dès qu'on l'atteint avec une intention encore vraie, elle vient de servir.
  //
  // POURQUOI UN `useEffect`, ET PAS LE PATTERN « ajuster l'état pendant le
  // rendu » (cf. ItemActionsSheet, commit 9b93400) : ce pattern-là recalcule
  // ET COMMIT dans le MÊME passage de rendu — React relance le composant
  // avant que quoi que ce soit ne soit monté. Ici, ce serait fatal : la remise
  // à zéro écraserait `intentionCoach` AVANT que `initialRouteName` (plus bas)
  // n'ait eu l'occasion de lire sa valeur encore vraie, et le portillon
  // n'atterrirait plus JAMAIS sur `CoachOnboarding` — pas même au premier
  // passage, le chemin nominal. Un effet, lui, s'exécute APRÈS le commit :
  // `initialRouteName` a donc déjà capturé la valeur vraie pour CE montage
  // avant que cette remise à zéro n'ait lieu.
  // La synchronisation post-commit est ici DÉLIBÉRÉE, pas un oubli du pattern
  // « pendant le rendu » — même exception assumée que
  // `hooks/useClubDirective.ts` (remise à zéro sur un événement externe).
  useEffect(() => {
    if (profileCompleted === false && appSpace.space !== "coach" && intentionCoach) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntentionCoach(false);
    }
  }, [profileCompleted, appSpace.space, intentionCoach]);

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
        // Déconnexion : le pointeur de club tombe AVEC le compte. C'est ce qui
        // démonte l'abonnement à l'appartenance (cf. useAppSpace), sans quoi
        // l'espace du compte précédent survivrait à sa propre session.
        setClubId(null);
        // L'intention coach aussi : elle appartenait à la traversée qui vient de
        // se terminer. La garder ferait atterrir le compte SUIVANT sur la
        // création de club sans que personne l'ait demandé.
        setIntentionCoach(false);
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
        const data = snap.data();
        setProfileCompleted(!!data?.profileCompleted);
        // OÙ regarder, jamais QUI on est. Le jour où plusieurs clubs deviendront
        // possibles, `resolveClubPointer` REFUSE explicitement plutôt que de
        // prendre le premier de la liste : un choix implicite ouvrirait l'espace
        // d'un club que personne n'a demandé, et personne ne saurait lequel.
        const pointeur = resolveClubPointer(data?.clubId);
        setClubId(pointeur.statut === "unique" ? pointeur.clubId : null);
        setInitializing(false);
      },
      (err) => {
        if (__DEV__) {
          console.warn("Erreur lors du check profil:", err);
        }
        setProfileCompleted(false);
        setClubId(null);
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
  if (initializing) return <Splash label="Chargement de ton profil…" />;

  // 5bis) Pas connecté → Auth stack (Welcome intégré dans le stack pour back navigation)
  if (!user) {
    return (
      <AuthNavigator
        initialRouteName={welcomeDone ? "Login" : "Welcome"}
        onWelcomeComplete={(options) => {
          setWelcomeDone(true);
          setIntentionCoach(!!options?.intentionCoach);
        }}
      />
    );
  }

  // 5ter) Appartenance au club pas encore lue → Splash.
  //    Même raison que le check `initializing` juste au-dessus : tant qu'on ne
  //    SAIT pas, on n'affiche pas. Parier sur l'espace joueur ferait clignoter
  //    l'app joueur devant un coach à chaque démarrage à froid.
  //    Ce temps d'attente ne concerne QUE les comptes rattachés à un club : sans
  //    `clubId`, il n'y a rien à lire et la décision est immédiate.
  //    Libellé explicite comme les deux Splash au-dessus (da-polish, CLAUDE.md
  //    « un chargement doit être explicite ») : ce Splash-ci est arrivé par la
  //    branche coach, `label` est optionnel, donc ni tsc ni jest ne signalaient
  //    l'oubli. Texte neutre : on ne SAIT pas encore si l'espace est joueur ou
  //    coach — c'est précisément ce qu'on attend.
  if (appSpace.decision === "en-attente") return <Splash label="Chargement de ton espace…" />;

  // 5quater) Autorité coach INVÉRIFIABLE alors qu'elle avait été confirmée →
  //    écran d'accès non vérifié.
  //    Les quatre états de l'autorité (domain/coachAuthority) : seul `autorise`
  //    ouvre l'espace coach ; `chargement`, `refuse` et `indetermine` le ferment
  //    ET purgent. Ici on traite le seul des trois qui mérite une explication :
  //    un coach dont on n'a pas pu vérifier les accès. Le renvoyer sans un mot
  //    dans l'application joueur lui ferait croire à une panne — ou, si son
  //    profil joueur n'est pas rempli, lui ouvrirait le questionnaire de profil
  //    parce qu'un document n'a pas pu être lu.
  //    Un joueur, lui, ne voit jamais cet écran : sans autorité coach confirmée,
  //    une lecture en échec le laisse dans son application, qui sait vivre hors
  //    ligne. La mémoire « déjà confirmée » n'ouvre rien — elle choisit entre
  //    deux états déjà fermés.
  if (appSpace.autorite === "indetermine" && appSpace.autoriteDejaConfirmee) {
    return <CoachAccessUnconfirmedScreen onRetry={appSpace.revalider} />;
  }

  // 6bis) Encadrant (propriétaire ou coach du club) → espace coach.
  //    Pas de questionnaire joueur, pas de tab bar joueur.
  if (appSpace.space === "coach") {
    return <CoachNavigator />;
  }

  // 6) Connecté mais profil non complété → écran profil (joueur)
  //    Le stack inclut CoachOnboarding pour qu'un staff puisse créer son club.
  if (profileCompleted === false) {
    // Nom de route volontairement distinct du "ProfileSetup" de AppNavigator :
    // ces deux arbres sont échangés conditionnellement, mais le
    // NavigationContainer n'y voit qu'un seul navigateur qui change de contenu et
    // restaurait son état sur la route homonyme — il réaffichait le setup au lieu
    // du Home après la complétion. Nom distinct + key par arbre = plus de
    // rapprochement possible.
    return (
      // ROUTE D'ARRIVÉE DÉCIDÉE PAR L'INTENTION, PAS PAR UN RÔLE EN BASE.
      // Un coach qui a dit « Je suis coach » sur l'accueil atterrit sur la
      // création de club ; tout le monde d'autre sur le questionnaire joueur.
      // `initialRouteName` n'est lu qu'au montage de ce navigateur — c'est-à-dire
      // au moment précis où l'inscription vient de se terminer, l'intention étant
      // posée bien avant (écran d'accueil).
      <AppStack.Navigator
        key="nav-gate"
        initialRouteName={intentionCoach ? "CoachOnboarding" : "ProfileSetupGate"}
        screenOptions={{ headerShown: false }}
      >
          <AppStack.Screen name="ProfileSetupGate" options={{ headerShown: false }}>
            {() => (
              <ProfileSetupScreen onProfileCompleted={() => setProfileCompleted(true)} />
            )}
          </AppStack.Screen>
          <AppStack.Screen
            name="CoachOnboarding"
            options={{ headerShown: false, animation: "slide_from_right" }}
          >
            {(props) => (
              // PAS DE CUL-DE-SAC. Quand cet écran est le point d'ARRIVÉE, il n'y
              // a rien derrière : `goBack()` ne ferait rien et « Retour » serait
              // un bouton menteur. On fournit donc la sortie explicite — « Je suis
              // joueur finalement » — qui oublie l'intention et repose le
              // questionnaire joueur comme unique écran de la pile (`reset`, pour
              // ne pas laisser la création de club derrière le setup).
              // L'écran choisit lui-même lequel des deux afficher, selon qu'il
              // peut revenir en arrière ou non (cf. CoachOnboardingScreen).
              <CoachOnboardingScreen
                onRetourJoueur={() => {
                  setIntentionCoach(false);
                  props.navigation.reset({ index: 0, routes: [{ name: "ProfileSetupGate" }] });
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
      </AppStack.Navigator>
    );
  }

  // 6) Profil complet → app joueur (mode déjà choisi dans le questionnaire profil)
  return <AppNavigator />;
}
