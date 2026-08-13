import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { theme } from "../../constants/theme";
import { Card } from "../ui/Card";
import { getFootballLabel } from "../../config/trainingDefaults";
import { POINTS_MIN_POUR_COURBE } from "../../hooks/home/useRealLoadData";

const palette = theme.colors;

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
      <Card variant="surface" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>TON ÉTAT</Text>
            <Text style={styles.title}>Ta tendance se construit</Text>
            <Text style={styles.sub}>
              Termine quelques séances et partage ton ressenti pour obtenir un repère plus utile.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card variant="surface" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>TON ÉTAT</Text>
          <Text style={styles.title}>{football.label}</Text>
          <Text style={styles.sub}>{football.message}</Text>
        </View>
        <View style={styles.valuePill}>
          <View style={[styles.statusDot, { backgroundColor: football.color }]} />
        </View>
      </View>

      {realActivityDayCount < POINTS_MIN_POUR_COURBE ? (
        // H2 — pas encore assez de jours réels pour tracer une tendance (deux
        // points font un segment, pas une tendance). Même chartWrap (minHeight 90)
        // pour la stabilité du gabarit ; texte validé, pas de repères 0/-10.
        <View style={styles.chartWrap}>
          <Text style={styles.sub}>
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
              <Line x1={padLeft} y1={toY(0)} x2={chartWidth - padRight} y2={toY(0)} stroke={palette.borderSoft} strokeWidth={1} />
              {/* Overreaching threshold */}
              <Line x1={padLeft} y1={toY(-10)} x2={chartWidth - padRight} y2={toY(-10)} stroke="rgba(245, 158, 11, 0.3)" strokeWidth={1} />
              {/* TSB curve */}
              {path ? <Path d={path} stroke={lineColor} strokeWidth={2.6} fill="none" /> : null}
              {points.map((p, idx) => (
                <Circle key={`dot_${idx}`} cx={p.x} cy={p.y} r={idx === points.length - 1 ? 5 : 3} fill={lineColor} />
              ))}
            </Svg>
            <Text style={[styles.refLabel, { top: toY(0) - 8 }]}>0</Text>
            <Text style={[styles.refLabel, { top: toY(-10) - 8, color: "#f59e0b" }]}>-10</Text>
          </View>

          <View style={styles.chartLabelRow}>
            {/* Points = jours d'activité calculés par le modèle (pas 7 jours
                calendaires) : "Ta forme sur 7 jours" mentirait. */}
            <Text style={styles.chartLabel}>Ta tendance récente</Text>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 26,
    gap: 10,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: palette.sub,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "900",
    color: palette.text,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
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
    color: palette.sub,
  },
  chartLabelRow: {
    paddingTop: 2,
  },
  chartLabel: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "600",
  },
});

export default React.memo(HomeReadinessHeroInner);
