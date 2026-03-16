// components/auth/AuthBackground.tsx
// Fond football partagé pour les écrans d'authentification
// Utilise ImageBackground + overlay sombre pour la lisibilité

import React, { useState } from "react";
import {
  ImageBackground,
  View,
  StyleSheet,
  StatusBar,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../constants/theme";

// Images prépa physique via Pexels (gratuites, haute qualité)
// Une image DIFFÉRENTE par écran — toutes orientées prépa physique / training
export const AUTH_IMAGES = {
  // Welcome : sprinter sur piste — ambiance explosive, premier contact avec l'app
  welcome: {
    uri: "https://images.pexels.com/photos/3764014/pexels-photo-3764014.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  // Login : athlète qui s'étire / récupère — "content de te revoir"
  login: {
    uri: "https://images.pexels.com/photos/6455927/pexels-photo-6455927.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  // Register : musculation / haltères — action, puissance, nouveau départ
  register: {
    uri: "https://images.pexels.com/photos/4164761/pexels-photo-4164761.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  // Setup profil : course / agilité — préparation, progression
  setup: {
    uri: "https://images.pexels.com/photos/3766211/pexels-photo-3766211.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
} as const;

type AuthBackgroundProps = {
  image: ImageSourcePropType;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthBackground({ image, children, style }: AuthBackgroundProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <View style={[styles.root, style]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
      <ImageBackground
        source={image}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setImageLoaded(true)}
      >
        {/* Fallback gradient si l'image n'a pas encore chargé */}
        {!imageLoaded && (
          <LinearGradient
            colors={[theme.colors.bg, "#0d0d10", "#131316"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Overlay sombre pour la lisibilité du texte */}
        <View style={styles.overlay} />
      </ImageBackground>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
});
