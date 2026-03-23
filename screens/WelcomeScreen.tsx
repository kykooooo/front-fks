// screens/WelcomeScreen.tsx
// Écran d'accueil — carrousel d'images foot en crossfade + CTA

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  AccessibilityInfo,
  type ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { WELCOME_CAROUSEL, BANNER_FALLBACK } from "../constants/bannerImages";

const palette = theme.colors;
const CROSSFADE_MS = 1200;
const INTERVAL_MS = 4000;

type Props = {
  onComplete: (entry?: "login" | "register") => void;
};

export default function WelcomeScreen({ onComplete }: Props) {
  const haptics = useHaptics();
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnims = useRef(WELCOME_CAROUSEL.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  // Animations d'entrée du contenu
  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const subAnim = useRef(new Animated.Value(0)).current;
  const subSlide = useRef(new Animated.Value(20)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // Intro animations
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        [logoAnim, titleAnim, subAnim, ctaAnim].forEach((a) => a.setValue(1));
        [titleSlide, subSlide].forEach((a) => a.setValue(0));
        return;
      }
      Animated.timing(logoAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(titleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 200);
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(subAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(subSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 300);
      setTimeout(() => {
        Animated.timing(ctaAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 500);
    });
  }, []);

  // Crossfade automatique entre les images
  useEffect(() => {
    let cancelled = false;
    let reduceMotion = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      reduceMotion = reduce;
    });

    const timer = setInterval(() => {
      if (cancelled || reduceMotion) return;

      setActiveIndex((prev) => {
        const next = (prev + 1) % WELCOME_CAROUSEL.length;
        // Fade in la nouvelle image, fade out l'ancienne
        Animated.parallel([
          Animated.timing(fadeAnims[next], {
            toValue: 1,
            duration: CROSSFADE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnims[prev], {
            toValue: 0,
            duration: CROSSFADE_MS,
            useNativeDriver: true,
          }),
        ]).start();
        return next;
      });
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fadeAnims]);

  const handleStart = useCallback(async () => {
    haptics.impactMedium();
    await AsyncStorage.setItem("fks_welcome_done", "true");
    onComplete("register");
  }, [haptics, onComplete]);

  const handleLogin = useCallback(async () => {
    haptics.impactLight();
    await AsyncStorage.setItem("fks_welcome_done", "true");
    onComplete("login");
  }, [haptics, onComplete]);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Carrousel d'images en crossfade */}
      <View style={styles.carouselWrap}>
        {WELCOME_CAROUSEL.map((source, i) => (
          <Animated.View
            key={i}
            style={[StyleSheet.absoluteFill, { opacity: fadeAnims[i] }]}
            pointerEvents="none"
          >
            <Image
              source={source}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Animated.View>
        ))}

        {/* Assombrissement pour lisibilité */}
        <View style={styles.tint} />

        {/* Gradient bas → fond app */}
        <LinearGradient
          colors={["transparent", `${palette.bg}CC`, palette.bg]}
          locations={[0.3, 0.7, 1]}
          style={styles.gradient}
        />

        {/* Contenu par-dessus */}
        <View style={styles.overlayContent}>
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

          {/* Dots indicateurs */}
          <View style={styles.dots}>
            {WELCOME_CAROUSEL.map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: fadeAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [{
                      scale: fadeAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    }],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

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

  // ─── Carrousel ───
  carouselWrap: {
    height: 420,
    position: "relative",
    overflow: "hidden",
    backgroundColor: BANNER_FALLBACK.welcome,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  overlayContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },

  // ─── Contenu texte ───
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

  // ─── CTA ───
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
