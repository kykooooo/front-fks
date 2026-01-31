import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { Card } from "../ui/Card";
import { theme } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  todayLabel: string;
  tsb: number;
  tsbColor: string;
  readinessPercent: number;
  readinessLabel: string;
  fatigueText: string;
  phase?: string | null;
  phaseCount?: number | null;
  atl: number;
  ctl: number;
  tsbHistory?: number[];
};

export default function HomeReadinessCard({
  todayLabel,
  tsb,
  tsbColor,
  readinessPercent,
  readinessLabel,
  fatigueText,
  phase,
  phaseCount,
  atl,
  ctl,
  tsbHistory = [],
}: Props) {
  const history = tsbHistory.length >= 7
    ? tsbHistory.slice(0, 7).reverse()
    : [tsb, ...tsbHistory].slice(0, 7).reverse();
  const min = -20;
  const max = 20;
  const lineColor = tsb >= 0 ? palette.success : palette.warn;
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 84;
  const padLeft = 28;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 10;
  const innerHeight = chartHeight - padTop - padBottom;

  const toY = (value: number) => {
    const clamped = Math.max(min, Math.min(max, value));
    const ratio = (clamped - min) / (max - min);
    return padTop + (1 - ratio) * innerHeight;
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

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== chartWidth) setChartWidth(w);
  };

  return (
    <Card variant="surface" style={styles.heroCard}>
      <View style={styles.heroRail} />
      <View style={styles.heroGlow} />
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.heroTitle}>Forme & charge</Text>
          <Text style={styles.heroSubtitle}>{todayLabel}</Text>
        </View>
        <View style={styles.heroScore}>
          <Text style={styles.heroScoreLabel}>TSB</Text>
          <Text style={[styles.heroScoreValue, { color: tsbColor }]}>{tsb.toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.readinessRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.readinessTitle}>Readiness</Text>
          <Text style={styles.readinessHint}>{fatigueText}</Text>
        </View>
        <View style={styles.readinessPill}>
          <Text style={styles.readinessPillText}>{readinessPercent}%</Text>
        </View>
      </View>
      <View style={styles.readinessTrack}>
        <View
          style={[
            styles.readinessFill,
            { width: `${Math.max(0, Math.min(100, readinessPercent))}%`, backgroundColor: tsbColor },
          ]}
        />
      </View>

      <View style={styles.heroBottomRow}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Phase</Text>
          <Text style={styles.heroStatValue}>{phase ?? "—"}</Text>
          <Text style={styles.heroStatSub}>Séance #{phaseCount ?? 0} dans cette phase</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Charge interne</Text>
          <Text style={styles.heroStatValue}>
            ATL {atl.toFixed(1)} · CTL {ctl.toFixed(1)}
          </Text>
          <Text style={styles.heroStatSub}>Qualité du jour: {readinessLabel}</Text>
        </View>
      </View>

      <View style={styles.chartDivider} />
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>TSB (7j)</Text>
        <Text style={styles.chartMeta}>ATL/CTL</Text>
      </View>
      <View style={styles.chartRow}>
        <View style={styles.sparkWrap} onLayout={handleLayout}>
          <Svg width={chartWidth} height={chartHeight}>
            <Line x1={padLeft} y1={toY(0)} x2={chartWidth - padRight} y2={toY(0)} stroke={palette.borderSoft} strokeWidth={1} />
            <Line x1={padLeft} y1={toY(-10)} x2={chartWidth - padRight} y2={toY(-10)} stroke={palette.borderSoft} strokeWidth={1} />
            <Line x1={padLeft} y1={toY(-20)} x2={chartWidth - padRight} y2={toY(-20)} stroke={palette.borderSoft} strokeWidth={1} />

            {path ? <Path d={path} stroke={lineColor} strokeWidth={2.5} fill="none" /> : null}
            {points.map((p, idx) => (
              <Circle key={`dot_${idx}`} cx={p.x} cy={p.y} r={3} fill={lineColor} />
            ))}
          </Svg>
          <Text style={[styles.refLabel, { top: toY(0) - 8 }]}>0</Text>
          <Text style={[styles.refLabel, { top: toY(-10) - 8 }]}>fatigue</Text>
          <Text style={[styles.refLabel, { top: toY(-20) - 8 }]}>surcharge</Text>
        </View>
        <View style={styles.atlCtl}>
          <View style={styles.atlCtlRow}>
            <Text style={styles.atlCtlLabel}>ATL</Text>
            <View style={styles.atlCtlTrack}>
              <View
                style={[
                  styles.atlCtlFill,
                  { width: `${Math.min(100, atl * 2)}%`, backgroundColor: palette.warn },
                ]}
              />
            </View>
          </View>
          <View style={styles.atlCtlRow}>
            <Text style={styles.atlCtlLabel}>CTL</Text>
            <View style={styles.atlCtlTrack}>
              <View
                style={[
                  styles.atlCtlFill,
                  { width: `${Math.min(100, ctl * 2)}%`, backgroundColor: palette.success },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.chartHint}>TSB {tsb.toFixed(1)} = {readinessLabel.toLowerCase()}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
  },
  heroRail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: palette.borderSoft,
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,20,0.04)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
  },
  heroScore: {
    alignItems: "flex-end",
  },
  heroScoreLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: palette.sub,
  },
  heroScoreValue: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
  },
  readinessRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readinessTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.text,
  },
  readinessHint: {
    marginTop: 2,
    fontSize: 12,
    color: palette.sub,
  },
  readinessPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  readinessPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.text,
  },
  readinessTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  readinessFill: {
    height: "100%",
    borderRadius: 999,
  },
  heroBottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroStat: {
    flex: 1,
    gap: 2,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.text,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
  },
  heroDivider: {
    width: 1,
    height: 42,
    backgroundColor: palette.borderSoft,
  },
  chartDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 12,
    marginBottom: 10,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
  },
  chartMeta: {
    fontSize: 11,
    color: palette.sub,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  sparkWrap: {
    flex: 1,
    height: 84,
    position: "relative",
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
    overflow: "hidden",
  },
  refLabel: {
    position: "absolute",
    left: 6,
    fontSize: 9,
    color: palette.sub,
  },
  atlCtl: {
    width: 120,
    gap: 8,
  },
  atlCtlRow: {
    gap: 4,
  },
  atlCtlLabel: {
    fontSize: 10,
    color: palette.sub,
  },
  atlCtlTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  atlCtlFill: {
    height: "100%",
    borderRadius: 999,
  },
  chartHint: {
    marginTop: 8,
    fontSize: 11,
    color: palette.sub,
  },
});
