// components/coach/CoachTeamAnalytics.tsx
// Analytics équipe - vue d'ensemble des charges et progressions

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import type { EnrichedPlayer } from "../../hooks/coach/useCoachPlayersData";
import { toDateKey } from "../../utils/dateHelpers";

const palette = theme.colors;

type Props = {
  players: EnrichedPlayer[];
};

// TSB ranges for categorization
const TSB_RANGES = {
  overloaded: { min: -Infinity, max: -15, color: "#ef4444", label: "Surcharge" },
  fatigued: { min: -15, max: -5, color: "#f59e0b", label: "Fatigué" },
  optimal: { min: -5, max: 10, color: "#22c55e", label: "En forme" },
  fresh: { min: 10, max: Infinity, color: "#3b82f6", label: "Frais" },
};

const toSafeDate = (value?: string | null) => {
  const key = toDateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

function getTsbCategory(tsb: number): keyof typeof TSB_RANGES {
  if (tsb <= -15) return "overloaded";
  if (tsb <= -5) return "fatigued";
  if (tsb <= 10) return "optimal";
  return "fresh";
}

export function CoachTeamAnalytics({ players }: Props) {
  // Calculate team stats
  const stats = useMemo(() => {
    if (players.length === 0) {
      return {
        avgTsb: 0,
        avgAtl: 0,
        avgCtl: 0,
        tsbDistribution: { overloaded: 0, fatigued: 0, optimal: 0, fresh: 0 },
        activePlayers: 0,
        inactivePlayers: 0,
        withCycle: 0,
        withoutCycle: 0,
      };
    }

    const tsbValues = players.map((p) => p.tsb);
    const atlValues = players.map((p) => p.atl);
    const ctlValues = players.map((p) => p.ctl);

    const avgTsb = tsbValues.reduce((a, b) => a + b, 0) / players.length;
    const avgAtl = atlValues.reduce((a, b) => a + b, 0) / players.length;
    const avgCtl = ctlValues.reduce((a, b) => a + b, 0) / players.length;

    const tsbDistribution = { overloaded: 0, fatigued: 0, optimal: 0, fresh: 0 };
    players.forEach((p) => {
      const category = getTsbCategory(p.tsb);
      tsbDistribution[category]++;
    });

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const activePlayers = players.filter((p) => {
      const date = toSafeDate(p.lastSessionDate);
      if (!date) return false;
      return date >= fiveDaysAgo;
    }).length;

    const withCycle = players.filter((p) => p.microcycleGoal).length;

    return {
      avgTsb,
      avgAtl,
      avgCtl,
      tsbDistribution,
      activePlayers,
      inactivePlayers: players.length - activePlayers,
      withCycle,
      withoutCycle: players.length - withCycle,
    };
  }, [players]);

  if (players.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={32} color={palette.sub} />
        <Text style={styles.emptyText}>Aucune donnée disponible</Text>
      </View>
    );
  }

  const tsbTone =
    stats.avgTsb <= -15 ? "danger" : stats.avgTsb <= -5 ? "warn" : "good";
  const tsbColor =
    tsbTone === "danger" ? "#ef4444" : tsbTone === "warn" ? "#f59e0b" : "#22c55e";

  return (
    <View style={styles.container}>
      {/* Team averages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Moyennes équipe</Text>
        <View style={styles.avgGrid}>
          <View style={styles.avgCard}>
            <View style={[styles.avgIconWrap, { backgroundColor: `${tsbColor}20` }]}>
              <Ionicons name="battery-half" size={18} color={tsbColor} />
            </View>
            <Text style={styles.avgValue}>{Math.round(stats.avgTsb)}</Text>
            <Text style={styles.avgLabel}>TSB moyen</Text>
          </View>
          <View style={styles.avgCard}>
            <View style={[styles.avgIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
              <Ionicons name="flash" size={18} color="#8b5cf6" />
            </View>
            <Text style={styles.avgValue}>{Math.round(stats.avgAtl)}</Text>
            <Text style={styles.avgLabel}>ATL moyen</Text>
          </View>
          <View style={styles.avgCard}>
            <View style={[styles.avgIconWrap, { backgroundColor: "rgba(20, 184, 166, 0.15)" }]}>
              <Ionicons name="trending-up" size={18} color="#14b8a6" />
            </View>
            <Text style={styles.avgValue}>{Math.round(stats.avgCtl)}</Text>
            <Text style={styles.avgLabel}>CTL moyen</Text>
          </View>
        </View>
      </View>

      {/* TSB Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Répartition forme (TSB)</Text>
        <View style={styles.distributionBar}>
          {(Object.keys(TSB_RANGES) as (keyof typeof TSB_RANGES)[]).map((key) => {
            const count = stats.tsbDistribution[key];
            const percentage = players.length > 0 ? (count / players.length) * 100 : 0;
            if (percentage === 0) return null;
            return (
              <View
                key={key}
                style={[
                  styles.distributionSegment,
                  {
                    backgroundColor: TSB_RANGES[key].color,
                    width: `${percentage}%`,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.distributionLegend}>
          {(Object.keys(TSB_RANGES) as (keyof typeof TSB_RANGES)[]).map((key) => {
            const range = TSB_RANGES[key];
            const count = stats.tsbDistribution[key];
            return (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: range.color }]} />
                <Text style={styles.legendText}>
                  {range.label} ({count})
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Activity stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activité</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.activePlayers}</Text>
              <Text style={styles.statLabel}>Actifs (5j)</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Ionicons name="moon" size={16} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.inactivePlayers}</Text>
              <Text style={styles.statLabel}>Inactifs</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
              <Ionicons name="trophy" size={16} color="#8b5cf6" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.withCycle}</Text>
              <Text style={styles.statLabel}>Avec cycle</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Top/Bottom players */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Joueurs à surveiller</Text>
        <View style={styles.playersRow}>
          {/* Most fatigued */}
          {players.length > 0 && (
            <View style={styles.playerHighlight}>
              <Text style={styles.playerHighlightLabel}>Plus fatigué</Text>
              {(() => {
                const sorted = [...players].sort((a, b) => a.tsb - b.tsb);
                const p = sorted[0];
                return (
                  <View style={styles.playerHighlightCard}>
                    <Text style={styles.playerHighlightName}>{p.firstName}</Text>
                    <Text style={[styles.playerHighlightValue, { color: "#ef4444" }]}>
                      TSB {Math.round(p.tsb)}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
          {/* Most fresh */}
          {players.length > 0 && (
            <View style={styles.playerHighlight}>
              <Text style={styles.playerHighlightLabel}>Plus en forme</Text>
              {(() => {
                const sorted = [...players].sort((a, b) => b.tsb - a.tsb);
                const p = sorted[0];
                return (
                  <View style={styles.playerHighlightCard}>
                    <Text style={styles.playerHighlightName}>{p.firstName}</Text>
                    <Text style={[styles.playerHighlightValue, { color: "#22c55e" }]}>
                      TSB {Math.round(p.tsb)}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyText: {
    color: palette.sub,
    fontSize: 13,
  },
  section: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  avgGrid: {
    flexDirection: "row",
    gap: 10,
  },
  avgCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
  },
  avgIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avgValue: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
  },
  avgLabel: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "600",
  },
  distributionBar: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: palette.borderSoft,
  },
  distributionSegment: {
    height: "100%",
  },
  distributionLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: palette.sub,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: palette.cardSoft,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },
  statLabel: {
    fontSize: 10,
    color: palette.sub,
  },
  playersRow: {
    flexDirection: "row",
    gap: 10,
  },
  playerHighlight: {
    flex: 1,
    gap: 6,
  },
  playerHighlightLabel: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "600",
  },
  playerHighlightCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: palette.cardSoft,
    gap: 2,
  },
  playerHighlightName: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  playerHighlightValue: {
    fontSize: 11,
    fontWeight: "600",
  },
});
