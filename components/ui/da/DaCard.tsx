// components/ui/da/DaCard.tsx
// Carte de base de la DA joueur (Accueil + Création de séance) : fond, bordure
// fine, ombre discrète, coins arrondis. Jamais de carte dans une carte
// (SPEC_DA_ACCUEIL_SEANCE.md §1.1) — un DaCard ne doit pas en contenir un autre.
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { da } from "../../../constants/daJoueur";

type DaCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Remplace le padding par défaut (20). */
  padding?: number;
  testID?: string;
};

function DaCardBase({ children, style, padding, testID }: DaCardProps) {
  // Valeur réellement dynamique (prop de l'appelant) : construite hors du
  // littéral JSX pour ne pas déclencher react-native/no-inline-styles, qui
  // détecte un ObjectExpression même dans un tableau de styles.
  const paddingStyle = padding !== undefined ? { padding } : undefined;

  return (
    <View style={[styles.base, paddingStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

export const DaCard = React.memo(DaCardBase);

const styles = StyleSheet.create({
  base: {
    backgroundColor: da.colors.card,
    borderWidth: 1,
    borderColor: da.colors.border,
    borderRadius: da.radius.card,
    padding: 20,
    ...da.shadow.card,
  },
});
