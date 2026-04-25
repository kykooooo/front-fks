// components/coach/CoachPlayerComparison.tsx
// Comparaison de joueurs côte à côte

import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../constants/theme";
import { MICROCYCLES, isMicrocycleId, MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";
import type { EnrichedPlayer } from "../../hooks/coach/useCoachPlayersData";

const palette = theme.colors;

type Props = {
  players: EnrichedPlayer[];
  onPlayerPress?: (uid: string) => void;
};

type SortKey = "name" | "tsb" | "atl" | "ctl" | "progress" | "activity";

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: "name", label: "Nom", icon: "person" },
  { key: "tsb", label: "TSB", icon: "battery-half" },
  { key: "atl", label: "ATL", icon: "flash" },
  { key: "ctl", label: "CTL", icon: "trending-up" },
  { key: "progress", label: "Cycle", icon: "trophy" },
  { key: "activity", label: "Activité", icon: "time" },
];

function getTsbColor(tsb: number): string {
  if (tsb <= -15) return theme.colors.red500;
  if (tsb <= -5) return theme.colors.amber500;
  if (tsb <= 10) return theme.colors.green500;
  return theme.colors.blue500;
}

function getActivityDays(lastSessionDate: string | null | undefined): number {
  if (!lastSessionDate) return 999;
  const last = new Date(lastSessionDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

export function CoachPlayerComparison({ players, onPlayerPress }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("tsb");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "name":
          diff = (a.firstName || "").localeCompare(b.firstName || "");
          break;
        case "tsb":
          diff = a.tsb - b.tsb;
          break;
        case "atl":
          diff = a.atl - b.atl;
          break;
        case "ctl":
          diff = a.ctl - b.ctl;
          break;
        case "progress":
          const aProgress = (a.microcycleSessionIndex ?? 0) / MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
          const bProgress = (b.microcycleSessionIndex ?? 0) / MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
          diff = aProgress - bProgress;
          break;
        case "activity":
          diff = getActivityDays(a.lastSessionDate) - getActivityDays(b.lastSessionDate);
          break;
      }
      return sortAsc ? diff : -diff;
    });
    return sorted;
  }, [players, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (players.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={32} color={palette.sub} />
        <Text style={styles.emptyText}>Aucun joueur à comparer</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sort options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map((opt) => {
          const isActive = sortKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handleSort(opt.key)}
              style={[styles.sortChip, isActive && styles.sortChipActive]}
            >
              <Ionicons
                name={opt.icon as any}
                size={14}
                color={isActive ? theme.colors.white : palette.sub}
              />
              <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
              {isActive && (
                <Ionicons
                  name={sortAsc ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={theme.colors.white}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Players list */}
      <ScrollView style={styles.playersScroll} showsVerticalScrollIndicator={false}>
        {sortedPlayers.map((player, index) => {
          const cycleId = isMicrocycleId(player.microcycleGoal) ? player.microcycleGoal : null;
          const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : "—";
          const cycleProgress = player.microcycleSessionIndex ?? 0;
          const activityDays = getActivityDays(player.lastSessionDate);
          const tsbColor = getTsbColor(player.tsb);

          return (
            <TouchableOpacity
              key={player.uid}
              onPress={() => onPlayerPress?.(player.uid)}
              activeOpacity={0.7}
              style={styles.playerCard}
            >
              {/* Rank */}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              {/* Player info */}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.firstName}</Text>
                <Text style={styles.playerMeta}>
                  {cycleLabel} · {cycleProgress}/{MICROCYCLE_TOTAL_SESSIONS_DEFAULT}
                </Text>
              </View>

              {/* Stats */}
              <View style={styles.statsGrid}>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: tsbColor }]}>
                    {Math.round(player.tsb)}
                  </Text>
                  <Text style={styles.statLabel}>TSB</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{Math.round(player.atl)}</Text>
                  <Text style={styles.statLabel}>ATL</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{Math.round(player.ctl)}</Text>
                  <Text style={styles.statLabel}>CTL</Text>
                </View>
                <View style={styles.statCell}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: activityDays > 5 ? theme.colors.amber500 : palette.text },
                    ]}
                  >
                    {activityDays < 999 ? `${activityDays}j` : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Inactif</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(cycleProgress / MICROCYCLE_TOTAL_SESSIONS_DEFAULT) * 100}%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyText: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  sortRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: palette.cardSoft,
  },
  sortChipActive: {
    backgroundColor: palette.accent,
  },
  sortChipText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "600",
    color: palette.sub,
  },
  sortChipTextActive: {
    color: theme.colors.white,
  },
  playersScroll: {
    maxHeight: 400,
  },
  playerCard: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
    gap: 8,
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    color: palette.sub,
  },
  playerInfo: {
    marginLeft: 28,
  },
  playerName: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  playerMeta: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    marginTop: 4,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  statLabel: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    marginTop: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: RADIUS.xs,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
    borderRadius: RADIUS.xs,
  },
});
