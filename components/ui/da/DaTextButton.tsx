// components/ui/da/DaTextButton.tsx
// Action texte orange (« Voir la séance », « Modifier »…) — jamais un second
// bouton plein sur le même écran (SPEC_DA_ACCUEIL_SEANCE.md §1). Cible tactile
// 44 même quand le texte est court (hitSlop).
import React from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TITRE, TOUCHE_MIN } from "../../../constants/daJoueur";

type DaTextButtonProps = {
  label: string;
  onPress: () => void;
  /** Nom d'icône Ionicons affiché à droite du libellé. */
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Ce libellé joue le rôle d'un bouton (cible tactile fixe, jamais de second
// bouton plein sur l'écran) : il suit le même plafond d'agrandissement que
// DaPrimaryButton (1,3) plutôt que celui des textes courants (1,6), pour que
// la ligne de 44 de haut ne déborde pas à l'agrandissement système maximal —
// choix documenté dans le rapport de la mission SOCLE.
function DaTextButtonBase({
  label,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: DaTextButtonProps) {
  const textColor = disabled ? da.colors.disabledText : da.colors.actionText;
  const colorStyle = { color: textColor };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[styles.base, style]}
    >
      <Text style={[styles.label, colorStyle]} maxFontSizeMultiplier={PLAFOND_TITRE}>
        {label}
      </Text>
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
    </Pressable>
  );
}

export const DaTextButton = React.memo(DaTextButtonBase);

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCHE_MIN,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
});
