// screens/RoutineScreen.tsx
//
// Routine v2 — É1 (voir C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md).
// Remplace intégralement l'ancien algo `suggestedPlan` (ignorait âge/cycle/
// fenêtres match) par `domain/weekPlanning.ts` (É0) via `useWeekPlan`. Écran
// fonctionnel sobre : mêmes briques que le reste de l'app (Screen/Card/
// Badge/Button/SectionHeader), aucune nouvelle direction visuelle.
//
// Accessible uniquement depuis SessionHubScreen derrière FEATURES.WEEK_PLAN —
// cet écran lui-même n'a pas besoin de vérifier le flag : la route "Routine"
// n'est navigable nulle part ailleurs dans l'app (audit design §1.3).
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { Screen } from "../components/ui/Screen";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { theme } from "../constants/theme";
import { useHaptics } from "../hooks/useHaptics";
import { useNavGuard } from "../hooks/useNavGuard";
import { showToast } from "../utils/toast";
import { useWeekPlan } from "../hooks/routine/useWeekPlan";
import {
  DOW_LABEL_SHORT,
  DAY_STATE_COLOR,
  explainDay,
  buildWeekSummary,
  formatShortDate,
} from "../hooks/routine/dayLabels";
import type { DowKey } from "../domain/weekPlanning";

const palette = theme.colors;

export default function RoutineScreen() {
  const nav = useNavigation<any>();
  const guardNav = useNavGuard();
  const haptics = useHaptics();
  const plan = useWeekPlan();
  const [expandedDow, setExpandedDow] = useState<DowKey | null>(null);

  const summary = buildWeekSummary(plan);

  const handleToggleMove = (dow: DowKey) => {
    haptics.impactLight();
    setExpandedDow((cur) => (cur === dow ? null : dow));
  };

  const handlePickTarget = (from: DowKey, to: DowKey) => {
    const result = plan.requestMove(from, to);
    if (result.allowed) {
      haptics.success();
      showToast({
        type: "success",
        title: `Déplacée vers ${DOW_LABEL_SHORT[to]}`,
        message: result.label || undefined,
      });
      setExpandedDow(null);
    } else {
      haptics.warning();
      showToast({ type: "warn", title: "Déplacement impossible", message: result.reason });
    }
  };

  const handleCancelMove = (from: DowKey) => {
    haptics.impactLight();
    plan.cancelMove(from);
  };

  return (
    <Screen style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <Text style={styles.heroKicker}>TA SEMAINE</Text>
          <Text style={styles.heroSubtitle}>{summary}</Text>
        </Card>

        {!plan.hasActiveCycle ? (
          <Card variant="soft" style={styles.cycleCard}>
            <Text style={styles.cycleTitle}>Aucun cycle actif</Text>
            <Text style={styles.cycleSubtitle}>
              Choisis ton cycle pour que FKS puisse te proposer des jours de séance.
            </Text>
            <Button
              label="Choisir un cycle"
              onPress={() =>
                guardNav(() => nav.navigate("CycleModal", { mode: "select", origin: "routine" }))
              }
              variant="secondary"
              size="sm"
              style={styles.cycleButton}
            />
          </Card>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Semaine" />
          <View style={styles.dayList}>
            {plan.days.map((day) => {
              const explanation = explainDay(day);
              const detail =
                !plan.hasActiveCycle && explanation.state === "rest_available"
                  ? "Pas de séance — choisis d'abord ton cycle."
                  : explanation.detail;
              const isToday = day.dow === plan.todayDow;
              const canMove = plan.hasActiveCycle && day.placement !== null && !day.movedFrom;
              const isExpanded = expandedDow === day.dow;

              return (
                <Card key={day.dow} variant="soft" style={[styles.dayCard, isToday && styles.dayCardToday] as any}>
                  <View style={styles.dayRow}>
                    <View style={styles.dayDateCol}>
                      <Text style={styles.dayDow}>{DOW_LABEL_SHORT[day.dow]}</Text>
                      <Text style={styles.dayDate}>{formatShortDate(plan.dateForDow(day.dow))}</Text>
                    </View>
                    <View style={styles.dayTextCol}>
                      <View style={styles.dayTitleRow}>
                        <View style={[styles.dayDot, { backgroundColor: DAY_STATE_COLOR[explanation.state] }]} />
                        <Text style={styles.dayTitle}>{explanation.title}</Text>
                      </View>
                      <Text style={styles.dayDetail}>{detail}</Text>
                    </View>
                  </View>

                  {canMove || day.movedTo ? (
                    <View style={styles.dayActionsRow}>
                      {canMove ? (
                        <TouchableOpacity onPress={() => handleToggleMove(day.dow)} activeOpacity={0.8}>
                          <Text style={styles.dayActionText}>{isExpanded ? "Fermer" : "Déplacer"}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {day.movedTo ? (
                        <TouchableOpacity onPress={() => handleCancelMove(day.dow)} activeOpacity={0.8}>
                          <Text style={styles.dayActionText}>Annuler le déplacement</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {isExpanded ? (
                    <View style={styles.movePicker}>
                      <Text style={styles.movePickerHint}>Déplacer vers :</Text>
                      <View style={styles.movePickerRow}>
                        {plan.getMoveTargets(day.dow).map((target) => (
                          <TouchableOpacity
                            key={target.dow}
                            onPress={() => handlePickTarget(day.dow, target.dow)}
                            style={[styles.moveChip, !target.allowed && styles.moveChipDisabled]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.moveChipText, !target.allowed && styles.moveChipTextDisabled]}>
                              {DOW_LABEL_SHORT[target.dow]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        </View>

        <Text style={styles.footnote}>Les déplacements sont enregistrés sur cet appareil.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 8 },

  heroCard: { borderRadius: 22, padding: 16, gap: 6 },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.sub,
  },
  heroSubtitle: { fontSize: 15, fontWeight: "700", color: palette.text },

  cycleCard: { borderRadius: 18, padding: 14, gap: 8 },
  cycleTitle: { fontSize: 14, fontWeight: "700", color: palette.text },
  cycleSubtitle: { fontSize: 12, color: palette.sub },
  cycleButton: { alignSelf: "flex-start" },

  dayList: { gap: 8 },
  dayCard: { borderRadius: 16, padding: 12, gap: 8 },
  dayCardToday: { borderColor: palette.accent },

  dayRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dayDateCol: { width: 44, alignItems: "center" },
  dayDow: { fontSize: 12, fontWeight: "800", color: palette.text },
  dayDate: { fontSize: 10, color: palette.sub, marginTop: 2 },

  dayTextCol: { flex: 1, gap: 2 },
  dayTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayDot: { width: 7, height: 7, borderRadius: 999 },
  dayTitle: { fontSize: 13, fontWeight: "700", color: palette.text },
  dayDetail: { fontSize: 12, color: palette.sub, lineHeight: 16 },

  dayActionsRow: { flexDirection: "row", gap: 16, paddingLeft: 56 },
  dayActionText: { fontSize: 12, fontWeight: "700", color: palette.accent },

  movePicker: { paddingLeft: 56, gap: 6 },
  movePickerHint: { fontSize: 11, color: palette.sub },
  movePickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moveChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  moveChipDisabled: {
    borderColor: palette.borderSoft,
    backgroundColor: "transparent",
  },
  moveChipText: { fontSize: 12, fontWeight: "700", color: palette.accent },
  moveChipTextDisabled: { color: palette.sub },

  footnote: { fontSize: 11, color: palette.sub, textAlign: "center" },
});
