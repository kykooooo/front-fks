import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  label: string;
  subLabel?: string;
  tone?: "primary" | "warn" | "disabled";
  onPress?: () => void;
  disabled?: boolean;
};

export default function HomePrimaryCTA({
  label,
  subLabel,
  tone = "primary",
  onPress,
  disabled = false,
}: Props) {
  const isDisabled = disabled || tone === "disabled";
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isDisabled, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });
  const bg =
    tone === "warn" ? "rgba(245,158,11,0.16)" : tone === "disabled" ? palette.cardSoft : palette.accent;
  const border =
    tone === "warn" ? palette.warn : tone === "disabled" ? palette.borderSoft : palette.accent;
  const textColor =
    tone === "warn" ? palette.warn : tone === "disabled" ? palette.sub : palette.text;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[styles.wrap, { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.7 : 1 }]}
      >
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {subLabel ? <Text style={[styles.sub, { color: tone === "disabled" ? palette.sub : palette.text }]}>{subLabel}</Text> : null}
      </View>
      <View style={[styles.iconWrap, { borderColor: textColor }]}>
        <Ionicons name="arrow-forward" size={18} color={textColor} />
      </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "900",
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
