// components/coach/coachUi.tsx
//
// FAÇADE HISTORIQUE du design system coach.
// Les tokens (couleurs, rayons, espacements, typographie, statuts) ont déménagé
// dans `coachTheme.ts`, qui est désormais la seule source de vérité. Ce fichier
// ne garde que :
//   - un ré-export de `coachColors` / `coachRadius` pour ne RIEN casser dans les
//     écrans qui les importent déjà (`CoachHomeScreen`, `CoachPlayerDetailScreen`,
//     `CoachOnboardingScreen`) ;
//   - `CoachBadge`, la petite pastille générique encore consommée par ces écrans.
//
// Pour tout nouveau code : importer depuis `coachTheme.ts`, et préférer
// `CoachStatusPill` à `CoachBadge` dès qu'il s'agit d'un STATUT (la pastille
// générique n'a pas d'icône, donc la couleur y porte seule le sens).

import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { coachColors, coachRadius, coachType } from "./coachTheme";

export { coachColors, coachRadius };

type CoachBadgeTone = "default" | "ok" | "warn" | "danger" | "info";

// Chaque ton : fond de surface + contour porteur de sens (>= 3:1) + texte AA.
// Les valeurs viennent toutes de `coachTheme` — aucun hexadécimal en dur ici,
// sinon la correction de contraste se reperdrait au premier copier-coller.
const TONES: Record<CoachBadgeTone, { bg: string; border: string; text: string }> = {
  default: {
    bg: coachColors.neutralSoft,
    border: coachColors.neutralBorder,
    text: coachColors.neutralText,
  },
  ok: { bg: coachColors.successSoft, border: coachColors.successBorder, text: coachColors.success },
  warn: { bg: coachColors.warnSoft, border: coachColors.warnBorder, text: coachColors.warn },
  danger: { bg: coachColors.dangerSoft, border: coachColors.dangerBorder, text: coachColors.danger },
  info: { bg: coachColors.accentSoft, border: coachColors.accentBorder, text: coachColors.accent },
};

export function CoachBadge({
  label,
  tone = "default",
  style,
}: {
  label: string;
  tone?: CoachBadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.badgeText, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: coachRadius.xs,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: coachType.legende.fontSize - 1, // 12 : pastille compacte
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
  },
});
