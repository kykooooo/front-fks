// components/coach/CoachStatusPill.tsx
//
// Pastille de statut : ICÔNE + TEXTE + couleur.
//
// POURQUOI l'icône et le texte sont obligatoires.
// La couleur n'est JAMAIS seule à porter le sens. Un coach daltonien (8 % des
// hommes) ne distingue pas le vert du orange ; en plein soleil, personne ne les
// distingue. Le libellé reste donc toujours écrit, et l'icône donne une
// deuxième lecture à distance. C'est aussi ce qui permet de faire tenir la
// nuance "à surveiller" / "à vérifier" sans passer par un rouge d'alarme.
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
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  statusTone,
  type CoachStatusLevel,
} from "./coachTheme";

type CoachStatusPillProps = {
  level: CoachStatusLevel;
  /**
   * Remplace le libellé standard du niveau (ex. "Séance faite hier" au lieu de
   * "Rien à signaler"). Le niveau, lui, ne change pas : il pilote la couleur,
   * l'icône, et ce que le lecteur d'écran annonce.
   */
  label?: string;
  /** `sm` pour une ligne de liste dense, `md` pour un en-tête de fiche. */
  size?: "sm" | "md";
  /**
   * Libellé COMPLET du statut, quand celui qui s'affiche est volontairement
   * raccourci faute de place — typiquement « Rien à signaler » pour
   * « Rien à signaler parmi les données disponibles » (cf.
   * `domain/coachView/statusLabel`).
   *
   * POURQUOI CETTE PROP EXISTE. La nuance « parmi les données disponibles » ne
   * tient pas dans une pastille posée à côté d'un prénom sur 375 pt : elle se
   * couperait en plein mot. L'appelant affiche donc la phrase entière juste à
   * côté, et la passe ici pour que le LECTEUR D'ÉCRAN l'entende aussi — sinon la
   * nuance existerait pour les voyants seulement, ce qui reviendrait à laisser
   * un utilisateur non voyant sur le constat faux qu'on vient de corriger.
   */
  fullLabel?: string | null;
  /**
   * Rend la pastille actionnable (ex. filtrer l'effectif sur ce statut). La
   * zone tactile est alors portée à 44 pt via `hitSlop` sans grossir le visuel.
   */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachStatusPill({
  level,
  label,
  size = "sm",
  fullLabel,
  onPress,
  style,
  testID,
}: CoachStatusPillProps) {
  const tone = statusTone(level);
  const text = label ?? tone.libelle;
  // Ce que le lecteur d'écran doit entendre comme STATUT : le libellé complet
  // s'il existe, celui du niveau sinon. Jamais une version raccourcie.
  const statutParle = (fullLabel ?? "").trim() || tone.libelle;
  const small = size === "sm";
  const iconSize = small ? 13 : 15;

  const content = (
    <View
      style={[
        styles.pill,
        small ? styles.pillSm : styles.pillMd,
        { backgroundColor: tone.fond, borderColor: tone.bordure },
        style,
      ]}
      testID={testID}
    >
      <Ionicons name={tone.icone} size={iconSize} color={tone.texte} />
      <Text
        style={[small ? styles.labelSm : styles.labelMd, { color: tone.texte }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );

  // Le lecteur d'écran annonce TOUJOURS le niveau canonique, même quand le
  // libellé affiché est personnalisé : sinon "Séance faite hier" ne dit pas
  // s'il faut agir. On lit d'abord le statut, puis la précision.
  // Le libellé personnalisé n'est répété qu'à condition d'APPORTER quelque chose
  // ("3 à vérifier"). Un raccourci du statut lui-même ("Rien à signaler" sous
  // "Rien à signaler parmi les données disponibles") n'est pas réannoncé : le
  // lecteur d'écran entendrait deux fois la même chose, la seconde en moins bien.
  const estRaccourci = Boolean(label) && statutParle.startsWith(label as string);
  const precisionParlee = label && label !== statutParle && !estRaccourci ? label : null;
  const a11yLabel = precisionParlee
    ? `Statut : ${statutParle}. ${precisionParlee}`
    : `Statut : ${statutParle}`;

  if (!onPress) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }

  // hitSlop : la cible tactile atteint 44 pt sans que la pastille grossisse.
  const slop = Math.max(0, Math.round((coachLayout.minTouchSize - (small ? 24 : 30)) / 2));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: coachSpacing.xxs + 1,
    borderWidth: 1,
    borderRadius: coachRadius.pill,
    flexShrink: 1,
  },
  // minHeight (jamais height) : le libellé peut grandir avec la taille de
  // police système, la pastille suit au lieu de rogner le texte.
  pillSm: {
    minHeight: 24,
    paddingVertical: 3,
    paddingHorizontal: coachSpacing.xs,
  },
  pillMd: {
    minHeight: 30,
    paddingVertical: 5,
    paddingHorizontal: coachSpacing.sm,
  },
  labelSm: {
    fontSize: coachType.micro.fontSize + 1, // 12
    lineHeight: coachType.micro.lineHeight + 1,
    fontWeight: "700",
    flexShrink: 1,
  },
  labelMd: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    flexShrink: 1,
  },
});
