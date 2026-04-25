// components/auth/AuthBackground.tsx
// Fond partage pour les ecrans d'authentification.
// Peut afficher soit une image hero, soit un decor abstrait plus discret.

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
import { theme, RADIUS } from "../../constants/theme";
import { PitchDecoration } from "../ui/PitchDecoration";
import { FootballIllustration } from "../ui/FootballIllustration";

export const AUTH_IMAGES = {
  welcome: {
    uri: "https://images.pexels.com/photos/3764014/pexels-photo-3764014.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  login: {
    uri: "https://images.pexels.com/photos/6455927/pexels-photo-6455927.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  register: {
    uri: "https://images.pexels.com/photos/4164761/pexels-photo-4164761.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
  setup: {
    uri: "https://images.pexels.com/photos/3766211/pexels-photo-3766211.jpeg?auto=compress&cs=tinysrgb&w=1080",
  },
} as const;

type AuthBackgroundProps = {
  image?: ImageSourcePropType;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthBackground({ image, children, style }: AuthBackgroundProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasImage = Boolean(image);

  return (
    <View style={[styles.root, style]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[theme.colors.ink950, theme.colors.ink930, theme.colors.ink920]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[theme.colors.accentSoft24, theme.colors.accentSoft04, "transparent"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.topGlow}
        />
        <LinearGradient
          colors={["transparent", theme.colors.skySoft10, theme.colors.skySoft02]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bottomGlow}
        />

        <View style={[styles.orb, styles.orbAccent]} />
        <View style={[styles.orb, styles.orbSoft]} />

        <PitchDecoration
          type="centerCircle"
          width={220}
          height={220}
          color={theme.colors.white}
          opacity={0.06}
          style={styles.centerCircle}
        />
        <PitchDecoration
          type="cornerArc"
          width={110}
          height={110}
          color={theme.colors.white}
          opacity={0.07}
          style={styles.cornerArc}
        />
        <PitchDecoration
          type="halfwayLine"
          width={180}
          height={60}
          color={theme.colors.white}
          opacity={0.05}
          style={styles.halfwayLine}
        />
        <FootballIllustration
          type="sprint"
          width={220}
          height={220}
          color={theme.colors.accent}
          opacity={0.04}
          style={styles.playerMark}
        />
      </View>

      {hasImage ? (
        <ImageBackground
          source={image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
        >
          {!imageLoaded ? (
            <LinearGradient
              colors={[theme.colors.background, theme.colors.ink910, theme.colors.ink900]}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.overlay} />
        </ImageBackground>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black65,
  },
  topGlow: {
    position: "absolute",
    top: -80,
    left: -40,
    right: -40,
    height: 280,
  },
  bottomGlow: {
    position: "absolute",
    right: -60,
    bottom: -20,
    width: 280,
    height: 260,
  },
  orb: {
    position: "absolute",
    borderRadius: RADIUS.pill,
  },
  orbAccent: {
    width: 220,
    height: 220,
    top: 96,
    right: -80,
    backgroundColor: theme.colors.accentSoft08,
  },
  orbSoft: {
    width: 180,
    height: 180,
    bottom: 110,
    left: -70,
    backgroundColor: theme.colors.white04,
  },
  centerCircle: {
    position: "absolute",
    top: 132,
    right: -70,
  },
  cornerArc: {
    position: "absolute",
    bottom: 168,
    left: -24,
  },
  halfwayLine: {
    position: "absolute",
    top: 96,
    left: 18,
  },
  playerMark: {
    position: "absolute",
    bottom: 48,
    right: -22,
  },
});
