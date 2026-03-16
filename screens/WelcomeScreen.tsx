// screens/WelcomeScreen.tsx
// Onboarding premium — Nike TC × Strava

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  Animated,
  StatusBar,
  AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHaptics } from "../hooks/useHaptics";
import { ds, typo, space, radius, anim } from "../theme/authDesignSystem";

const { width: SCREEN_W } = Dimensions.get("window");
const SLIDE_COUNT = 3;

const FEATURES = [
  {
    icon: "flash-outline" as const,
    title: "Adapte chaque s\u00e9ance",
    desc: "L\u2019IA ajuste selon ta fatigue, ton poste et ta semaine",
  },
  {
    icon: "trending-up-outline" as const,
    title: "Progresse vraiment",
    desc: "Suis ta charge et tes perfs, semaine apr\u00e8s semaine",
  },
  {
    icon: "location-outline" as const,
    title: "Partout, avec ton matos",
    desc: "Salle, terrain ou chez toi \u2014 on s\u2019adapte",
  },
];

const AVATARS = [
  { initials: "KM", bg: "#E8553A" },
  { initials: "AB", bg: "#6366F1" },
  { initials: "LT", bg: "#0EA5E9" },
];

type Props = {
  onComplete: (entry?: "login" | "register") => void;
};

export default function WelcomeScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const [noMotion, setNoMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setNoMotion);
  }, []);

  // CTA pulse
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (noMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: anim.pulseScale,
          duration: anim.pulseDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: anim.pulseDuration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, noMotion]);

  // Slide entrance
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isLast = currentIndex === SLIDE_COUNT - 1;

  const handleComplete = useCallback(
    async (entry: "login" | "register" = "login") => {
      haptics.impactMedium();
      await AsyncStorage.setItem("fks_welcome_done", "true");
      onComplete(entry);
    },
    [onComplete, haptics]
  );

  const goToSlide = useCallback(
    (index: number) => {
      haptics.impactLight();
      if (noMotion) {
        flatListRef.current?.scrollToIndex({ index, animated: false });
        setCurrentIndex(index);
        return;
      }
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setCurrentIndex(index);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: anim.medium,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim, noMotion, haptics]
  );

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ── CTA button ──
  const CTA = ({ label }: { label: string }) => (
    <Animated.View style={{ transform: [{ scale: pulse }], width: "100%" }}>
      <Pressable
        style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        onPress={() => handleComplete("register")}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={[...ds.gradientAccent]}
          style={s.ctaInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={s.ctaText}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color={ds.textOnAccent} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  // ── Slide 1 : Hero ──
  const renderHero = () => (
    <View style={s.inner}>
      <View style={{ gap: 8, alignItems: "center" }}>
        <Text style={s.brand}>FKS</Text>
        <View style={s.signatureBar} />
      </View>

      <View style={{ height: space.xxxl }} />

      <Text style={s.heroTitle}>
        Ta pr\u00e9pa physique,{"\n"}ton terrain.
      </Text>
      <Text style={s.heroSub}>
        Des s\u00e9ances pilot\u00e9es par l\u2019IA, adapt\u00e9es \u00e0 ton poste et ta fatigue.
      </Text>

      <View style={{ height: space.xl }} />
      <CTA label="C'est parti" />

      <Pressable
        onPress={() => handleComplete("login")}
        style={s.secondaryLink}
        accessibilityLabel="Se connecter"
        accessibilityRole="button"
      >
        <Text style={s.secondaryLinkText}>J'ai d\u00e9j\u00e0 un compte</Text>
      </Pressable>
    </View>
  );

  // ── Slide 2 : Features ──
  const renderFeatures = () => (
    <View style={s.inner}>
      <Text style={s.sectionLabel}>POURQUOI FKS</Text>
      <View style={{ height: space.lg }} />

      <View style={{ gap: space.sectionGap, width: "100%" }}>
        {FEATURES.map((f, i) => (
          <View key={i} style={s.featureRow}>
            <View style={s.featureIcon}>
              <Ionicons name={f.icon} size={22} color={ds.accent} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Slide 3 : Social proof ──
  const renderSocial = () => (
    <View style={s.inner}>
      <Text style={s.sectionLabel}>COMMUNAUT\u00c9</Text>
      <View style={{ height: space.lg }} />

      <Text style={s.socialTitle}>+500 joueurs{"\n"}nous font confiance</Text>
      <View style={{ height: space.xl }} />

      {/* Avatars */}
      <View style={s.avatarsRow}>
        {AVATARS.map((a, i) => (
          <View
            key={i}
            style={[s.avatar, { backgroundColor: a.bg, marginLeft: i > 0 ? -8 : 0 }]}
          >
            <Text style={s.avatarInitials}>{a.initials}</Text>
          </View>
        ))}
        <View style={s.ratingPill}>
          <Text style={s.ratingValue}>4.8</Text>
          <View style={s.ratingStar}>
            <Ionicons name="star" size={12} color={ds.accent} />
          </View>
        </View>
      </View>

      <View style={{ height: space.sectionGap }} />
      <CTA label="Cr\u00e9er mon compte" />

      <Pressable
        onPress={() => handleComplete("login")}
        style={s.secondaryLink}
        accessibilityLabel="Se connecter"
        accessibilityRole="button"
      >
        <Text style={s.secondaryLinkText}>J'ai d\u00e9j\u00e0 un compte</Text>
      </Pressable>
    </View>
  );

  const renderSlide = ({ index }: { item: number; index: number }) => (
    <View style={s.slide}>
      {index === 0 && renderHero()}
      {index === 1 && renderFeatures()}
      {index === 2 && renderSocial()}
    </View>
  );

  const data = [0, 1, 2];

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={ds.bg} />

      {/* Skip */}
      {!isLast && (
        <Pressable
          style={[s.skipBtn, { top: insets.top + 12 }]}
          onPress={() => goToSlide(SLIDE_COUNT - 1)}
          accessibilityLabel="Passer"
          accessibilityRole="button"
        >
          <Text style={s.skipText}>Passer</Text>
        </Pressable>
      )}

      {/* Slides */}
      <Animated.View
        style={[s.slides, { opacity: fadeAnim, paddingTop: insets.top + 16 }]}
      >
        <FlatList
          ref={flatListRef}
          data={data}
          renderItem={renderSlide}
          keyExtractor={String}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={onViewRef}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={16}
          bounces={false}
        />
      </Animated.View>

      {/* Dots — traits Nike */}
      <View style={[s.dotsWrap, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.dotsRow}>
          {data.map((_, i) => {
            const range = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
            const w = scrollX.interpolate({
              inputRange: range,
              outputRange: [24, 24, 24],
              extrapolate: "clamp",
            });
            const bg = scrollX.interpolate({
              inputRange: range,
              outputRange: [ds.border, ds.accent, ds.border],
              extrapolate: "clamp",
            });
            return (
              <Pressable key={i} onPress={() => goToSlide(i)}>
                <Animated.View
                  style={[s.dot, { width: w, backgroundColor: bg }]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ds.bg,
  },
  slides: {
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.screenH,
    paddingBottom: 64,
  },
  inner: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },

  // ── Brand ──
  brand: {
    color: ds.text,
    ...typo.brand,
  },
  signatureBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.accent,
  },

  // ── Hero ──
  heroTitle: {
    color: ds.text,
    ...typo.hero,
    textAlign: "center",
  },
  heroSub: {
    color: ds.textSecondary,
    ...typo.subtitle,
    textAlign: "center",
    marginTop: space.md,
  },

  // ── Section label ──
  sectionLabel: {
    color: ds.textTertiary,
    ...typo.sectionLabel,
  },

  // ── Features ──
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ds.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    color: ds.text,
    fontSize: 16,
    fontWeight: "600",
  },
  featureDesc: {
    color: ds.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  // ── Social ──
  socialTitle: {
    color: ds.text,
    ...typo.title,
    textAlign: "center",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ds.bg,
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: ds.surface,
    marginLeft: 4,
  },
  ratingValue: {
    color: ds.text,
    fontSize: 14,
    fontWeight: "700",
  },
  ratingStar: {
    marginTop: -1,
  },

  // ── CTA ──
  cta: {
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
    width: "100%",
  },
  ctaPressed: {
    opacity: anim.pressOpacity,
    transform: [{ scale: anim.pressScale }],
  },
  ctaInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  ctaText: {
    color: ds.textOnAccent,
    ...typo.button,
  },

  // ── Secondary link ──
  secondaryLink: {
    paddingVertical: 14,
  },
  secondaryLinkText: {
    color: ds.textSecondary,
    ...typo.body,
    fontWeight: "500",
  },

  // ── Skip ──
  skipBtn: {
    position: "absolute",
    right: space.screenH,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: ds.textTertiary,
    ...typo.caption,
  },

  // ── Dots ──
  dotsWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingVertical: 12,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 3,
    borderRadius: 1.5,
  },
});
