// components/coach/CoachSkeleton.tsx
//
// Squelettes de chargement de l'espace coach.
//
// POURQUOI un squelette plutôt qu'un spinner.
// Un spinner ne dit pas ce qui arrive. Un squelette qui a la forme de la liste
// d'effectif annonce "une liste de joueurs va s'afficher ici" : l'œil se place
// avant même que les données arrivent, et l'écran ne saute pas au moment du
// remplissage.
//
// POURQUOI l'animation est aussi discrète.
// Une pulsation trop marquée transforme un écran de chargement en écran qui
// clignote — inconfortable, et franchement pénible pour qui est sensible au
// mouvement. On reste sur une respiration lente entre 0,45 et 1 d'opacité, et
// on la COUPE totalement quand "Réduire les animations" est actif (réglage
// système d'accessibilité, même garde-fou que `useHaptics`).
//
// Composant purement présentationnel.

import React from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { coachColors, coachLayout, coachRadius, coachSpacing } from "./coachTheme";

/** Opacité figée quand l'utilisateur a demandé moins de mouvement. */
const STATIC_OPACITY = 0.7;

function useSkeletonOpacity(): Animated.AnimatedInterpolation<number> | number {
  // `useState` avec initialiseur paresseux plutôt qu'un `useRef` : la valeur
  // animée est créée une seule fois ET reste lisible pendant le rendu (un ref
  // ne doit pas être lu pendant le rendu, cf. règle eslint react-hooks/refs).
  const [progress] = React.useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  React.useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  if (reduceMotion) return STATIC_OPACITY;
  return progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
}

type CoachSkeletonProps = {
  /** `list` = lignes d'effectif ; `card` = fiche joueur / bloc de section. */
  variant?: "list" | "card";
  /** Nombre de lignes du squelette de liste. */
  rows?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachSkeleton({
  variant = "list",
  rows = 4,
  style,
  testID,
}: CoachSkeletonProps) {
  const opacity = useSkeletonOpacity();
  const count = Math.max(1, Math.min(rows, 12));

  return (
    // Une seule annonce pour tout le bloc : un lecteur d'écran n'a aucun intérêt
    // à parcourir douze rectangles gris.
    <View accessible accessibilityLabel="Chargement en cours" style={style} testID={testID}>
      <Animated.View style={{ opacity }}>
        {variant === "list" ? (
          <View style={styles.list}>
            {Array.from({ length: count }, (_, i) => (
              <View key={i} style={styles.row}>
                <View style={styles.avatar} />
                <View style={styles.rowBody}>
                  <View style={[styles.bar, styles.barName]} />
                  <View style={[styles.bar, styles.barMeta]} />
                </View>
                <View style={styles.pill} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.bar, styles.barTitle]} />
            <View style={[styles.bar, styles.barMeta]} />
            <View style={styles.cardSpacer} />
            <View style={[styles.bar, styles.barFull]} />
            <View style={[styles.bar, styles.barFull]} />
            <View style={[styles.bar, styles.barShort]} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: coachColors.card,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.sm,
    paddingVertical: coachSpacing.sm,
    paddingHorizontal: coachSpacing.md,
    // Même gabarit que CoachPlayerRow : la liste réelle ne fera pas sauter
    // l'écran quand elle remplacera le squelette.
    minHeight: coachLayout.rowMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: coachColors.borderSoft,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: coachRadius.pill,
    backgroundColor: coachColors.cardAlt,
  },
  rowBody: { flex: 1, gap: coachSpacing.xxs + 2 },
  pill: {
    width: 74,
    height: 22,
    borderRadius: coachRadius.pill,
    backgroundColor: coachColors.cardAlt,
  },
  card: {
    backgroundColor: coachColors.card,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
    padding: coachSpacing.md,
    gap: coachSpacing.xs,
  },
  cardSpacer: { height: coachSpacing.xs },
  // `height` est ici volontaire : ces barres ne contiennent AUCUN texte, elles
  // n'ont donc rien à laisser grandir (la règle minHeight vise les blocs de
  // texte, cf. CLAUDE.md règle d'or).
  bar: { height: 11, borderRadius: coachRadius.xs, backgroundColor: coachColors.cardAlt },
  barName: { width: "55%" },
  barMeta: { width: "38%", height: 9 },
  barTitle: { width: "62%", height: 15 },
  barFull: { width: "100%" },
  barShort: { width: "70%" },
});
