// components/coach/CoachStateBlock.tsx
//
// Brique commune aux écrans vides et aux écrans d'erreur : icône, titre,
// explication, et AU PLUS une action.
//
// POURQUOI une seule action.
// Un écran vide ou en erreur est déjà un moment de doute ("est-ce que l'appli
// est cassée ?"). Deux boutons transforment ce doute en choix à faire. On donne
// donc une seule sortie, celle qui a le plus de chances de servir, et une
// phrase qui explique ce qui se passe — jamais un code technique.
//
// Composant purement présentationnel, interne au design system coach :
// les écrans passent par `CoachEmptyState` / `CoachErrorState`.

import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  statusTone,
  type CoachIconName,
  type CoachStatusLevel,
} from "./coachTheme";

export type CoachStateAction = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
};

export type CoachStateBlockProps = {
  icon: CoachIconName;
  title: string;
  /** Ce qui se passe, en français simple. Pas de code, pas de jargon. */
  body: string;
  /** Ton du bloc d'icône. Défaut `unknown` (neutre : rien n'est cassé). */
  level?: CoachStatusLevel;
  action?: CoachStateAction | null;
  /** Précision technique très discrète (ex. "Dernière tentative à 14:03"). */
  footnote?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachStateBlock({
  icon,
  title,
  body,
  level = "unknown",
  action,
  footnote,
  style,
  testID,
}: CoachStateBlockProps) {
  const tone = statusTone(level);
  const note = (footnote ?? "").trim();

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <View style={[styles.iconDisc, { backgroundColor: tone.fond, borderColor: tone.bordure }]}>
        <Ionicons name={icon} size={26} color={tone.texte} />
      </View>

      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>
      <Text style={styles.body} numberOfLines={6}>
        {body}
      </Text>

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.accessibilityHint}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}

      {note ? (
        <Text style={styles.footnote} numberOfLines={2}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: coachSpacing.xs,
    paddingVertical: coachSpacing.xl,
    paddingHorizontal: coachSpacing.lg,
  },
  iconDisc: {
    width: 56,
    height: 56,
    borderRadius: coachRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: coachSpacing.xxs,
  },
  title: {
    textAlign: "center",
    fontSize: coachType.titreSection.fontSize,
    lineHeight: coachType.titreSection.lineHeight,
    fontWeight: coachType.titreSection.fontWeight,
    color: coachColors.text,
  },
  body: {
    textAlign: "center",
    maxWidth: 420, // au-delà, la ligne devient trop longue pour être lue d'un trait
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    color: coachColors.sub,
  },
  button: {
    marginTop: coachSpacing.sm,
    // Zone tactile pleine (44 pt) : c'est souvent la seule action de l'écran.
    minHeight: coachLayout.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: coachSpacing.lg,
    borderRadius: coachRadius.chip,
    backgroundColor: coachColors.accent,
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: {
    // Blanc sur #2A4D8F = 8,21:1 — AA largement tenu.
    color: "#FFFFFF",
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    textAlign: "center",
  },
  footnote: {
    marginTop: coachSpacing.xs,
    textAlign: "center",
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },
});
