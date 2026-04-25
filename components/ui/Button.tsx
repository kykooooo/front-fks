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
import { theme, TYPE, RADIUS } from "../../constants/theme";
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
      ? theme.colors.white
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
            ? { color: theme.colors.black08, borderless: false }
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
    borderRadius: RADIUS.pill,
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
    ...theme.shadow.accent,
  },
  secondary: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderSoft,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.accent,
  },
  sm: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  md: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  lg: {
    minHeight: 56,
    paddingVertical: 17,
    paddingHorizontal: 24,
  },
  label: {
    textAlign: "center",
    flexShrink: 1,
  },
  labelSm: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  labelMd: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelLg: {
    fontSize: TYPE.subtitle.fontSize,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  accessory: {
    marginHorizontal: 2,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black,
  },
});
