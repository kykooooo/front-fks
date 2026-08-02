// components/coach/CoachScreen.tsx
//
// Enveloppe d'écran de l'espace coach. C'est le SEUL endroit où la largeur du
// contenu se décide.
//
// POURQUOI ce composant existe.
//  1. Règle d'or (CLAUDE.md #11) : la safe area est gérée par <Screen> et par
//     lui seul. On l'enveloppe, on ne le contourne pas — donc aucun
//     <SafeAreaView edges={...}>, aucun paddingTop magique, aucune <StatusBar>
//     locale dans les écrans coach.
//  2. L'espace coach n'avait AUCUNE largeur maximale. Sur iPad ou sur le web,
//     une ligne d'effectif s'étirait sur toute la fenêtre : le prénom collé à
//     gauche, le statut à l'extrême droite, et l'œil qui perd la ligne entre
//     les deux. On plafonne le contenu et on le centre.
//  3. Au-delà d'une certaine largeur, une seule colonne étroite au milieu d'un
//     grand écran vide fait pauvre. On ouvre alors une variante deux colonnes
//     (voir `useCoachLayout` / `CoachColumns`).
//
// Composant purement présentationnel : aucune lecture Firestore, aucune logique
// métier (elle vit dans domain/coachView).

import React from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Screen } from "../ui/Screen";
import { coachColors, coachLayout, coachSpacing } from "./coachTheme";

export type CoachLayoutInfo = {
  /** Largeur de fenêtre courante (pt). */
  width: number;
  /** 1 ou 2 : nombre de colonnes lisibles à cette largeur. */
  columns: 1 | 2;
  /** Largeur maximale à appliquer au contenu, colonnes comprises. */
  maxContentWidth: number;
  /** `true` sous 340 pt (iPhone SE) : les lignes doivent rester lisibles. */
  narrow: boolean;
};

/**
 * Décrit la place disponible. Un écran coach s'en sert pour choisir entre une
 * pile verticale (téléphone) et deux colonnes (tablette / web large).
 */
export function useCoachLayout(): CoachLayoutInfo {
  const { width } = useWindowDimensions();
  const columns: 1 | 2 = width >= coachLayout.twoColumnMinWidth ? 2 : 1;
  return {
    width,
    columns,
    maxContentWidth:
      columns === 2 ? coachLayout.maxContentWidthWide : coachLayout.maxContentWidth,
    narrow: width < coachLayout.narrowWidth,
  };
}

type CoachScreenProps = {
  children: React.ReactNode;
  /**
   * Contenu COLLÉ en haut, hors de la zone scrollable : titre d'écran, onglets,
   * bandeau de contexte. Il reçoit la même largeur maximale que le contenu, pour
   * que le titre reste aligné sur la première ligne de la liste.
   */
  header?: React.ReactNode;
  /** `false` : l'écran fournit lui-même sa liste (FlatList/SectionList). */
  scroll?: boolean;
  /** Pull-to-refresh. Ignoré si `scroll` vaut `false`. */
  refreshControl?: ScrollViewProps["refreshControl"];
  /** Props additionnelles du ScrollView interne (onScroll, etc.). */
  scrollProps?: ScrollViewProps;
  /**
   * `true` : l'écran sait exploiter deux colonnes (il utilise `CoachColumns`).
   * Sur grand écran il gagne alors la largeur élargie ; sinon il reste sur la
   * largeur de lecture confortable, même sur un écran immense.
   */
  wide?: boolean;
  /** Style du conteneur extérieur (rarement utile). */
  style?: StyleProp<ViewStyle>;
  /** Style du contenu scrollable (padding de l'écran). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachScreen({
  children,
  header,
  scroll = true,
  refreshControl,
  scrollProps,
  wide = false,
  style,
  contentContainerStyle,
  testID,
}: CoachScreenProps) {
  const layout = useCoachLayout();
  // Un écran qui ne sait pas gérer deux colonnes ne doit pas s'élargir pour
  // autant : on lui laisse la largeur de lecture, centrée.
  const maxWidth = wide ? layout.maxContentWidth : coachLayout.maxContentWidth;
  const centered: ViewStyle = { maxWidth };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      {...scrollProps}
    >
      <View style={[styles.centered, centered]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.centered, centered]}>{children}</View>
  );

  return (
    // <Screen> ne prend pas de testID : on le pose sur le conteneur interne,
    // qui est de toute façon la racine visible de l'écran coach.
    <Screen style={[styles.screen, style]}>
      <View style={styles.flex} testID={testID}>
        {header ? (
          <View style={styles.headerBand}>
            <View style={[styles.centered, centered]}>{header}</View>
          </View>
        ) : null}
        {body}
      </View>
    </Screen>
  );
}

type CoachColumnsProps = {
  /** Colonne principale (liste, contenu dense). */
  primary: React.ReactNode;
  /** Colonne secondaire (résumé, signaux). Passe SOUS la principale en 1 colonne. */
  secondary: React.ReactNode;
  /** Écart entre les colonnes. */
  gap?: number;
};

/**
 * Deux colonnes au-delà de `coachLayout.twoColumnMinWidth`, une pile verticale
 * en dessous. Aucune media query CSS en React Native : on lit la largeur réelle.
 * L'ordre de la pile (principale puis secondaire) est aussi l'ordre de lecture
 * d'un lecteur d'écran — on ne le déplace jamais pour des raisons visuelles.
 */
export function CoachColumns({ primary, secondary, gap = coachSpacing.md }: CoachColumnsProps) {
  const { columns } = useCoachLayout();

  if (columns === 1) {
    return (
      <View style={{ gap }}>
        <View>{primary}</View>
        <View>{secondary}</View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { gap }]}>
      <View style={styles.colPrimary}>{primary}</View>
      <View style={styles.colSecondary}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond clair coach : <Screen> pose par défaut le fond sombre du thème joueur.
  screen: { backgroundColor: coachColors.bg },
  flex: { flex: 1 },
  // `alignSelf: center` + `width: 100%` + `maxWidth` = colonne centrée qui ne
  // dépasse jamais, et qui occupe tout l'espace sur téléphone.
  centered: { width: "100%", alignSelf: "center" },
  scrollContent: { flexGrow: 1, paddingBottom: coachSpacing.xxl },
  headerBand: {
    backgroundColor: coachColors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: coachColors.border,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  // 3/5 – 2/5 : la colonne dense reste dominante, la secondaire reste lisible.
  colPrimary: { flex: 3 },
  colSecondary: { flex: 2 },
});
