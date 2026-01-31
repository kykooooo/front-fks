import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { Card } from "../ui/Card";
import { theme } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  chargeLabel: string;
  tsbText: string;
  tsbValue: number;
  tsbColor: string;
  atlSeries: number[];
  ctlSeries: number[];
  weeklyCount: number;
  nextLabel: string;
};

export default function HomeDashboardCard({
  chargeLabel,
  tsbText,
  tsbValue,
  tsbColor,
  atlSeries,
  ctlSeries,
  weeklyCount,
  nextLabel,
}: Props) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 92;
  const pad = 8;
  const padLeft = 6;
  const padRight = 6;
  const innerHeight = chartHeight - pad * 2;

  const maxValue = useMemo(() => {
    const values = [...atlSeries, ...ctlSeries].filter((v) => Number.isFinite(v));
    const max = values.length ? Math.max(...values) : 1;
    return Math.max(1, max);
  }, [atlSeries, ctlSeries]);

  const toY = (value: number) => {
    const ratio = Math.max(0, Math.min(1, value / maxValue));
    return pad + (1 - ratio) * innerHeight;
  };

  const buildPath = (series: number[]) => {
    if (!chartWidth || series.length < 2) return "";
    const innerWidth = Math.max(10, chartWidth - padLeft - padRight);
    const step = innerWidth / (series.length - 1);
    return series
      .map((v, i) => `${i === 0 ? "M" : "L"}${padLeft + i * step},${toY(v)}`)
      .join(" ");
  };

  const atlPath = useMemo(() => buildPath(atlSeries), [atlSeries, chartWidth, maxValue]);
  const ctlPath = useMemo(() => buildPath(ctlSeries), [ctlSeries, chartWidth, maxValue]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== chartWidth) setChartWidth(w);
  };

  return (
    <Card variant="surface" style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Charge actuelle</Text>
          <Text style={styles.title} numberOfLines={1}>
            {chargeLabel}
          </Text>
        </View>
        <View style={styles.tsbBox}>
          <Text style={styles.tsbLabel}>TSB</Text>
          <Text style={[styles.tsbValue, { color: tsbColor }]}>{tsbValue.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.tsbText}>{tsbText}</Text>

      <View style={styles.chartWrap} onLayout={handleLayout}>
        <Svg width={chartWidth} height={chartHeight}>
          <Line x1={padLeft} y1={toY(maxValue * 0.33)} x2={chartWidth - padRight} y2={toY(maxValue * 0.33)} stroke={palette.borderSoft} strokeWidth={1} />
          <Line x1={padLeft} y1={toY(maxValue * 0.66)} x2={chartWidth - padRight} y2={toY(maxValue * 0.66)} stroke={palette.borderSoft} strokeWidth={1} />
          {atlPath ? <Path d={atlPath} stroke={palette.warn} strokeWidth={2.2} fill="none" /> : null}
          {ctlPath ? <Path d={ctlPath} stroke={palette.success} strokeWidth={2.2} fill="none" /> : null}
        </Svg>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: palette.warn }]} />
          <Text style={styles.legendText}>ATL</Text>
          <View style={[styles.legendDot, { backgroundColor: palette.success, marginLeft: 12 }]} />
          <Text style={styles.legendText}>CTL</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerBlock}>
          <Text style={styles.footerLabel}>Semaine</Text>
          <Text style={styles.footerValue}>{weeklyCount} séances</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerBlock}>
          <Text style={styles.footerLabel}>Prochaine</Text>
          <Text style={styles.footerValue} numberOfLines={1}>
            {nextLabel}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 24,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
  },
  title: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  tsbBox: {
    alignItems: "flex-end",
  },
  tsbLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.sub,
  },
  tsbValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  tsbText: {
    fontSize: 12,
    color: palette.sub,
  },
  chartWrap: {
    paddingVertical: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    marginLeft: 6,
    fontSize: 11,
    color: palette.sub,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerBlock: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.sub,
  },
  footerValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  footerDivider: {
    width: 1,
    backgroundColor: palette.borderSoft,
    marginVertical: 4,
  },
});
