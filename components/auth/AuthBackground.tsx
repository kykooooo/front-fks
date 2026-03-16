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

// Images de football via Pexels (gratuites, haute qualité)
// Compressées côté serveur via ?auto=compress&w=1080
export const AUTH_IMAGES = {
  // Terrain de foot au crépuscule — vue large, ambiance
  welcome: {
    uri: "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  // Joueur à l'entraînement — action
  register: {
    uri: "https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  // Crampons / préparation — ambiance vestiaire
  setup: {
    uri: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=1080",
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
