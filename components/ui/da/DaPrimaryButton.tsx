// components/ui/da/DaPrimaryButton.tsx
// Bouton principal pleine largeur de la DA joueur — UNE action dominante par
// écran (SPEC_DA_ACCUEIL_SEANCE.md §1.1/1.2). Libellé aligné à gauche, flèche
// à droite ; l'état chargement remplace la flèche par un indicateur, jamais
// le libellé.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TITRE, TOUCHE_MIN } from "../../../constants/daJoueur";
import { useHaptics } from "../../../hooks/useHaptics";
import { useReduceMotion } from "../../../hooks/useReduceMotion";

type DaPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Flèche `arrow-forward` à droite. Par défaut affichée. */
  arrow?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

function DaPrimaryButtonBase({
  label,
  onPress,
  disabled = false,
  loading = false,
  arrow = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: DaPrimaryButtonProps) {
  // Animated.Value créée une seule fois (jamais `useRef(...).current` lu
  // pendant le rendu — règle react-hooks/refs du chantier).
  const [pressAnim] = useState(() => new Animated.Value(0));
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();

  const onPressIn = () => {
    haptics.impactLight();
    if (reduceMotion) return;
    Animated.timing(pressAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    if (reduceMotion) return;
    Animated.timing(pressAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  };

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });

  // La désactivation visuelle (fond + texte grisés) suit UNIQUEMENT `disabled` :
  // en chargement le bouton garde son fond d'action, seule la flèche devient
  // un indicateur (spec §1.2). L'interaction, elle, est coupée dans les deux cas.
  const backgroundColor = disabled ? da.colors.disabledBg : da.colors.action;
  const labelColor = disabled ? da.colors.disabledText : da.colors.onAction;
  const iconColor = disabled ? da.colors.disabledText : da.colors.onAction;
  const interactionCoupee = disabled || loading;

  // Valeurs réellement dynamiques : construites hors du littéral JSX (même
  // motif que DaCard) pour ne pas déclencher react-native/no-inline-styles.
  const animatedWrapStyle: ViewStyle = { transform: [{ scale }] };
  const backgroundStyle: ViewStyle = { backgroundColor };
  const labelColorStyle = { color: labelColor };

  return (
    <Animated.View style={[style, animatedWrapStyle]}>
      <Pressable
        onPress={interactionCoupee ? undefined : onPress}
        onPressIn={interactionCoupee ? undefined : onPressIn}
        onPressOut={interactionCoupee ? undefined : onPressOut}
        disabled={interactionCoupee}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: interactionCoupee, busy: loading }}
        style={[styles.base, backgroundStyle]}
      >
        <Text
          style={[styles.label, labelColorStyle]}
          maxFontSizeMultiplier={PLAFOND_TITRE}
        >
          {label}
        </Text>
        {loading ? (
          <ActivityIndicator color={da.colors.onAction} size="small" />
        ) : arrow ? (
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-forward" size={22} color={iconColor} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export const DaPrimaryButton = React.memo(DaPrimaryButtonBase);

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
