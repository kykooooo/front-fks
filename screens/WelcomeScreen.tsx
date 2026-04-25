// screens/WelcomeScreen.tsx
// Onboarding swipeable — 3 slides plein écran avec images foot + CTA

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Pressable,
  StatusBar,
  type ViewToken,
  type ListRenderItemInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../constants/theme";

const palette = theme.colors;

/* ─── Slides data ─── */
const SLIDES = [
  {
    id: "1",
    image: require("../assets/images/slide1-ball.jpg"),
    title: "Ta prépa physique,\nton avantage",
    subtitle: "Des séances adaptées à ton niveau, ton calendrier et tes objectifs.",
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
function Slide({ item, width, height }: { item: SlideData; width: number; height: number }) {
  return (
    <View style={[styles.slide, { width, height }]}>
      <Image
        source={item.image}
        style={{ width, height, position: "absolute", top: 0, left: 0 }}
        resizeMode="cover"
      />
      <View style={styles.tint} />
      <LinearGradient
        colors={["transparent", theme.colors.black70, theme.colors.black92]}
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
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
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
    ({ item }: ListRenderItemInfo<SlideData>) => <Slide item={item} width={SCREEN_W} height={SCREEN_H} />,
    [SCREEN_W, SCREEN_H]
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
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* Bottom overlay — dots + CTA */}
      <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
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
    backgroundColor: theme.colors.black,
  },
  slide: {
    position: "relative" as const,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black15,
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
    fontSize: TYPE.display.sm.fontSize,
    fontWeight: "900",
    color: theme.colors.white,
    lineHeight: 42,
    textShadowColor: theme.colors.black60,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: TYPE.body.fontSize,
    color: theme.colors.white85,
    marginTop: 12,
    lineHeight: 22,
    textShadowColor: theme.colors.black50,
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
    borderRadius: RADIUS.xs,
  },
  dotActive: {
    backgroundColor: theme.colors.white,
    width: 24,
  },
  dotInactive: {
    backgroundColor: theme.colors.white35,
  },
  ctaRow: {
    width: "100%",
    marginBottom: 16,
  },
  ctaPrimary: {
    width: "100%",
    backgroundColor: palette.accent,
    borderRadius: RADIUS.pill,
    paddingVertical: 17,
    alignItems: "center",
    ...theme.shadow.accent,
  },
  ctaPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  ctaPrimaryText: {
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  loginLink: {
    paddingVertical: 10,
  },
  loginLinkText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "600",
    color: theme.colors.white70,
  },
});
