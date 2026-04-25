// components/home/HomeAdviceCard.tsx
// Affiche un conseil contextuel proéminent pour guider le joueur

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHaptics } from "../../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../../constants/theme";
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
    bg: theme.colors.blueSoft08,
    border: theme.colors.blue500,
    accent: theme.colors.blue600,
    iconBg: theme.colors.blueSoft15,
    label: "Info",
  },
  warn: {
    bg: theme.colors.amberSoft10,
    border: theme.colors.amber500,
    accent: theme.colors.orange600,
    iconBg: theme.colors.amberSoft18,
    label: "Attention",
  },
  danger: {
    bg: theme.colors.redSoft10,
    border: theme.colors.red500,
    accent: theme.colors.red600,
    iconBg: theme.colors.redSoft18,
    label: "Important",
  },
  success: {
    bg: theme.colors.greenSoft08,
    border: theme.colors.green500,
    accent: theme.colors.green600,
    iconBg: theme.colors.greenSoft15,
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
    // Ombre subtile
    shadowColor: theme.colors.black,
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
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    fontSize: TYPE.micro.fontSize,
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
  tipWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
  },
  tipText: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    lineHeight: 17,
    fontStyle: "italic",
  },
});

export default React.memo(HomeAdviceCardInner);
