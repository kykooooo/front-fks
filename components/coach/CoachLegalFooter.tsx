// components/coach/CoachLegalFooter.tsx
//
// Accès légal de l'espace coach : mentions légales, confidentialité, suppression
// de compte.
//
// POURQUOI CE COMPOSANT EXISTE.
// Ces trois accès vivaient dans le pied de page de `CoachHomeScreen`, écran qui
// disparaît avec la refonte. Ils ne sont PAS décoratifs : Apple (App Store
// 5.1.1(v)) et Google exigent qu'un compte créé dans l'app puisse être supprimé
// depuis l'app, et le RGPD impose l'accès à la politique de confidentialité. Les
// perdre en route bloquerait la publication. On les remonte donc en pied de
// l'onglet « Semaine » — l'onglet de réglages de fait de l'espace coach (cadre
// du club, code d'invitation), et non un onglet opérationnel comme
// « Aujourd'hui » où ils voleraient de l'attention à la file de lecture.
//
// NAVIGATION SANS HOOK. On passe par `navigationRef` plutôt que par
// `useNavigation()` : le composant reste montable hors d'un conteneur de
// navigation (tests d'écran, prévisualisation), et `navigate` est un no-op
// silencieux tant que le conteneur n'est pas prêt. Un appelant qui veut router
// autrement fournit `onOpen`.

import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { navigationRef } from "../../navigation/navigationRef";
import { useHaptics } from "../../hooks/useHaptics";
import { coachColors, coachLayout, coachSpacing, coachType } from "./coachTheme";

/** Les trois routes partagées avec l'espace joueur (mêmes écrans, même contenu). */
export type CoachLegalRoute = "LegalNotice" | "PrivacyPolicy" | "DeleteAccount";

type Lien = {
  route: CoachLegalRoute;
  libelle: string;
  /** Libellé de lecteur d'écran : il dit ce qui va s'ouvrir, pas juste le mot. */
  a11y: string;
  danger?: boolean;
};

const LIENS: Lien[] = [
  { route: "LegalNotice", libelle: "Mentions légales", a11y: "Ouvrir les mentions légales" },
  {
    route: "PrivacyPolicy",
    libelle: "Confidentialité",
    a11y: "Ouvrir la politique de confidentialité",
  },
  {
    route: "DeleteAccount",
    libelle: "Supprimer mon compte",
    a11y: "Ouvrir la suppression définitive du compte",
    danger: true,
  },
];

export type CoachLegalFooterProps = {
  /** Routage personnalisé. Défaut : `navigationRef.navigate(route)`. */
  onOpen?: (route: CoachLegalRoute) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachLegalFooter({ onOpen, style, testID }: CoachLegalFooterProps) {
  const haptics = useHaptics();

  const ouvrir = (route: CoachLegalRoute) => {
    haptics.impactLight();
    if (onOpen) {
      onOpen(route);
      return;
    }
    // `isReady()` : hors conteneur monté (tests), on ne fait rien plutôt que de
    // lever une exception sous le doigt d'un entraîneur.
    if (navigationRef.isReady()) {
      navigationRef.navigate(route as never);
    }
  };

  return (
    <View style={[styles.wrap, style]} testID={testID ?? "coach-legal-footer"}>
      {LIENS.map((lien, index) => (
        <React.Fragment key={lien.route}>
          {index > 0 ? (
            <Text style={styles.separateur} accessibilityElementsHidden importantForAccessibility="no">
              ·
            </Text>
          ) : null}
          <Pressable
            onPress={() => ouvrir(lien.route)}
            accessibilityRole="button"
            accessibilityLabel={lien.a11y}
            hitSlop={8}
            style={({ pressed }) => [styles.lien, pressed && styles.lienPresse]}
            testID={`coach-legal-${lien.route}`}
          >
            <Text style={[styles.texte, lien.danger && styles.texteDanger]} numberOfLines={1}>
              {lien.libelle}
            </Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: coachSpacing.xs,
    paddingVertical: coachSpacing.sm,
  },
  lien: {
    // Zone tactile pleine hauteur : ces liens sont petits, ils ne doivent
    // jamais se rater (un coach qui ne trouve pas la suppression de compte est
    // un signalement de conformité, pas une gêne).
    minHeight: coachLayout.minTouchSize,
    justifyContent: "center",
    paddingHorizontal: coachSpacing.xxs,
  },
  lienPresse: { opacity: 0.6 },
  texte: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: coachType.legende.fontWeight,
    color: coachColors.sub,
    textDecorationLine: "underline",
  },
  texteDanger: { color: coachColors.danger },
  separateur: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
  },
});
