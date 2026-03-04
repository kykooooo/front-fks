// components/home/HomeAdviceCard.tsx
// Affiche un conseil contextuel proéminent pour guider le joueur

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHaptics } from "../../hooks/useHaptics";
import { theme } from "../../constants/theme";
import type { Advice, AdviceTone } from "../../domain/adviceRules";

const palette = theme.colors;

type Props = {
  advice: Advice;
};

const toneStyles: Record<
  AdviceTone,
  { bg: string; border: string; accent: string; iconBg: string; label: string }
> = {
  info: {
    bg: "rgba(37, 99, 235, 0.08)",
    border: "#3b82f6",
    accent: "#2563eb",
    iconBg: "rgba(37, 99, 235, 0.15)",
    label: "Info",
  },
  warn: {
    bg: "rgba(245, 158, 11, 0.10)",
    border: "#f59e0b",
    accent: "#d97706",
    iconBg: "rgba(245, 158, 11, 0.18)",
    label: "Attention",
  },
  danger: {
    bg: "rgba(239, 68, 68, 0.10)",
    border: "#ef4444",
    accent: "#dc2626",
    iconBg: "rgba(239, 68, 68, 0.18)",
    label: "Important",
  },
  success: {
    bg: "rgba(22, 163, 74, 0.08)",
    border: "#22c55e",
    accent: "#16a34a",
    iconBg: "rgba(22, 163, 74, 0.15)",
    label: "Top",
  },
};

function HomeAdviceCardInner({ advice }: Props) {
  if (__DEV__) console.log("[RENDER] HomeAdviceCard");
  const nav = useNavigation<any>();
  const haptics = useHaptics();
  const colors = toneStyles[advice.tone];

  const handleAction = () => {
    haptics.impactLight();
    if (advice.actionRoute) {
      nav.navigate(advice.actionRoute, advice.actionParams ?? {});
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg, borderLeftColor: colors.border },
      ]}
    >
      {/* Badge "Conseil du jour" */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: colors.iconBg }]}>
          <Ionicons name="bulb" size={10} color={colors.accent} />
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            Conseil du jour
          </Text>
        </View>
      </View>

      {/* Contenu principal */}
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name={advice.icon as any} size={24} color={colors.accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{advice.title}</Text>
          <Text style={styles.message}>{advice.message}</Text>
        </View>
      </View>

      {/* Micro-tip éducatif */}
      {advice.tip && (
        <View style={[styles.tipWrap, { backgroundColor: colors.iconBg }]}>
          <Ionicons name="school-outline" size={14} color={colors.accent} />
          <Text style={[styles.tipText, { color: colors.accent }]}>{advice.tip}</Text>
        </View>
      )}

      {/* Bouton action */}
      {advice.actionLabel && (
        <TouchableOpacity
          onPress={handleAction}
          activeOpacity={0.85}
          style={[styles.actionButton, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.actionText}>{advice.actionLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    gap: 14,
    // Ombre subtile
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: "row",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  message: {
    fontSize: 14,
    color: palette.sub,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  tipWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    fontStyle: "italic",
  },
});

export default React.memo(HomeAdviceCardInner);
