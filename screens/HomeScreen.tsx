// screens/HomeScreen.tsx
import React, { useMemo, useLayoutEffect, useEffect, useCallback, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { recomputeLoadIfStale } from "../state/orchestrators/recomputeLoadIfStale";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { useSettingsStore } from "../state/settingsStore";
import { useAppModeStore } from "../state/appModeStore";
import HomeStatusBar from "../components/home/HomeStatusBar";
import HomeReadinessHero from "../components/home/HomeReadinessHero";
import HomePrimaryCTA from "../components/home/HomePrimaryCTA";
import HomeNextSessionCard from "../components/home/HomeNextSessionCard";
import HomeWeekSummaryCard from "../components/home/HomeWeekSummaryCard";
import HomeProgressHero from "../components/home/HomeProgressHero";
import { BaselineTestsWelcomeModal } from "../components/home/BaselineTestsWelcomeModal";
import { useTestsStorage } from "./tests/hooks/useTestsStorage";
import { useBaselinePromptSeen } from "../utils/useBaselinePromptSeen";
import { useLoadSeries } from "../hooks/home/useLoadSeries";
import { useMatchSoon } from "../hooks/home/useMatchSoon";
import { useWeekDays } from "../hooks/home/useWeekDays";
import { useWeekSummary } from "../hooks/home/useWeekSummary";
import { useActivityStreak } from "../hooks/home/useActivityStreak";
import { usePrimaryCta } from "../hooks/home/usePrimaryCta";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import { useInjuryActions } from "../hooks/useInjuryActions";
import HomeAdviceCard from "../components/home/HomeAdviceCard";
import { HomeCoachRecommendation } from "../components/home/HomeCoachRecommendation";
import { PainSpikeModal } from "../components/PainSpikeModal";
import { useCoachRecommendations } from "../hooks/useCoachRecommendations";
import { isSameDay, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { BANNER_FALLBACK } from "../constants/bannerImages";

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
  const clearModeForUid = useAppModeStore((s) => s.clearForUid);

  const heroAnim = React.useRef(new Animated.Value(0)).current;
  const ctaAnim = React.useRef(new Animated.Value(0)).current;
  const cardsAnim = React.useRef(new Animated.Value(0)).current;

  // Baseline tests welcome modal : affichée 1× au premier Home si aucun test enregistré.
  const currentUid = auth.currentUser?.uid ?? null;
  const { entries: testEntries } = useTestsStorage();
  const { status: baselineStatus, markSeen: markBaselineSeen } = useBaselinePromptSeen(currentUid);
  const showBaselineModal = baselineStatus === "not_seen" && testEntries.length === 0;
  const onBaselineStart = useCallback(() => {
    markBaselineSeen();
    nav.navigate("Tests");
  }, [markBaselineSeen, nav]);
  const onBaselineLater = useCallback(() => {
    markBaselineSeen();
  }, [markBaselineSeen]);

  const handleLogout = async () => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      await signOut(auth);
      resetTrainingStore(null);
      if (uid) {
        await clearModeForUid(uid);
      }
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

  // Recalcule ATL/CTL/TSB jusqu'à aujourd'hui à chaque focus du Home.
  // Indispensable si l'app n'a pas été force-quit et que le jour a changé :
  // sans ça, un joueur reste affiché "fatigué" même après 30 jours de repos.
  // Idempotent : no-op si la métrique est déjà sur le bon dayKey.
  useFocusEffect(
    useCallback(() => {
      if (!storeHydrated) return;
      recomputeLoadIfStale();
    }, [storeHydrated])
  );

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

  // MVP blessures — PainSpikeModal (règle 5 charte).
  // S'ouvre quand la règle advice `injury_pain_spike` se déclenche.
  // Le `acknowledgePainSpike()` persiste `lastSeenPainSpike` pour
  // empêcher la carte de re-déclencher sur le même feedback.
  const { acknowledgePainSpike } = useInjuryActions();
  const [painSpikeVisible, setPainSpikeVisible] = useState(false);

  useEffect(() => {
    if (advice?.modal === "pain_spike" || advice?.id === "injury_pain_spike") {
      setPainSpikeVisible(true);
    }
  }, [advice?.id, advice?.modal]);

  const handlePainSpikeAcknowledge = useCallback(async () => {
    try {
      await acknowledgePainSpike();
    } catch (err) {
      if (__DEV__) console.error("[HomeScreen] acknowledgePainSpike failed:", err);
      showToast({
        type: "error",
        title: "Pas enregistré",
        message: "Impossible de synchroniser ton acquittement. Réessaie dans un instant.",
      });
      throw err; // relancé pour que PainSpikeModal ne ferme PAS silencieusement
    }
  }, [acknowledgePainSpike]);

  const handlePainSpikeModifyInjury = useCallback(() => {
    // Navigue vers l'onglet Profile avec ouverture auto du modal InjuryForm.
    nav.navigate("Profile", { openInjuryForm: true });
  }, [nav]);

  // Recommandations du coach
  const { recommendations: coachRecommendations } = useCoachRecommendations();

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screenContainer}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.stickyHeader}>
          <HomeStatusBar
            phaseLabel={phase ?? "Playlist"}
            tsbValue={tsb}
            tsbTone={tsbTone}
            matchSoon={matchSoon}
          />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.heroShell}>
            <Image
              source={heroImage}
              style={styles.heroPhoto}
              resizeMode="cover"
              fadeDuration={0}
            />
            <LinearGradient
              colors={["transparent", theme.colors.black55, theme.colors.black88]}
              locations={[0.15, 0.55, 1]}
              style={styles.heroGradient}
            />

            {/* Contenu par-dessus */}
            <View style={styles.heroBannerContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>FKS</Text>
                </View>
                <Text style={styles.heroDate}>{todayLabel}</Text>
              </View>
              <Text style={styles.helloTitle}>Salut, {athleteName}</Text>
              <Text style={styles.helloSub}>
                Ton état du jour et ta prochaine séance.
              </Text>
              <View style={styles.quickRow}>
                <View style={styles.quickChip}>
                  <Text style={styles.quickLabel}>Semaine</Text>
                  <Text style={styles.quickValue}>{weekSummary.fksCount}/{weeklyGoal}</Text>
                </View>
                <View style={styles.quickChip}>
                  <Text style={styles.quickLabel}>Série</Text>
                  <Text style={styles.quickValue}>{activityStreak}j</Text>
                </View>
                <View style={[styles.quickChip, matchSoon ? styles.quickChipWarn : null]}>
                  <Text style={styles.quickLabel}>Match</Text>
                  <Text style={styles.quickValue}>{matchSoon ? "Proche" : "—"}</Text>
                </View>
              </View>
            </View>
          </View>

          <Animated.View
            style={{
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            <HomeReadinessHero
              tsb={tsb}
              tsbHistory={loadSeries.tsbArr}
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: ctaAnim,
              transform: [
                {
                  translateY: ctaAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            <HomePrimaryCTA
              label={primaryCta.label}
              subLabel={primaryCta.sub}
              tone={primaryCta.tone}
              disabled={primaryCta.disabled}
              onPress={primaryCta.onPress}
            />
          </Animated.View>

          {advice && (
            <Animated.View
              style={{
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              }}
            >
              <HomeAdviceCard advice={advice} />
            </Animated.View>
          )}

          {/* Recommandations du coach */}
          {coachRecommendations.length > 0 && (
            <Animated.View
              style={{
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
                gap: 10,
              }}
            >
              {/* UX pré-démo : 1 reco max au-dessus de la fold (moins de cartes concurrentes) */}
              {coachRecommendations.slice(0, 1).map((rec) => (
                <HomeCoachRecommendation key={rec.id} recommendation={rec} />
              ))}
            </Animated.View>
          )}

          <Animated.View
            style={{
              opacity: cardsAnim,
              transform: [
                {
                    translateY: cardsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
            }}
          >
            <View style={styles.cardsStack}>
              <HomeProgressHero onPress={() => nav.navigate("Tests")} />

              <HomeNextSessionCard
                hasPending={Boolean(pendingSession)}
                upcomingLabel={upcomingSessionLabel}
                primaryLabel={pendingSession ? "Voir la séance" : primaryCta.label}
                onPrimary={pendingSession ? startPendingSession : onPressNew}
                  primaryDisabled={!pendingSession && Boolean(primaryCta.disabled)}
                  secondaryLabel="Historique"
                  onSecondary={goToHistory}
                  onFeedback={pendingSession ? goToFeedback : undefined}
              />

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ta semaine</Text>
                <Text style={styles.sectionSub}>{weekSummary.message}</Text>
              </View>

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
            </Animated.View>

          {DEV_FLAGS.ENABLED && (
            <TouchableOpacity onPress={onRunHarness} style={styles.devChip}>
              <Text style={styles.devChipText}>
                Mode test : injecter charges club/match + externes (7j)
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      <BaselineTestsWelcomeModal
        visible={showBaselineModal}
        onStart={onBaselineStart}
        onLater={onBaselineLater}
      />

      {/* MVP blessures — modal critique règle 5 charte (pain >= 7). */}
      <PainSpikeModal
        visible={painSpikeVisible}
        onClose={() => setPainSpikeVisible(false)}
        onModifyInjury={handlePainSpikeModifyInjury}
        onAcknowledge={handlePainSpikeAcknowledge}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    aspectRatio: 4 / 3,
    position: "relative" as const,
    backgroundColor: BANNER_FALLBACK.explosif,
  },
  heroPhoto: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white16,
    borderWidth: 1,
    borderColor: theme.colors.white22,
  },
  heroBadgeText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: theme.colors.white,
  },
  heroDate: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.white70,
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: theme.colors.black50,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  helloTitle: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: theme.colors.white,
    textShadowColor: theme.colors.black50,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  helloSub: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.white80,
    textShadowColor: theme.colors.black40,
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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: theme.colors.white18,
    backgroundColor: theme.colors.white14,
  },
  quickChipWarn: {
    borderColor: theme.colors.amberSoft50,
    backgroundColor: theme.colors.amberSoft16,
  },
  quickLabel: {
    fontSize: TYPE.micro.fontSize,
    color: theme.colors.white62,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quickValue: {
    marginTop: 3,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "800",
    color: theme.colors.white,
  },
  sectionHeaderRow: {
    marginTop: 4,
    gap: 4,
  },
  sectionTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.text,
  },
  sectionSub: {
    fontSize: TYPE.caption.fontSize,
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
    fontSize: TYPE.caption.fontSize,
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
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.accent,
  },
  linkArrow: {
    fontSize: TYPE.body.fontSize,
    color: palette.accent,
  },
  devChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  devChipText: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
  },
  bottomSpacer: {
    height: 12,
  },
});
