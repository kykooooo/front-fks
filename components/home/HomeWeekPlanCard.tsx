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
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { MICROCYCLES, isMicrocycleId } from "../../domain/microcycles";
import { DOW_LABEL_SHORT, DOW_LABEL_FULL, DAY_STATE_COLOR, explainDay } from "../../hooks/routine/dayLabels";

const palette = theme.colors;

type Props = {
  streak: number;
  onPress: () => void;
};

export default function HomeWeekPlanCard({ streak, onPress }: Props) {
  const plan = useWeekPlan();
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;

  const todayIdx = plan.days.findIndex((d) => d.dow === plan.todayDow);
  const upcoming = todayIdx >= 0 ? plan.days.slice(todayIdx).find((d) => d.placement !== null) : undefined;

  const nextLabel = !plan.hasActiveCycle
    ? "Choisis ton cycle pour activer ta semaine."
    : !upcoming
      ? "Aucune séance programmée cette semaine."
      : `Prochaine séance : ${upcoming.dow === plan.todayDow ? "aujourd'hui" : DOW_LABEL_FULL[upcoming.dow]}${cycleLabel ? ` — ${cycleLabel}` : ""}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card variant="soft" style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Ta semaine</Text>
          <View style={styles.streakChip}>
            <Ionicons name="flame" size={13} color={palette.cta} />
            <Text style={styles.streakText}>{streak > 0 ? `${streak} j` : "Nouvelle"}</Text>
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
