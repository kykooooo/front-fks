// components/coach/CoachSignalRow.tsx
//
// Un signal d'attention : ce qui se passe, POURQUOI on le dit, et D'OÙ vient
// l'information.
//
// POURQUOI le "pourquoi" est une prop obligatoire.
// Un signal sans explication est un score opaque : le coach le subit au lieu de
// le comprendre, et il finit par ne plus le croire. Une phrase courte en
// français simple ("Aucune séance terminée depuis 9 jours") suffit — et si on
// n'arrive pas à l'écrire, c'est que le signal n'a rien à faire à l'écran.
//
// POURQUOI la provenance est obligatoire aussi.
// "Le joueur a déclaré", "relevé pendant la séance", "règle FKS", "calculé par
// l'app" et "donnée absente" n'engagent pas la même confiance. Une estimation
// ne doit jamais se lire comme une mesure. La mention reste discrète (micro,
// gris) mais elle est toujours là.
//
// PIÈGE DE VOCABULAIRE À NE JAMAIS REFAIRE (pour qui écrit les `title` ici).
// « Adaptée » ne veut PAS dire la même chose selon qui a adapté :
//   - le MOTEUR FKS a allégé la séance  -> provenance `fks`,
//     dire « Séance ajustée par FKS » (jamais « Adaptée » tout court) ;
//   - le JOUEUR a modifié sa séance     -> provenance `execution`,
//     là seulement on emploie « adapté » / « sauté » / « remplacé ».
// Confondre les deux fait croire au coach que son joueur a bricolé la séance
// alors que c'est FKS qui a décidé de l'alléger — ou l'inverse.
//
// Composant purement présentationnel.

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
  coachRadius,
  coachSpacing,
  coachType,
  provenanceTone,
  statusTone,
  type CoachIconName,
  type CoachProvenance,
  type CoachStatusLevel,
} from "./coachTheme";

type CoachSignalRowProps = {
  /** Ce qui se passe, en une ligne. Ex. "Séance ajustée par FKS". */
  title: string;
  /** Pourquoi on l'affiche, en français simple. Une à deux phrases maximum. */
  why: string;
  /** Origine de l'information — jamais implicite. */
  provenance: CoachProvenance;
  /** Niveau : pilote la couleur du bloc d'icône. Défaut `watch`. */
  level?: CoachStatusLevel;
  /** Icône spécifique au signal ; sinon celle du niveau. */
  icon?: CoachIconName;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachSignalRow({
  title,
  why,
  provenance,
  level = "watch",
  icon,
  onPress,
  style,
  testID,
}: CoachSignalRowProps) {
  const tone = statusTone(level);
  const source = provenanceTone(provenance);

  const content = (
    <View style={[styles.row, style]} testID={testID}>
      <View style={[styles.iconBox, { backgroundColor: tone.fond, borderColor: tone.bordure }]}>
        <Ionicons name={icon ?? tone.icone} size={17} color={tone.texte} />
      </View>

      <View style={styles.body}>
        {/* Titre potentiellement issu du serveur -> numberOfLines. */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.why} numberOfLines={3}>
          {why}
        </Text>

        <View style={styles.sourceLine}>
          <Ionicons name={source.icone} size={11} color={coachColors.muted} />
          <Text style={styles.source} numberOfLines={1}>
            {source.libelle}
          </Text>
        </View>
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={coachColors.muted} />
      ) : null}
    </View>
  );

  // Le lecteur d'écran reçoit signal + explication + provenance dans cet ordre :
  // c'est l'ordre dans lequel un humain a besoin de les entendre.
  const a11yLabel = `${tone.libelle}. ${title}. ${why}. Source : ${source.libelle}`;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.sm,
    paddingVertical: coachSpacing.sm,
    paddingHorizontal: coachSpacing.md,
    // minHeight, jamais height : le "pourquoi" peut prendre trois lignes.
    minHeight: 56,
    backgroundColor: coachColors.card,
  },
  pressed: { opacity: 0.6 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, flexShrink: 1, gap: 2 },
  title: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  why: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  sourceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xxs,
    marginTop: 2,
  },
  source: {
    flexShrink: 1,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },
});
