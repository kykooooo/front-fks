// screens/SessionHubScreen.tsx
// Hub séances modernisé - design pro avec icônes et hiérarchie visuelle

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { MICROCYCLES, isMicrocycleId, MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../domain/microcycles";
import { useHaptics } from "../hooks/useHaptics";
import { openSessionEntry } from "../utils/sessionEntry";
import { isSessionCompleted } from "../utils/sessionStatus";
import { shouldSurfaceAsPendingSession } from "../utils/sessionFallback";

const palette = theme.colors;
const TESTS_STORAGE_KEY = "fks_tests_v1";

type HubOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: [string, string];
  title: string;
  subtitle: string;
  route: string;
  primary?: boolean;
};

const HUB_OPTIONS: HubOption[] = [
  {
    id: "create",
    icon: "flash",
    iconBg: [theme.colors.accent, theme.colors.accentAlt],
    title: "Créer une séance",
    subtitle: "Séance adaptée à ton contexte",
    route: "GenerateSession",
    primary: true,
  },
  {
    id: "prebuilt",
    icon: "sparkles-outline",
    iconBg: [theme.colors.teal500, theme.colors.teal400],
    title: "Routines & extras",
    subtitle: "Mobilité, activation, récupération",
    route: "PrebuiltSessions",
  },
  {
    id: "history",
    icon: "time-outline",
    iconBg: [theme.colors.cyan500, theme.colors.cyan400],
    title: "Historique",
    subtitle: "Consulte tes séances passées",
    route: "SessionHistory",
  },
  {
    id: "tests",
    icon: "speedometer-outline",
    iconBg: [theme.colors.green600, theme.colors.green400],
    title: "Tests terrain",
    subtitle: "Mesure sprints, sauts, circuits",
    route: "Tests",
  },
];

function HubCard({
  option,
  index,
  onPress,
}: {
  option: HubOption;
  index: number;
  onPress: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const haptics = useHaptics();
  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  if (option.primary) {
    return (
      <Animated.View
        style={[
          styles.primaryCardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryCard}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={option.iconBg}
            style={styles.primaryCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
          >
            <View style={styles.primaryCardContent}>
              <View style={styles.primaryIconCircle}>
                <Ionicons name={option.icon} size={28} color={theme.colors.white} />
              </View>
              <View style={styles.primaryTextContainer}>
                <Text style={styles.primaryTitle}>{option.title}</Text>
                <Text style={styles.primarySubtitle}>{option.subtitle}</Text>
              </View>
            </View>
            <View style={styles.primaryArrow}>
              <Ionicons name="arrow-forward" size={22} color={theme.colors.white} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.cardPressable}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Card variant="surface" style={styles.card}>
          <View style={styles.cardContent}>
            <LinearGradient
              colors={option.iconBg}
              style={styles.cardIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={option.icon} size={20} color={theme.colors.white} />
            </LinearGradient>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.sub} />
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SessionHubScreen() {
  const nav = useNavigation<any>();
  const pending = useSessionsStore((s) =>
    s.sessions.find((x) => !isSessionCompleted(x) && shouldSurfaceAsPendingSession(x))
  );
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  const pendingId = typeof pending?.id === "string" ? pending.id : null;
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const completedSessions = useSessionsStore((s) => s.sessions.filter((x) => isSessionCompleted(x)).length);
  const [testsEmpty, setTestsEmpty] = useState<boolean | null>(null);

  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const cycleProgress = Math.min(
    MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0))
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(TESTS_STORAGE_KEY);
          if (cancelled) return;
          if (!raw) {
            setTestsEmpty(true);
            return;
          }
          const parsed = JSON.parse(raw);
          setTestsEmpty(!Array.isArray(parsed) || parsed.length === 0);
        } catch {
          if (!cancelled) setTestsEmpty(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Séances</Text>
          <Text style={styles.headerSubtitle}>
            Génère, explore ou consulte tes entraînements
          </Text>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="layers" size={14} color={palette.accent} />
            <Text style={styles.statText}>
              {cycleDef?.label ?? "Aucun cycle"}{" "}
              {cycleId ? (
                <Text style={styles.statHighlight}>
                  {cycleProgress}/{MICROCYCLE_TOTAL_SESSIONS_DEFAULT}
                </Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.green600} />
            <Text style={styles.statText}>
              <Text style={styles.statHighlight}>{completedSessions}</Text> terminées
            </Text>
          </View>
        </View>

        {/* Pending session alert */}
        {pending ? (
          <Card variant="soft" style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.alertIconCircle}>
                <Ionicons name="hourglass-outline" size={18} color={palette.accent} />
              </View>
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>Séance en attente</Text>
                <Text style={styles.alertSubtitle}>
                  Complete ton feedback pour débloquer la suite
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => {
                if (!pending) return;
                void openSessionEntry(nav, pending, lastAiSessionV2?.v2 ?? null);
              }}
              disabled={!pendingId}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>Ouvrir ma séance</Text>
              <Ionicons name="arrow-forward" size={16} color={palette.accent} />
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Tests missing alert */}
        {testsEmpty === true && !pending ? (
          <Card variant="soft" style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertIconCircle, { backgroundColor: theme.colors.cyanSoft15 }]}>
                <Ionicons name="analytics-outline" size={18} color={theme.colors.cyan500} />
              </View>
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>Tests terrain</Text>
                <Text style={styles.alertSubtitle}>
                  Mesure tes qualités pour affiner tes séances
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.alertButton, { borderColor: theme.colors.cyan500 }]}
              onPress={() => nav.navigate("Tests")}
              activeOpacity={0.8}
            >
              <Text style={[styles.alertButtonText, { color: theme.colors.cyan500 }]}>
                Passer les tests
              </Text>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.cyan500} />
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Hub options */}
        <View style={styles.optionsContainer}>
          {HUB_OPTIONS.map((option, index) => (
            <HubCard
              key={option.id}
              option={option}
              index={index}
              onPress={() => nav.navigate(option.route)}
            />
          ))}
        </View>

        {/* Bottom tip */}
        <View style={styles.tipContainer}>
          <Ionicons name="bulb-outline" size={14} color={palette.sub} />
          <Text style={styles.tipText}>
            Génère ta séance quotidienne ou explore les programmes thématiques
          </Text>
        </View>
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
    gap: 16,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontSize: TYPE.hero.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: TYPE.body.fontSize,
    color: palette.sub,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
  },
  statHighlight: {
    color: palette.text,
    fontWeight: "700",
  },
  alertCard: {
    padding: 14,
    gap: 12,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.accentSoft15,
    justifyContent: "center",
    alignItems: "center",
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  alertSubtitle: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    marginTop: 2,
  },
  alertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  alertButtonText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "600",
    color: palette.accent,
  },
  optionsContainer: {
    gap: 12,
  },
  primaryCardContainer: {
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  primaryCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  primaryCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  primaryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.white20,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryTextContainer: {
    flex: 1,
  },
  primaryTitle: {
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "800",
    color: theme.colors.white,
  },
  primarySubtitle: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.white80,
    marginTop: 2,
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.white20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardPressable: {
    borderRadius: RADIUS.md,
  },
  card: {
    padding: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    marginTop: 2,
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.cardSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tipText: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
});
