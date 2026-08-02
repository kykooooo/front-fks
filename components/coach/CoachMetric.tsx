// components/coach/CoachMetric.tsx
//
// Un chiffre, son libellé, son icône.
//
// LA DISTINCTION STRUCTURANTE : zéro n'est PAS "indisponible".
//   - `value = 0`    -> "0 séance terminée cette semaine". C'est une MESURE,
//                       elle vaut zéro, et c'est souvent l'information la plus
//                       utile de l'écran. On l'atténue visuellement (rien à
//                       célébrer) mais on l'affiche en toutes lettres.
//   - `value = null` -> on ne SAIT PAS. Affiché "—", avec la mention "Donnée
//                       absente" pour qu'aucun coach ne lise un zéro.
// Confondre les deux, c'est faire croire à un entraîneur que son joueur n'a
// rien fait alors qu'on n'a simplement pas reçu la donnée. Cette distinction ne
// doit jamais se perdre, ni ici ni chez l'appelant.
//
// Composant purement présentationnel.

import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  COACH_VALUE_UNAVAILABLE,
  coachColors,
  coachRadius,
  coachSpacing,
  coachType,
  type CoachIconName,
} from "./coachTheme";

type CoachMetricProps = {
  /** Libellé du chiffre, au singulier ou déjà accordé par l'appelant. */
  label: string;
  /** Valeur mesurée. `null` = donnée indisponible (≠ zéro). */
  value: number | null;
  icon: CoachIconName;
  /** Unité collée au chiffre (ex. "min", "%"). Masquée si la valeur est absente. */
  unit?: string | null;
  /** Précision courte sous le libellé (ex. "sur les 7 derniers jours"). */
  hint?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const UNAVAILABLE_NOTE = "Donnée absente";

export function CoachMetric({
  label,
  value,
  icon,
  unit,
  hint,
  style,
  testID,
}: CoachMetricProps) {
  const unavailable = value === null;
  const isZero = value === 0;
  // Trois intensités visuelles : mesure > 0 (forte), mesure = 0 (atténuée),
  // pas de mesure (grisée + mention explicite).
  const valueColor = unavailable
    ? coachColors.muted
    : isZero
      ? coachColors.sub
      : coachColors.text;
  const iconColor = unavailable || isZero ? coachColors.muted : coachColors.accent;
  const hintText = (hint ?? "").trim();

  // Le lecteur d'écran ne doit surtout pas entendre "tiret" : on lui dit
  // explicitement que la donnée est indisponible.
  const a11yLabel = unavailable
    ? `${label} : donnée indisponible`
    : `${label} : ${value}${unit ? ` ${unit}` : ""}`;

  return (
    <View
      style={[styles.wrap, style]}
      accessible
      accessibilityLabel={hintText ? `${a11yLabel}. ${hintText}` : a11yLabel}
      testID={testID}
    >
      <View style={[styles.iconBox, unavailable && styles.iconBoxMuted]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>

      <View style={styles.body}>
        <View style={styles.valueLine}>
          <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
            {unavailable ? COACH_VALUE_UNAVAILABLE : String(value)}
          </Text>
          {!unavailable && unit ? (
            <Text style={styles.unit} numberOfLines={1}>
              {unit}
            </Text>
          ) : null}
        </View>

        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>

        {unavailable ? (
          <Text style={styles.note} numberOfLines={1}>
            {UNAVAILABLE_NOTE}
          </Text>
        ) : hintText ? (
          // 4 lignes, pas 2. MESURÉ à la capture sur un cadre de 375 pt : une
          // tuile occupe une demi-largeur, soit ~21 caractères par ligne. À
          // 2 lignes, la précision se faisait couper EN PLEIN MILIEU — « Profils
          // sans séance terminée depuis 10 jou… », c'est-à-dire précisément le
          // nombre de jours qui justifie le chiffre affiché. Une précision
          // tronquée est pire qu'absente : le coach lit une phrase qui commence
          // à expliquer et s'arrête. 4 lignes couvrent les libellés existants
          // (le plus long fait 71 caractères) sans rendre la tuile démesurée.
          <Text style={styles.note} numberOfLines={4}>
            {hintText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 118,
    gap: coachSpacing.xs,
    padding: coachSpacing.sm,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: coachRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: coachColors.accentSoft,
  },
  iconBoxMuted: { backgroundColor: coachColors.neutralSoft },
  body: { gap: 1 },
  valueLine: { flexDirection: "row", alignItems: "baseline", gap: coachSpacing.xxs },
  value: {
    fontSize: coachType.titreEcran.fontSize,
    lineHeight: coachType.titreEcran.lineHeight,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.sub,
  },
  label: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  note: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    color: coachColors.muted,
  },
});
