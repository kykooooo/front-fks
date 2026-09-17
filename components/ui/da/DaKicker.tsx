// components/ui/da/DaKicker.tsx
// Petit libellé en capitales au-dessus d'un titre (« CETTE SEMAINE »,
// « TA FORME »…). Toujours en couleur secondaire : il ne doit jamais
// concurrencer le titre qu'il annonce.
import React from "react";
import { Text, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";

type DaKickerProps = {
  children: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

function DaKickerBase({ children, style, testID }: DaKickerProps) {
  return (
    <Text
      style={[styles.base, style]}
      maxFontSizeMultiplier={PLAFOND_TEXTE}
      testID={testID}
    >
      {children}
    </Text>
  );
}

export const DaKicker = React.memo(DaKickerBase);

const styles = StyleSheet.create({
  base: {
    ...da.typography.kicker,
    color: da.colors.sub,
  },
});
