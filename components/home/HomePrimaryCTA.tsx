// components/home/HomePrimaryCTA.tsx
// Bouton principal de l'accueil (SPEC_DA_ACCUEIL_SEANCE.md §2.3) — même
// gabarit que `DaPrimaryButton` (56 de haut, rayon 16, libellé à gauche,
// flèche à droite), mais gardé comme composant distinct pour porter le pulse
// en boucle (scale 1 → 1.015) que `DaPrimaryButton` n'a pas. Plus de
// `subLabel` ni de ton "warn" ambré : l'état d'attention est désormais porté
// par une `DaNotice` à côté du bouton, jamais par le bouton lui-même.
import React, { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { da, PLAFOND_TITRE, TOUCHE_MIN } from "../../constants/daJoueur";
import { useHaptics } from "../../hooks/useHaptics";
import { useReduceMotion } from "../../hooks/useReduceMotion";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

function HomePrimaryCTAInner({ label, onPress, disabled = false }: Props) {
  if (__DEV__) console.log("[RENDER] HomePrimaryCTA");
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  // `Animated.Value` créée une seule fois — jamais `useRef(...).current` lu
  // pendant le rendu (règle react-hooks/refs du chantier).
  const [pulse] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(0));

  const onPressIn = () => {
    haptics.impactLight();
    if (reduceMotion) return;
    Animated.timing(press, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (reduceMotion) return;
    Animated.timing(press, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  };

  useEffect(() => {
    // Réduire les animations (OS) ou bouton désactivé : pas de pulsation en
    // boucle, bouton figé à l'échelle 1.
    if (disabled || reduceMotion) {
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
  }, [disabled, reduceMotion, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const animatedStyle = { transform: [{ scale: pulseScale }, { scale: pressScale }] };
  const backgroundStyle = { backgroundColor: disabled ? da.colors.disabledBg : da.colors.action };
  const labelColor = disabled ? da.colors.disabledText : da.colors.onAction;
  const labelColorStyle = { color: labelColor };
  const interactionCoupee = disabled;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={interactionCoupee ? undefined : onPress}
        onPressIn={interactionCoupee ? undefined : onPressIn}
        onPressOut={interactionCoupee ? undefined : onPressOut}
        disabled={interactionCoupee}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: interactionCoupee }}
        style={[styles.base, backgroundStyle]}
      >
        <Text style={[styles.label, labelColorStyle]} maxFontSizeMultiplier={PLAFOND_TITRE}>
          {label}
        </Text>
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-forward" size={22} color={labelColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: da.radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    ...da.typography.button,
    flex: 1,
    textAlign: "left",
  },
  iconWrap: {
    minWidth: TOUCHE_MIN - 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});

export default React.memo(HomePrimaryCTAInner);
