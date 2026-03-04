import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { useHaptics } from "../../hooks/useHaptics";

const palette = theme.colors;

type WeekDay = {
  key: string;
  label: string;
  isToday: boolean;
  hasPlanned: boolean;
  hasFks: boolean;
  hasExt: boolean;
  hasClub: boolean;
  hasMatch: boolean;
};

type Props = {
  title: string;
  summaryLabel: string;
  message: string;
  weekDays: WeekDay[];
  plannedThisWeek: number;
  weeklyGoal: number;
  activityStreak: number;
  onManageRoutine: () => void;
};

// ─── Activity badges config ───

type ActivityBadge = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
};

const BADGES: Record<string, ActivityBadge> = {
  match: {
    icon: "football-outline",
    label: "Match",
    color: palette.danger,
    bg: "rgba(239,68,68,0.12)",
  },
  club: {
    icon: "people-outline",
    label: "Club",
    color: palette.accent,
    bg: "rgba(255,122,26,0.12)",
  },
  fks: {
    icon: "barbell-outline",
    label: "Séance FKS",
    color: palette.success,
    bg: "rgba(22,163,74,0.12)",
  },
  planned: {
    icon: "calendar-outline",
    label: "Planifiée",
    color: palette.accent,
    bg: "rgba(255,122,26,0.10)",
  },
  ext: {
    icon: "fitness-outline",
    label: "Autre activité",
    color: palette.info,
    bg: "rgba(37,99,235,0.12)",
  },
  rest: {
    icon: "moon-outline",
    label: "Repos",
    color: palette.sub,
    bg: "rgba(161,161,170,0.10)",
  },
};

function getDayBadges(day: WeekDay): ActivityBadge[] {
  const result: ActivityBadge[] = [];
  if (day.hasMatch) result.push(BADGES.match);
  if (day.hasClub) result.push(BADGES.club);
  if (day.hasFks) result.push(BADGES.fks);
  else if (day.hasPlanned) result.push(BADGES.planned);
  if (day.hasExt) result.push(BADGES.ext);
  if (result.length === 0) result.push(BADGES.rest);
  return result;
}

function getDotStyle(day: WeekDay): { color: string; outline: boolean } | null {
  if (day.hasMatch) return { color: palette.danger, outline: false };
  if (day.hasClub) return { color: palette.accent, outline: false };
  if (day.hasFks) return { color: palette.success, outline: false };
  if (day.hasExt) return { color: palette.info, outline: false };
  if (day.hasPlanned) return { color: palette.accent, outline: true };
  return null;
}

function isDayCompleted(day: WeekDay): boolean {
  return day.hasFks || day.hasExt || day.hasClub || day.hasMatch;
}

function isDayPlannedOnly(day: WeekDay): boolean {
  return day.hasPlanned && !isDayCompleted(day);
}

function HomeWeekSummaryCardInner({
  title,
  summaryLabel,
  message,
  weekDays,
  plannedThisWeek,
  weeklyGoal,
  activityStreak,
  onManageRoutine,
}: Props) {
  if (__DEV__) console.log("[RENDER] HomeWeekSummaryCard");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const { impactLight } = useHaptics();

  const handleDayPress = (dayKey: string) => {
    impactLight();
    setSelectedDayKey((prev) => (prev === dayKey ? null : dayKey));
  };

  const selectedDay = selectedDayKey
    ? weekDays.find((d) => d.key === selectedDayKey) ?? null
    : null;

  const selectedBadges = selectedDay ? getDayBadges(selectedDay) : [];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>{summaryLabel} séances</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.accent }]} />
            <Text style={styles.legendText}>Fait</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotOutline]} />
            <Text style={styles.legendText}>Planifié</Text>
          </View>
        </View>
      </View>

      {/* Days row */}
      <View style={styles.daysRow}>
        {weekDays.map((d) => {
          const completed = isDayCompleted(d);
          const plannedOnly = isDayPlannedOnly(d);
          const dot = getDotStyle(d);
          const isSelected = selectedDayKey === d.key;

          return (
            <TouchableOpacity
              key={d.key}
              onPress={() => handleDayPress(d.key)}
              activeOpacity={0.7}
              style={[
                styles.dayCell,
                completed && styles.dayCellCompleted,
                plannedOnly && styles.dayCellPlanned,
                d.isToday && styles.dayCellToday,
                isSelected && styles.dayCellSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  d.isToday && styles.dayLabelToday,
                  completed && styles.dayLabelActive,
                ]}
              >
                {d.label}
              </Text>
              {dot ? (
                <View
                  style={[
                    styles.dayDot,
                    dot.outline
                      ? { borderWidth: 2, borderColor: dot.color, backgroundColor: "transparent" }
                      : { backgroundColor: dot.color },
                  ]}
                />
              ) : (
                <View style={styles.dayDotSpacer} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day detail panel */}
      {selectedDay && (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <View style={styles.detailDayPill}>
              <Text style={styles.detailDayText}>
                {selectedDay.label}{selectedDay.isToday ? " · Aujourd'hui" : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDayKey(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={palette.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.badgesRow}>
            {selectedBadges.map((badge, i) => (
              <View
                key={i}
                style={[styles.activityBadge, { backgroundColor: badge.bg }]}
              >
                <Ionicons name={badge.icon} size={14} color={badge.color} />
                <Text style={[styles.badgeText, { color: badge.color }]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Routine row */}
      <View style={styles.divider} />
      <View style={styles.routineRow}>
        <Text style={styles.routineText}>
          Objectif : {plannedThisWeek}/{weeklyGoal} cette semaine
        </Text>
        <TouchableOpacity onPress={onManageRoutine} style={styles.routineCta} activeOpacity={0.8}>
          <Text style={styles.routineCtaText}>Gérer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Card ───
  card: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },

  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  legendDotOutline: {
    borderWidth: 1.5,
    borderColor: palette.accent,
    backgroundColor: "transparent",
  },
  legendText: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "600",
  },

  // ─── Days Row ───
  daysRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  dayCellCompleted: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  dayCellPlanned: {
    backgroundColor: "transparent",
    borderColor: palette.accent,
    borderStyle: "dashed" as any,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: palette.accent,
  },
  dayCellSelected: {
    shadowColor: palette.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dayLabel: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dayLabelToday: {
    color: palette.accent,
    fontWeight: "800",
  },
  dayLabelActive: {
    color: palette.text,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dayDotSpacer: {
    width: 8,
    height: 8,
  },

  // ─── Detail Panel ───
  detailPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailDayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.accentSoft,
  },
  detailDayText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ─── Routine Row ───
  divider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 12,
    marginBottom: 10,
  },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routineText: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "600",
  },
  routineCta: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  routineCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.accent,
  },
});

export default React.memo(HomeWeekSummaryCardInner);
