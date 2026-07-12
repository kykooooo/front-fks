// screens/RoutineScreen.tsx
//
// Écran combiné "Semaine & Progression" — É1.5 (voir
// C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md). Fusionne le
// calendrier hebdo v2 (É1, `domain/weekPlanning.ts` via `useWeekPlan`) avec
// le contrôle d'objectif hebdo (Partie 3) et un résumé Progression (Partie 2)
// — jamais les milestones en détail ici, juste série + lien vers l'écran
// Progression complet, qui reste inchangé. Écran fonctionnel sobre : mêmes
// briques que le reste de l'app (Screen/Card/Badge/Button/SectionHeader),
// aucune nouvelle direction visuelle.
//
// Accessible depuis la carte "Ta semaine" du Home derrière FEATURES.WEEK_PLAN
// (route "Routine" — nom conservé pour ne pas toucher au typing de
// navigation, seul le titre affiché a changé).
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/ui/Screen";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { theme } from "../constants/theme";
import { useHaptics } from "../hooks/useHaptics";
import { useNavGuard } from "../hooks/useNavGuard";
import { showToast } from "../utils/toast";
import { useWeekPlan } from "../hooks/routine/useWeekPlan";
import { useWeeklyGoal, WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX } from "../hooks/useWeeklyGoal";
import { capFksForAge } from "../domain/weekPlanning";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useActivityStreak } from "../hooks/home/useActivityStreak";
import {
  DOW_LABEL_SHORT,
  DAY_STATE_COLOR,
  explainDay,
  buildWeekSummary,
  formatShortDate,
} from "../hooks/routine/dayLabels";
import type { DowKey } from "../domain/weekPlanning";

const palette = theme.colors;

const WEEKLY_GOAL_OPTIONS: number[] = Array.from(
  { length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 },
  (_, i) => WEEKLY_GOAL_MIN + i
);

export default function RoutineScreen() {
  const nav = useNavigation<any>();
  const guardNav = useNavGuard();
  const haptics = useHaptics();
  const plan = useWeekPlan();
  const [expandedDow, setExpandedDow] = useState<DowKey | null>(null);

  // ─── Partie 3 : objectif de séances/semaine ───
  const ageCategory = useExternalStore((s) => s.ageCategory) ?? "Senior";
  const { value: weeklyGoal, setWeeklyGoal, saving } = useWeeklyGoal();
  const ageCap = capFksForAge(ageCategory);
  const isAgeCapped = weeklyGoal > ageCap;

  // ─── Partie 2 : résumé Progression (série uniquement, jamais les milestones) ───
  const sessions = useSessionsStore((s) => s.sessions);
  const externalLoads = useExternalStore((s) => s.externalLoads ?? []);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const activityStreak = useActivityStreak(sessions, externalLoads, devNowISO ?? undefined);

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

  const handlePickWeeklyGoal = (n: number) => {
    if (n === weeklyGoal) return;
    haptics.impactLight();
    setWeeklyGoal(n);
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

        {/* Partie 3 — objectif de séances/semaine */}
        <View style={styles.section}>
          <SectionHeader title="Ton objectif" />
          <Card variant="soft" style={styles.goalCard}>
            <Text style={styles.goalLabel}>Séances FKS par semaine</Text>
            <View style={styles.goalChipsRow}>
              {WEEKLY_GOAL_OPTIONS.map((n) => {
                const selected = n === weeklyGoal;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => handlePickWeeklyGoal(n)}
                    disabled={saving}
                    style={[styles.goalChip, selected && styles.goalChipSelected]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.goalChipText, selected && styles.goalChipTextSelected]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isAgeCapped ? (
              <Text style={styles.goalHint}>
                À ton âge, {ageCap} séance{ageCap > 1 ? "s" : ""} FKS par semaine en plus du club, c'est le bon
                rythme.
              </Text>
            ) : null}
          </Card>
        </View>

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
              const stateColor = DAY_STATE_COLOR[explanation.state];

              return (
                <Card key={day.dow} variant="soft" style={[styles.dayCard, isToday && styles.dayCardToday] as any}>
                  <View style={styles.dayRow}>
                    <View style={[styles.dayDateCol, isToday && styles.dayDateColToday]}>
                      <Text style={[styles.dayDow, isToday && styles.dayDowToday]}>{DOW_LABEL_SHORT[day.dow]}</Text>
                      <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>
                        {formatShortDate(plan.dateForDow(day.dow))}
                      </Text>
                    </View>
                    <View style={[styles.dayStateBar, { backgroundColor: stateColor }]} />
                    <View style={styles.dayTextCol}>
                      <View style={styles.dayTitleRow}>
                        <View style={[styles.dayDot, { backgroundColor: stateColor }]} />
                        <Text style={styles.dayTitle}>{explanation.title}</Text>
                        {isToday ? <Text style={styles.dayTodayBadge}>Aujourd'hui</Text> : null}
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

        {/* Partie 2 — résumé Progression (série + lien, jamais les milestones ici) */}
        <View style={styles.section}>
          <SectionHeader title="Progression" />
          <Card variant="soft" style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Ionicons name="flame" size={18} color={palette.cta} />
              <Text style={styles.progressText}>
                {activityStreak === 0
                  ? "Lance ta première séance"
                  : activityStreak === 1
                    ? "1 jour d'affilée"
                    : `${activityStreak} jours d'affilée`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => guardNav(() => nav.navigate("Progression"))}
              style={styles.progressLink}
              activeOpacity={0.8}
            >
              <Text style={styles.progressLinkText}>Voir ma progression</Text>
              <Text style={styles.progressLinkArrow}>→</Text>
            </TouchableOpacity>
          </Card>
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

  goalCard: { borderRadius: 18, padding: 14, gap: 10 },
  goalLabel: { fontSize: 12, color: palette.sub, fontWeight: "600" },
  goalChipsRow: { flexDirection: "row", gap: 8 },
  goalChip: {
    width: 44,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  goalChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  goalChipText: { fontSize: 15, fontWeight: "800", color: palette.sub },
  goalChipTextSelected: { color: palette.accent },
  goalHint: { fontSize: 12, color: palette.sub, lineHeight: 17 },

  dayList: { gap: 8 },
  dayCard: { borderRadius: 16, padding: 12, gap: 8 },
  dayCardToday: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },

  dayRow: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  dayDateCol: { width: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 4 },
  dayDateColToday: { backgroundColor: palette.card },
  dayDow: { fontSize: 12, fontWeight: "800", color: palette.text },
  dayDowToday: { color: palette.accent },
  dayDate: { fontSize: 10, color: palette.sub, marginTop: 2 },
  dayDateToday: { color: palette.accent },

  dayStateBar: { width: 3, borderRadius: theme.radius.pill },

  dayTextCol: { flex: 1, gap: 2, justifyContent: "center" },
  dayTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayDot: { width: 7, height: 7, borderRadius: 999 },
  dayTitle: { fontSize: 13, fontWeight: "700", color: palette.text },
  dayTodayBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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

  progressCard: { borderRadius: 18, padding: 14, gap: 10 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressText: { fontSize: 13, color: palette.text, fontWeight: "700" },
  progressLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  progressLinkText: { fontSize: 13, fontWeight: "700", color: palette.accent },
  progressLinkArrow: { fontSize: 14, color: palette.accent },

  footnote: { fontSize: 11, color: palette.sub, textAlign: "center" },
});
