// components/ui/Badge.tsx
import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme, TYPE, RADIUS } from "../../constants/theme";

type BadgeTone = "default" | "ok" | "warn" | "danger";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

const toneMap: Record<BadgeTone, { bg: string; border: string; text: string }> = {
  default: {
    bg: theme.colors.slateSoft06,
    border: theme.colors.borderSoft,
    text: theme.colors.text,
  },
  ok: {
    bg: theme.colors.greenSoft12,
    border: theme.colors.success,
    text: theme.colors.success,
  },
  warn: {
    bg: theme.colors.amberSoft14,
    border: theme.colors.warn,
    text: theme.colors.warn,
  },
  danger: {
    bg: theme.colors.redSoft12,
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
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  text: {
    fontWeight: "600",
    fontSize: TYPE.micro.fontSize,
  },
});
