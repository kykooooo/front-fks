// components/homeVNext/HomeVNextSparkline.tsx
// =============================================================================
// LA COURBE DE TENDANCE
// =============================================================================
//
// Ce que l'audit reproche a la courbe actuelle, et qui est corrige ici :
//
//   - LES REPERES BRUTS "0" ET "-10" (P2.7). Ils exposent l'echelle interne du
//     modele de charge a un joueur a qui on a promis de ne jamais montrer de
//     jargon. Ici : aucun chiffre, aucun axe, aucune graduation. La courbe ne
//     sert qu'a montrer une TRAJECTOIRE.
//   - LA CARTE DE 232 PX DONT 110 DE BLANC. Ici le trace fait 52 px de haut, et
//     la carte s'arrete juste apres sa legende.
//   - LES POINTS FABRIQUES. Le ViewModel ne fournit `points` que lorsque les
//     deux seuils sont franchis ; ce composant ne complete jamais une serie
//     courte et ne pose jamais un point a zero pour un jour sans donnee.
//
// AUCUNE DEPENDANCE GRAPHIQUE. Pas de `react-native-svg` : le trace est fait de
// `View` pivotees. Une raison de fond — ce prototype doit rendre a l'identique
// dans l'app et dans le visualiseur web, et un segment en `View` est exact
// partout. Chaque segment est place a son MILIEU puis pivote : la rotation se
// fait donc autour du centre, ce qui evite toute dependance a
// `transformOrigin`.
// =============================================================================

import React from "react";
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";

import { MARQUEURS } from "./homeVNextMarqueurs";
import { couleurs, espacement } from "./homeVNextTokens";

const HAUTEUR = 52;
const EPAISSEUR = 2.5;
const POINT = 7;
/** Marge haute et basse pour que le point final ne soit jamais rogne. */
const MARGE_Y = 6;

/**
 * Largeur d'appareil de reference, utilisee UNIQUEMENT en dernier recours (voir
 * la cascade de largeur ci-dessous). 375 px = l'iPhone de reference de l'audit.
 */
const LARGEUR_APPAREIL_REFERENCE = 375;

/** Largeur de trace en dessous de laquelle la courbe n'a plus de sens a lire. */
const LARGEUR_MINIMALE = 160;

export type HomeVNextSparklineProps = {
  /** Points reels, dans l'ordre chronologique. Jamais complete, jamais lisse. */
  points: readonly number[];
  /** Decrit la courbe a la synthese vocale. Fourni par l'appelant. */
  accessibilityLabel: string;
  /**
   * Largeur de trace imposee, en pixels.
   *
   * A PASSER par tout environnement qui rend l'ecran en UNE SEULE PASSE, sans
   * cycle de layout (rendu statique en chaine de caracteres, capture serveur).
   * Dans l'app, ne rien passer : `onLayout` fait le travail.
   */
  largeur?: number;
};

