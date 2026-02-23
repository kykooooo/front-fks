// components/ui/Button.tsx
import React, { useRef } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Animated,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  Platform,
} from "react-native";
import { theme } from "../../constants/theme";
import { useHaptics } from "../../hooks/useHaptics";

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
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const pressAnim = useRef(new Animated.Value(0)).current;
  const haptics = useHaptics();

  const onPressIn = () => {
    haptics.impactLight();
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const scale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  const overlayOpacity = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={
          Platform.OS === "android"
            ? { color: "rgba(0,0,0,0.08)", borderless: false }
            : undefined
        }
        style={[
          styles.base,
          sizeStyle,
          variantStyle,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          style,
        ]}
      >
        <Animated.View style={[styles.pressOverlay, { opacity: overlayOpacity }]} />
        {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
        <Text style={[styles.label, labelSize, { color: labelColor }, textStyle]}>
          {label}
        </Text>
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </Pressable>
    </Animated.View>
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
    overflow: "hidden",
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
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
