import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import Svg, { Line, Path, Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { useTrainingStore } from "../state/trainingStore";
import { Card } from "../components/ui/Card";
import { TRAINING_DEFAULTS, getFootballLabel } from "../config/trainingDefaults";
import { updateTrainingLoad } from "../engine/loadModel";
import { STORAGE_KEYS } from "../constants/storage";
import { toDateKey } from "../utils/dateHelpers";

const palette = theme.colors;

type LoadPoint = {
  key: string;
  atl: number;
  ctl: number;
  tsb: number;
  load: number;
};

// ──────────────────────── Milestones ────────────────────────
type Milestone = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  reached: boolean;
};

function computeMilestones(
  totalSessions: number,
  totalDays: number,
  maxStreak: number,
  totalCycles: number
): Milestone[] {
  return [
    {
      id: "first_session",
      icon: "flash",
      label: "Première séance",
      value: totalSessions >= 1 ? "Fait !" : "0 / 1",
      color: "#ff7a1a",
      reached: totalSessions >= 1,
    },
    {
      id: "ten_sessions",
      icon: "trophy",
      label: "10 séances",
      value: totalSessions >= 10 ? "Débloqué" : `${totalSessions} / 10`,
      color: "#8b5cf6",
      reached: totalSessions >= 10,
    },
    {
      id: "fifty_sessions",
      icon: "medal",
      label: "50 séances",
      value: totalSessions >= 50 ? "Débloqué" : `${totalSessions} / 50`,
      color: "#f59e0b",
      reached: totalSessions >= 50,
    },
    {
      id: "streak_7",
      icon: "flame",
      label: "7 jours d'affilée",
      value: maxStreak >= 7 ? "Débloqué" : `${maxStreak} / 7`,
      color: "#ef4444",
      reached: maxStreak >= 7,
    },
    {
      id: "first_cycle",
      icon: "ribbon",
      label: "Cycle terminé",
      value: totalCycles >= 1 ? "Fait !" : "0 / 1",
      color: "#16a34a",
      reached: totalCycles >= 1,
    },
    {
      id: "active_30",
      icon: "calendar",
      label: "30 jours d'activité",
      value: totalDays >= 30 ? "Débloqué" : `${totalDays} / 30`,
      color: "#06b6d4",
      reached: totalDays >= 30,
    },
  ];
}

// ──────────────────────── Test comparison helper ────────────────────────
type TestEntry = {
  ts: number;
  playlist?: string;
  broadJumpCm?: number;
  tripleJumpCm?: number;
  cmjCm?: number;
  sprint10s?: number;
  sprint20s?: number;
  sprint30s?: number;
  endurance6min_m?: number;
  yoYoIR1_m?: number;
  gobletKg?: number;
  gobletReps?: number;
  [key: string]: any;
};

type TestComparison = {
  label: string;
  unit: string;
  before: number;
  after: number;
  diff: number;
  improved: boolean;
  lowerIsBetter: boolean;
};

const TEST_FIELDS: {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter?: boolean;
}[] = [
  { key: "broadJumpCm", label: "Saut longueur", unit: "cm" },
  { key: "cmjCm", label: "CMJ", unit: "cm" },
  { key: "sprint10s", label: "Sprint 10m", unit: "s", lowerIsBetter: true },
  { key: "sprint20s", label: "Sprint 20m", unit: "s", lowerIsBetter: true },
  { key: "sprint30s", label: "Sprint 30m", unit: "s", lowerIsBetter: true },
  { key: "endurance6min_m", label: "Endurance 6min", unit: "m" },
  { key: "yoYoIR1_m", label: "Yo-Yo IR1", unit: "m" },
  { key: "gobletKg", label: "Goblet Squat", unit: "kg" },
];

