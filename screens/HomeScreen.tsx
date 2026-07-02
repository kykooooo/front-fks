// screens/HomeScreen.tsx
import React, { useMemo, useLayoutEffect, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import HomeReadinessHero from "../components/home/HomeReadinessHero";
import HomePrimaryCTA from "../components/home/HomePrimaryCTA";
import HomeNextSessionCard from "../components/home/HomeNextSessionCard";
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
import { getFootballLabel } from "../config/trainingDefaults";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { getCycleTheme } from "../constants/cycleTheme";
import { getMicrocyclePhase } from "../utils/microcycleUtils";

const palette = theme.colors;

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

  const handleLogout = () => {
    // Confirmation : le bouton est dans le header, un tap accidentel ne doit pas déconnecter.
    Alert.alert("Déconnexion", "Tu veux vraiment te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            resetTrainingStore(null);
          } catch {
            showToast({ type: "error", title: "Déconnexion", message: "Échec de la déconnexion. Réessaie." });
          }
        },
      },
    ]);
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
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

  const nowISO = devNowISO ?? undefined;
  const hasAppliedToday =
    !!dailyApplied &&
    !!lastAppliedDate &&
    isSameDay(new Date(lastAppliedDate), nowISO ? new Date(nowISO) : new Date());

  const loadSeries = useLoadSeries(dailyApplied, nowISO);

  // Libellé "état du jour" joueur-friendly (jamais de TSB brut).
  const football = getFootballLabel(tsb);

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

  // Badge compact "Séance N/12 · <phase>" — affichage dérivé (jamais session.phase = "Playlist").
  const homeCycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const homeCycleDone =
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)) >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const homeCyclePhase =
    homeCycleId && !homeCycleDone ? getMicrocyclePhase(microcycleSessionIndex) : null;
  const homeCycleColor = homeCycleId ? getCycleTheme(homeCycleId).strong : palette.accent;

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

  const animStyle = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screenContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header compact clair */}
        <Animated.View style={animStyle(heroAnim)}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.greeting} numberOfLines={1}>Salut, {athleteName}</Text>
              <Text style={styles.date}>{todayLabel}</Text>
            </View>
            <View style={styles.readyChip}>
              <View style={[styles.readyDot, { backgroundColor: football.color }]} />
              <Text style={styles.readyLabel} numberOfLines={1}>{football.label}</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA principal — action n°1, en haut */}
        <Animated.View style={animStyle(ctaAnim)}>
          <HomePrimaryCTA
            label={primaryCta.label}
            subLabel={primaryCta.sub}
            tone={primaryCta.tone}
            disabled={primaryCta.disabled}
            onPress={primaryCta.onPress}
          />
        </Animated.View>

        {/* Badge cycle : où en est le joueur dans son voyage (séance + phase) */}
        {homeCyclePhase ? (
          <Animated.View style={animStyle(ctaAnim)}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => nav.navigate("CycleModal", { mode: "manage", origin: "home" })}
              style={[styles.cycleChip, { borderColor: homeCycleColor + "40" }]}
            >
              <View style={[styles.cycleChipDot, { backgroundColor: homeCycleColor }]} />
              <Text style={styles.cycleChipText} numberOfLines={1}>
                <Text style={[styles.cycleChipStrong, { color: homeCycleColor }]}>
                  Séance {homeCyclePhase.sessionNumber}/{homeCyclePhase.total}
                </Text>
                {"  ·  "}
                {homeCyclePhase.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={palette.sub} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Ligne stats compacte : Semaine / Série / Match */}
        <Animated.View style={animStyle(ctaAnim)}>
          <View style={styles.statsLine}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Semaine</Text>
              <Text style={styles.statValue}>{weekSummary.fksCount}/{weeklyGoal}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Série</Text>
              <Text style={styles.statValue}>{activityStreak > 0 ? `${activityStreak} j` : "Nouvelle"}</Text>
            </View>
            {matchSoon ? (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Match</Text>
                  <Text style={[styles.statValue, { color: palette.warn }]}>Proche</Text>
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>

        {/* État du jour (détail + tendance 7j) — placé plus bas, ne vole pas la vedette */}
        <Animated.View style={animStyle(cardsAnim)}>
          <HomeReadinessHero tsb={tsb} tsbHistory={loadSeries.tsbArr} />
        </Animated.View>

        {advice && (
          <Animated.View style={animStyle(cardsAnim)}>
            <HomeAdviceCard advice={advice} />
          </Animated.View>
        )}

        <Animated.View style={animStyle(cardsAnim)}>
          <View style={styles.cardsStack}>
            <HomeCarouselCard title="Progression" subtitle="Régularité & forme">
              <View style={styles.progressRow}>
                <Ionicons name="flame" size={18} color={palette.cta} />
                <Text style={styles.progressText}>{activityStreak} jours d’affilée</Text>
              </View>
              <TouchableOpacity onPress={() => nav.navigate("Progression")} style={styles.link}>
                <Text style={styles.linkText}>Voir ma progression</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            </HomeCarouselCard>

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
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
  // ── Header compact clair ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.3,
  },
  date: {
    fontSize: 12.5,
    color: palette.sub,
    marginTop: 2,
    textTransform: "capitalize",
  },
  readyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    maxWidth: 150,
  },
  readyDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  readyLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
    flexShrink: 1,
  },
  // ── Ligne stats compacte ──
  cycleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cycleChipDot: { width: 8, height: 8, borderRadius: 999 },
  cycleChipText: { flex: 1, fontSize: 13, color: palette.sub, fontWeight: "600" },
  cycleChipStrong: { fontWeight: "800" },
  statsLine: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: palette.border,
    marginVertical: 2,
  },
  cardsStack: {
    gap: 16,
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
