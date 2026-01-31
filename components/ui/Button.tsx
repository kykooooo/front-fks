// components/ui/Button.tsx
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { theme } from "../../constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  fullWidth?: boolean;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  style,
  textStyle,
  disabled = false,
  fullWidth = false,
  leftAccessory,
  rightAccessory,
}: ButtonProps) {
  const labelColor =
    variant === "primary"
      ? theme.colors.text
      : variant === "secondary"
        ? theme.colors.text
        : theme.colors.accent;

  const sizeStyle = size === "sm" ? styles.sm : size === "lg" ? styles.lg : styles.md;
  const labelSize =
    size === "sm" ? styles.labelSm : size === "lg" ? styles.labelLg : styles.labelMd;
  const variantStyle =
    variant === "primary"
      ? styles.primary
      : variant === "secondary"
        ? styles.secondary
        : variant === "outline"
          ? styles.outline
          : styles.ghost;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        styles.base,
        sizeStyle,
        variantStyle,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
      <Text style={[styles.label, labelSize, { color: labelColor }, textStyle]}>
        {label}
      </Text>
      {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.6,
  },
  primary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  secondary: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSoft,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: theme.colors.borderSoft,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.accent,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lg: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  label: {
    textAlign: "center",
    flexShrink: 1,
  },
  labelSm: {
    fontSize: 12,
    fontWeight: "600",
  },
  labelMd: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelLg: {
    fontSize: 15,
    fontWeight: "700",
  },
  accessory: {
    marginHorizontal: 2,
  },
});
