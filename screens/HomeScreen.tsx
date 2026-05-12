// screens/HomeScreen.tsx
import React, { useMemo, useLayoutEffect, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { theme } from "../constants/theme";
import { useSettingsStore } from "../state/settingsStore";
import HomeStatusBar from "../components/home/HomeStatusBar";
import HomeReadinessHero from "../components/home/HomeReadinessHero";
import HomePrimaryCTA from "../components/home/HomePrimaryCTA";
import HomeNextSessionCard from "../components/home/HomeNextSessionCard";
import HomeWeekSummaryCard from "../components/home/HomeWeekSummaryCard";
import HomeTestsNudge from "../components/home/HomeTestsNudge";
import HomeCarouselCard from "../components/home/HomeCarouselCard";
import { useLoadSeries } from "../hooks/home/useLoadSeries";
import { useMatchSoon } from "../hooks/home/useMatchSoon";
import { useWeekDays } from "../hooks/home/useWeekDays";
import { useWeekSummary } from "../hooks/home/useWeekSummary";
import { useActivityStreak } from "../hooks/home/useActivityStreak";
import { usePrimaryCta } from "../hooks/home/usePrimaryCta";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import HomeAdviceCard from "../components/home/HomeAdviceCard";
import { isSameDay, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { BANNER_FALLBACK } from "../constants/bannerImages";
import { MICROCYCLES, isMicrocycleId } from "../domain/microcycles";

// ─── Nike-style accent (orange premium énergique) ─────────────────────────
const NIKE_ACCENT = "#FF6B1A";
const NIKE_ACCENT_PRESSED = "#E5560A";

const palette = theme.colors;
const HERO_DARK = require("../assets/images/hero-dark.jpg");
const HERO_LIGHT = require("../assets/images/hero-light.jpg");

// Stable default references to prevent ?? [] from creating new arrays each render
const EMPTY_STRINGS: string[] = [];
const EMPTY_EXTERNALS: { source?: string; dateISO?: string }[] = [];


export default function HomeScreen() {
  if (__DEV__) console.log("[RENDER] HomeScreen");

  // ─── Carrousel hero ───


  type RootNav = {
    navigate: (screen: string, params?: any) => void;
    setOptions?: (opts: any) => void;
  };
  const nav = useNavigation<RootNav>();
  const resetTrainingStore = useSyncStore((s) => s.resetForUser);

  const heroAnim = React.useRef(new Animated.Value(0)).current;
  const ctaAnim = React.useRef(new Animated.Value(0)).current;
  const cardsAnim = React.useRef(new Animated.Value(0)).current;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      resetTrainingStore(null);
    } catch {
      showToast({ type: "error", title: "Déconnexion", message: "Échec de la déconnexion. Réessaie." });
    }
  };

  useLayoutEffect(() => {
    nav.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTitle: "",
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      headerRight: () => (
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Text
            style={styles.logoutText}
          >
            Déconnexion
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [nav]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        heroAnim.setValue(1);
        ctaAnim.setValue(1);
        cardsAnim.setValue(1);
        return;
      }
      Animated.stagger(80, [
        Animated.timing(heroAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(ctaAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(cardsAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [heroAnim, ctaAnim, cardsAnim]);

  // ── Actions (stable refs) ──
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const runTestHarness = useDebugStore((s) => s.runTestHarness);

  // ── Load state ──
  const phase = useSessionsStore((s) => s.phase);
  const tsb = useLoadStore((s) => s.tsb);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const dailyApplied = useLoadStore((s) => s.dailyApplied);
  const lastAppliedDate = useLoadStore((s) => s.lastAppliedDate);

  // ── Sessions & calendar ──
  const sessions = useSessionsStore((s) => s.sessions);
  const externalLoads = useExternalStore((s) => s.externalLoads ?? EMPTY_EXTERNALS);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? EMPTY_STRINGS);
  const matchDays = useExternalStore((s) => s.matchDays ?? EMPTY_STRINGS);
  const plannedFksDays = useSyncStore((s) => s.plannedFksDays ?? EMPTY_STRINGS);
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);

  useEffect(() => {
    if (!storeHydrated) return;
    startFirestoreWatch();
  }, [startFirestoreWatch, storeHydrated]);

  const weekStart = useSettingsStore((s) => s.weekStart);
  const weeklyGoal = useSettingsStore((s) => s.weeklyGoal ?? 2);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const heroImage = themeMode === "light" ? HERO_LIGHT : HERO_DARK;

  const nowISO = devNowISO ?? undefined;
  const hasAppliedToday =
    !!dailyApplied &&
    !!lastAppliedDate &&
    isSameDay(new Date(lastAppliedDate), nowISO ? new Date(nowISO) : new Date());

  const loadSeries = useLoadSeries(dailyApplied, nowISO);

  const tsbTone = tsb <= -15 ? "danger" : tsb < 0 ? "warn" : "good";

  const matchSoon = useMatchSoon(matchDays, nowISO);

  const weekDays = useWeekDays({
    devNowISO: nowISO,
    weekStart,
    sessions,
    externalLoads,
    clubTrainingDays,
    matchDays,
    plannedFksDays,
  });

  const { primaryCta, upcomingSessionLabel, pendingSession, startPendingSession, onPressNew } = usePrimaryCta({
    nav,
    sessions,
    lastAiSessionV2,
    microcycleGoal,
    microcycleSessionIndex,
    hasAppliedToday,
    tsb,
    devNowISO: nowISO,
  });

  // Stable callbacks for memoized children
  const goToHistory = useCallback(() => nav.navigate("SessionHistory"), [nav]);
  const goToRoutine = useCallback(() => nav.navigate("Routine"), [nav]);
  const goToFeedback = useCallback(() => {
    if (pendingSession) nav.navigate("Feedback", { sessionId: (pendingSession as any).id });
  }, [nav, pendingSession]);

  const advice = useContextualAdvice();

  // Recommandations du coach

  const onRunHarness = () => {
    runTestHarness?.(7);
    showToast({ type: "info", title: "Harness appliqué", message: "Charges auto + externes de test injectées sur 7 jours." });
  };

  const weekSummary = useWeekSummary({
    sessions,
    externalLoads,
    weekDays,
    weeklyGoal,
  });

  const athleteName = auth.currentUser?.displayName ?? "joueur";

  const activityStreak = useActivityStreak(sessions, externalLoads, nowISO);

  const plannedThisWeek = useMemo(
    () => weekDays.filter((d) => d.hasPlanned).length,
    [weekDays]
  );

  const todayLabel = useMemo(() => {
    const base = nowISO ? new Date(nowISO) : new Date();
    try {
      return base.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return toDateKey(base);
    }
  }, [nowISO]);

  // ─── Cycle label pour le hero (FORCE, EXPLOSIF, etc.) ─────────────────
  const cycleLabel = useMemo(() => {
    if (microcycleGoal && isMicrocycleId(microcycleGoal)) {
      return MICROCYCLES[microcycleGoal].label.toUpperCase();
    }
    return "FKS";
  }, [microcycleGoal]);

  const sessionIndexDisplay = Math.min(12, Math.max(0, (microcycleSessionIndex ?? 0)) + 1);

  // ─── Etat physiologique en clair (Nike-style : bold + emoji discret) ────
  const readinessShort =
    tsb >= 5 ? "FRAIS · PRÊT À POUSSER"
    : tsb >= -5 ? "EN FORME"
    : tsb >= -15 ? "CHARGÉ"
    : "RÉCUPÉRATION";

  return (
    <View style={styles.nikeRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.nikeContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. HERO PLEIN LARGEUR — photo + CTA orange massif ─── */}
        <Animated.View
          style={[
            styles.heroNike,
            {
              opacity: heroAnim,
            },
          ]}
        >
          <Image
            source={heroImage}
            style={styles.heroNikeBackdrop}
            resizeMode="cover"
            fadeDuration={0}
          />
          <View style={styles.heroNikeTint} />
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.65)", "rgba(0,0,0,0.95)"]}
            locations={[0, 0.5, 1]}
            style={styles.heroNikeGradient}
          />

          {/* Top : date + match alert si pertinent */}
          <SafeAreaView style={styles.heroTopBarNike} edges={["top"]}>
            <Text style={styles.heroDateNike}>
              {todayLabel.toUpperCase()} · SALUT {athleteName.toUpperCase()}
            </Text>
            {matchSoon && (
              <View style={styles.matchAlertNike}>
                <Text style={styles.matchAlertNikeText}>MATCH J-1</Text>
              </View>
            )}
            <TouchableOpacity onPress={handleLogout} style={styles.logoutNike}>
              <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Bottom : label + titre cycle + sous-titre + CTA orange */}
          <View style={styles.heroBottomNike}>
            <Text style={styles.heroLabelNike}>AUJOURD'HUI</Text>
            <Text style={styles.heroTitleNike}>{cycleLabel}</Text>
            <Text style={styles.heroSubtitleNike}>
              {primaryCta.sub || `Séance ${sessionIndexDisplay}/12 · ${readinessShort}`}
            </Text>

            <Animated.View
              style={{
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.ctaNike,
                  primaryCta.disabled && styles.ctaNikeDisabled,
                ]}
                onPress={primaryCta.onPress}
                disabled={primaryCta.disabled}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.ctaNikeText}>
                  {primaryCta.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ─── 2. Sections scroll — fond noir, accents minimaux ─── */}
        <Animated.View
          style={[
            styles.sectionsNike,
            {
              opacity: cardsAnim,
              transform: [
                {
                  translateY: cardsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Conseil contextuel si pertinent */}
          {advice && <HomeAdviceCard advice={advice} />}

          {/* Forme & tendance */}
          <View>
            <Text style={styles.sectionHeadNike}>TA FORME</Text>
            <HomeReadinessHero tsb={tsb} tsbHistory={loadSeries.tsbArr} />
          </View>

          {/* Cette semaine */}
          <View>
            <Text style={styles.sectionHeadNike}>CETTE SEMAINE</Text>
            <HomeWeekSummaryCard
              title="Semaine en cours"
              summaryLabel={`${weekSummary.fksCount}/${weeklyGoal}`}
              message={weekSummary.message}
              weekDays={weekDays}
              plannedThisWeek={plannedThisWeek}
              weeklyGoal={weeklyGoal}
              activityStreak={activityStreak}
              onManageRoutine={goToRoutine}
            />
          </View>

          {/* Quick actions row */}
          <View style={styles.quickRowNike}>
            <TouchableOpacity
              style={styles.quickActionNike}
              onPress={() => nav.navigate("Progression")}
              activeOpacity={0.7}
            >
              <Ionicons name="trending-up" size={20} color={NIKE_ACCENT} />
              <Text style={styles.quickActionNikeLabel}>PROGRESSION</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionNike}
              onPress={() => nav.navigate("Tests")}
              activeOpacity={0.7}
            >
              <Ionicons name="speedometer" size={20} color={NIKE_ACCENT} />
              <Text style={styles.quickActionNikeLabel}>TESTS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionNike}
              onPress={goToHistory}
              activeOpacity={0.7}
            >
              <Ionicons name="time" size={20} color={NIKE_ACCENT} />
              <Text style={styles.quickActionNikeLabel}>HISTORIQUE</Text>
            </TouchableOpacity>
          </View>

          {DEV_FLAGS.ENABLED && (
            <TouchableOpacity onPress={onRunHarness} style={styles.devChip}>
              <Text style={styles.devChipText}>
                Mode test : injecter charges club/match + externes (7j)
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Nike-style root + container ────────────────────────────────────────
  nikeRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  nikeContainer: {
    paddingBottom: 32,
    backgroundColor: "#000",
  },
  // ─── Hero plein écran ───────────────────────────────────────────────────
  heroNike: {
    width: "100%",
    height: 560,
    position: "relative" as const,
    backgroundColor: "#111",
  },
  heroNikeBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  heroNikeTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  heroNikeGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopBarNike: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroDateNike: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.75)",
  },
  matchAlertNike: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: NIKE_ACCENT,
  },
  matchAlertNikeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#fff",
  },
  logoutNike: {
    padding: 6,
  },
  heroBottomNike: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 28,
    gap: 8,
  },
  heroLabelNike: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: NIKE_ACCENT,
  },
  heroTitleNike: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitleNike: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  // ─── CTA orange massif Nike ─────────────────────────────────────────────
  ctaNike: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: NIKE_ACCENT,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: NIKE_ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaNikeDisabled: {
    backgroundColor: "rgba(255,107,26,0.4)",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaNikeText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#fff",
  },
  // ─── Sections sous le hero ──────────────────────────────────────────────
  sectionsNike: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 24,
  },
  sectionHeadNike: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
  },
  quickRowNike: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  quickActionNike: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  quickActionNikeLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.85)",
  },
  // ─── Legacy styles (gardés pour rétro-compat, non utilisés) ─────────────
  screenContainer: {
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: palette.bg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scroll: {
    flex: 1,
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: {
    fontWeight: "500",
    color: palette.sub,
    fontSize: 12,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: palette.bg,
  },
  mainContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  heroShell: {
    borderRadius: 24,
    overflow: "hidden",
    height: 232,
    position: "relative" as const,
    backgroundColor: BANNER_FALLBACK.explosif,
  },
  heroPhotoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
    transform: [{ scale: 1.08 }],
  },
  heroPhotoFigure: {
    position: "absolute",
    right: -18,
    top: -8,
    bottom: 0,
    width: "62%",
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,8,10,0.18)",
    borderRadius: 24,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72%",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroBannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    gap: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#ffffff",
  },
  heroDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  helloTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  helloSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  quickChip: {
    flexGrow: 1,
    minWidth: 96,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  quickChipWarn: {
    borderColor: "rgba(245,158,11,0.5)",
    backgroundColor: "rgba(245,158,11,0.16)",
  },
  quickLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.62)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quickValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  sectionHeaderRow: {
    marginTop: 4,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.text,
  },
  sectionSub: {
    fontSize: 12,
    color: palette.sub,
  },
  cardsStack: {
    gap: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 160,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressText: {
    fontSize: 13,
    color: palette.text,
    fontWeight: "700",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
  },
  linkArrow: {
    fontSize: 14,
    color: palette.accent,
  },
  devChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  devChipText: {
    fontSize: 11,
    color: palette.sub,
  },
  bottomSpacer: {
    height: 12,
  },
});
