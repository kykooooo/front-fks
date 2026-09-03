// screens/SessionHubScreen.tsx
// Hub séances modernisé - design pro avec icônes et hiérarchie visuelle

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { MICROCYCLES, isMicrocycleId, MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../domain/microcycles";
import { useHaptics } from "../hooks/useHaptics";
import { useNavGuard } from "../hooks/useNavGuard";
import { toDateKey } from "../utils/dateHelpers";
import { selectPendingSession } from "../utils/sessionHelpers";
import { Screen } from "../components/ui/Screen";
import { MonCorpsHubCard } from "../components/monCorps/MonCorpsHubCard";

const palette = theme.colors;

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
    iconBg: ["#ff7a1a", "#ff9a4a"],
    title: "Créer une séance",
    subtitle: "Séance adaptée à ton contexte",
    route: "GenerateSession",
    primary: true,
  },
  {
    id: "prebuilt",
    icon: "sparkles-outline",
    iconBg: ["#14b8a6", "#2dd4bf"],
    title: "Routines & extras",
    subtitle: "Mobilité, activation, récupération",
    route: "PrebuiltSessions",
  },
  {
    id: "history",
    icon: "time-outline",
    iconBg: ["#06b6d4", "#22d3ee"],
    title: "Historique",
    subtitle: "Consulte tes séances passées",
    route: "SessionHistory",
  },
  {
    id: "tests",
    icon: "speedometer-outline",
    iconBg: ["#16a34a", "#4ade80"],
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
                <Ionicons name={option.icon} size={28} color="#fff" />
              </View>
              <View style={styles.primaryTextContainer}>
                <Text style={styles.primaryTitle}>{option.title}</Text>
                <Text style={styles.primarySubtitle}>{option.subtitle}</Text>
              </View>
            </View>
            <View style={styles.primaryArrow}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
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
              <Ionicons name={option.icon} size={20} color="#fff" />
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
  const guardNav = useNavGuard();
  const sessions = useSessionsStore((s) => s.sessions);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  // Même fenêtre que FeedbackScreen : une zombie hors fenêtre n'apparaît plus
  // ici comme "séance en attente" (elle vit dans l'historique en "non validée").
  const pending = selectPendingSession(
    sessions,
    toDateKey(devNowISO ? new Date(devNowISO) : new Date())
  );
  const pendingId = typeof pending?.id === "string" ? pending.id : null;
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  // S22 — v2 de la séance en attente (même source que usePrimaryCta) pour
  // pouvoir la rouvrir en preview, pas seulement donner le feedback.
  const pendingV2 = pending ? pending.aiV2 ?? pending.ai ?? lastAiSessionV2?.v2 ?? null : null;
  const openPendingSession = () => {
    if (!pending || !pendingV2) return;
    const plannedDateISO = toDateKey(pending.dateISO ?? pending.date);
    guardNav(() =>
      nav.navigate("SessionPreview", {
        v2: pendingV2,
        plannedDateISO,
        sessionId: pending.id,
      })
    );
  };
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const completedSessions = useSessionsStore((s) => s.sessions.filter((x) => x.completed).length);

  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const cycleProgress = Math.min(
    MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0))
  );

  return (
    // Socle visuel (CLAUDE.md règle 13) : cet écran utilisait une
    // `<SafeAreaView>` en direct, seul rescapé du whack-a-mole de safe area.
    // `<Screen>` est la source unique de vérité, header-aware.
    <Screen>
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
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
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
                  Complète ton feedback pour débloquer la suite
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => pendingId && nav.navigate("Feedback", { sessionId: pendingId })}
              disabled={!pendingId}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>Donner mon feedback</Text>
              <Ionicons name="arrow-forward" size={16} color={palette.accent} />
            </TouchableOpacity>
            {pendingV2 ? (
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={openPendingSession}
                activeOpacity={0.8}
              >
                <Text style={[styles.alertButtonText, styles.alertButtonSecondaryText]}>
                  Voir la séance
                </Text>
                <Ionicons name="eye-outline" size={16} color={palette.sub} />
              </TouchableOpacity>
            ) : null}
          </Card>
        ) : null}

        {/* MON CORPS (décision D2) — au-dessus du bouton qui fabrique la séance,
            parce que c'est exactement ce que l'information sert à fabriquer :
            « je regarde mon corps, puis je lance ». Dans Profil, elle serait
            rangée avec l'état civil, consultée une fois puis jamais rouverte. */}
        <MonCorpsHubCard onPress={() => guardNav(() => nav.navigate("MonCorps"))} />

        {/* Pas de 2e alerte "Tests terrain" ici : le hub grid ci-dessous (entrée
            "tests" de HUB_OPTIONS) est déjà l'entrée permanente vers Tests, et
            ProfileScreen porte déjà une relance contextuelle avec fraîcheur
            (shouldSuggestTests, 30j) — inutile de dupliquer le même intitulé. */}

        {/* Hub options */}
        <View style={styles.optionsContainer}>
          {HUB_OPTIONS.map((option, index) => (
            <HubCard
              key={option.id}
              option={option}
              index={index}
              onPress={() => guardNav(() => nav.navigate(option.route))}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: 14,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statText: {
    fontSize: 13,
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
    borderRadius: 12,
    backgroundColor: "rgba(255,122,26,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  alertSubtitle: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 2,
  },
  alertButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.accent,
  },
  alertButtonSecondary: {
    borderColor: palette.borderSoft,
  },
  alertButtonSecondaryText: {
    color: palette.sub,
  },
  optionsContainer: {
    gap: 12,
  },
  primaryCardContainer: {
    shadowColor: "#ff7a1a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryCard: {
    borderRadius: 16,
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
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryTextContainer: {
    flex: 1,
  },
  primaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  primarySubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardPressable: {
    borderRadius: 14,
  },
  card: {
    padding: 14,
    borderRadius: 14,
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
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
});
