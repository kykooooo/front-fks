// components/ui/PitchDecoration.tsx
// Éléments décoratifs de terrain en SVG stroke.
// Lignes, arcs et cercles inspirés des marquages de terrain de football.

import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { theme } from "../../constants/theme";

/* ─── Types ─── */
export type PitchDecorationType = "centerCircle" | "cornerArc" | "halfwayLine";

type Props = {
  type: PitchDecorationType;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/* ─── Composant ─── */
function PitchDecorationInner({
  type,
  width = 60,
  height = 60,
  color,
  opacity = 0.15,
  style,
}: Props) {
  if (width <= 0 || height <= 0) return null;

  const stroke = color ?? theme.colors.white;

  const content = (() => {
    switch (type) {
      // Cercle central + ligne médiane
      case "centerCircle":
        return (
          <>
            <Circle cx="50" cy="50" r="30" fill="none" stroke={stroke} strokeWidth="1.5" />
            <Line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth="1" />
            <Circle cx="50" cy="50" r="2.5" fill={stroke} />
          </>
        );
      // Quart de cercle (marquage de corner)
      case "cornerArc":
        return (
          <Path
            d="M0 0 L0 30 A30 30 0 0 0 30 0 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
        );
      // Ligne médiane + petit cercle central
      case "halfwayLine":
        return (
          <>
            <Line x1="5" y1="50" x2="95" y2="50" stroke={stroke} strokeWidth="1" strokeDasharray="4 3" />
            <Circle cx="50" cy="50" r="3" fill="none" stroke={stroke} strokeWidth="1" />
          </>
        );
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <View
      style={[{ width, height, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="0 0 100 100">
        {content}
      </Svg>
    </View>
  );
}

export const PitchDecoration = React.memo(PitchDecorationInner);
