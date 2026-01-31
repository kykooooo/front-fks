import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { theme } from "../../constants/theme";

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

export default function HomeWeekSummaryCard({
  title,
  summaryLabel,
  message,
  weekDays,
  plannedThisWeek,
  weeklyGoal,
  activityStreak,
  onManageRoutine,
}: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        right={
          <View style={styles.sectionChip}>
            <Text style={styles.sectionChipText}>{summaryLabel}</Text>
          </View>
        }
      />

      <Card variant="soft" style={styles.weekCard}>
        <View style={styles.weekTopRow}>
          <Text style={styles.weekLabel}>Volume & séances</Text>
          <Text style={styles.weekHint}>{message}</Text>
        </View>

        <View style={styles.planDaysRow}>
          {weekDays.map((d) => {
            const isPlannedOnly = d.hasPlanned && !d.hasFks;
            let dotColor = palette.borderSoft;
            if (d.hasMatch) dotColor = palette.danger;
            else if (d.hasClub) dotColor = palette.accent;
            else if (d.hasFks) dotColor = palette.success;
            else if (d.hasExt) dotColor = palette.info;
            else if (d.hasPlanned) dotColor = palette.success;

            return (
              <View
                key={d.key + "_plan"}
                style={[
                  styles.planDay,
                  d.hasPlanned && styles.planDayActive,
                  d.isToday && styles.planDayToday,
                ]}
              >
                <Text
                  style={[
                    styles.planDayLabel,
                    d.hasPlanned && styles.planDayLabelActive,
                  ]}
                >
                  {d.label}
                </Text>
                <View
                  style={[
                    styles.planDayDot,
                    isPlannedOnly
                      ? [styles.planDayDotOutline, { borderColor: dotColor }]
                      : { backgroundColor: dotColor },
                  ]}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.weekLegendRow}>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: palette.success }]} />
            <Text style={styles.weekLegendText}>Séance FKS faite</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, styles.weekLegendDotOutline, { borderColor: palette.success }]} />
            <Text style={styles.weekLegendText}>Séance FKS à faire</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: palette.info }]} />
            <Text style={styles.weekLegendText}>Charge externe</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: palette.accent }]} />
            <Text style={styles.weekLegendText}>Entraînement club</Text>
          </View>
          <View style={styles.weekLegendItem}>
            <View style={[styles.weekLegendDot, { backgroundColor: palette.danger }]} />
            <Text style={styles.weekLegendText}>Match</Text>
          </View>
        </View>

        <View style={styles.routineDivider} />
        <View style={styles.routineRowSimple}>
          <Text style={styles.routineSummary}>
            Routine : {plannedThisWeek}/{weeklyGoal} cette semaine
          </Text>
          <TouchableOpacity onPress={onManageRoutine} style={styles.routineCta} activeOpacity={0.9}>
            <Text style={styles.routineCtaText}>Gérer</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  sectionChipText: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "600",
  },
  weekCard: {
    borderRadius: 18,
    padding: 12,
  },
  weekTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weekLabel: {
    fontSize: 12,
    color: palette.sub,
  },
  weekHint: {
    fontSize: 11,
    color: palette.sub,
  },
  planDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  planDay: {
    width: 36,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  planDayActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  planDayToday: {
    borderColor: palette.accent,
  },
  planDayLabel: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "600",
  },
  planDayLabelActive: {
    color: palette.accent,
    fontWeight: "700",
  },
  planDayDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  planDayDotOutline: {
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  weekLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  weekLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weekLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  weekLegendDotOutline: {
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  weekLegendText: {
    fontSize: 10,
    color: palette.sub,
  },
  routineDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 12,
    marginBottom: 10,
  },
  routineRowSimple: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  routineSummary: {
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
    backgroundColor: "transparent",
  },
  routineCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.accent,
  },
});