function computeTestComparisons(tests: TestEntry[]): TestComparison[] {
  if (tests.length < 2) return [];
  const sorted = [...tests].sort((a, b) => a.ts - b.ts);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const comparisons: TestComparison[] = [];

  for (const field of TEST_FIELDS) {
    const before = first[field.key];
    const after = last[field.key];
    if (typeof before === "number" && typeof after === "number" && before > 0 && after > 0) {
      const diff = after - before;
      const improved = field.lowerIsBetter ? diff < 0 : diff > 0;
      comparisons.push({
        label: field.label,
        unit: field.unit,
        before,
        after,
        diff,
        improved,
        lowerIsBetter: !!field.lowerIsBetter,
      });
    }
  }
  return comparisons;
}

// ──────────────────────── Component ────────────────────────
export default function ProgressScreen() {
  const navigation = useNavigation<any>();
  const tsb = useTrainingStore((s) => s.tsb);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const sessions = useTrainingStore((s) => s.sessions ?? []);
  const externalLoads = useTrainingStore((s) => s.externalLoads ?? []);
  const dailyApplied = useTrainingStore((s) => s.dailyApplied ?? {});
  const [testEntries, setTestEntries] = useState<TestEntry[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      title: "Progression",
    });
  }, [navigation]);

  // Load test data
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.TESTS_V1).then((raw) => {
      if (raw) {
        try {
          setTestEntries(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const today = devNowISO ? new Date(devNowISO) : new Date();
  const todayKey = toDateKey(today);
  const footballLabel = useMemo(() => getFootballLabel(tsb), [tsb]);

  // ─── Load series (30 days) ───
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
      const key = toDateKey(d);
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

  const tsbSeries = useMemo(() => loadSeries.map((d) => d.tsb), [loadSeries]);

  // ─── Month data ───
  const monthKey = todayKey.slice(0, 7);
  const lastMonth = (() => {
    const d = startOfMonth(today);
    const prev = subDays(d, 1);
    return toDateKey(prev).slice(0, 7);
  })();

  const completedSessions = sessions.filter((s: any) => s?.completed);
  const activitySet = new Set<string>();
  completedSessions.forEach((s: any) =>
    activitySet.add(toDateKey(s?.dateISO ?? s?.date))
  );
  externalLoads.forEach((e: any) =>
    activitySet.add(toDateKey(e?.dateISO ?? e?.date))
  );

  const monthSessions = completedSessions.filter((s: any) =>
    toDateKey(s?.dateISO ?? s?.date).startsWith(monthKey)
  );
  const lastMonthSessions = completedSessions.filter((s: any) =>
    toDateKey(s?.dateISO ?? s?.date).startsWith(lastMonth)
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
    return Number(
      (rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length).toFixed(1)
    );
  })();

  const avgDuration = (() => {
    const durations = monthSessions
      .map(
        (s: any) =>
          s?.feedback?.durationMin ?? s?.durationMin ?? s?.aiV2?.duration_min
      )
      .filter((v: any) => Number.isFinite(v));
    if (!durations.length) return null;
    return Math.round(
      durations.reduce((a: number, b: number) => a + b, 0) / durations.length
    );
  })();

  // ─── Streaks ───
  const globalMaxStreak = useMemo(() => {
    const allDays = Array.from(activitySet).sort();
    let streak = 0;
    let best = 0;
    let prev = "";
    for (const day of allDays) {
      if (prev && toDateKey(subDays(new Date(`${day}T12:00:00`), 1)) === prev) {
        streak += 1;
      } else {
        streak = 1;
      }
      best = Math.max(best, streak);
      prev = day;
    }
    return best;
  }, [activitySet]);

  const maxStreakThisMonth = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    let streak = 0;
    let best = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = toDateKey(d);
      if (activitySet.has(key)) {
        streak += 1;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    }
    return best;
  }, [activitySet, today]);

  // ─── Calendar ───
  const calendarDays = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    const days: {
      key: string;
      label: string;
      isActive: boolean;
      isToday: boolean;
    }[] = [];
    const leadingEmpty = (getDay(start) + 6) % 7;
    for (let i = 0; i < leadingEmpty; i += 1) {
      days.push({
        key: `empty_${i}`,
        label: "",
        isActive: false,
        isToday: false,
      });
    }
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = toDateKey(d);
      days.push({
        key,
        label: String(d.getDate()),
        isActive: activitySet.has(key),
        isToday: key === todayKey,
      });
    }
    return days;
  }, [activitySet, today, todayKey]);

  // ─── Milestones ───
  const milestones = useMemo(
    () =>
      computeMilestones(
        completedSessions.length,
        activitySet.size,
        globalMaxStreak,
        0
      ),
    [completedSessions.length, activitySet.size, globalMaxStreak]
  );

  // ─── Tests comparisons ───
  const testComparisons = useMemo(
    () => computeTestComparisons(testEntries),
    [testEntries]
  );

  // ─── TSB Sparkline ───
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 110;
  const pad = 8;
  const padLeft = 24;
  const padRight = 8;
  const tsbMin = -20;
  const tsbMax = 20;

  const toY = (value: number) => {
    const clamped = Math.max(tsbMin, Math.min(tsbMax, value));
    const ratio = (clamped - tsbMin) / (tsbMax - tsbMin);
    return pad + (1 - ratio) * (chartHeight - pad * 2);
  };

  const tsbPoints = useMemo(() => {
    if (!chartWidth || tsbSeries.length < 2) return [];
    const innerWidth = Math.max(10, chartWidth - padLeft - padRight);
    const step = innerWidth / (tsbSeries.length - 1);
    return tsbSeries.map((v, i) => ({
      x: padLeft + i * step,
      y: toY(v),
      v,
    }));
  }, [chartWidth, tsbSeries]);

  const tsbPath = useMemo(() => {
    if (!tsbPoints.length) return "";
    return tsbPoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
      .join(" ");
  }, [tsbPoints]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== chartWidth) setChartWidth(w);
  };

  // ─── Month delta helpers ───
  const sessionsDelta = monthSessions.length - lastMonthSessions.length;
  const loadDelta = Math.round(monthLoad - lastMonthLoad);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════════ HERO : Forme actuelle ═══════════ */}
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>TA FORME</Text>
              <Text style={[styles.heroTitle, { color: footballLabel.color }]}>
                {footballLabel.label}
              </Text>
              <Text style={styles.heroMessage}>{footballLabel.message}</Text>
            </View>
            <View
              style={[styles.statusDot, { backgroundColor: footballLabel.color }]}
            />
          </View>

          {/* Sparkline TSB 30 jours */}
          <View style={styles.chartWrap} onLayout={handleLayout}>
            <Svg width={chartWidth} height={chartHeight}>
              {/* Zone optimale */}
              <Line
                x1={padLeft}
                y1={toY(5)}
                x2={chartWidth - padRight}
                y2={toY(5)}
                stroke="rgba(34, 197, 94, 0.2)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Line
                x1={padLeft}
                y1={toY(-5)}
                x2={chartWidth - padRight}
                y2={toY(-5)}
                stroke="rgba(34, 197, 94, 0.2)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              {/* Zero */}
              <Line
                x1={padLeft}
                y1={toY(0)}
                x2={chartWidth - padRight}
                y2={toY(0)}
                stroke={palette.borderSoft}
                strokeWidth={1}
              />
              {/* Seuil surcharge */}
              <Line
                x1={padLeft}
                y1={toY(-10)}
                x2={chartWidth - padRight}
                y2={toY(-10)}
                stroke="rgba(245, 158, 11, 0.3)"
                strokeWidth={1}
              />
              {/* Courbe */}
              {tsbPath ? (
                <Path
                  d={tsbPath}
                  stroke={footballLabel.color}
                  strokeWidth={2.4}
                  fill="none"
                />
              ) : null}
              {tsbPoints.map((p, idx) => (
                <Circle
                  key={`dot_${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={idx === tsbPoints.length - 1 ? 5 : 2.5}
                  fill={footballLabel.color}
                />
              ))}
            </Svg>
            <Text style={[styles.refLabel, { top: toY(0) - 8 }]}>0</Text>
            <Text
              style={[styles.refLabel, { top: toY(-10) - 8, color: "#f59e0b" }]}
            >
              -10
            </Text>
          </View>
          <Text style={styles.chartCaption}>
            Ta forme sur 30 jours
          </Text>
        </Card>

        {/* ═══════════ MILESTONES ═══════════ */}
        <Card variant="surface" style={styles.milestonesCard}>
          <Text style={styles.sectionTitle}>Accomplissements</Text>
          <View style={styles.milestonesGrid}>
            {milestones.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.milestoneItem,
                  !m.reached && styles.milestoneItemLocked,
                ]}
              >
                <View
                  style={[
                    styles.milestoneIcon,
                    {
                      backgroundColor: m.reached
                        ? `${m.color}20`
                        : palette.cardSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.reached ? m.icon : "lock-closed"}
                    size={20}
                    color={m.reached ? m.color : palette.muted}
                  />
                </View>
                <Text
                  style={[
                    styles.milestoneLabel,
                    !m.reached && { color: palette.muted },
                  ]}
                >
                  {m.label}
                </Text>
                <Text
                  style={[
                    styles.milestoneValue,
                    m.reached && { color: m.color },
                  ]}
                >
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ═══════════ TESTS : Before / After ═══════════ */}
        {testComparisons.length > 0 && (
          <Card variant="surface" style={styles.testsCard}>
            <View style={styles.testsTitleRow}>
              <Ionicons name="analytics" size={18} color={palette.accent} />
              <Text style={styles.sectionTitle}>Évolution tests</Text>
            </View>
            <Text style={styles.testsSub}>
              Première batterie vs dernière batterie
            </Text>
            {testComparisons.map((tc) => {
              const diffStr = tc.lowerIsBetter
                ? tc.diff < 0
                  ? `${tc.diff.toFixed(1)} ${tc.unit}`
                  : `+${tc.diff.toFixed(1)} ${tc.unit}`
                : tc.diff > 0
                  ? `+${tc.diff.toFixed(1)} ${tc.unit}`
                  : `${tc.diff.toFixed(1)} ${tc.unit}`;
              return (
                <View key={tc.label} style={styles.testRow}>
                  <View style={styles.testLabelWrap}>
                    <Text style={styles.testLabel}>{tc.label}</Text>
                  </View>
                  <Text style={styles.testBefore}>
                    {tc.before} {tc.unit}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={palette.muted}
                  />
                  <Text style={styles.testAfter}>
                    {tc.after} {tc.unit}
                  </Text>
                  <View
                    style={[
                      styles.testDiffBadge,
                      {
                        backgroundColor: tc.improved
                          ? "rgba(22,163,74,0.12)"
                          : "rgba(239,68,68,0.12)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={tc.improved ? "trending-up" : "trending-down"}
                      size={12}
                      color={tc.improved ? "#16a34a" : "#ef4444"}
                    />
                    <Text
                      style={[
                        styles.testDiffText,
                        { color: tc.improved ? "#16a34a" : "#ef4444" },
                      ]}
                    >
                      {diffStr}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* ═══════════ CALENDRIER ═══════════ */}
        <Card variant="surface" style={styles.calendarCard}>
          <Text style={styles.sectionTitle}>Calendrier</Text>
          <Text style={styles.sectionSub}>
            {format(today, "MMMM yyyy", { locale: fr })}
          </Text>
          <View style={styles.calendarHeader}>
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <Text key={`dow_${i}_${d}`} style={styles.calendarDow}>
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
                    <Text
                      style={[
                        styles.calendarText,
                        day.isActive && styles.calendarTextActive,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.calendarLegend}>
            <View
              style={[styles.legendDot, { backgroundColor: palette.accent }]}
            />
            <Text style={styles.legendText}>Séance / effort</Text>
          </View>
        </Card>

        {/* ═══════════ STATS DU MOIS ═══════════ */}
        <Card variant="surface" style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Stats du mois</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="barbell-outline" size={16} color={palette.accent} />
              <Text style={styles.statLabel}>Séances</Text>
              <Text style={styles.statValue}>{monthSessions.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={16} color={palette.warn} />
              <Text style={styles.statLabel}>Effort moyen</Text>
              <Text style={styles.statValue}>
                {avgRpe ? `${avgRpe} / 10` : "—"}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={palette.info} />
              <Text style={styles.statLabel}>Durée moy.</Text>
              <Text style={styles.statValue}>
                {avgDuration ? `${avgDuration} min` : "—"}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={16} color="#ef4444" />
              <Text style={styles.statLabel}>Record streak</Text>
              <Text style={styles.statValue}>{maxStreakThisMonth} j</Text>
            </View>
          </View>

          {/* Comparaison */}
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>vs mois dernier</Text>
            <View style={styles.compareChips}>
              <View
                style={[
                  styles.compareChip,
                  {
                    backgroundColor:
                      sessionsDelta >= 0
                        ? "rgba(22,163,74,0.12)"
                        : "rgba(239,68,68,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name={sessionsDelta >= 0 ? "trending-up" : "trending-down"}
                  size={12}
                  color={sessionsDelta >= 0 ? "#16a34a" : "#ef4444"}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: sessionsDelta >= 0 ? "#16a34a" : "#ef4444",
                  }}
                >
                  {sessionsDelta >= 0 ? "+" : ""}
                  {sessionsDelta} séances
                </Text>
              </View>
              <View
                style={[
                  styles.compareChip,
                  {
                    backgroundColor:
                      loadDelta >= 0
                        ? "rgba(22,163,74,0.12)"
                        : "rgba(239,68,68,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name={loadDelta >= 0 ? "trending-up" : "trending-down"}
                  size={12}
                  color={loadDelta >= 0 ? "#16a34a" : "#ef4444"}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: loadDelta >= 0 ? "#16a34a" : "#ef4444",
                  }}
                >
                  {loadDelta >= 0 ? "+" : ""}
                  {loadDelta} effort
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════ STYLES ═══════════════════
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

  // ─── Hero ───
  heroCard: {
    padding: 16,
    borderRadius: 24,
    gap: 8,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: palette.sub,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
  },
  heroMessage: {
    marginTop: 4,
    fontSize: 13,
    color: palette.sub,
    lineHeight: 18,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    marginTop: 6,
  },
  chartWrap: {
    marginTop: 8,
    minHeight: 110,
  },
  refLabel: {
    position: "absolute",
    left: 0,
    fontSize: 10,
    color: palette.sub,
  },
  chartCaption: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "600",
  },

  // ─── Milestones ───
  milestonesCard: {
    padding: 16,
    borderRadius: 24,
    gap: 14,
  },
  milestonesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  milestoneItem: {
    width: "30%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  milestoneItemLocked: {
    opacity: 0.55,
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.text,
    textAlign: "center",
  },
  milestoneValue: {
    fontSize: 10,
    fontWeight: "700",
    color: palette.sub,
  },

  // ─── Tests ───
  testsCard: {
    padding: 16,
    borderRadius: 24,
    gap: 12,
  },
  testsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testsSub: {
    fontSize: 12,
    color: palette.sub,
    marginTop: -4,
  },
  testRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  testLabelWrap: {
    flex: 1,
  },
  testLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.text,
  },
  testBefore: {
    fontSize: 12,
    color: palette.sub,
    minWidth: 48,
    textAlign: "right",
  },
  testAfter: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
    minWidth: 48,
    textAlign: "right",
  },
  testDiffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  testDiffText: {
    fontSize: 10,
    fontWeight: "700",
  },

  // ─── Calendar ───
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

  // ─── Stats ───
  statsCard: {
    padding: 16,
    borderRadius: 24,
    gap: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    width: "46%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  compareRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    gap: 8,
  },
  compareLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  compareChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compareChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
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
});
