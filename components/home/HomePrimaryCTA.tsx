import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { useHaptics } from "../../hooks/useHaptics";
import { useReduceMotion } from "../../hooks/useReduceMotion";

const palette = theme.colors;

type Props = {
  label: string;
  subLabel?: string;
  tone?: "primary" | "warn" | "disabled";
  onPress?: () => void;
  disabled?: boolean;
};

function HomePrimaryCTAInner({
  label,
  subLabel,
  tone = "primary",
  onPress,
  disabled = false,
}: Props) {
  if (__DEV__) console.log("[RENDER] HomePrimaryCTA");
  const isDisabled = disabled || tone === "disabled";
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    haptics.impactLight();
    Animated.timing(press, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.timing(press, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  };
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });

  useEffect(() => {
    // Réduire les animations (OS) : pas de pulsation en boucle, bouton figé à l'échelle 1.
    if (isDisabled || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [isDisabled, reduceMotion, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });
  // CTA primaire = action clé → fond orange (cta) + texte BLANC (contraste propre).
  const bg =
    tone === "warn" ? "rgba(245,158,11,0.16)" : tone === "disabled" ? palette.cardSoft : palette.cta;
  const border =
    tone === "warn" ? palette.warn : tone === "disabled" ? palette.borderSoft : palette.cta;
  const textColor =
    tone === "warn" ? palette.warn : tone === "disabled" ? palette.sub : "#ffffff";
  const subColor =
    tone === "disabled" ? palette.sub : tone === "warn" ? palette.warn : "rgba(255,255,255,0.9)";

  return (
    <Animated.View style={{ transform: [{ scale }, { scale: pressScale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[styles.wrap, { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.7 : 1 }]}
      >
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {subLabel ? <Text style={[styles.sub, { color: subColor }]}>{subLabel}</Text> : null}
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

export default React.memo(HomePrimaryCTAInner);
