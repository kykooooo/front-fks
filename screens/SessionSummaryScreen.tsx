// screens/SessionSummaryScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommonActions, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Ionicons } from "@expo/vector-icons";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { updateTrainingLoad } from "../engine/loadModel";
import { useSettingsStore } from "../state/settingsStore";

type SummaryRoute = RouteProp<AppStackParamList, "SessionSummary">;

const palette = theme.colors;
const AUTO_FEEDBACK_DELAY_MS = 4000;

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
  const route = useRoute<SummaryRoute>();
  const { summary, sessionId } = route.params;
  const atl = useLoadStore((s) => s.atl);
  const ctl = useLoadStore((s) => s.ctl);
  const tsb = useLoadStore((s) => s.tsb);
  const sessionCompleted = useSessionsStore((s) =>
    sessionId ? !!s.sessions.find((session) => session.id === sessionId)?.completed : false
  );
  const autoFeedbackEnabled = useSettingsStore((s) => s.autoFeedbackEnabled);
  const canAutoFeedback = !!sessionId && !sessionCompleted && autoFeedbackEnabled;

  const [countdown, setCountdown] = useState(
    canAutoFeedback ? Math.ceil(AUTO_FEEDBACK_DELAY_MS / 1000) : 0
  );
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didNavigateRef = useRef(false);
  const enter = useRef(new Animated.Value(0)).current;

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
  const rpeLabel = rpe ? `RPE ${rpe}` : "—";
  const itemsLabel = totalItems > 0 ? `${completedItems}/${totalItems}` : "—";

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
    return updateTrainingLoad(atl, ctl, estimatedLoad);
  }, [estimatedLoad, atl, ctl]);

  const projectedTsb = projected ? +projected.tsb.toFixed(1) : null;
  const projectedDelta =
    projectedTsb != null ? +(projectedTsb - tsb).toFixed(1) : null;

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
      goHome();
    });
    return unsubscribe;
  }, [nav, goHome]);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enter]);

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
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            { opacity: enter, transform: [{ translateY: enterTranslate }] },
          ]}
        >
          <Card variant="surface" style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroKicker}>Séance terminée</Text>
            <Text style={styles.heroTitle}>{summary.title}</Text>
            {summary.subtitle ? (
              <Text style={styles.heroSubtitle}>{summary.subtitle}</Text>
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
          </Card>

          <Card variant="soft" style={styles.statsCard}>
            <SectionHeader title="Stats rapides" />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{durationLabel}</Text>
                <Text style={styles.statLabel}>Durée</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{rpeLabel}</Text>
                <Text style={styles.statLabel}>RPE estimé</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{itemsLabel}</Text>
                <Text style={styles.statLabel}>Validés</Text>
              </View>
            </View>
          </Card>

          <Card variant="surface" style={styles.loadCard}>
            <SectionHeader title="Effort du jour" />
            <Text style={styles.loadValue}>
              {estimatedLoad != null ? `${estimatedLoad} UA` : "—"}
            </Text>
            <Text style={styles.loadHint}>
              TSB {tsb.toFixed(1)} → {projectedTsb ?? "—"}
              {projectedDelta != null
                ? ` (${projectedDelta >= 0 ? "+" : ""}${projectedDelta})`
                : ""}
            </Text>
          </Card>

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
                    <Ionicons name="leaf-outline" size={14} color="#14b8a6" />
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
            <Button
              label="Retour"
              onPress={goHome}
              fullWidth
              size="md"
              variant="ghost"
              style={styles.backButton}
            />
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
    padding: 18,
    gap: 10,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroKicker: {
    color: palette.accent,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  heroTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: palette.sub,
    fontSize: 12,
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
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  statsCard: {
    padding: 14,
    gap: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: palette.borderSoft,
    opacity: 0.7,
  },
  statValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  statLabel: {
    color: palette.sub,
    fontSize: 11,
  },
  loadCard: {
    padding: 16,
    gap: 8,
  },
  loadValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  loadHint: {
    color: palette.sub,
    fontSize: 12,
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
    fontSize: 13,
    lineHeight: 18,
  },
  ctaBlock: {
    gap: 10,
    alignItems: "center",
  },
  countdownText: {
    color: palette.sub,
    fontSize: 12,
  },
  backButton: {
    alignSelf: "stretch",
  },
});
