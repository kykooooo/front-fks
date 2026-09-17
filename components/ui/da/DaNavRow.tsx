// components/ui/da/DaNavRow.tsx
// Ligne de navigation autonome (« Historique des séances », « Mon corps »…) :
// icône, titre + sous-titre, chevron. C'est une carte à elle seule (rayon 16).
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";

type DaNavRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

function DaNavRowBase({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
}: DaNavRowProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={da.colors.text} />
      </View>
      <View style={styles.texte}>
        <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={styles.sousTitre}
            maxFontSizeMultiplier={PLAFOND_TEXTE}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={da.colors.sub} />
    </Pressable>
  );
}

export const DaNavRow = React.memo(DaNavRowBase);

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderRadius: da.radius.tile,
    borderWidth: 1,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  texte: {
    flex: 1,
    gap: 2,
  },
  titre: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: da.colors.text,
  },
  sousTitre: {
    fontSize: 14,
    lineHeight: 20,
    color: da.colors.sub,
  },
});
