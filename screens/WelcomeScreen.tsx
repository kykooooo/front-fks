// screens/WelcomeScreen.tsx
// Onboarding swipeable — 3 slides clairs (sans image), illustrés par icônes + CTA

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Pressable,
  type ViewToken,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { STORAGE_KEYS } from "../constants/storage";

const palette = theme.colors;

/* ─── Slides data ─── */
const SLIDES = [
  {
    id: "1",
    icon: "football-outline" as const,
    title: "Ta prépa physique,\nton avantage",
    subtitle: "Des séances adaptées à ton niveau, ton calendrier et tes objectifs.",
  },
  {
    id: "2",
    icon: "trending-up-outline" as const,
    title: "Progresse à\nchaque séance",
    subtitle: "Force, vitesse, endurance — chaque programme te rapproche de ton meilleur niveau.",
  },
  {
    id: "3",
    icon: "shield-checkmark-outline" as const,
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
function Slide({ item, width, bottomInset }: { item: SlideData; width: number; bottomInset: number }) {
  return (
    <View style={[styles.slide, { width, paddingBottom: bottomInset }]}>
      <View style={styles.iconCircle}>
        <Ionicons name={item.icon} size={72} color={palette.accent} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );
}

/* ─── Main ─── */
export default function WelcomeScreen({ onComplete }: Props) {
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);

  // Espace réservé en bas de chaque slide pour ne pas passer sous le bloc CTA.
  const bottomBlock = Math.max(insets.bottom, 20) + 180;

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
    await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
    onComplete("register");
  }, [haptics, onComplete]);

  const handleLogin = useCallback(async () => {
    haptics.impactLight();
    await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
    onComplete("login");
  }, [haptics, onComplete]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SlideData>) => (
      <Slide item={item} width={SCREEN_W} bottomInset={bottomBlock} />
    ),
    [SCREEN_W, bottomBlock]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

      {/* Bottom — dots + CTA */}
      <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaPrimaryText}>Commencer</Text>
        </Pressable>
        <Pressable
          onPress={handleLogin}
          style={({ pressed }) => [styles.loginLink, pressed && styles.loginLinkPressed]}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        >
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
    backgroundColor: palette.bg,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 4,
  },
  iconCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: palette.text,
    textAlign: "center",
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: palette.sub,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 22,
  },

  // ─── Bottom ───
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: palette.accent,
    width: 24,
  },
  dotInactive: {
    backgroundColor: palette.border,
  },
  ctaPrimary: {
    width: "100%",
    backgroundColor: palette.cta,
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
    paddingVertical: 12,
    marginTop: 4,
  },
  // Retour visuel au press (audit tactile 2026-07) : ce lien n'avait aucun
  // feedback pendant l'appui, contrairement au CTA principal juste au-dessus.
  loginLinkPressed: {
    opacity: 0.6,
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.sub,
  },
});
