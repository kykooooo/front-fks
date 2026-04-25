// navigation/types.ts
// Types de navigation centralisés + instances de navigateurs + constantes

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams } from "@react-navigation/native";
import type { FKS_NextSessionV2 } from "../screens/newSession/types";

// --- Param lists ---

export type TabParamList = {
  Home: undefined;
  NewSession: undefined;
  VideoLibrary: { highlightId?: string; startInFavorites?: boolean } | undefined;
  Chat: undefined;
  // `openInjuryForm` : ouvre automatiquement le modal InjuryForm de la section
  // "Zones sensibles" au mount de ProfileScreen. Utilisé par PainSpikeModal
  // (bouton "Modifier ma zone sensible") pour rediriger directement vers le
  // formulaire de modification.
  Profile: { openInjuryForm?: boolean } | undefined;
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
      sessionTheme?: string | null;
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
      cycleLabel?: string | null;
      cycleProgressLabel?: string | null;
      cyclePhaseLabel?: string | null;
      adaptationLabels?: string[];
      playerRationaleTitle?: string | null;
      playerRationale?: string | null;
      coachNote?: string | null;
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

// --- Navigator instances ---

export const AppStack = createNativeStackNavigator<AppStackParamList>();
export const AuthStack = createNativeStackNavigator<AuthStackParamList>();
export const ProfileGateStack = createNativeStackNavigator<Pick<AppStackParamList, "ProfileSetup" | "CycleModal">>();
export const Tab = createBottomTabNavigator<TabParamList>();

// --- Constantes ---

export const WELCOME_KEY = "fks_welcome_done";
export const PLAYER_TAB_ORDER: Array<keyof TabParamList> = ["Home", "NewSession", "Chat", "VideoLibrary", "Profile"];
export const COACH_TAB_ORDER: Array<keyof TabParamList> = ["Coach", "Chat", "Profile"];
