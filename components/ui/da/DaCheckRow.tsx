// components/ui/da/DaCheckRow.tsx
// Ligne à cocher (matériel, options) : icône facultative, libellé + description,
// case 24×24. Trois signaux jamais réduits à la seule couleur : remplissage,
// coche blanche, et l'état accessible checked/unchecked.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";

type DaCheckRowProps = {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testID?: string;
};

function DaCheckRowBase({
  label,
  description,
  icon,
  checked,
  onToggle,
  disabled = false,
  testID,
}: DaCheckRowProps) {
  const caseStyle = checked ? styles.caseCochee : styles.caseNonCochee;

  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      style={styles.row}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={da.colors.text} />
        </View>
      ) : null}
      <View style={styles.texte}>
        <Text
          style={styles.label}
          maxFontSizeMultiplier={PLAFOND_TEXTE}
          numberOfLines={2}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={styles.description}
            maxFontSizeMultiplier={PLAFOND_TEXTE}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.caseBase, caseStyle]}>
        {checked ? <Ionicons name="checkmark" size={16} color={da.colors.onAction} /> : null}
      </View>
    </Pressable>
  );
}

export const DaCheckRow = React.memo(DaCheckRowBase);

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  texte: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: da.colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: da.colors.sub,
  },
  caseBase: {
    // La case elle-même fait 24×24 (spec) ; la cible tactile de 44 minimum
    // est portée par `row` (minHeight 56, pleine largeur pressable).
    width: 24,
    height: 24,
    borderRadius: da.radius.check,
    alignItems: "center",
    justifyContent: "center",
  },
  caseCochee: {
    backgroundColor: da.colors.action,
    borderWidth: 0,
  },
  caseNonCochee: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: da.colors.controlBorder,
  },
});
