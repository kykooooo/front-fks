// components/ui/BrandMark.tsx
// Wordmark "FKS" — traitement unique, partagé par les écrans du parcours
// d'inscription (DA Polish, direction A, lot 0 §1.5). Remplace les 3
// traitements incohérents précédents : Welcome sans marque, Login "FKS"
// 28/900/ls3 centré, Setup "FKS" 20/900/ls2 aligné à gauche — la marque
// n'apparaissait/disparaissait plus jamais deux fois de la même façon.
import React from "react";
import { Text, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { theme } from "../../constants/theme";

type BrandMarkSize = "sm";

type BrandMarkProps = {
  /** Une seule taille pour l'instant (direction A). Réservé pour une future
   * déclinaison "lg" (direction B, cf. doc de direction §3). */
  size?: BrandMarkSize;
  style?: StyleProp<TextStyle>;
};

const SIZE_STYLES: Record<BrandMarkSize, TextStyle> = {
  sm: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 3,
    color: theme.colors.text,
  },
};

export function BrandMark({ size = "sm", style }: BrandMarkProps) {
  return <Text style={[styles.base, SIZE_STYLES[size], style]}>FKS</Text>;
}

const styles = StyleSheet.create({
  base: {
    textAlign: "center",
  },
});
