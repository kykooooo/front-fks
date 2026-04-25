// navigation/MainTabs.tsx
// Bottom tabs : mode joueur (5 onglets) ou coach (3 onglets)

import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { useAppModeStore } from "../state/appModeStore";
import { Tab, PLAYER_TAB_ORDER, COACH_TAB_ORDER } from "./types";

import HomeScreen from "../screens/HomeScreen";
import SessionHubScreen from "../screens/SessionHubScreen";
import ChatScreen from "../screens/ChatScreen";
import VideoLibraryScreen from "../screens/VideoLibraryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CoachDashboardScreen from "../screens/CoachDashboardScreen";

export function MainTabs() {
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
          <Tab.Screen name="NewSession" options={{ title: "Seance" }}>
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
          <Tab.Screen name="VideoLibrary" options={{ title: "Videos" }}>
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
