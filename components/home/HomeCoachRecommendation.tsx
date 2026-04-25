// components/home/HomeCoachRecommendation.tsx
// Affiche une recommandation du coach sur la home du joueur

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHaptics } from "../../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../../constants/theme";
import { MICROCYCLES, isMicrocycleId } from "../../domain/microcycles";
import type { CoachRecommendation, RecommendationType } from "../../domain/coachRecommendations";
import { dismissRecommendation, markRecommendationAsRead } from "../../repositories/coachRecommendationsRepo";
import { auth } from "../../services/firebase";
import { showToast } from "../../utils/toast";

const palette = theme.colors;

type Props = {
  recommendation: CoachRecommendation;
  onDismiss?: () => void;
};

// Config par type de recommandation
const TYPE_CONFIG: Record<
  RecommendationType,
  { icon: string; color: string; bg: string; iconBg: string; title: string }
> = {
  cycle_suggestion: {
    icon: "trophy",
    color: theme.colors.violet500,
    bg: theme.colors.violetSoft08,
    iconBg: theme.colors.violetSoft15,
    title: "Suggestion de cycle",
  },
  rest_advice: {
    icon: "bed",
    color: theme.colors.amber500,
    bg: theme.colors.amberSoft08,
    iconBg: theme.colors.amberSoft15,
    title: "Conseil récupération",
  },
  intensity_adjust: {
    icon: "speedometer",
    color: theme.colors.blue500,
    bg: theme.colors.blue500Soft08,
    iconBg: theme.colors.blue500Soft15,
    title: "Ajustement intensité",
  },
  custom: {
    icon: "chatbubble",
    color: theme.colors.blue600,
    bg: theme.colors.blueSoft08,
    iconBg: theme.colors.blueSoft15,
    title: "Message du coach",
  },
};

function HomeCoachRecommendationInner({ recommendation, onDismiss }: Props) {
  if (__DEV__) console.log("[RENDER] HomeCoachRecommendation");
  const nav = useNavigation<any>();
  const haptics = useHaptics();
  const playerId = auth.currentUser?.uid ?? "";
  const config = TYPE_CONFIG[recommendation.type] ?? TYPE_CONFIG.custom;
  const isUnread = !recommendation.readAt;

  const suggestedCycle =
    recommendation.suggestedCycleId && isMicrocycleId(recommendation.suggestedCycleId)
      ? MICROCYCLES[recommendation.suggestedCycleId]
      : null;

  const handlePress = () => {
    haptics.impactLight();
    if (!recommendation.readAt) {
      markRecommendationAsRead(playerId, recommendation.id).catch((err) => {
        if (__DEV__) console.error("[HomeCoachRecommendation] markAsRead failed:", err);
      });
    }
    if (
      recommendation.type === "cycle_suggestion" &&
      recommendation.suggestedCycleId &&
      isMicrocycleId(recommendation.suggestedCycleId)
    ) {
      nav.navigate("CycleModal", { mode: "select" });
    }
  };

  const handleDismiss = async () => {
    haptics.impactLight();
    try {
      await dismissRecommendation(playerId, recommendation.id);
      onDismiss?.();
    } catch (err) {
      if (__DEV__) console.error("[HomeCoachRecommendation] dismiss failed:", err);
      showToast({ type: "error", title: "Erreur", message: "Impossible de masquer la recommandation. Réessaie." });
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: config.bg, borderLeftColor: config.color },
        isUnread && styles.cardUnread,
      ]}
    >
      {/* Header: Coach badge + Dismiss */}
      <View style={styles.header}>
        <View style={[styles.coachBadge, { backgroundColor: config.iconBg }]}>
          <Ionicons name="person" size={10} color={config.color} />
          <Text style={[styles.coachName, { color: config.color }]}>
            {recommendation.coachName ?? "Coach"}
          </Text>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={palette.sub} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon as any} size={24} color={config.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{recommendation.message}</Text>
          {suggestedCycle && (
            <View style={[styles.cycleTag, { backgroundColor: config.iconBg }]}>
              <Ionicons name="trophy-outline" size={12} color={config.color} />
              <Text style={[styles.cycleTagText, { color: config.color }]}>
                {suggestedCycle.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action button */}
      {suggestedCycle && (
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          style={[styles.actionButton, { backgroundColor: config.color }]}
        >
          <Text style={styles.actionText}>Voir le cycle</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    padding: 16,
    gap: 14,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: {
    shadowOpacity: 0.1,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coachBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  coachName: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.xs,
    marginLeft: 2,
  },
  dismissButton: {
    padding: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  message: {
    fontSize: TYPE.body.fontSize,
    color: palette.sub,
    lineHeight: 20,
  },
  cycleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  cycleTagText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  actionText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
  },
});

export const HomeCoachRecommendation = React.memo(HomeCoachRecommendationInner);
