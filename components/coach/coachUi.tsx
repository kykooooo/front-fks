// components/coach/coachUi.tsx
// Design system LOCAL de l'espace coach (DA "outil staff" claire), indépendant
// du thème global (dark) qui sert les écrans joueur. On ne touche jamais
// `theme.colors`. Palette claire premium + badge lisible sur fond clair.

import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

// Drop-in : reprend les MÊMES noms de clés que `theme.colors` utilisés par les
// écrans coach (text/sub/muted/accent/accentSoft/card/border/borderSoft/warn/…),
// mais avec des valeurs claires → bascule l'UI coach en clair sans réécrire les styles.
export const coachColors = {
  bg: "#F6F5F2", // fond application : blanc cassé / gris chaud très léger
  card: "#FFFFFF", // cartes
  cardAlt: "#EFEDE8", // surface secondaire chaude (track segmenté)
  border: "#E7E4DD", // bordures cartes / hairlines (chaud)
  borderSoft: "#ECEAE3",
  text: "#1C2433", // texte principal (fort contraste, légèrement chaud)
  sub: "#5A6275", // texte secondaire (assez foncé pour rester lisible)
  muted: "#8C8F99", // texte tertiaire
  accent: "#2A4D8F", // accent pro : bleu profond non saturé (actions, état actif)
  accentSoft: "#E9EEF6", // remplissage doux bleu
  success: "#2E7D52", // vert terrain (faite / adaptée)
  successSoft: "#E8F1EB",
  warn: "#C2410C", // orange brûlé (à relancer uniquement)
  warnSoft: "#FAEEE5",
  warnFaint: "#FBF6F0", // fond de ligne très léger pour "à relancer"
  danger: "#B3261E",
  dangerSoft: "#F8E9E8",
};

export const coachRadius = { card: 10, chip: 8, pill: 999 };

type CoachBadgeTone = "default" | "ok" | "warn" | "danger" | "info";

const TONES: Record<CoachBadgeTone, { bg: string; border: string; text: string }> = {
  default: { bg: "#F0EEE9", border: "#E2DFD8", text: "#454B5C" },
  ok: { bg: coachColors.successSoft, border: "#C6E1CF", text: coachColors.success },
  warn: { bg: coachColors.warnSoft, border: "#EFD0BA", text: coachColors.warn },
  danger: { bg: coachColors.dangerSoft, border: "#EEC4C2", text: coachColors.danger },
  info: { bg: coachColors.accentSoft, border: "#CBD8EC", text: coachColors.accent },
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
      <Text style={[styles.badgeText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
