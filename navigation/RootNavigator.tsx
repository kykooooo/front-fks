// src/navigation/RootNavigator.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { HOME_FEATURES } from "../config/homeFeatures";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "../state/stores/useSyncStore";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { setAnalyticsUserId } from "../services/analytics";
import { setSentryUser } from "../services/monitoring";
import { onWelcomeReset } from "../services/accountDeletion";
import { effacerIntentionCoach, lireIntentionCoach } from "../services/coachIntent";
import { showToast } from "../utils/toast";
import { isPlayerProfileComplete } from "../domain/playerProfile";
import { useAppSpace } from "../hooks/useAppSpace";
import { resolveClubPointer } from "../domain/coachAuthority";
import { publishAppSpaceSwitch } from "../state/appSpaceGate";
import { useRattachementClubEnCours } from "../state/rattachementClubGate";

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
      {/* Accessible depuis l'édition de profil ("Tu fais partie du staff ?") */}
      <AppStack.Screen
        name="CoachOnboarding"
        component={CoachOnboardingScreen}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
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
  // POURQUOI PAS DANS `users/{uid}.role` : ce champ est écrivable par le
  // client, il ne décide plus de rien depuis le lot « un compte, un espace », et
  // l'y remettre rouvrirait exactement la faille refermée là-bas. Une intention
  // n'est pas une autorité.
  //
  // POURQUOI SUR LE DISQUE (AsyncStorage, services/coachIntent) ET PLUS EN
  // MÉMOIRE SEULE — audit inscription 2026-09, P1-02 + erratum 1 : en `useState`
  // elle mourait avec l'app entre l'inscription et la création du club, et
  // l'écran d'accueil qui la posait est INATTEIGNABLE au lancement suivant
  // (`fks_welcome_done` est déjà vrai et aucun `navigate("Welcome")` n'existe).
  // Le coach retombait sur les 4 étapes du questionnaire joueur, sans porte.
  // `intentionCoachLue` dit si la lecture du disque a répondu : le portillon
  // attend cette réponse avant de choisir son écran d'arrivée, sinon la course
  // entre AsyncStorage et le premier instantané Firestore déciderait à sa place.
  const [intentionCoach, setIntentionCoach] = useState(false);
  const [intentionCoachLue, setIntentionCoachLue] = useState(false);
  // Vrai dès qu'un compte a été connecté dans CETTE session de l'app : sert à
  // distinguer un VRAI logout (l'intention doit tomber avec la traversée qui se
  // termine) du `null` de démarrage, où Firebase n'a encore rien restauré et où
  // une intention posée au lancement précédent doit survivre.
  const compteDejaConnecteRef = useRef(false);
  /** L'identité du compte connecté, ou `null`. Ce qui change vraiment. */
  const uidCourant = user?.uid ?? null;
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

  // ── LE RATTACHEMENT AU CLUB N'EST PAS FINI ────────────────────────────────
  // Le questionnaire enregistre le profil AVANT de tenter le code club (c'est
  // ce qui empêche un code refusé de faire perdre les quatre étapes, cf.
  // screens/profileSetup/attachClub). Conséquence : l'instantané `users/{uid}`
  // arrive — événement LOCAL, immédiat, avant même l'aller-retour serveur —,
  // `profileCompleted` et `profilJoueurComplet` passent à vrai, la condition
  // ci-dessous tombe, `<AppNavigator/>` remplace ce stack et la carte « code
  // club refusé » est DÉMONTÉE. Sans ce drapeau, elle l'était très
  // probablement avant même d'être affichée, et le joueur atterrissait sur
  // l'accueil en croyant avoir rejoint son club (R1 de la contre-vérification
  // du 05/09).
  //
  // Le drapeau est posé par l'écran AVANT l'écriture du profil et baissé quand
  // la personne a répondu (réessai réussi, « Plus tard », ou aucun code saisi).
  // Il ne fait que RETARDER la bascule : la source durable de la complétude
  // reste l'instantané Firestore. Par compte, pour qu'il ne se transmette
  // jamais au suivant sur un téléphone partagé.
  const rattachementClubEnCours = useRattachementClubEnCours(uidCourant);

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

  /** Oublie l'intention coach, en mémoire ET sur le disque. */
  const oublierIntentionCoach = useCallback(() => {
    setIntentionCoach(false);
    void effacerIntentionCoach();
  }, []);

  // ── L'INTENTION COACH, RELUE À CHAQUE CHANGEMENT DE COMPTE ────────────────
  // Un seul effet possède la lecture ET l'effacement de déconnexion : les
  // séparer laissait une course (l'effacement en vol pendant que la relecture
  // répondait « encore posée ») qui aurait fait hériter l'intention d'un compte
  // au suivant sur un téléphone partagé.
  //
  // L'IDENTITÉ DU COMPTE en dépendance, pas l'objet `user` : la relecture couvre le moment exact où elle
  // compte — la connexion/inscription vient d'aboutir, le portillon n'est pas
  // encore monté. C'est ce qui rattrape une intention posée sur l'écran de
  // connexion ou d'inscription (components/auth/CoachEntryLink), et pas
  // seulement celle posée sur l'accueil. Dépendre de l'OBJET aurait relancé la
  // lecture — et rouvert le Splash du portillon — à chaque nouvel instantané
  // d'authentification portant pourtant le même compte.
  useEffect(() => {
    let vivant = true;
    // La remise à « pas encore lue » est SYNCHRONE et délibérée : entre le
    // changement de compte et la réponse du disque, le portillon doit attendre
    // plutôt que router sur une intention qui appartenait au compte précédent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntentionCoachLue(false);
    void (async () => {
      // Déconnexion CONFIRMÉE (un compte était connecté dans cette session, il
      // ne l'est plus) : l'intention appartenait à la traversée qui vient de se
      // terminer. Un `null` de DÉMARRAGE, lui, n'efface rien — sinon une
      // intention posée hier serait perdue au premier réveil de Firebase.
      if (!uidCourant && compteDejaConnecteRef.current) {
        compteDejaConnecteRef.current = false;
        await effacerIntentionCoach();
      }
      if (uidCourant) compteDejaConnecteRef.current = true;
      const posee = await lireIntentionCoach();
      if (!vivant) return;
      setIntentionCoach(posee);
      setIntentionCoachLue(true);
    })();
    return () => {
      vivant = false;
    };
  }, [uidCourant]);

  // ── QUAND L'INTENTION N'A PLUS DE SENS, ON L'OUBLIE (ET ON LE DIT) ────────
  // Deux fins de vie, toutes deux vérifiables sur l'état du compte :
  //
  //  . le compte A DÉJÀ UN CLUB → l'intention a servi. C'est ce qui protège le
  //    chemin décrit par la recette du 03/08 : un coach qui tape « Je m'entraîne
  //    aussi » revient dans l'espace joueur avec un profil joueur vide ; le
  //    portillon se remonte et ne doit PAS le renvoyer créer un second club ;
  //
  //  . le compte est un COMPTE JOUEUR DÉJÀ CONFIGURÉ (profil complet, aucun
  //    club, aucun espace coach) → on ne casse rien et on ne promet rien : il
  //    n'y a pas de chemin client vers un rôle d'encadrant sur un compte
  //    existant, et en fabriquer un ici demanderait une Cloud Function et une
  //    revue sécurité (hors lot). On le dit honnêtement, une fois.
  useEffect(() => {
    if (!intentionCoach || !user) return;
    // Remises à zéro synchrones assumées : elles ne dépendent que de faits
    // déjà connus (le compte a un club / le profil joueur est complet), et
    // retarder l’oubli d’un tour ferait router sur une intention périmée.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (clubId) {
      oublierIntentionCoach();
      return;
    }
    if (profileCompleted === true && appSpace.space !== "coach") {
      oublierIntentionCoach();
      showToast({
        type: "info",
        title: "Compte joueur",
        message: "Ton compte est un compte joueur. Pour créer un club, utilise un autre compte.",
      });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [intentionCoach, user, clubId, profileCompleted, appSpace.space, oublierIntentionCoach]);

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
        // L'intention coach, elle, est traitée par l'effet qui la possède (plus
        // haut) : lui seul sait distinguer une VRAIE déconnexion — où elle doit
        // tomber avec la traversée qui se termine — du `null` de démarrage, où
        // une intention posée au lancement précédent doit au contraire survivre.
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
        setProfilJoueurComplet(false);
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
        onWelcomeComplete={(options) => {
          setWelcomeDone(true);
          // Les trois boutons de l'accueil sont exclusifs : celui qui vient
          // d'être choisi FAIT FOI, mémoire et disque. « Je suis coach » a déjà
          // écrit l'intention (WelcomeScreen) ; les deux autres l'effacent, pour
          // qu'un aller-retour ne laisse pas une intention orpheline derrière.
          if (options?.intentionCoach) {
            setIntentionCoach(true);
          } else {
            oublierIntentionCoach();
          }
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
  //
  //    DEUX FAÇONS D'ÊTRE « PAS PRÊT », ET LA SECONDE EST NEUVE (audit 2026-09,
  //    P1-04). Le drapeau `profileCompleted` ne suffit plus : la création de
  //    club le pose à vrai sans écrire un seul champ joueur, si bien qu'un coach
  //    qui active « Je m'entraîne aussi » entrait dans l'app joueur avec ni
  //    catégorie, ni poste, ni niveau — et le moteur dosait alors SANS AUCUN
  //    plafond d'âge. On regarde donc aussi les champs eux-mêmes.
  //
  //    Ce chemin ne touche RIEN de l'espace coach : la branche 6bis a déjà
  //    renvoyé `<CoachNavigator />` pour un encadrant, et le questionnaire
  //    n'écrit ni `role`, ni `accessRole` (qui vit sur l'appartenance, interdite
  //    au client), ni `clubId` quand il n'en connaît pas (cf. ProfileSetupScreen
  //    — la clé est OMISE, un `merge` ne peut donc pas l'effacer).
  //    TROISIÈME FAÇON DE N'ÊTRE « PAS PRÊT », ET ELLE NE SE LIT PAS EN BASE :
  //    le questionnaire est rempli, il est même DÉJÀ écrit, mais la question
  //    posée à l'écran — « ton code club n'a pas été reconnu, tu réessaies ou
  //    tu passes ? » — n'a pas de réponse. Laisser le portillon tomber ici, ce
  //    serait démonter la question pendant qu'elle est à l'écran.
  if (profileCompleted === false || profilJoueurComplet === false || rattachementClubEnCours) {
    // L'intention coach vit sur le disque : tant que sa lecture n'a pas répondu,
    // on ne choisit PAS d'écran d'arrivée. `initialRouteName` n'est lu qu'au
    // montage de ce navigateur — décider trop tôt, c'est décider faux pour toute
    // la traversée, et c'est exactement ce qui renvoyait un coach au
    // questionnaire joueur (audit inscription 2026-09, P1-02).
    if (!intentionCoachLue) return <Splash label="Chargement…" />;

    // Nom de route volontairement distinct du "ProfileSetup" de AppNavigator :
    // ces deux arbres sont échangés conditionnellement, mais le
    // NavigationContainer n'y voit qu'un seul navigateur qui change de contenu et
    // restaurait son état sur la route homonyme — il réaffichait le setup au lieu
    // du Home après la complétion. Nom distinct + key par arbre = plus de
    // rapprochement possible.
    return (
      // ROUTE D'ARRIVÉE DÉCIDÉE PAR L'INTENTION, PAS PAR UN RÔLE EN BASE.
      // Un coach qui a dit « Vous êtes coach ? » (accueil, connexion ou
      // inscription) atterrit sur la création de club ; tout le monde d'autre sur
      // le questionnaire joueur. `initialRouteName` n'est lu qu'au montage de ce
      // navigateur — l'intention, elle, a été relue sur le disque juste avant.
      //
      // `!clubId` : un compte qui a DÉJÀ un club n'a plus rien à créer. C'est la
      // ceinture du chemin « Je m'entraîne aussi » (l'effet plus haut oublie
      // l'intention dès qu'un club apparaît ; ceci est la bretelle, pour la
      // fraction de seconde où l'effet n'a pas encore couru).
      <AppStack.Navigator
        key="nav-gate"
        initialRouteName={intentionCoach && !clubId ? "CoachOnboarding" : "ProfileSetupGate"}
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
                  // Oubliée sur le disque AUSSI : sinon le prochain démarrage
                  // reposerait la personne sur la création de club qu'elle vient
                  // précisément de refuser.
                  oublierIntentionCoach();
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
          {/* Le setup profil peut envoyer ici (D6) : la route doit exister AUSSI
              dans cette pile, sinon la question de fin de setup mènerait nulle part. */}
          <AppStack.Screen name="MonCorps" component={MonCorpsScreen} options={{ headerShown: true, title: "Mon corps" }} />
      </AppStack.Navigator>
    );
  }

  // 6) Profil complet → app joueur (mode déjà choisi dans le questionnaire profil)
  return <AppNavigator />;
}