export function HomeVNextSparkline({
  points,
  accessibilityLabel,
  largeur: largeurImposee,
}: HomeVNextSparklineProps) {
  const { width: largeurFenetre } = useWindowDimensions();
  const [largeurMesuree, setLargeurMesuree] = React.useState<number | null>(null);

  const surLayout = React.useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setLargeurMesuree((prev) => (prev !== null && Math.abs(prev - w) < 1 ? prev : w));
  }, []);

  // -------------------------------------------------------------------------
  // CASCADE DE LARGEUR — trois sources, dans cet ordre.
  //
  // Ce trace a besoin d'une largeur en PIXELS : la longueur d'un segment
  // oblique est une hypotenuse, elle ne s'exprime pas en pourcentage.
  //
  //   1. `largeur` imposee par l'appelant — la seule qui marche dans un rendu
  //      en une passe.
  //   2. `onLayout` — la verite dans l'app et dans un navigateur reel.
  //   3. la fenetre, moins les marges d'ecran et de carte.
  //
  // Si les trois echouent (fenetre a 0, ce qui arrive en rendu serveur), on
  // retombe sur la largeur utile d'un appareil de reference plutot que sur une
  // courbe rabougrie. MESURE : sans ce repli, un rendu statique produisait un
  // trace de 120 px dans une carte de 311 px.
  // -------------------------------------------------------------------------
  const largeurDepuisFenetre =
    largeurFenetre - 2 * espacement.ecranX - 2 * espacement.carte;
  const largeurUtileDefaut =
    LARGEUR_APPAREIL_REFERENCE - 2 * espacement.ecranX - 2 * espacement.carte;

  const candidat =
    largeurImposee ??
    (largeurMesuree !== null && largeurMesuree > 0 ? largeurMesuree : largeurDepuisFenetre);

  const largeur = candidat >= LARGEUR_MINIMALE ? candidat : largeurUtileDefaut;

  const segments = React.useMemo(() => calculerSegments(points, largeur), [points, largeur]);
  const dernier = segments.length > 0 ? segments[segments.length - 1] : null;

  return (
    <View
      style={styles.cadre}
      onLayout={surLayout}
      accessible
      accessibilityLabel={accessibilityLabel}
      // Marqueur verifie automatiquement : aucune courbe ne doit exister sur un
      // etat a donnees insuffisantes.
      testID={MARQUEURS.courbe}
    >
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {segments.map((s, i) => (
          <View
            key={i}
            style={[
              styles.trait,
              {
                left: s.gauche,
                top: s.haut,
                width: s.longueur,
                transform: [{ rotate: `${s.angle}rad` }],
              },
            ]}
          />
        ))}
        {dernier ? (
          // Le seul repere de la courbe : ou tu en es aujourd'hui. Sans chiffre.
          <View
            style={[
              styles.pointFinal,
              { left: dernier.xFin - POINT / 2, top: dernier.yFin - POINT / 2 },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------

type Segment = {
  gauche: number;
  haut: number;
  longueur: number;
  angle: number;
  xFin: number;
  yFin: number;
};

/**
 * Convertit une serie de valeurs en segments positionnes.
 *
 * L'echelle est relative a la serie elle-meme (min -> max) : aucune constante
 * du modele de charge n'entre ici, et donc aucune valeur d'amorcage ne peut
 * s'inviter dans le dessin. Serie parfaitement plate : tout est place a
 * mi-hauteur plutot que de diviser par zero.
 */
function calculerSegments(points: readonly number[], largeur: number): Segment[] {
  if (points.length < 2 || largeur <= 0) return [];

  const min = Math.min(...points);
  const max = Math.max(...points);
  const etendue = max - min;
  const utile = HAUTEUR - 2 * MARGE_Y;

  const y = (v: number) =>
    etendue === 0 ? MARGE_Y + utile / 2 : MARGE_Y + utile * (1 - (v - min) / etendue);

  const pas = (largeur - POINT) / (points.length - 1);
  const x = (i: number) => POINT / 2 + i * pas;

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = x(i);
    const y1 = y(points[i] as number);
    const x2 = x(i + 1);
    const y2 = y(points[i + 1] as number);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const longueur = Math.sqrt(dx * dx + dy * dy);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    segments.push({
      gauche: cx - longueur / 2,
      haut: cy - EPAISSEUR / 2,
      longueur,
      angle: Math.atan2(dy, dx),
      xFin: x2,
      yFin: y2,
    });
  }
  return segments;
}

const styles = StyleSheet.create({
  cadre: {
    // `height` et non `minHeight` : la regle "minHeight jamais height" protege
    // les blocs de TEXTE, qui doivent pouvoir grandir. Un cadre de dessin, lui,
    // a une hauteur intrinseque dont depend le calcul des segments. Aucun texte
    // ne vit ici.
    height: HAUTEUR,
    width: "100%",
  },
  trait: {
    position: "absolute",
    height: EPAISSEUR,
    borderRadius: EPAISSEUR / 2,
    backgroundColor: couleurs.lien,
  },
  pointFinal: {
    position: "absolute",
    width: POINT,
    height: POINT,
    borderRadius: POINT / 2,
    backgroundColor: couleurs.lien,
  },
});
