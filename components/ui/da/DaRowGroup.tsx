// components/ui/da/DaRowGroup.tsx
// Conteneur carte qui regroupe des lignes (DaCheckRow…) avec un séparateur
// FIN entre chaque paire — jamais avant la première ni après la dernière.
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { da } from "../../../constants/daJoueur";

type DaRowGroupProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function DaRowGroupBase({ children, style, testID }: DaRowGroupProps) {
  const items = React.Children.toArray(children);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {items.map((enfant, index) => (
        // Clé indexée : les lignes d'un groupe sont statiques (pas de
        // réordonnancement/ajout dynamique), l'ordre reste stable.
        <React.Fragment key={index}>
          {enfant}
          {index < items.length - 1 ? <View style={styles.separateur} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

export const DaRowGroup = React.memo(DaRowGroupBase);

const styles = StyleSheet.create({
  container: {
    borderRadius: da.radius.tile,
    borderWidth: 1,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    overflow: "hidden",
  },
  separateur: {
    height: 1,
    marginLeft: 16,
    backgroundColor: da.colors.border,
  },
});
