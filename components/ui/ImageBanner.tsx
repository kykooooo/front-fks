// components/ui/ImageBanner.tsx
// Bandeau image pleine largeur avec gradient en bas pour fondre dans le fond.
// Fallback couleur unie si l'image ne charge pas. Zéro crash garanti.

import React, { useState, type ReactNode } from "react";
import {
  View,
  Image,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../constants/theme";

type Props = {
  /** Source image (require() local ou { uri }) */
  source: ImageSourcePropType;
  /** Hauteur du bandeau (défaut 250) */
  height?: number;
  /** Couleur de fond du gradient en bas — doit matcher le fond de l'écran */
  gradientColor?: string;
  /** Couleur de fallback si l'image ne charge pas */
  fallbackColor?: string;
  /** Contenu affiché par-dessus le gradient (titres, badges, etc.) */
  children?: ReactNode;
  /** Border radius (si dans une card) */
  borderRadius?: number;
  /** Style additionnel sur le wrapper */
  style?: StyleProp<ViewStyle>;
};

export function ImageBanner({
  source,
  height = 250,
  gradientColor,
  fallbackColor = theme.colors.card,
  children,
  borderRadius = 0,
  style,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const bgColor = gradientColor ?? theme.colors.background;

  return (
    <View
      style={[
        styles.wrapper,
        { height, borderRadius, backgroundColor: fallbackColor },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Image */}
      {!errored && (
        <Image
          source={source}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          fadeDuration={300}
        />
      )}

      {/* Gradient overlay — toujours affiché pour la lisibilité du texte */}
      <LinearGradient
        colors={["transparent", `${bgColor}CC`, bgColor]}
        locations={[0.2, 0.7, 1]}
        style={[styles.gradient, { borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius }]}
      />

      {/* Léger assombrissement global pour lisibilité */}
      <View style={[styles.tint, { borderRadius }]} />

      {/* Contenu par-dessus */}
      {children ? (
        <View style={styles.content}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black25,
  },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
});
