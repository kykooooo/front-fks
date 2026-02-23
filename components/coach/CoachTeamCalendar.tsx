// components/coach/CoachTeamCalendar.tsx
// Vue calendrier équipe - affiche qui fait quoi sur la semaine

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { theme } from "../../constants/theme";
import { toDateKey } from "../../utils/dateHelpers";

const palette = theme.colors;

export type PlayerCalendarData = {
  uid: string;
  firstName: string;
  matchDays: string[]; // "mon", "tue", etc.
  clubTrainingDays: string[];
  sessions: { dateISO: string; completed: boolean }[];
  lastSessionDate?: string | null;
};

type Props = {
  players: PlayerCalendarData[];
  onPlayerPress?: (uid: string) => void;
  currentDate?: Date;
};

const DOW_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type DayStatus = "match" | "club" | "fks_done" | "fks_planned" | "rest";

const STATUS_CONFIG: Record<DayStatus, { icon: string; color: string; bg: string }> = {
  match: { icon: "football", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  club: { icon: "people", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  fks_done: { icon: "checkmark-circle", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
  fks_planned: { icon: "time", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  rest: { icon: "remove", color: palette.sub, bg: "transparent" },
};

function getPlayerDayStatus(
  player: PlayerCalendarData,
  dayKey: string,
  dateISO: string
): DayStatus {
  // Priority: match > club > fks_done > fks_planned > rest
  if (player.matchDays.includes(dayKey)) return "match";
  if (player.clubTrainingDays.includes(dayKey)) return "club";

  const session = player.sessions.find((s) => toDateKey(s.dateISO) === dateISO);
  if (session?.completed) return "fks_done";
  if (session) return "fks_planned";

  return "rest";
}

export function CoachTeamCalendar({ players, onPlayerPress, currentDate }: Props) {
  const now = currentDate ?? new Date();

  // Generate week days starting from Monday
  const weekDays = useMemo(() => {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return {
        date,
        dateISO: format(date, "yyyy-MM-dd"),
        dayKey: DOW_KEYS[i],
        label: DOW_LABELS[i],
        dayNum: format(date, "d"),
        isToday: isSameDay(date, now),
      };
    });
  }, [now]);

  if (players.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={32} color={palette.sub} />
        <Text style={styles.emptyText}>Aucun joueur dans le club</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header row with days */}
      <View style={styles.headerRow}>
        <View style={styles.nameCell}>
          <Text style={styles.headerLabel}>Joueur</Text>
        </View>
        {weekDays.map((day) => (
          <View
            key={day.dayKey}
            style={[styles.dayCell, day.isToday && styles.todayCell]}
          >
            <Text style={[styles.dayLabel, day.isToday && styles.todayLabel]}>
              {day.label}
            </Text>
            <Text style={[styles.dayNum, day.isToday && styles.todayNum]}>
              {day.dayNum}
            </Text>
          </View>
        ))}
      </View>

      {/* Player rows */}
      <ScrollView style={styles.playersScroll} showsVerticalScrollIndicator={false}>
        {players.map((player) => (
          <Pressable
            key={player.uid}
            onPress={() => onPlayerPress?.(player.uid)}
            style={({ pressed }) => [
              styles.playerRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.nameCell}>
              <Text style={styles.playerName} numberOfLines={1}>
                {player.firstName || "Joueur"}
              </Text>
            </View>
            {weekDays.map((day) => {
              const status = getPlayerDayStatus(player, day.dayKey, day.dateISO);
              const config = STATUS_CONFIG[status];
              return (
                <View key={day.dayKey} style={styles.dayCell}>
                  <View style={[styles.statusDot, { backgroundColor: config.bg }]}>
                    <Ionicons
                      name={config.icon as any}
                      size={14}
                      color={config.color}
                    />
                  </View>
                </View>
              );
            })}
          </Pressable>
        ))}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG.match.bg }]}>
            <Ionicons name="football" size={10} color={STATUS_CONFIG.match.color} />
          </View>
          <Text style={styles.legendText}>Match</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG.club.bg }]}>
            <Ionicons name="people" size={10} color={STATUS_CONFIG.club.color} />
          </View>
          <Text style={styles.legendText}>Club</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG.fks_done.bg }]}>
            <Ionicons name="checkmark-circle" size={10} color={STATUS_CONFIG.fks_done.color} />
          </View>
          <Text style={styles.legendText}>FKS fait</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_CONFIG.fks_planned.bg }]}>
            <Ionicons name="time" size={10} color={STATUS_CONFIG.fks_planned.color} />
          </View>
          <Text style={styles.legendText}>Planifié</Text>
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
  },
  emptyText: {
    color: palette.sub,
    fontSize: 13,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  nameCell: {
    width: 80,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    minWidth: 36,
  },
  todayCell: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: palette.sub,
  },
  todayLabel: {
    color: "#2563eb",
  },
  dayNum: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
    marginTop: 2,
  },
  todayNum: {
    color: "#2563eb",
  },
  playersScroll: {
    maxHeight: 300,
  },
  playerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  playerName: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.text,
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    gap: 12,
    backgroundColor: palette.cardSoft,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: {
    fontSize: 10,
    color: palette.sub,
  },
});
