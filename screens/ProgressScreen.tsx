import React, { useLayoutEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { format, startOfMonth, endOfMonth, addDays, subDays, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { theme } from "../constants/theme";
import { useTrainingStore } from "../state/trainingStore";
import { Card } from "../components/ui/Card";
import { TRAINING_DEFAULTS } from "../config/trainingDefaults";
import { updateTrainingLoad } from "../engine/loadModel";

const palette = theme.colors;

type LoadPoint = {
  key: string;
  atl: number;
  ctl: number;
  tsb: number;
  load: number;
};

const toDayKey = (iso?: string) => (iso ?? "").slice(0, 10);

export default function ProgressScreen() {
  const navigation = useNavigation<any>();
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsb = useTrainingStore((s) => s.tsb);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const sessions = useTrainingStore((s) => s.sessions ?? []);
  const externalLoads = useTrainingStore((s) => s.externalLoads ?? []);
  const dailyApplied = useTrainingStore((s) => s.dailyApplied ?? {});

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      title: "Progression",
    });
  }, [navigation]);

  const today = devNowISO ? new Date(devNowISO) : new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const loadSeries = useMemo<LoadPoint[]>(() => {
    const daysBack = 30;
    const warmup = 45;
    const totalDays = daysBack + warmup;
    const orderedDays = Array.from({ length: totalDays }).map((_, idx) =>
      subDays(today, totalDays - 1 - idx)
    );

    let atlSeed = TRAINING_DEFAULTS.ATL0;
    let ctlSeed = TRAINING_DEFAULTS.CTL0;
    const series: LoadPoint[] = [];

    orderedDays.forEach((d, idx) => {
      const key = d.toISOString().slice(0, 10);
      const load = Number(dailyApplied[key] ?? 0) || 0;
      const next = updateTrainingLoad(atlSeed, ctlSeed, load, { dtDays: 1 });
      atlSeed = next.atl;
      ctlSeed = next.ctl;
      if (idx >= warmup) {
        series.push({
          key,
          atl: Number(next.atl.toFixed(1)),
          ctl: Number(next.ctl.toFixed(1)),
          tsb: Number(next.tsb.toFixed(1)),
          load,
        });
      }
    });

    return series;
  }, [dailyApplied, devNowISO]);

  const chartData = useMemo(() => loadSeries.slice(-30), [loadSeries]);
  const atlSeries = chartData.map((d) => d.atl);
  const ctlSeries = chartData.map((d) => d.ctl);

  const monthKey = todayKey.slice(0, 7);
  const lastMonth = (() => {
    const d = startOfMonth(today);
    const prev = subDays(d, 1);
    return prev.toISOString().slice(0, 7);
  })();

  const completedSessions = sessions.filter((s: any) => s?.completed);
  const activitySet = new Set<string>();
  completedSessions.forEach((s: any) => activitySet.add(toDayKey(s?.dateISO ?? s?.date)));
  externalLoads.forEach((e: any) => activitySet.add(toDayKey(e?.dateISO ?? e?.date)));

  const monthSessions = completedSessions.filter((s: any) =>
    toDayKey(s?.dateISO ?? s?.date).startsWith(monthKey)
  );
  const lastMonthSessions = completedSessions.filter((s: any) =>
    toDayKey(s?.dateISO ?? s?.date).startsWith(lastMonth)
  );

  const monthLoad = Object.entries(dailyApplied)
    .filter(([k]) => k.startsWith(monthKey))
    .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  const lastMonthLoad = Object.entries(dailyApplied)
    .filter(([k]) => k.startsWith(lastMonth))
    .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

  const avgRpe = (() => {
    const rpes = monthSessions
      .map((s: any) => s?.feedback?.rpe ?? s?.rpe)
      .filter((v: any) => Number.isFinite(v));
    if (!rpes.length) return null;
    const avg = rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length;
    return Number(avg.toFixed(1));
  })();

  const avgDuration = (() => {
    const durations = monthSessions
      .map((s: any) => s?.feedback?.durationMin ?? s?.durationMin ?? s?.aiV2?.duration_min)
      .filter((v: any) => Number.isFinite(v));
    if (!durations.length) return null;
    const avg = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
    return Math.round(avg);
  })();

  const maxStreakThisMonth = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    let streak = 0;
    let best = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = d.toISOString().slice(0, 10);
      if (activitySet.has(key)) {
        streak += 1;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    }
    return best;
  }, [activitySet, today]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    const days: { key: string; label: string; isActive: boolean; isToday: boolean }[] = [];
    const leadingEmpty = (getDay(start) + 6) % 7; // Monday = 0
    for (let i = 0; i < leadingEmpty; i += 1) {
      days.push({ key: `empty_${i}`, label: "", isActive: false, isToday: false });
    }
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: String(d.getDate()),
        isActive: activitySet.has(key),
        isToday: key === todayKey,
      });
    }
    return days;
  }, [activitySet, today, todayKey]);

  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 160;
  const pad = 8;
  const padLeft = 10;
  const padRight = 10;
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
  const tsbSeries = chartData.map((d) => d.tsb);
  const minTsb = Math.min(...tsbSeries, 0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== chartWidth) setChartWidth(w);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <Text style={styles.heroTitle}>Charge & forme (30 jours)</Text>
          <Text style={styles.heroSub}>
            ATL = fatigue · CTL = forme · TSB = équilibre
          </Text>
          <View style={styles.chartWrap} onLayout={handleLayout}>
            <Svg width={chartWidth} height={chartHeight}>
              {minTsb < 0 ? (
                <Rect
                  x={0}
                  y={toY(maxValue * 0.25)}
                  width={chartWidth}
                  height={chartHeight}
                  fill="rgba(220, 65, 50, 0.06)"
                />
              ) : null}
              <Line x1={padLeft} y1={toY(maxValue * 0.33)} x2={chartWidth - padRight} y2={toY(maxValue * 0.33)} stroke={palette.borderSoft} strokeWidth={1} />
              <Line x1={padLeft} y1={toY(maxValue * 0.66)} x2={chartWidth - padRight} y2={toY(maxValue * 0.66)} stroke={palette.borderSoft} strokeWidth={1} />
              {atlPath ? <Path d={atlPath} stroke={palette.warn} strokeWidth={2.4} fill="none" /> : null}
              {ctlPath ? <Path d={ctlPath} stroke={palette.success} strokeWidth={2.4} fill="none" /> : null}
            </Svg>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: palette.warn }]} />
            <Text style={styles.legendText}>ATL</Text>
            <View style={[styles.legendDot, { backgroundColor: palette.success, marginLeft: 14 }]} />
            <Text style={styles.legendText}>CTL</Text>
            <View style={[styles.legendDot, { backgroundColor: palette.danger, marginLeft: 14 }]} />
            <Text style={styles.legendText}>TSB négatif</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>ATL</Text>
              <Text style={styles.heroStatValue}>{atl.toFixed(1)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>CTL</Text>
              <Text style={styles.heroStatValue}>{ctl.toFixed(1)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>TSB</Text>
              <Text style={styles.heroStatValue}>{tsb.toFixed(1)}</Text>
            </View>
          </View>
        </Card>

        <Card variant="surface" style={styles.calendarCard}>
          <Text style={styles.sectionTitle}>Calendrier visuel</Text>
          <Text style={styles.sectionSub}>{format(today, "MMMM yyyy", { locale: fr })}</Text>
          <View style={styles.calendarHeader}>
            {["L", "M", "M", "J", "V", "S", "D"].map((d) => (
              <Text key={`dow_${d}`} style={styles.calendarDow}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => (
              <View key={day.key} style={styles.calendarCell}>
                {day.label ? (
                  <View
                    style={[
                      styles.calendarDot,
                      day.isActive && styles.calendarDotActive,
                      day.isToday && styles.calendarDotToday,
                    ]}
                  >
                    <Text style={[styles.calendarText, day.isActive && styles.calendarTextActive]}>
                      {day.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.calendarLegend}>
            <View style={[styles.legendDot, { backgroundColor: palette.accent }]} />
            <Text style={styles.legendText}>Séance / charge</Text>
          </View>
        </Card>

        <Card variant="surface" style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Stats du mois</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Séances complétées</Text>
              <Text style={styles.statValue}>{monthSessions.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Charge totale</Text>
              <Text style={styles.statValue}>{Math.round(monthLoad)} UA</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>RPE moyen</Text>
              <Text style={styles.statValue}>{avgRpe ?? "—"}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Durée moyenne</Text>
              <Text style={styles.statValue}>{avgDuration ? `${avgDuration} min` : "—"}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Record consécutif</Text>
              <Text style={styles.statValue}>{maxStreakThisMonth} j</Text>
            </View>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>Ce mois vs mois dernier</Text>
            <Text style={styles.compareValue}>
              {monthSessions.length} / {lastMonthSessions.length} séances · {Math.round(monthLoad)} / {Math.round(lastMonthLoad)} UA
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
    backgroundColor: palette.bg,
  },
  heroCard: {
    padding: 16,
    borderRadius: 24,
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  heroSub: {
    fontSize: 12,
    color: palette.sub,
  },
  chartWrap: {
    marginTop: 8,
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
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
  heroStats: {
    flexDirection: "row",
    gap: 12,
  },
  heroStat: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroStatLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.sub,
  },
  heroStatValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  sectionSub: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  calendarCard: {
    padding: 16,
    borderRadius: 24,
    gap: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarDow: {
    width: 32,
    textAlign: "center",
    fontSize: 11,
    color: palette.sub,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    alignItems: "center",
    marginVertical: 6,
  },
  calendarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  calendarDotActive: {
    backgroundColor: palette.accent,
  },
  calendarDotToday: {
    borderWidth: 1,
    borderColor: palette.text,
  },
  calendarText: {
    fontSize: 12,
    color: palette.sub,
  },
  calendarTextActive: {
    color: palette.text,
    fontWeight: "700",
  },
  calendarLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statsCard: {
    padding: 16,
    borderRadius: 24,
    gap: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: {
    width: "46%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  statLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  statValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  compareRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  compareLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  compareValue: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
});
