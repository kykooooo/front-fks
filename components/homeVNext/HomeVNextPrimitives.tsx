// components/homeVNext/HomeVNextPrimitives.tsx
// =============================================================================
// PROTOTYPE Home vNext — BRIQUES PARTAGEES
// =============================================================================
//
// Trois regles gouvernent ce fichier :
//
//  1. AUCUNE POLICE D'ICONE. Le chevron et la coche sont dessines avec des
//     `View` et des bordures. Raison : le prototype doit rendre a l'identique
//     dans l'app ET dans le visualiseur web. Le harnais de l'audit rendait les
//     Ionicons en carres gris ; un chevron en bordure, lui, est exact partout.
//
//  2. TOUT ELEMENT TACTILE A UN ROLE. `components/ui/Button` ne transmet PAS
//     `accessibilityRole` a son `Pressable` (verifie ligne a ligne dans
//     `components/ui/Button.tsx`) : un lien construit dessus est annonce comme
//     du texte inerte par VoiceOver. C'est exactement la classe de defaut que
//     l'audit reproche au Home (zero propriete d'accessibilite). D'ou
//     `HomeVNextLink` ci-dessous, qui pose `accessibilityRole="link"` et le
//     plancher tactile de 44 pt.
//
//  3. AUCUN HAPTIC ICI. La convention du projet est `useHaptics()` et rien
//     d'autre ; or ce hook importe `expo-haptics` et `state/settingsStore`
//     (donc AsyncStorage). Un prototype qui doit se rendre hors de l'app ne
//     peut pas embarquer ca. Le retour haptique se rebranchera au moment de la
//     reprise en production, dans les callbacks passes en props.
// =============================================================================

import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { couleurs, espacement, rayons, typo, TAILLE_TACTILE_MIN } from "./homeVNextTokens";

// -----------------------------------------------------------------------------
// Chevron — dessine, jamais une police
// -----------------------------------------------------------------------------

type ChevronProps = {
  /** Cote du carre avant rotation. Le chevron visible fait environ `size` de haut. */
  size?: number;
  color: string;
  thickness?: number;
};

/** Chevron ">" : un carre dont on ne garde que deux bordures, pivote de 45 degres. */
export function Chevron({ size = 8, color, thickness = 2 }: ChevronProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderTopWidth: thickness,
        borderRightWidth: thickness,
        borderColor: color,
        transform: [{ rotate: "45deg" }],
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// Coche — pastille de confirmation de l'accuse de reception
// -----------------------------------------------------------------------------

type CocheProps = { color: string; background: string };

/**
 * Coche dans une pastille. Volontairement sobre : pas de degrade, pas de
 * bordure, pas de "couture" — l'audit reproche au Home actuel un disque
 * decoratif dont l'assemblage se voit.
 */
export function Coche({ color, background }: CocheProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cocheDisque, { backgroundColor: background }]}
    >
      <View style={[styles.cocheTrait, { borderColor: color }]} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Filet — separateur d'un cheveu
// -----------------------------------------------------------------------------

export function Filet({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.filet, style]}
    />
  );
}

// -----------------------------------------------------------------------------
// Lien — la seule forme autorisee pour une action secondaire
// -----------------------------------------------------------------------------

type LienProps = {
  label: string;
  onPress?: () => void;
  /** Complete l'annonce vocale : "ouvre le detail de la seance". */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Marqueur stable pour les verifications automatiques. Rendu tel quel par
   * React Native (prop `testID`) et traduit en `data-testid` par
   * react-native-web : le meme marqueur sert donc dans les tests de composant
   * ET dans l'analyse du HTML genere par le harnais.
   */
  testID?: string;
};

/**
 * Lien texte + chevron. Jamais un aplat (doctrine 1 : une action secondaire est
 * visiblement moins forte que l'action principale).
 *
 * Plancher tactile : `minHeight` = 44 pt, garanti par le style, plus un
 * `hitSlop` lateral. L'audit releve 8 zones tactiles sur 8 sous 44 pt sur le
 * Home actuel.
 */
export function HomeVNextLink({ label, onPress, accessibilityHint, style, testID }: LienProps) {
  // `useState` avec initialiseur paresseux plutot que `useRef(...).current` :
  // meme stabilite, mais on ne lit pas un ref pendant le rendu (regle
  // `react-hooks/refs`, que le pattern de `components/ui/Button.tsx` enfreint).
  const [anim] = React.useState(() => new Animated.Value(0));

  const enfoncer = () =>
    Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  const relacher = () =>
    Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }).start();

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={enfoncer}
      onPressOut={relacher}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
      testID={testID}
      style={[styles.lien, style]}
    >
      <Animated.View style={[styles.lienContenu, { opacity }]}>
        <Text style={styles.lienTexte} numberOfLines={1}>
          {label}
        </Text>
        <Chevron color={couleurs.lien} size={7} thickness={1.8} />
      </Animated.View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Carte de section — UNE seule convention de titrage pour tout l'ecran
// -----------------------------------------------------------------------------

type CarteSectionProps = {
  /** Titre en capitales. Rendu par `components/ui/SectionHeader`. */
  titre: string;
  /** Legende alignee a droite du titre (ex : "7 derniers jours"). */
  legende?: string | null;
  children: React.ReactNode;
};

/**
 * L'audit releve 4 conventions de titrage differentes pour 4 blocs qui se
 * suivent. Ici il n'y en a qu'une : capitales + marque bleue, via le
 * `SectionHeader` du socle, strictement identique d'une section a l'autre.
 */
export function CarteSection({ titre, legende, children }: CarteSectionProps) {
  return (
    <Card variant="surface" style={styles.carte}>
      <SectionHeader
        title={titre}
        right={
          legende ? (
            <Text style={styles.legende} numberOfLines={1}>
              {legende}
            </Text>
          ) : null
        }
      />
      <View style={styles.carteContenu}>{children}</View>
    </Card>
  );
}

// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  cocheDisque: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cocheTrait: {
    // Un "L" pivote de 45 degres : c'est toute la coche. `marginTop` negatif
    // pour la recentrer optiquement dans son disque apres rotation.
    width: 11,
    height: 6,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: "-45deg" }],
    marginTop: -3,
  },
  filet: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: couleurs.bordure,
  },
  lien: {
    // Plancher tactile. `minHeight`, jamais `height` : le bloc doit pouvoir
    // grandir si le systeme agrandit le texte.
    minHeight: TAILLE_TACTILE_MIN,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  lienContenu: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacement.serre,
  },
  lienTexte: {
    ...typo.body,
    color: couleurs.lien,
    flexShrink: 1,
  },
  carte: {
    borderRadius: rayons.carte,
    padding: espacement.carte,
  },
  carteContenu: {
    marginTop: espacement.interne,
  },
  legende: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
  },
});
