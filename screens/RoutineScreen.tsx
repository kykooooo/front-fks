import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { addDays, format, parseISO, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";

import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useSettingsStore } from "../state/settingsStore";
import { toDateKey } from "../utils/dateHelpers";

const palette = theme.colors;
const REMINDER_LABELS: Record<string, string> = {
  prev_evening: "Veille 20h",
  same_morning: "Jour 9h",
  two_hours: "2h avant",
};
const REMINDER_HINTS: Record<string, string> = {
  prev_evening: "La veille à 20h pour préparer la séance.",
  same_morning: "Le matin même à 9h pour lancer la journée.",
  two_hours: "Deux heures avant la séance planifiée.",
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function RoutineScreen() {
  const nav = useNavigation<any>();
  const sessions = useSessionsStore((s) => s.sessions);
  const externalLoads = useExternalStore((s) => s.externalLoads);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useExternalStore((s) => s.matchDays ?? []);
  const plannedFksDays = useSyncStore((s) => s.plannedFksDays ?? []);
  const togglePlannedFksDay = useSyncStore((s) => s.togglePlannedFksDay);
  const setPlannedFksDays = useSyncStore((s) => s.setPlannedFksDays);
  const devNowISO = useDebugStore((s) => s.devNowISO);

  const weekStart = useSettingsStore((s) => s.weekStart);
  const weeklyGoal = useSettingsStore((s) => s.weeklyGoal ?? 2);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const sessionReminders = useSettingsStore((s) => s.sessionReminders);
  const reminderStrategy = useSettingsStore((s) => s.reminderStrategy);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const weekStartIndex = weekStart === "sun" ? 0 : 1;
  const weekDays = useMemo(() => {
    const todayReal = devNowISO ? new Date(devNowISO) : new Date();
    const start = startOfWeek(todayReal, { weekStartsOn: weekStartIndex });
    const days: {
      key: string;
      label: string;
      isToday: boolean;
      hasFks: boolean;
      hasExt: boolean;
      hasClub: boolean;
      hasMatch: boolean;
      hasPlanned: boolean;
    }[] = [];

    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, i);
      const key = toDateKey(d);
      const label = format(d, "EEEEE", { locale: fr }).toUpperCase();

      const hasFks = sessions.some((s: any) => {
        const dateStr = toDateKey(s?.dateISO ?? s?.date);
        return dateStr === key && s.completed;
      });

      const hasExt = (externalLoads ?? []).some((e: any) => {
        const dateStr = toDateKey(e?.dateISO ?? e?.date);
        return dateStr === key;
      });

      const dow = format(d, "eee", { locale: fr }).toLowerCase().slice(0, 3);
      const map: Record<string, string> = {
        lun: "mon",
        mar: "tue",
        mer: "wed",
        jeu: "thu",
        ven: "fri",
        sam: "sat",
        dim: "sun",
      };
      const hasClub = clubTrainingDays.includes(map[dow] ?? "");
      const hasMatch = matchDays.includes(map[dow] ?? "");
      const hasPlanned = plannedFksDays.includes(key);

      days.push({
        key,
        label,
        isToday: isSameDay(d, todayReal),
        hasFks,
        hasExt,
        hasClub,
        hasMatch,
        hasPlanned,
      });
    }

    return days;
  }, [
    sessions,
    externalLoads,
    clubTrainingDays,
    matchDays,
    plannedFksDays,
    weekStartIndex,
    devNowISO,
  ]);

  const weekKeySet = useMemo(
    () => new Set(weekDays.map((d) => d.key)),
    [weekDays]
  );

  const weekSummary = useMemo(() => {
    const fksCount = sessions.filter((s: any) => {
      const key = toDateKey(s?.dateISO ?? s?.date);
      return s.completed && weekKeySet.has(key);
    }).length;
    const extCount = (externalLoads ?? []).filter((e: any) => {
      const key = toDateKey(e?.dateISO ?? e?.date);
      return weekKeySet.has(key);
    }).length;
    return { fksCount, extCount };
  }, [sessions, externalLoads, weekKeySet]);

  const plannedThisWeek = useMemo(
    () => weekDays.filter((d) => d.hasPlanned).length,
    [weekDays]
  );

  const activityStreak = useMemo(() => {
    const activity = new Set<string>();
    sessions
      .filter((s: any) => s.completed)
      .forEach((s: any) => activity.add(toDateKey(s?.dateISO ?? s?.date)));
    (externalLoads ?? []).forEach((e: any) =>
      activity.add(toDateKey(e?.dateISO ?? e?.date))
    );

    const base = devNowISO ? new Date(devNowISO) : new Date();
    let count = 0;
    for (let i = 0; i < 10; i += 1) {
      const key = toDateKey(subDays(base, i));
      if (!activity.has(key)) break;
      count += 1;
    }
    return count;
  }, [sessions, externalLoads, devNowISO]);

  const suggestedPlan = useMemo(() => {
    const target = Math.max(1, Math.min(6, Math.round(weeklyGoal)));
    if (!weekDays.length) return [];

    const basePool = weekDays.map((d, idx) => ({ idx, d }));
    let pool = basePool.filter(({ d }) => !d.hasMatch && !d.hasClub);
    if (pool.length < target) {
      pool = basePool.filter(({ d }) => !d.hasMatch);
    }
    if (pool.length < target) {
      pool = basePool;
    }

    const available = pool.map((p) => p.idx);
    const patterns: Record<number, number[]> = {
      1: [2],
      2: [1, 4],
      3: [1, 3, 5],
      4: [0, 2, 4, 6],
      5: [0, 1, 3, 4, 6],
      6: [0, 1, 2, 4, 5, 6],
    };
    const pattern = patterns[target] ?? patterns[2];
    const used = new Set<number>();
    const picks: number[] = [];

    const pickClosest = (targetIdx: number) => {
      let bestIdx: number | null = null;
      let bestDist = 99;
      for (const idx of available) {
        if (used.has(idx)) continue;
        const dist = Math.abs(targetIdx - idx);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
      if (bestIdx == null) return;
      used.add(bestIdx);
      picks.push(bestIdx);
    };

    pattern.forEach(pickClosest);
    for (const idx of available) {
      if (picks.length >= target) break;
      if (used.has(idx)) continue;
      used.add(idx);
      picks.push(idx);
    }

    return picks
      .filter((idx) => weekDays[idx])
      .slice(0, target)
      .map((idx) => weekDays[idx].key);
  }, [weekDays, weeklyGoal]);

  const nextPlannedDay = useMemo(() => {
    if (!weekDays.length) return null;
    const todayKey = toDateKey(devNowISO ?? new Date());
    const todayIndex = weekDays.findIndex((d) => d.key === todayKey);
    if (todayIndex < 0) {
      return weekDays.find((d) => d.hasPlanned) ?? null;
    }
    for (let i = 0; i < weekDays.length; i += 1) {
      const idx = (todayIndex + i) % weekDays.length;
      if (weekDays[idx]?.hasPlanned) return weekDays[idx];
    }
    return null;
  }, [weekDays, devNowISO]);

  const nextPlannedLabel = useMemo(() => {
    if (!nextPlannedDay) return null;
    const label = format(parseISO(nextPlannedDay.key), "EEEE", { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [nextPlannedDay]);

  const reminderDetail = useMemo(() => {
    if (!nextPlannedDay) return "Planifie une séance pour activer un rappel.";
    if (!notificationsEnabled || !sessionReminders) {
      return "Active les notifications pour recevoir tes rappels.";
    }
    if (reminderStrategy === "two_hours") {
      return `${nextPlannedLabel ?? "Séance"} · 2h avant`;
    }
    const baseDate =
      reminderStrategy === "prev_evening"
        ? subDays(parseISO(nextPlannedDay.key), 1)
        : parseISO(nextPlannedDay.key);
    const dayLabel = format(baseDate, "EEEE", { locale: fr });
    const dayCapitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
    const hour = reminderStrategy === "prev_evening" ? "20h" : "9h";
    return `${dayCapitalized} à ${hour}`;
  }, [
    nextPlannedDay,
    reminderStrategy,
    notificationsEnabled,
    sessionReminders,
    nextPlannedLabel,
  ]);

  const routineChallenges = useMemo(() => {
    const targetGoal = Math.max(1, Math.min(6, Math.round(weeklyGoal)));
    return [
      {
        key: "weekly",
        title: "Séances FKS",
        subtitle: `${targetGoal} séances cette semaine`,
        progress: weekSummary.fksCount,
        target: targetGoal,
      },
      {
        key: "plan",
        title: "Planifier la semaine",
        subtitle: "Réserve tes créneaux FKS",
        progress: plannedThisWeek,
        target: targetGoal,
      },
      {
        key: "streak",
        title: "Série d'activité",
        subtitle: "4 jours actifs d'affilée",
        progress: Math.min(activityStreak, 4),
        target: 4,
      },
    ];
  }, [weekSummary.fksCount, plannedThisWeek, activityStreak, weeklyGoal]);

  const handleAutoPlan = () => {
    const preserved = plannedFksDays.filter((d) => !weekKeySet.has(d));
    const next = [...preserved, ...suggestedPlan];
    setPlannedFksDays?.(next);
  };

  const handleClearPlan = () => {
    const preserved = plannedFksDays.filter((d) => !weekKeySet.has(d));
    setPlannedFksDays?.(preserved);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>ROUTINE</Text>
          <Text style={styles.heroTitle}>Planifie ta semaine</Text>
          <Text style={styles.heroSubtitle}>
            {nextPlannedLabel
              ? `Prochaine séance prévue: ${nextPlannedLabel}`
              : "Choisis des créneaux fixes pour rester régulier."}
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Planifié</Text>
              <Text style={styles.heroStatValue}>
                {plannedThisWeek}/{weeklyGoal}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Série</Text>
              <Text style={styles.heroStatValue}>{activityStreak} j</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>FKS semaine</Text>
              <Text style={styles.heroStatValue}>{weekSummary.fksCount}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader
            title="Plan hebdo"
            right={<Badge label={`${plannedThisWeek}/${weeklyGoal}`} />}
          />
          <Card variant="soft" style={styles.planCard}>
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
                  <TouchableOpacity
                    key={`${d.key}-plan`}
                    onPress={() => togglePlannedFksDay?.(d.key)}
                    style={[
                      styles.planDay,
                      d.hasPlanned && styles.planDayActive,
                      d.isToday && styles.planDayToday,
                    ]}
                    activeOpacity={0.85}
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
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.planActionsRow}>
              <Button
                label="Auto-planifier"
                onPress={handleAutoPlan}
                variant="secondary"
                size="sm"
                style={styles.planAction}
              />
              <Button
                label="Effacer"
                onPress={handleClearPlan}
                variant="ghost"
                size="sm"
                style={styles.planAction}
              />
            </View>
            <Text style={styles.planHint}>
              Tap sur un jour pour l'ajouter ou l'enlever.
            </Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.success }]}
                />
                <Text style={styles.legendText}>Séance FKS faite</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    styles.legendDotOutline,
                    { borderColor: palette.success },
                  ]}
                />
                <Text style={styles.legendText}>Séance FKS à faire</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.accent }]}
                />
                <Text style={styles.legendText}>Club</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.info }]}
                />
                <Text style={styles.legendText}>Charge externe</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.danger }]}
                />
                <Text style={styles.legendText}>Match</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Mini-challenges"
            right={
              <TouchableOpacity onPress={() => nav.navigate("Profile")}>
                <Text style={styles.sectionLink}>Voir les badges</Text>
              </TouchableOpacity>
            }
          />
          <Card variant="soft" style={styles.challengeCard}>
            <View style={styles.challengeList}>
              {routineChallenges.map((item) => {
                const target = Math.max(1, item.target);
                const progress = Math.min(item.progress, target);
                const pct = Math.round((progress / target) * 100);
                const done = item.progress >= target;
                return (
                  <View key={item.key} style={styles.challengeItem}>
                    <View style={styles.challengeTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.challengeItemTitle}>{item.title}</Text>
                        <Text style={styles.challengeItemSubtitle}>{item.subtitle}</Text>
                      </View>
                      <Badge
                        label={done ? "Validé" : `${item.progress}/${target}`}
                        tone={done ? "ok" : "default"}
                      />
                    </View>
                    <View style={styles.challengeTrack}>
                      <View style={[styles.challengeFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Rappels" />
          <Card variant="soft" style={styles.reminderCard}>
            <View style={styles.reminderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderTitle}>Rappels intelligents</Text>
                <Text style={styles.reminderSubtitle}>
                  {notificationsEnabled && sessionReminders
                    ? "Rappels actifs avant tes séances planifiées."
                    : "Active les rappels pour rester régulier."}
                </Text>
                <Text style={styles.reminderDetail}>{reminderDetail}</Text>
              </View>
              <Badge
                label={
                  notificationsEnabled && sessionReminders ? "Actifs" : "Coupés"
                }
                tone={
                  notificationsEnabled && sessionReminders ? "ok" : "default"
                }
              />
            </View>
            <View style={styles.reminderOptions}>
              {(Object.keys(REMINDER_LABELS) as Array<keyof typeof REMINDER_LABELS>).map(
                (key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() =>
                      updateSettings({ reminderStrategy: key as "prev_evening" | "same_morning" | "two_hours" })
                    }
                    style={[
                      styles.reminderOption,
                      reminderStrategy === key && styles.reminderOptionActive,
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.reminderOptionText,
                        reminderStrategy === key &&
                          styles.reminderOptionTextActive,
                      ]}
                    >
                      {REMINDER_LABELS[key]}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            <Text style={styles.reminderHint}>
              {REMINDER_HINTS[reminderStrategy] ?? ""}
            </Text>
            <TouchableOpacity
              onPress={() => nav.navigate("Settings")}
              style={styles.reminderCta}
              activeOpacity={0.9}
            >
              <Text style={styles.reminderCtaText}>Gérer les notifications</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionLink: { fontSize: 11, color: palette.accent, fontWeight: "600" },

  heroCard: {
    borderRadius: 22,
    padding: 16,
    overflow: "hidden",
    gap: 6,
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.8,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: palette.sub,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: palette.sub,
  },
  heroStatsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: palette.sub,
  },
  heroStatValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  heroDivider: {
    width: 1,
    height: 26,
    backgroundColor: palette.borderSoft,
  },

  planCard: { borderRadius: 18, padding: 12, gap: 10 },
  planDaysRow: { flexDirection: "row", justifyContent: "space-between" },
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
    fontWeight: "600",
    color: palette.sub,
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
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  planActionsRow: { flexDirection: "row", gap: 8 },
  planAction: { flex: 1 },
  planHint: { fontSize: 11, color: palette.sub },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 999 },
  legendDotOutline: { backgroundColor: "transparent", borderWidth: 1 },
  legendText: { fontSize: 10, color: palette.sub },

  challengeCard: { borderRadius: 18, padding: 12 },
  challengeList: { gap: 10 },
  challengeItem: { gap: 6 },
  challengeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  challengeItemTitle: { fontSize: 12, fontWeight: "700", color: palette.text },
  challengeItemSubtitle: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  challengeTrack: {
    height: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    overflow: "hidden",
  },
  challengeFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.accent,
  },

  reminderCard: { borderRadius: 18, padding: 12, gap: 10 },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reminderTitle: { fontSize: 13, fontWeight: "700", color: palette.text },
  reminderSubtitle: { fontSize: 11, color: palette.sub, marginTop: 4 },
  reminderDetail: { fontSize: 11, color: palette.text, marginTop: 6 },
  reminderOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reminderOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  reminderOptionActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  reminderOptionText: { fontSize: 11, color: palette.sub, fontWeight: "600" },
  reminderOptionTextActive: { color: palette.accent },
  reminderHint: { fontSize: 11, color: palette.sub },
  reminderCta: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  reminderCtaText: { fontSize: 11, fontWeight: "700", color: palette.text },
});
