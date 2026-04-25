// navigation/AuthNavigator.tsx
// Stack d'authentification (Welcome, Login, Register) + ecran Splash

import React from "react";
import { ActivityIndicator, View } from "react-native";
import { theme } from "../constants/theme";
import { AuthStack } from "./types";
import type { AuthStackParamList } from "./types";

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

export function AuthNavigator({
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
    </AuthStack.Navigator>
  );
}

export function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}
