// navigation/AppNavigator.tsx
// Stack principal de l'app : tabs + 18 ecrans modaux/full-screen

import React from "react";
import { theme } from "../constants/theme";
import { AppStack } from "./types";
import { MainTabs } from "./MainTabs";

import FeedbackScreen from "../screens/FeedbackScreen";
import ExternalLoadScreen from "../screens/ExternalLoadScreen";
import SessionPreviewScreen from "../screens/SessionPreviewScreen";
import SessionSummaryScreen from "../screens/SessionSummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LegalNoticeScreen from "../screens/LegalNoticeScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import RoutineScreen from "../screens/RoutineScreen";
import ProgressScreen from "../screens/ProgressScreen";
import NewSessionScreen from "../screens/NewSessionScreen";
import SessionHistoryScreen from "../screens/SessionHistoryScreen";
import PrebuiltSessionsScreen from "../screens/PrebuiltSessionsScreen";
import PrebuiltSessionDetailScreen from "../screens/PrebuiltSessionDetailScreen";
import ProfileSetupScreen from "../screens/ProfileSetupScreen";
import TestsScreen from "../screens/TestsScreen";
import VideoLibraryScreen from "../screens/VideoLibraryScreen";
import CoachPlayerDetailScreen from "../screens/CoachPlayerDetailScreen";
import CycleModalScreen from "../screens/CycleModalScreen";

export function AppNavigator() {
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
      <AppStack.Screen name="SessionSummary" component={SessionSummaryScreen} options={{ headerShown: true, title: "Resume" }} />
      <AppStack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Parametres" }} />
      <AppStack.Screen name="LegalNotice" component={LegalNoticeScreen} options={{ headerShown: true, title: "Mentions legales" }} />
      <AppStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: true, title: "Confidentialite" }} />
      <AppStack.Screen name="Routine" component={RoutineScreen} options={{ headerShown: true, title: "Routine" }} />
      <AppStack.Screen name="Progression" component={ProgressScreen} options={{ headerShown: true, title: "Progression" }} />
      <AppStack.Screen name="GenerateSession" component={NewSessionScreen} options={{ headerShown: true, title: "Creer une seance" }} />
      <AppStack.Screen name="SessionHistory" component={SessionHistoryScreen} options={{ headerShown: true, title: "Historique" }} />
      <AppStack.Screen name="PrebuiltSessions" component={PrebuiltSessionsScreen} options={{ headerShown: true, title: "Seances pre-construites" }} />
      <AppStack.Screen name="PrebuiltSessionDetail" component={PrebuiltSessionDetailScreen} options={{ headerShown: true, title: "Details seance" }} />
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
