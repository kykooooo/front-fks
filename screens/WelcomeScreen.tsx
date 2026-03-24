// screens/WelcomeScreen.tsx
// Onboarding swipeable — 3 slides plein écran avec images foot + CTA

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  type ViewToken,
  type ListRenderItemInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const palette = theme.colors;

/* ─── Slides data ─── */
const SLIDES = [
  {
    id: "1",
    image: require("../assets/images/slide1-ball.jpg"),
    title: "Ta prépa physique,\nton avantage",
    subtitle: "Des séances créées par l'IA, adaptées à ton niveau et ton calendrier.",
  },
  {
    id: "2",
    image: require("../assets/images/slide2-sprint.jpg"),
    title: "Progresse à\nchaque séance",
    subtitle: "Force, vitesse, endurance — chaque programme te rapproche de ton meilleur niveau.",
  },
  {
    id: "3",
    image: require("../assets/images/slide3-tunnel.jpg"),
    title: "Prêt le jour\ndu match",
    subtitle: "L'app gère ta charge pour que tu arrives frais et performant.",
  },
] as const;

/* ─── Types ─── */
type SlideData = (typeof SLIDES)[number];
type Props = {
  onComplete: (entry?: "login" | "register") => void;
};

/* ─── Slide component ─── */
function Slide({ item }: { item: SlideData }) {
  return (
    <View style={styles.slide}>
      <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.tint} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.92)"]}
        locations={[0.3, 0.6, 1]}
        style={styles.gradient}
      />
      <View style={styles.slideContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

/* ─── Main ─── */
export default function WelcomeScreen({ onComplete }: Props) {
  const haptics = useHaptics();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

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

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SlideData>) => <Slide item={item} />,
    []
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES as unknown as SlideData[]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom overlay — dots + CTA */}
      <View style={styles.bottomOverlay}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA buttons */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaPrimaryText}>Commencer</Text>
          </Pressable>
        </View>
        <Pressable onPress={handleLogin} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>J'ai déjà un compte</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slide: {
    width: SCREEN_W,
    height: SCREEN_H,
    position: "relative",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  slideContent: {
    position: "absolute",
    bottom: 220,
    left: 24,
    right: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 42,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    marginTop: 12,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ─── Bottom overlay ───
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 24,
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  ctaRow: {
    width: "100%",
    marginBottom: 16,
  },
  ctaPrimary: {
    width: "100%",
    backgroundColor: palette.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: 17,
    alignItems: "center",
    ...theme.shadow.accent,
  },
  ctaPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  loginLink: {
    paddingVertical: 10,
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
});
