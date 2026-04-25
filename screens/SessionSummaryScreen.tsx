// screens/SessionSummaryScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated, AccessibilityInfo } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CommonActions, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Ionicons } from "@expo/vector-icons";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { updateTrainingLoad } from "../engine/loadModel";
import { getTauForLevel } from "../config/trainingDefaults";
import { useSettingsStore } from "../state/settingsStore";
import { useHaptics } from "../hooks/useHaptics";
import { PitchDecoration } from "../components/ui/PitchDecoration";
import { TrainingIllustration } from "../components/ui/TrainingIllustration";
import { isSessionCompleted } from "../utils/sessionStatus";

type SummaryRoute = RouteProp<AppStackParamList, "SessionSummary">;

const palette = theme.colors;
const AUTO_FEEDBACK_DELAY_MS = 4000;
const CELEBRATION_MESSAGES = [
  "Tu viens de poser une brique. La suite demain.",
  "Chaque séance te rapproche de ton meilleur niveau.",
  "Le talent, c'est le travail. Tu es sur la bonne voie.",
  "Les meilleurs s'entraînent quand personne ne regarde.",
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const intensityTone = (intensity?: string) => {
  const key = (intensity ?? "").toLowerCase();
  if (key.includes("hard") || key.includes("max")) return "danger";
  if (key.includes("mod")) return "warn";
  if (key.includes("easy")) return "ok";
  return "default";
};

export default function SessionSummaryScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<SummaryRoute>();
  const { summary, sessionId } = route.params;
  const atl = useLoadStore((s) => s.atl);
  const ctl = useLoadStore((s) => s.ctl);
  const tsb = useLoadStore((s) => s.tsb);
  const playerLevel = useSessionsStore((s) => s.playerLevel);
  const sessionCompleted = useSessionsStore((s) =>
    sessionId ? isSessionCompleted(s.sessions.find((session) => session.id === sessionId)) : false
  );
  const hasPendingFeedback = !!sessionId && !sessionCompleted;
  const autoFeedbackEnabled = useSettingsStore((s) => s.autoFeedbackEnabled);
  const canAutoFeedback = hasPendingFeedback && autoFeedbackEnabled;

  const [countdown, setCountdown] = useState(
    canAutoFeedback ? Math.ceil(AUTO_FEEDBACK_DELAY_MS / 1000) : 0
  );
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didNavigateRef = useRef(false);
  const enter = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0.6)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const haptics = useHaptics();

  const totalItems = summary.totalItems ?? 0;
  const completedItems = summary.completedItems ?? 0;
  const completionRatio = totalItems > 0 ? completedItems / totalItems : 0;
  const completionPct =
    totalItems > 0 ? Math.round(completionRatio * 100) : null;

  const durationMin =
    typeof summary.durationMin === "number" && Number.isFinite(summary.durationMin)
      ? Math.max(1, Math.round(summary.durationMin))
      : undefined;
  const rpe =
    typeof summary.rpe === "number" && Number.isFinite(summary.rpe)
      ? clamp(Math.round(summary.rpe), 1, 10)
      : undefined;

  const durationLabel = durationMin ? `${durationMin} min` : "—";
  const itemsLabel = totalItems > 0 ? `${completedItems}/${totalItems}` : "—";
  const summaryAdaptationLabels = useMemo(() => {
    if (!Array.isArray(summary.adaptationLabels)) return [];
    return Array.from(
      new Set(
        summary.adaptationLabels
          .map((label) => (typeof label === "string" ? label.trim() : ""))
          .filter((label) => label.length > 0)
      )
    ).slice(0, 4);
  }, [summary.adaptationLabels]);
  const summaryMethodBadges = useMemo(
    () =>
      [summary.cycleLabel, summary.cycleProgressLabel, summary.cyclePhaseLabel].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      ),
    [summary.cycleLabel, summary.cycleProgressLabel, summary.cyclePhaseLabel]
  );

  const estimatedLoad = useMemo(() => {
    if (typeof summary.srpe === "number" && Number.isFinite(summary.srpe)) {
      return Math.round(summary.srpe);
    }
    if (durationMin && rpe) {
      return Math.round(durationMin * rpe);
    }
    return null;
  }, [summary.srpe, durationMin, rpe]);

  const projected = useMemo(() => {
    if (estimatedLoad == null) return null;
    const { tauAtl, tauCtl } = getTauForLevel(playerLevel);
    return updateTrainingLoad(atl, ctl, estimatedLoad, { tauAtl, tauCtl });
  }, [estimatedLoad, atl, ctl, playerLevel]);

  const projectedTsb = projected ? +projected.tsb.toFixed(1) : null;
  const projectedDelta =
    projectedTsb != null ? +(projectedTsb - tsb).toFixed(1) : null;
  const effortRatio =
    rpe != null ? clamp(rpe / 10, 0.12, 1) : estimatedLoad != null ? clamp(estimatedLoad / 360, 0.12, 1) : 0.32;
  const completionWidth = clamp(completionRatio, 0, 1);
  const effortValue = rpe != null ? `${rpe}/10` : summary.intensity ?? "—";
  const celebrationMessage = useMemo(() => {
    const progressKey = (summary.cycleProgressLabel ?? "").toLowerCase();
    if (progressKey.includes("1/12")) return CELEBRATION_MESSAGES[0];
    if (rpe != null && rpe >= 8) return CELEBRATION_MESSAGES[3];
    if (completionPct != null && completionPct >= 100) return CELEBRATION_MESSAGES[1];
    return CELEBRATION_MESSAGES[(durationMin ?? completedItems ?? 0) % CELEBRATION_MESSAGES.length];
  }, [summary.cycleProgressLabel, rpe, completionPct, durationMin, completedItems]);

  const prefill = useMemo(() => {
    const next: { rpe?: number; durationMin?: number } = {};
    if (rpe != null) next.rpe = rpe;
    if (durationMin != null) next.durationMin = durationMin;
    return Object.keys(next).length ? next : undefined;
  }, [rpe, durationMin]);

  const goHome = useCallback(() => {
    nav.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Tabs", params: { screen: "Home" } }],
      })
    );
  }, [nav]);

  const clearAuto = useCallback(() => {
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    if (autoTickRef.current) clearInterval(autoTickRef.current);
    autoTimeoutRef.current = null;
    autoTickRef.current = null;
  }, []);

  const goFeedback = useCallback(() => {
    if (!sessionId || sessionCompleted) return;
    if (didNavigateRef.current) return;
    didNavigateRef.current = true;
    clearAuto();
    nav.navigate("Feedback", {
      sessionId,
      prefill,
    });
  }, [sessionId, sessionCompleted, clearAuto, nav, prefill]);

  // Block hardware back / gesture from going back to SessionLiveScreen
  useEffect(() => {
    const unsubscribe = nav.addListener("beforeRemove", (e: any) => {
      // Allow programmatic reset (our goHome / goFeedback)
      if (e.data.action.type === "RESET" || e.data.action.type === "NAVIGATE") return;
      e.preventDefault();
      if (hasPendingFeedback) {
        goFeedback();
        return;
      }
      goHome();
    });
    return unsubscribe;
  }, [nav, goHome, goFeedback, hasPendingFeedback]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion == null) return;
    if (reduceMotion) {
      enter.setValue(1);
      celebrationScale.setValue(1);
      emojiScale.setValue(1);
      return;
    }
    enter.setValue(0);
    celebrationScale.setValue(0.6);
    emojiScale.setValue(0);
    haptics.success();
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(celebrationScale, {
        toValue: 1,
        damping: 11,
        stiffness: 120,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(emojiScale, {
          toValue: 1.2,
          damping: 9,
          stiffness: 140,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.spring(emojiScale, {
          toValue: 1,
          damping: 10,
          stiffness: 170,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reduceMotion, enter, celebrationScale, emojiScale]);

  useEffect(() => {
    didNavigateRef.current = false;
    if (!canAutoFeedback) {
      clearAuto();
      setCountdown(0);
      return;
    }
    setCountdown(Math.ceil(AUTO_FEEDBACK_DELAY_MS / 1000));
    autoTimeoutRef.current = setTimeout(() => {
      goFeedback();
    }, AUTO_FEEDBACK_DELAY_MS);
    autoTickRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : c));
    }, 1000);
    return () => {
      clearAuto();
    };
  }, [canAutoFeedback, clearAuto, goFeedback]);

  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(20, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: enter, transform: [{ translateY: enterTranslate }] },
          ]}
        >
          <Card variant="surface" style={styles.heroCard}>
            <LinearGradient
              colors={[theme.colors.plum900, theme.colors.ember950, theme.colors.ink900]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroVisual}
            >
              <View style={styles.heroGlowWrap} pointerEvents="none">
                <View style={[styles.heroGlow, styles.heroGlowTop]} />
                <View style={[styles.heroGlow, styles.heroGlowBottom]} />
              </View>
              <PitchDecoration
                type="centerCircle"
                width={190}
                height={190}
                color={theme.colors.white}
                opacity={0.08}
                style={styles.heroCircle}
              />
              <PitchDecoration
                type="cornerArc"
                width={110}
                height={110}
                color={theme.colors.white}
                opacity={0.07}
                style={styles.heroCorner}
              />
              <TrainingIllustration
                variant="summary"
                width={170}
                height={170}
                primaryColor={theme.colors.white18}
                accentColor={theme.colors.accentAlt}
                secondaryColor={theme.colors.goldSoft50}
                opacity={0.95}
                style={styles.heroIllustration}
              />
              <Animated.View
                style={[
                  styles.heroCelebrateWrap,
                  { transform: [{ scale: celebrationScale }] },
                ]}
              >
                <View style={styles.heroCelebrateRow}>
                  <Text style={styles.heroCelebrateTitle}>
                    {"S\u00E9ance termin\u00E9e"}
                  </Text>
                  <Animated.View
                    style={[
                      styles.heroCelebrateIconWrap,
                      { transform: [{ scale: emojiScale }] },
                    ]}
                  >
                    <Ionicons
                      name="flame"
                      size={TYPE.hero.fontSize}
                      color={theme.colors.accentAlt}
                    />
                  </Animated.View>
                </View>
                <Text style={styles.heroSessionTitle}>{summary.title}</Text>
              </Animated.View>
            </LinearGradient>
            <View style={styles.heroBody}>
              <Text style={styles.heroCelebrationMessage}>{celebrationMessage}</Text>
              {summary.subtitle ? (
                <Text style={styles.heroSubtitle}>{summary.subtitle}</Text>
              ) : null}
              {summary.sessionTheme ? (
                <View style={styles.heroThemePill}>
                  <Text style={styles.heroThemeText}>{summary.sessionTheme}</Text>
                </View>
              ) : null}
              <View style={styles.heroBadges}>
                {summary.plannedDateISO ? <Badge label={summary.plannedDateISO} /> : null}
                {summary.intensity ? (
                  <Badge label={summary.intensity} tone={intensityTone(summary.intensity)} />
                ) : null}
                {summary.focus ? <Badge label={summary.focus} /> : null}
                {summary.location ? <Badge label={summary.location} /> : null}
              </View>
              <View style={styles.heroProgress}>
                <Text style={styles.progressLabel}>
                  Progression : {itemsLabel}
                  {completionPct != null ? ` · ${completionPct}%` : ""}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${completionRatio * 100}%` }]}
                  />
                </View>
              </View>
            </View>
          </Card>

          <View style={styles.metricsGrid}>
            <Card variant="soft" style={[styles.metricCard, styles.metricCardAccent]}>
              <View style={[styles.metricIconWrap, styles.metricIconAccent]}>
                <Ionicons name="time-outline" size={18} color={palette.accent} />
              </View>
              <Text style={styles.metricLabel}>Durée</Text>
              <Text style={styles.metricValue}>{durationLabel}</Text>
              <Text style={styles.metricMeta}>Temps de travail</Text>
            </Card>

            <Card variant="soft" style={[styles.metricCard, styles.metricCardWarn]}>
              <View style={[styles.metricIconWrap, styles.metricIconWarn]}>
                <Ionicons name="flash-outline" size={18} color={theme.colors.amber500} />
              </View>
              <Text style={styles.metricLabel}>Effort</Text>
              <Text style={styles.metricValue}>{effortValue}</Text>
              <View style={styles.metricGaugeTrack}>
                <View
                  style={[
                    styles.metricGaugeFill,
                    styles.metricGaugeWarn,
                    { width: `${effortRatio * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricMeta}>
                {projectedTsb != null
                  ? `Forme projetée ${projectedTsb}${projectedDelta != null ? ` (${projectedDelta >= 0 ? "+" : ""}${projectedDelta})` : ""}`
                  : "RPE estimé"}
              </Text>
            </Card>

            <Card variant="soft" style={[styles.metricCard, styles.metricCardSuccess]}>
              <View style={[styles.metricIconWrap, styles.metricIconSuccess]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.green500} />
              </View>
              <Text style={styles.metricLabel}>Validés</Text>
              <Text style={styles.metricValue}>{itemsLabel}</Text>
              <View style={styles.metricGaugeTrack}>
                <View
                  style={[
                    styles.metricGaugeFill,
                    styles.metricGaugeSuccess,
                    { width: `${completionWidth * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricMeta}>
                {completionPct != null ? `${completionPct}% du plan validé` : "Exercices cochés"}
              </Text>
            </Card>
          </View>

          {summary.playerRationale ? (
            <Card variant="surface" style={styles.contextCard}>
              <SectionHeader title={summary.playerRationaleTitle ?? "Ce que tu as travaillé"} />
              <Text style={styles.contextText}>{summary.playerRationale}</Text>
            </Card>
          ) : null}

          {summary.coachNote ? (
            <Card variant="soft" style={styles.contextCard}>
              <SectionHeader title="Le mot du prépa" />
              <Text style={styles.contextCoachText}>{summary.coachNote}</Text>
            </Card>
          ) : null}

          <Card variant="soft" style={styles.badgeCard}>
            <SectionHeader title="Badges" />
            <View style={styles.badgeRow}>
              {summary.intensity ? (
                <Badge label={summary.intensity} tone={intensityTone(summary.intensity)} />
              ) : null}
              {summary.focus ? <Badge label={summary.focus} /> : null}
              {durationMin ? <Badge label={`${durationMin} min`} /> : null}
              {rpe ? <Badge label={`RPE ${rpe}`} /> : null}
            </View>
          </Card>

          {summary.recoveryTips && summary.recoveryTips.length > 0 ? (
            <Card variant="soft" style={styles.recoveryCard}>
              <SectionHeader title="Récupération" />
              <View style={{ gap: 8 }}>
                {summary.recoveryTips.map((tip: string, i: number) => (
                  <View key={`rec_${i}`} style={styles.recoveryRow}>
                    <Ionicons name="leaf-outline" size={14} color={theme.colors.teal500} />
                    <Text style={styles.recoveryText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <View style={styles.ctaBlock}>
            <Button
              label="Donner le feedback"
              onPress={goFeedback}
              fullWidth
              size="lg"
              variant="primary"
              disabled={!sessionId || sessionCompleted}
            />
            {canAutoFeedback && countdown > 0 ? (
              <Text style={styles.countdownText}>
                Feedback automatique dans {countdown}s
              </Text>
            ) : null}
            {!autoFeedbackEnabled && sessionId && !sessionCompleted ? (
              <Text style={styles.countdownText}>Feedback auto désactivé.</Text>
            ) : null}
            {sessionCompleted ? (
              <Text style={styles.countdownText}>Feedback déjà enregistré.</Text>
            ) : null}
            {hasPendingFeedback ? (
              <Text style={styles.countdownText}>
                Le feedback finalise ta séance et débloque proprement la suite.
              </Text>
            ) : (
              <Button
                label="Retour"
                onPress={goHome}
                fullWidth
                size="md"
                variant="ghost"
                style={styles.backButton}
              />
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
  },
  content: {
    gap: 16,
  },
  heroCard: {
    padding: 0,
    overflow: "hidden",
    ...theme.shadow.soft,
  },
  heroVisual: {
    position: "relative",
    minHeight: 200,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroGlowWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: "absolute",
    borderRadius: RADIUS.pill,
  },
  heroGlowTop: {
    width: 180,
    height: 180,
    top: -38,
    right: -42,
    backgroundColor: theme.colors.accentSoft28,
  },
  heroGlowBottom: {
    width: 150,
    height: 150,
    bottom: -34,
    left: -24,
    backgroundColor: theme.colors.goldSoft14,
  },
  heroCircle: {
    position: "absolute",
    top: 10,
    right: -28,
  },
  heroCorner: {
    position: "absolute",
    bottom: 12,
    left: -10,
  },
  heroIllustration: {
    position: "absolute",
    right: -18,
    bottom: -26,
    transform: [{ rotate: "4deg" }],
  },
  heroBody: {
    padding: 14,
    gap: 10,
  },
  heroCelebrateWrap: {
    gap: 8,
  },
  heroCelebrateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroCelebrateTitle: {
    color: theme.colors.white,
    fontSize: TYPE.hero.fontSize,
    fontWeight: "900",
    letterSpacing: TYPE.hero.letterSpacing,
    textShadowColor: theme.colors.black60,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroCelebrateIconWrap: {
    shadowColor: theme.colors.accentAlt,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroSessionTitle: {
    color: theme.colors.white90,
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "700",
    textShadowColor: theme.colors.black60,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroThemePill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accentSoft,
  },
  heroThemeText: {
    color: palette.accent,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  heroCelebrationMessage: {
    color: palette.sub,
    fontSize: TYPE.body.fontSize,
    lineHeight: 22,
    fontStyle: "italic",
  },
  heroSubtitle: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroProgress: {
    gap: 6,
  },
  progressLabel: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 104,
    padding: 14,
    gap: 8,
    borderRadius: RADIUS.lg,
  },
  metricCardAccent: {
    backgroundColor: theme.colors.accentSoft10,
    borderColor: theme.colors.accentSoft24,
  },
  metricCardWarn: {
    backgroundColor: theme.colors.amberSoft10,
    borderColor: theme.colors.amberSoft18,
  },
  metricCardSuccess: {
    backgroundColor: theme.colors.greenSoft12,
    borderColor: theme.colors.green500Soft15,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconAccent: {
    backgroundColor: theme.colors.accentSoft24,
  },
  metricIconWarn: {
    backgroundColor: theme.colors.amberSoft18,
  },
  metricIconSuccess: {
    backgroundColor: theme.colors.green500Soft15,
  },
  metricLabel: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    letterSpacing: TYPE.micro.letterSpacing,
    textTransform: "uppercase",
  },
  metricValue: {
    color: palette.text,
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
  },
  metricMeta: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 17,
  },
  metricGaugeTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  metricGaugeFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  metricGaugeWarn: {
    backgroundColor: theme.colors.amber500,
  },
  metricGaugeSuccess: {
    backgroundColor: theme.colors.green500,
  },
  contextCard: {
    padding: 14,
    gap: 10,
    ...theme.shadow.soft,
  },
  contextBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextText: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
    lineHeight: 20,
    fontWeight: "600",
  },
  contextCoachText: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
    lineHeight: 20,
    fontWeight: "700",
  },
  contextPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  contextPillText: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  badgeCard: {
    padding: 12,
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recoveryCard: {
    padding: 14,
    gap: 10,
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  recoveryText: {
    flex: 1,
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 18,
  },
  ctaBlock: {
    gap: 10,
    alignItems: "center",
  },
  countdownText: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  backButton: {
    alignSelf: "stretch",
  },
});

