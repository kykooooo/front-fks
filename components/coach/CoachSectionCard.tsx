// components/coach/CoachSectionCard.tsx
//
// Carte de section : titre, sous-titre optionnel, action optionnelle à droite.
// C'est le conteneur standard d'un bloc de l'espace coach (effectif, signaux
// du jour, semaine…). Il n'a AUCUNE opinion sur son contenu.
//
// Deux points de soin :
//  - l'action de droite est un lien tactile réel (>= 44 pt), pas un mot cliquable
//    de 30 pt de haut qu'on rate une fois sur deux avec le pouce ;
//  - `noPadding` existe pour les listes : une ligne d'effectif gère elle-même
//    ses marges et doit pouvoir aller au bord de la carte (surface de touche
//    pleine largeur), sinon la ligne "cliquable" a des angles morts.
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
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  type CoachIconName,
} from "./coachTheme";

type CoachSectionAction = {
  label: string;
  onPress: () => void;
  icon?: CoachIconName;
  /** Décrit l'effet du lien pour un lecteur d'écran. */
  accessibilityHint?: string;
};

type CoachSectionCardProps = {
  title: string;
  /** Précision courte sous le titre (contexte, période, compte). */
  subtitle?: string | null;
  /** Lien discret aligné à droite du titre. */
  action?: CoachSectionAction;
  /** `true` : le contenu gère lui-même ses marges (listes pleine largeur). */
  noPadding?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachSectionCard({
  title,
  subtitle,
  action,
  noPadding = false,
  children,
  style,
  testID,
}: CoachSectionCardProps) {
  const subtitleText = (subtitle ?? "").trim();

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={[styles.header, noPadding && styles.headerPadded]}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitleText ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitleText}
            </Text>
          ) : null}
        </View>

        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.accessibilityHint}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionLabel} numberOfLines={1}>
              {action.label}
            </Text>
            <Ionicons
              name={action.icon ?? "chevron-forward"}
              size={15}
              color={coachColors.accent}
            />
          </Pressable>
        ) : null}
      </View>

      {children ? (
        <View style={noPadding ? undefined : styles.body}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: coachColors.card,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.sm,
    paddingTop: coachSpacing.md,
    paddingHorizontal: coachSpacing.md,
    paddingBottom: coachSpacing.xs,
  },
  // Une carte "liste" a besoin d'un peu plus d'air sous son titre, sinon la
  // première ligne colle au sous-titre.
  headerPadded: { paddingBottom: coachSpacing.sm },
  headerText: { flex: 1, flexShrink: 1, gap: 2 },
  title: {
    fontSize: coachType.titreSection.fontSize,
    lineHeight: coachType.titreSection.lineHeight,
    fontWeight: coachType.titreSection.fontWeight,
    letterSpacing: coachType.titreSection.letterSpacing,
    color: coachColors.text,
  },
  subtitle: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xxs,
    // Zone tactile réelle : 44 pt de haut, marges négatives pour que le lien
    // reste optiquement aligné sur la ligne de titre malgré sa hauteur.
    minHeight: coachLayout.minTouchSize,
    paddingHorizontal: coachSpacing.xs,
    marginRight: -coachSpacing.xs,
    marginTop: -coachSpacing.sm,
    marginBottom: -coachSpacing.sm,
    borderRadius: coachRadius.chip,
    flexShrink: 0,
  },
  actionPressed: { backgroundColor: coachColors.accentSoft },
  actionLabel: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.accent,
  },
  body: {
    paddingHorizontal: coachSpacing.md,
    paddingBottom: coachSpacing.md,
    paddingTop: coachSpacing.xs,
  },
});
