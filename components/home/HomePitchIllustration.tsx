// components/home/HomePitchIllustration.tsx
// Illustration DÉCORATIVE de la carte « prochaine séance » (SPEC_DA_ACCUEIL_
// SEANCE.md §2.3, redessinée en finition F1 17/09/2026 : le premier tracé —
// un rond posé sur un rectangle + 3 points — se lisait comme un visage, pas
// comme un terrain). Lignes de terrain en perspective (touches, ligne de
// but, surfaces, ligne médiane, rond central) + 4 plots disposés
// irrégulièrement. Rien qui ressemble à une consigne d'exercice (pas de
// flèche de course, pas de trajectoire, pas de bonhomme) — elle ne
// concurrence jamais le bouton principal en dessous.
import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

import { da } from "../../constants/daJoueur";

// Trait de terrain, commun à toutes les lignes/formes du tracé.
const TRAIT_COULEUR = da.colors.sub;
const TRAIT_OPACITE = 0.3;
const TRAIT_EPAISSEUR = 1.25;

/** Un plot = petit triangle plein (pas un rond, pour ne jamais lire "ballon"). */
function Plot({ x, y }: { x: number; y: number }) {
  return (
    <Path
      d={`M${x} ${y - 7} L${x + 5} ${y + 4} L${x - 5} ${y + 4} Z`}
      fill={da.colors.action}
    />
  );
}

function HomePitchIllustrationInner() {
  const { width, height, fontScale } = useWindowDimensions();

  // Masquée quand le texte est très agrandi (elle perdrait tout son sens à
  // côté d'un titre/bouton qui a doublé de hauteur) ou sur un petit écran en
  // hauteur (elle ferait défiler le bouton principal hors de vue).
  if (fontScale >= 1.3 || height < 640) return null;

  const hauteur = width < 360 ? 84 : 112;
  const conteneurStyle = { height: hauteur };

  return (
    <View
      style={[styles.enveloppe, conteneurStyle]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice">
        {/* Touches (lignes de côté, en perspective) */}
        <Path
          d="M70 0 L-10 112"
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        <Path
          d="M250 0 L330 112"
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        {/* Ligne de but */}
        <Path
          d="M64 8 L256 8"
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        {/* Surface de réparation */}
        <Path
          d="M120 8 L108 40 L212 40 L200 8"
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        {/* Surface de but */}
        <Path
          d="M140 8 L136 22 L184 22 L180 8"
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        {/* Ligne médiane */}
        <Line
          x1={4}
          y1={92}
          x2={316}
          y2={92}
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
        />
        {/* Rond central — coupé en bas par le cadre (overflow hidden), voulu */}
        <Ellipse
          cx={160}
          cy={92}
          rx={56}
          ry={18}
          stroke={TRAIT_COULEUR}
          strokeOpacity={TRAIT_OPACITE}
          strokeWidth={TRAIT_EPAISSEUR}
          fill="none"
        />
        <Circle cx={160} cy={92} r={2} fill={TRAIT_COULEUR} fillOpacity={TRAIT_OPACITE} />

        {/* 4 plots, disposition volontairement irrégulière (jamais un parcours) */}
        <Plot x={78} y={56} />
        <Plot x={132} y={72} />
        <Plot x={204} y={60} />
        <Plot x={246} y={80} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  enveloppe: {
    borderRadius: 12,
    backgroundColor: da.colors.bg,
    overflow: "hidden",
  },
});

export default React.memo(HomePitchIllustrationInner);
