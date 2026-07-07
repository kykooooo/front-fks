// screens/HomeScreen.tsx
import React, { useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { Screen } from "../components/ui/Screen";
import { homeColors } from "../components/home/homeUi";
import { useSettingsStore } from "../state/settingsStore";
import HomeReadinessHero from "../components/home/HomeReadinessHero";
import HomePrimaryCTA from "../components/home/HomePrimaryCTA";
import HomeNextSessionCard from "../components/home/HomeNextSessionCard";
import HomeCarouselCard from "../components/home/HomeCarouselCard";
import { FootballIllustration } from "../components/ui/FootballIllustration";
import { PitchDecoration } from "../components/ui/PitchDecoration";
import { useLoadSeries } from "../hooks/home/useLoadSeries";
import { useMatchSoon } from "../hooks/home/useMatchSoon";
import { useWeekDays } from "../hooks/home/useWeekDays";
import { useWeekSummary } from "../hooks/home/useWeekSummary";
import { useActivityStreak } from "../hooks/home/useActivityStreak";
import { usePrimaryCta } from "../hooks/home/usePrimaryCta";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import { useNavGuard } from "../hooks/useNavGuard";
import HomeAdviceCard from "../components/home/HomeAdviceCard";
import { isSameDay, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { getCycleTheme } from "../constants/cycleTheme";
import { getMicrocyclePhase } from "../utils/microcycleUtils";

const palette = homeColors;

// Stable default references to prevent ?? [] from creating new arrays each render
const EMPTY_STRINGS: string[] = [];
const EMPTY_EXTERNALS: { source?: string; dateISO?: string }[] = [];


export default function HomeScreen() {
  if (__DEV__) console.log("[RENDER] HomeScreen");

  type RootNav = {
    navigate: (screen: string, params?: any) => void;
    setOptions?: (opts: any) => void;
  };
  const nav = useNavigation<RootNav>();

  const heroAnim = React.useRef(new Animated.Value(0)).current;
  const ctaAnim = React.useRef(new Animated.Value(0)).current;
  const cardsAnim = React.useRef(new Animated.Value(0)).current;

  // Note : pas de headerRight "Déconnexion" ici — les headers sont cachés
  // (Tab.Navigator + AppStack "Tabs" en headerShown: false). Le logout vit dans Réglages.

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

  const { primaryCta, upcomingSessionLabel, pendingSession, viewPendingSession, onPressNew } = usePrimaryCta({
    nav,
    sessions,
    lastAiSessionV2,
    microcycleGoal,
    microcycleSessionIndex,
    hasAppliedToday,
    tsb,
    devNowISO: nowISO,
  });

  // Stable callbacks for memoized children — protégés anti double-tap (même garde que usePrimaryCta)
  const guardNav = useNavGuard();
  const goToHistory = useCallback(
    () => guardNav(() => nav.navigate("SessionHistory")),
    [nav, guardNav]
  );
  const goToFeedback = useCallback(() => {
    if (pendingSession) {
      guardNav(() => nav.navigate("Feedback", { sessionId: (pendingSession as any).id }));
    }
  }, [nav, pendingSession, guardNav]);
  const goToProgression = useCallback(
    () => guardNav(() => nav.navigate("Progression")),
    [nav, guardNav]
  );
  const goToCycleModal = useCallback(
    () => guardNav(() => nav.navigate("CycleModal", { mode: "manage", origin: "home" })),
    [nav, guardNav]
  );

  // Nag feedback légitime uniquement si la séance en attente date d'un jour passé.
  const todayKey = toDateKey(nowISO ? new Date(nowISO) : new Date());
  const pendingDateKey = pendingSession
    ? toDateKey((pendingSession as any).dateISO ?? (pendingSession as any).date)
    : null;
  const feedbackDue = Boolean(pendingDateKey && pendingDateKey < todayKey);

  const advice = useContextualAdvice();

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
      const label = base.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      // Typo FR : seule la 1ʳᵉ lettre en majuscule (pas de capitalize CSS qui donnerait "Jeu. 3 Juil.")
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return toDateKey(base);
    }
  }, [nowISO]);

  const animStyle = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Screen scroll style={styles.screen} contentContainerStyle={styles.screenContainer}>
      {/* ── Hero plein écran noir — identité Nike, indépendante du theme global ── */}
      <Animated.View style={[styles.hero, animStyle(heroAnim)]}>
        <LinearGradient
          colors={[palette.heroFrom, palette.heroTo]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <PitchDecoration
          type="cornerArc"
          width={90}
          height={90}
          color="#FFFFFF"
          opacity={0.06}
          style={styles.decorCornerTL}
        />
        <FootballIllustration
          type="sprint"
          width={230}
          height={230}
          color="#FFFFFF"
          opacity={0.05}
          style={styles.decorSilhouette}
        />

        {/* Barre du haut : salutation + date, alerte match éventuelle */}
        <View style={styles.heroTopBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting} numberOfLines={1}>SALUT {athleteName.toUpperCase()}</Text>
            <Text style={styles.heroDate}>{todayLabel}</Text>
          </View>
          {matchSoon ? (
            <View style={styles.matchChip}>
              <Ionicons name="football" size={12} color={palette.cta} />
              <Text style={styles.matchChipText}>MATCH PROCHE</Text>
            </View>
          ) : null}
        </View>

        {/* Bloc ancré en bas : action du jour */}
        <View style={styles.heroBottom}>
          <Text style={styles.heroKicker}>AUJOURD'HUI</Text>
          <Text
            style={styles.heroTitle}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {primaryCta.label}
          </Text>
          {(primaryCta.sub || upcomingSessionLabel) ? (
            <Text style={styles.heroSubtitle} numberOfLines={2}>
              {primaryCta.sub ?? upcomingSessionLabel}
            </Text>
          ) : null}

          {homeCyclePhase ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goToCycleModal}
              style={[styles.cyclePill, { borderColor: homeCycleColor }]}
            >
              <View style={[styles.cyclePillDot, { backgroundColor: homeCycleColor }]} />
              <Text style={styles.cyclePillText} numberOfLines={1}>
                Séance {homeCyclePhase.sessionNumber}/{homeCyclePhase.total} · {homeCyclePhase.label}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={palette.sub} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.heroCta}>
            <HomePrimaryCTA
              label={primaryCta.label}
              subLabel={primaryCta.sub}
              tone={primaryCta.tone}
              disabled={primaryCta.disabled}
              onPress={primaryCta.onPress}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── Sections sous le hero — toujours sur fond noir Home ── */}
      <View style={styles.sections}>
        {advice && (
          <Animated.View style={animStyle(cardsAnim)}>
            <HomeAdviceCard advice={advice} />
          </Animated.View>
        )}

        <Animated.View style={animStyle(cardsAnim)}>
          <HomeReadinessHero tsb={tsb} tsbHistory={loadSeries.tsbArr} />
        </Animated.View>

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

        <Animated.View style={animStyle(cardsAnim)}>
          <View style={styles.cardsStack}>
            <HomeCarouselCard title="Progression" subtitle="Régularité & forme">
              <View style={styles.progressRow}>
                <Ionicons name="flame" size={18} color={palette.cta} />
                <Text style={styles.progressText}>
                  {activityStreak === 0
                    ? "Lance ta première séance"
                    : activityStreak === 1
                      ? "1 jour d’affilée"
                      : `${activityStreak} jours d’affilée`}
                </Text>
              </View>
              <TouchableOpacity onPress={goToProgression} style={styles.link}>
                <Text style={styles.linkText}>Voir ma progression</Text>
                <Text style={styles.linkArrow}>→</Text>
              </TouchableOpacity>
            </HomeCarouselCard>

            <HomeNextSessionCard
              hasPending={Boolean(pendingSession)}
              upcomingLabel={upcomingSessionLabel}
              primaryLabel={pendingSession ? "Voir la séance" : primaryCta.label}
              onPrimary={pendingSession ? viewPendingSession : primaryCta.onPress ?? onPressNew}
              primaryDisabled={!pendingSession && Boolean(primaryCta.disabled)}
              secondaryLabel="Historique"
              onSecondary={goToHistory}
              feedbackDue={feedbackDue}
              onFeedback={pendingSession && feedbackDue ? goToFeedback : undefined}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.bg,
  },
  screenContainer: {
    paddingBottom: 24,
    backgroundColor: palette.bg,
  },
  // ── Hero plein écran ──
  hero: {
    minHeight: 500,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  decorCornerTL: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  decorSilhouette: {
    position: "absolute",
    bottom: 0,
    right: -20,
  },
  heroTopBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.sub,
    letterSpacing: 1.2,
  },
  heroDate: {
    fontSize: 12.5,
    color: palette.muted,
    marginTop: 3,
  },
  matchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.ctaSoft,
    borderWidth: 1,
    borderColor: palette.cta,
  },
  matchChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.cta,
    letterSpacing: 0.5,
  },
  heroBottom: {
    gap: 4,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: "900",
    color: palette.cta,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: palette.sub,
    lineHeight: 20,
  },
  cyclePill: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: "100%",
  },
  cyclePillDot: { width: 7, height: 7, borderRadius: 999 },
  cyclePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
    flexShrink: 1,
  },
  heroCta: {
    marginTop: 20,
  },
  // ── Sections sous le hero ──
  sections: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 14,
  },
  statsLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 16,
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
