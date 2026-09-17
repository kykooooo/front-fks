import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { da, PLAFOND_TEXTE } from "../../constants/daJoueur";
import { DaCard, DaKicker } from "../ui/da";
import { getFootballLabel } from "../../config/trainingDefaults";
import { POINTS_MIN_POUR_COURBE } from "../../hooks/home/useRealLoadData";

type Props = {
  tsb: number;
  tsbHistory: number[];
  /** Prédicat "données réelles de charge" (useRealLoadData) — false = aucun jugement affiché. */
  hasRealLoadData: boolean;
  /** Jours d'activité réels distincts — pilote le seuil d'affichage de la courbe. */
  realActivityDayCount: number;
};

function HomeReadinessHeroInner({
  tsb,
  tsbHistory,
  hasRealLoadData,
  realActivityDayCount,
}: Props) {
  if (__DEV__) console.log("[RENDER] HomeReadinessHero");
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 90;
  const pad = 8;
  const padLeft = 24;
  const padRight = 8;
  const min = -20;
  const max = 20;
  // tsbHistory est CHRONOLOGIQUE (ancien → aujourd'hui) : on garde les 7 derniers
  // points dans cet ordre pour que le dernier point (droite, gros point) = aujourd'hui.
  const history = useMemo(() => {
    if (tsbHistory.length >= 7) return tsbHistory.slice(-7);
    // Garde anti-doublon : rebuildLoad pousse déjà un point decay-to-now égal au
    // tsb courant quand un gap existe — sans elle on dessinerait 2 points superposés.
    const last = tsbHistory[tsbHistory.length - 1];
    if (tsbHistory.length > 0 && last === tsb) return tsbHistory.slice(-7);
    return [...tsbHistory, tsb].slice(-7);
  }, [tsbHistory, tsb]);

  const toY = (value: number) => {
    const clamped = Math.max(min, Math.min(max, value));
    const ratio = (clamped - min) / (max - min);
    return pad + (1 - ratio) * (chartHeight - pad * 2);
  };

  const points = useMemo(() => {
    if (!chartWidth || history.length < 2) return [];
    const innerWidth = Math.max(10, chartWidth - padLeft - padRight);
    const step = innerWidth / (history.length - 1);
    return history.map((v, i) => ({
      x: padLeft + i * step,
      y: toY(v),
      v,
    }));
  }, [chartWidth, history]);

  const path = useMemo(() => {
    if (!points.length) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }, [points]);

  // Use football labels for player-friendly display
  const football = getFootballLabel(tsb);
  const lineColor = football.color;
  // Valeurs réellement dynamiques : construites hors du littéral JSX (même
  // motif que DaCard/DaPrimaryButton) pour ne pas déclencher
  // react-native/no-inline-styles.
  const dotColorStyle = { backgroundColor: football.color };
  const refZeroPositionStyle = { top: toY(0) - 8 };
  const refDixPositionStyle = { top: toY(-10) - 8 };

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== chartWidth) setChartWidth(w);
  };

  // H1 — état vide honnête : aucune donnée réelle de charge, donc aucun jugement
  // ("En forme" sur les constantes d'amorçage était un mensonge). Même carte,
  // même kicker ; textes validés par le fondateur (prototype VNext) ; pas de
  // pastille (c'est un jugement), pas de courbe, pas de repères.
  if (!hasRealLoadData) {
    return (
      <DaCard style={styles.carte}>
        <View style={styles.headerRow}>
          <View style={styles.headerTexte}>
            <DaKicker>TA FORME</DaKicker>
            <Text style={styles.title} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
              Ta tendance se construit
            </Text>
            <Text style={styles.sub} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={3}>
              Termine quelques séances et partage ton ressenti pour obtenir un repère plus utile.
            </Text>
          </View>
        </View>
      </DaCard>
    );
  }

  return (
    <DaCard style={styles.carte}>
      <View style={styles.headerRow}>
        <View style={styles.headerTexte}>
          <DaKicker>TA FORME</DaKicker>
          <Text style={styles.title} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
            {football.label}
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
            {football.message}
          </Text>
        </View>
        {/* Couleur d'état conservée UNIQUEMENT ici et sur la courbe : c'est son sens
            (SPEC_DA_ACCUEIL_SEANCE.md §2.7), pas un badge décoratif. */}
        <View style={styles.valuePill}>
          <View style={[styles.statusDot, dotColorStyle]} />
        </View>
      </View>

      {realActivityDayCount < POINTS_MIN_POUR_COURBE ? (
        // H2 — pas encore assez de jours réels pour tracer une tendance (deux
        // points font un segment, pas une tendance). Même chartWrap (minHeight 90)
        // pour la stabilité du gabarit ; texte validé, pas de repères 0/-10.
        <View style={styles.chartWrap}>
          <Text style={styles.sub} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={3}>
            Termine quelques séances et partage ton ressenti pour obtenir un repère plus utile.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.chartWrap} onLayout={handleLayout}>
            <Svg width={chartWidth} height={chartHeight}>
              {/* Optimal zone band (-5 to +5) */}
              <Line x1={padLeft} y1={toY(5)} x2={chartWidth - padRight} y2={toY(5)} stroke="rgba(34, 197, 94, 0.2)" strokeWidth={1} strokeDasharray="4,4" />
              <Line x1={padLeft} y1={toY(-5)} x2={chartWidth - padRight} y2={toY(-5)} stroke="rgba(34, 197, 94, 0.2)" strokeWidth={1} strokeDasharray="4,4" />
              {/* Zero line */}
              <Line x1={padLeft} y1={toY(0)} x2={chartWidth - padRight} y2={toY(0)} stroke={da.colors.border} strokeWidth={1} />
              {/* Overreaching threshold */}
              <Line x1={padLeft} y1={toY(-10)} x2={chartWidth - padRight} y2={toY(-10)} stroke="rgba(245, 158, 11, 0.3)" strokeWidth={1} />
              {/* TSB curve */}
              {path ? <Path d={path} stroke={lineColor} strokeWidth={2.6} fill="none" /> : null}
              {points.map((p, idx) => (
                <Circle key={`dot_${idx}`} cx={p.x} cy={p.y} r={idx === points.length - 1 ? 5 : 3} fill={lineColor} />
              ))}
            </Svg>
            <Text style={[styles.refLabel, refZeroPositionStyle]} maxFontSizeMultiplier={PLAFOND_TEXTE}>
              0
            </Text>
            <Text
              style={[styles.refLabel, styles.refLabelWarn, refDixPositionStyle]}
              maxFontSizeMultiplier={PLAFOND_TEXTE}
            >
              -10
            </Text>
          </View>

          <View style={styles.chartLabelRow}>
            {/* Points = jours d'activité calculés par le modèle (pas 7 jours
                calendaires) : "Ta forme sur 7 jours" mentirait. */}
            <Text style={styles.chartLabel} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
              Ta tendance récente
            </Text>
          </View>
        </>
      )}
    </DaCard>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: da.spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTexte: {
    flex: 1,
  },
  title: {
    ...da.typography.section,
    marginTop: da.spacing.xxs,
    color: da.colors.text,
  },
  sub: {
    ...da.typography.secondary,
    marginTop: 4,
    color: da.colors.sub,
  },
  valuePill: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
  },
  chartWrap: {
    marginTop: 6,
    minHeight: 90,
  },
  refLabel: {
    position: "absolute",
    left: 0,
    fontSize: 10,
    color: da.colors.sub,
  },
  refLabelWarn: {
    color: da.colors.warnText,
  },
  chartLabelRow: {
    paddingTop: 2,
  },
  chartLabel: {
    fontSize: 11,
    color: da.colors.sub,
    fontWeight: "600",
  },
});

export default React.memo(HomeReadinessHeroInner);
