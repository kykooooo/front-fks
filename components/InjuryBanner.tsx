// components/InjuryBanner.tsx
//
// Bandeau coach affiché en HAUT de SessionPreview quand la séance générée
// contient un champ `injury_adaptation_explanation` non null (backend).
//
// Règle 2 de INJURY_IA_CHARTER.md :
//   "Pour toute séance générée avec activeInjuries non vide, afficher un
//    bandeau 2-3 lignes max (200 chars max) : 'On ménage ta [zone]
//    aujourd'hui : pas de [catégorie évitée]. On garde [ce qui est conservé].'"
//
// Distinct de `InjuryLegalBanner` (bannière ROUGE juridique affichée sous
// le formulaire de déclaration) : ici c'est un bandeau AMBRE léger, purement
// informatif, non-dismissable mais non-alarmant.
//
// Le texte est imposé par Agent B — on l'affiche tel quel, sans reformulation.

import React from "react";
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../constants/theme";

type Props = {
  /**
   * Texte coach issu du backend (injury_adaptation_explanation).
   * Si null ou chaîne vide, le composant ne rend rien.
   */
  text: string | null | undefined;
  style?: StyleProp<ViewStyle>;
};

export function InjuryBanner({ text, style }: Props) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return null;

  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <Ionicons name="medical-outline" size={16} color={theme.colors.amber} />
      <Text style={styles.text}>{trimmed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.amberSoft08,
    borderWidth: 1,
    borderColor: theme.colors.amberSoft30,
  },
  text: {
    flex: 1,
    color: theme.colors.text,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 18,
    fontWeight: "600",
  },
});
