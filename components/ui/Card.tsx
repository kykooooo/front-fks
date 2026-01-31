// components/ui/Card.tsx
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../constants/theme";

type CardVariant = "surface" | "soft" | "outline";

type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = "surface", style }: CardProps) {
  const variantStyle =
    variant === "soft"
      ? styles.soft
      : variant === "outline"
        ? styles.outline
        : styles.surface;

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
  },
  surface: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  soft: {
    backgroundColor: theme.colors.cardSoft,
    borderColor: theme.colors.borderSoft,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.borderSoft,
  },
});
