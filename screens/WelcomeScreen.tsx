// screens/WelcomeScreen.tsx
// Écran d'accueil — minimaliste, fond uni sombre, typo forte

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { ImageBanner } from "../components/ui/ImageBanner";
import { BANNER_IMAGES, BANNER_FALLBACK } from "../constants/bannerImages";

const palette = theme.colors;

type Props = {
  onComplete: (entry?: "login" | "register") => void;
};

export default function WelcomeScreen({ onComplete }: Props) {
  const haptics = useHaptics();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const subAnim = useRef(new Animated.Value(0)).current;
  const subSlide = useRef(new Animated.Value(20)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        [logoAnim, titleAnim, subAnim, ctaAnim].forEach((a) => a.setValue(1));
        [titleSlide, subSlide].forEach((a) => a.setValue(0));
        return;
      }
      // Logo first
      Animated.timing(logoAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      // Title after 200ms
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 200);
      // Subtitle after 300ms
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(subAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(subSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 300);
      // CTA after 500ms
      setTimeout(() => {
        Animated.timing(ctaAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 500);
    });
  }, []);

  const handleStart = async () => {
    haptics.impactMedium();
    await AsyncStorage.setItem("fks_welcome_done", "true");
    onComplete("register");
  };

  const handleLogin = async () => {
    haptics.impactLight();
    await AsyncStorage.setItem("fks_welcome_done", "true");
    onComplete("login");
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Image bandeau haut — terrain de foot */}
      <ImageBanner
        source={BANNER_IMAGES.welcome}
        height={380}
        fallbackColor={BANNER_FALLBACK.welcome}
      >
        <Animated.View style={[styles.logoWrap, { opacity: logoAnim }]}>
          <Text style={styles.logo}>FKS</Text>
          <View style={styles.accentBar} />
        </Animated.View>
        <Animated.Text
          style={[styles.title, { opacity: titleAnim, transform: [{ translateY: titleSlide }] }]}
        >
          Ton terrain. Ta prépa.
        </Animated.Text>
        <Animated.Text
          style={[styles.subtitle, { opacity: subAnim, transform: [{ translateY: subSlide }] }]}
        >
          Séances créées par l'IA, adaptées à toi.
        </Animated.Text>
      </ImageBanner>

      {/* Bottom — CTA */}
      <View style={styles.bottomArea}>
        <Animated.View style={[styles.bottom, { opacity: ctaAnim }]}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Commencer</Text>
          </Pressable>
          <Pressable onPress={handleLogin} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>J'ai déjà un compte</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  logoWrap: { alignItems: "center", gap: 12, marginBottom: 16 },
  logo: {
    fontSize: 56,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 6,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  accentBar: { width: 40, height: 3, borderRadius: 2, backgroundColor: palette.accent },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  bottom: { alignItems: "center", gap: 20 },
  cta: {
    width: "100%",
    backgroundColor: palette.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    ...theme.shadow.accent,
  },
  ctaPressed: { transform: [{ scale: 0.96 }] },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  loginLink: { paddingVertical: 8 },
  loginLinkText: { fontSize: 14, fontWeight: "600", color: palette.accent },
});
