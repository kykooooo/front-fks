// components/ui/Badge.tsx
import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../constants/theme";

type BadgeTone = "default" | "ok" | "warn" | "danger";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

const toneMap: Record<BadgeTone, { bg: string; border: string; text: string }> = {
  default: {
    bg: "rgba(15,23,42,0.06)",
    border: theme.colors.borderSoft,
    text: theme.colors.text,
  },
  ok: {
    bg: "rgba(22,163,74,0.12)",
    border: theme.colors.success,
    text: theme.colors.success,
  },
  warn: {
    bg: "rgba(245,158,11,0.14)",
    border: theme.colors.warn,
    text: theme.colors.warn,
  },
  danger: {
    bg: "rgba(239,68,68,0.12)",
    border: theme.colors.danger,
    text: theme.colors.danger,
  },
};

export function Badge({ label, tone = "default", style }: BadgeProps) {
  const { bg, border, text } = toneMap[tone];
  return (
    <View style={[styles.base, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  text: {
    fontWeight: "600",
    fontSize: 11,
  },
});
