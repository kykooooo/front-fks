// components/home/HomeWeekPlanCard.tsx
//
// É1.5 (voir C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md) — carte
// "Ta semaine" : remplace HomeNextSessionCard + le contenu "Progression" du
// Home quand FEATURES.WEEK_PLAN est ON (jamais monté si OFF, donc jamais de
// diff sur le Home actuel). Absorbe : mini-calendrier 7 jours
// (domain/weekPlanning.ts via useWeekPlan), prochaine séance FKS en une
// ligne, et la flamme de série (streak) pour ne pas perdre l'info
// "Progression" qu'elle remplace. Tap -> écran combiné "Semaine & Progression".
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { theme } from "../../constants/theme";
import { useWeekPlan } from "../../hooks/routine/useWeekPlan";
import { DOW_LABEL_SHORT, DAY_STATE_COLOR, explainDay, buildWeekSummary } from "../../hooks/routine/dayLabels";

const palette = theme.colors;

type Props = {
  streak: number;
  /** Point 3 revue web : distingue "jamais fait" de "série retombée à 0" — jamais "Nouvelle" pour un compte avec historique. */
  hasEverCompleted: boolean;
  onPress: () => void;
};

export default function HomeWeekPlanCard({ streak, hasEverCompleted, onPress }: Props) {
  const plan = useWeekPlan();
  const streakChipText = streak > 0 ? `${streak} j` : hasEverCompleted ? "Relance-la" : "Nouvelle";

  // Revue web post-É1.5 (point 1) : même fonction + mêmes données que l'écran
  // combiné (hooks/routine/dayLabels.buildWeekSummary), jamais une phrase
  // recalculée localement — élimine le "Aucune séance" ici / "1 séance :
  // jeudi" là-bas.
  const nextLabel = plan.isWeekOver
    ? buildWeekSummary(plan.rawPlan, "next")
    : buildWeekSummary(plan.remainingPlan, "current");

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card variant="soft" style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Ta semaine</Text>
          <View style={styles.streakChip}>
            <Ionicons name="flame" size={13} color={palette.cta} />
            <Text style={styles.streakText}>{streakChipText}</Text>
          </View>
        </View>

        <View style={styles.daysRow}>
          {plan.days.map((day) => {
            const state = explainDay(day).state;
            const isToday = day.dow === plan.todayDow;
            return (
              <View key={day.dow} style={styles.dayCol}>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {DOW_LABEL_SHORT[day.dow][0]}
                </Text>
                <View
                  style={[styles.dayPill, { backgroundColor: DAY_STATE_COLOR[state] }, isToday && styles.dayPillToday]}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.nextText} numberOfLines={1}>
            {nextLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={palette.sub} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 14, fontWeight: "800", color: palette.text },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.ctaSoft,
  },
  streakText: { fontSize: 11, fontWeight: "700", color: palette.cta },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 6, width: 28 },
  dayLabel: { fontSize: 10, fontWeight: "700", color: palette.sub },
  dayLabelToday: { color: palette.text },
  dayPill: { width: 22, height: 8, borderRadius: theme.radius.pill },
  dayPillToday: { borderWidth: 1.5, borderColor: palette.text },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.borderSoft,
  },
  nextText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: palette.text },
});
