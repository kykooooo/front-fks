// screens/HomeScreen.tsx
import React, { useMemo, useLayoutEffect, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { subDays, startOfWeek, addDays, format } from "date-fns";
import { fr } from "date-fns/locale";

import { useTrainingStore } from "../state/trainingStore";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { theme } from "../constants/theme";
import { useSettingsStore } from "../state/settingsStore";
import { useAppModeStore } from "../state/appModeStore";
import HomeReadinessCard from "../components/home/HomeReadinessCard";
import HomeCycleHero from "../components/home/HomeCycleHero";
import HomeNextSessionCard from "../components/home/HomeNextSessionCard";
import HomeWeekSummaryCard from "../components/home/HomeWeekSummaryCard";
import HomeDashboardCard from "../components/home/HomeDashboardCard";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId, MICROCYCLES } from "../domain/microcycles";
import { TRAINING_DEFAULTS } from "../config/trainingDefaults";
import { updateTrainingLoad } from "../engine/loadModel";

const palette = theme.colors;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toDateKey = (value?: string) => (value ?? "").slice(0, 10);

export default function HomeScreen() {
  type RootNav = {
    navigate: (screen: string, params?: any) => void;
    setOptions?: (opts: any) => void;
  };
  const nav = useNavigation<RootNav>();
  const resetTrainingStore = useTrainingStore((s) => s.resetForUser);
  const clearModeForUid = useAppModeStore((s) => s.clearForUid);

  const handleLogout = async () => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      await signOut(auth);
      resetTrainingStore(null);
      if (uid) {
        await clearModeForUid(uid);
      }
    } catch {
      Alert.alert("Déconnexion", "Échec de la déconnexion. Réessaie.");
    }
  };

  useLayoutEffect(() => {
    nav.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTitle: "",
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      headerRight: () => (
        <TouchableOpacity
          onPress={handleLogout}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text
            style={{
              fontWeight: "500",
              color: palette.sub,
              fontSize: 12,
            }}
          >
            Déconnexion
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [nav]);

  const startFirestoreWatch = useTrainingStore((s) => s.startFirestoreWatch);
  const storeHydrated = useTrainingStore((s) => (s as any).storeHydrated ?? true);

  useEffect(() => {
    if (!storeHydrated) return;
    startFirestoreWatch();
  }, [startFirestoreWatch, storeHydrated]);

  const phase = useTrainingStore((s) => s.phase);
  const phaseCount = useTrainingStore((s) => s.phaseCount);
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsb = useTrainingStore((s) => s.tsb);
  const tsbHistory = useTrainingStore((s) => s.tsbHistory ?? []);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const externalLoads = useTrainingStore((s) => s.externalLoads);
  const clubTrainingDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const runTestHarness = useTrainingStore((s) => s.runTestHarness);
  const plannedFksDays = useTrainingStore((s) => s.plannedFksDays ?? []);
  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const weeklyGoal = useSettingsStore((s) => s.weeklyGoal ?? 2);

  const dailyApplied = useTrainingStore((s) => s.dailyApplied);
  const lastAppliedDate = useTrainingStore((s) => s.lastAppliedDate);
  const hasAppliedToday =
    !!dailyApplied &&
    !!lastAppliedDate &&
    isSameDay(new Date(lastAppliedDate), new Date());

  const sessions = useTrainingStore((s) => s.sessions);
  const lastAiSessionV2 = useTrainingStore((s) => s.lastAiSessionV2);

  const loadSeries = useMemo(() => {
    const today = devNowISO ? new Date(devNowISO) : new Date();
    const daysBack = 7;
    const warmup = 21;
    const totalDays = daysBack + warmup;
    const orderedDays = Array.from({ length: totalDays }).map((_, idx) =>
      subDays(today, totalDays - 1 - idx)
    );
    let atlSeed = TRAINING_DEFAULTS.ATL0;
    let ctlSeed = TRAINING_DEFAULTS.CTL0;
    const atlArr: number[] = [];
    const ctlArr: number[] = [];

    orderedDays.forEach((d, idx) => {
      const key = d.toISOString().slice(0, 10);
      const load = Number(dailyApplied?.[key] ?? 0) || 0;
      const next = updateTrainingLoad(atlSeed, ctlSeed, load, { dtDays: 1 });
      atlSeed = next.atl;
      ctlSeed = next.ctl;
      if (idx >= warmup) {
        atlArr.push(Number(next.atl.toFixed(1)));
        ctlArr.push(Number(next.ctl.toFixed(1)));
      }
    });

    return { atlArr, ctlArr };
  }, [dailyApplied, devNowISO]);

  const pendingSession = useMemo(
    () =>
      [...sessions]
        .filter((s: any) => !s.completed)
        .sort((a: any, b: any) => {
          const da = new Date(a?.dateISO ?? a?.date ?? 0).getTime();
          const db = new Date(b?.dateISO ?? b?.date ?? 0).getTime();
          return db - da;
        })[0],
    [sessions]
  );

  const todayKey = useMemo(() => {
    const iso = devNowISO ?? new Date().toISOString();
    return iso.slice(0, 10);
  }, [devNowISO]);

  const fatigueText = useMemo(() => {
    if (tsb <= -15) return "Charge très élevée, calme le jeu.";
    if (tsb <= -8) return "Fatigué, privilégie léger/modéré.";
    if (tsb < 0) return "OK mais reste prudent.";
    return "Tu es prêt à envoyer de la qualité.";
  }, [tsb]);

  const readinessLabel = useMemo(() => {
    if (tsb <= -15) return "Surcharge";
    if (tsb <= -8) return "Fatigue";
    if (tsb < 0) return "Stable";
    return "Prêt";
  }, [tsb]);

  const chargeLabel = useMemo(() => {
    if (tsb <= -15) return "Charge très élevée";
    if (tsb <= -8) return "Charge élevée";
    if (tsb < 0) return "Charge modérée";
    return "Charge bien maîtrisée";
  }, [tsb]);

  const readinessPercent = useMemo(() => {
    const value = ((tsb + 20) / 30) * 100;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [tsb]);

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

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = d.toISOString().slice(0, 10);
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

  const onPressNew = () => {
    const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
    const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
    const cycleCompleted = Boolean(cycleId) && microIdx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
    if (!cycleId) {
      Alert.alert(
        "Choisir un cycle",
        "Choisis ton cycle (playlist) pour que FKS puisse te proposer des séances cohérentes.",
        [
          {
            text: "Choisir mon cycle",
            onPress: () => nav.navigate("CycleModal", { mode: "select", origin: "home" }),
          },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }
    if (cycleCompleted) {
      Alert.alert(
        "Cycle terminé",
        "Bien joué. Choisis un nouveau cycle pour continuer.",
        [
          {
            text: "Choisir un nouveau cycle",
            onPress: () => nav.navigate("CycleModal", { mode: "select", origin: "home" }),
          },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }

    if (pendingSession && !DEV_FLAGS.ENABLED) {
      const date = (pendingSession as any).dateISO?.slice(0, 10) ?? "";
      Alert.alert(
        "Feedback requis",
        date
          ? `Donne le feedback de la séance du ${date} avant d'en générer une nouvelle.`
          : "Donne le feedback de la dernière séance avant d'en générer une nouvelle.",
        [
          {
            text: "Feedback",
            onPress: () =>
              nav.navigate(
                "Feedback" as never,
                { sessionId: (pendingSession as any).id } as never
              ),
          },
          {
            text: "Voir la séance",
            onPress: () => {
              const v2 =
                (pendingSession as any).aiV2 ??
                (pendingSession as any).ai ??
                lastAiSessionV2?.v2;
              const plannedDateISO =
                (pendingSession as any).dateISO?.slice(0, 10) ?? "";
              if (v2) {
                nav.navigate("SessionPreview" as never, {
                  v2,
                  plannedDateISO,
                  sessionId: (pendingSession as any).id,
                } as never);
              }
            },
          },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }

    if (hasAppliedToday) {
      if (DEV_FLAGS.ENABLED) {
        // mode dev : on autorise plusieurs séances par jour
      } else {
        Alert.alert(
          "Déjà validé aujourd'hui",
          "Tu as déjà appliqué la charge pour aujourd'hui. Reviens demain ou ajoute une charge externe."
        );
        return;
      }
    }
    nav.navigate("NewSession");
  };

  const onPressPreview = () => {
    if (lastAiSessionV2) {
      nav.navigate(
        "SessionPreview" as never,
        {
          v2: lastAiSessionV2.v2,
          plannedDateISO: lastAiSessionV2.date,
          sessionId: lastAiSessionV2.sessionId,
        } as never
      );
      return;
    }

    const latest = [...sessions]
      .filter((s: any) => s?.aiV2 || s?.ai)
      .sort((a: any, b: any) => {
        const da = new Date(a.dateISO ?? a.date ?? 0).getTime();
        const db = new Date(b.dateISO ?? b.date ?? 0).getTime();
        return db - da;
      })[0];

    if (!latest) {
      Alert.alert(
        "Aucune séance IA",
        "Génère une séance d'abord pour la prévisualiser."
      );
      return;
    }

    const v2 = (latest as any).aiV2 ?? (latest as any).ai;
    const plannedDateISO = (latest as any).dateISO?.slice(0, 10) ?? "";
    if (!v2) {
      Alert.alert(
        "Séance sans blueprint",
        "Cette séance n'a pas de données IA associées."
      );
      return;
    }

    nav.navigate("SessionPreview" as never, {
      v2,
      plannedDateISO,
      sessionId: latest?.id,
    } as never);
  };

  const startPendingSession = () => {
    if (!pendingSession) return;
    const v2 =
      (pendingSession as any).aiV2 ??
      (pendingSession as any).ai ??
      lastAiSessionV2?.v2;
    const plannedDateISO =
      (pendingSession as any).dateISO?.slice(0, 10) ?? "";
    if (v2) {
      nav.navigate("SessionLive" as never, {
        v2,
        plannedDateISO,
        sessionId: (pendingSession as any).id,
      } as never);
      return;
    }
    nav.navigate("SessionPreview" as never, {
      v2: lastAiSessionV2?.v2,
      plannedDateISO,
      sessionId: (pendingSession as any).id,
    } as never);
  };

  const onRunHarness = () => {
    runTestHarness?.(7);
    Alert.alert(
      "Harness appliqué",
      "Charges auto + externes de test injectées sur 7 jours."
    );
  };

  const upcomingSessionLabel = useMemo(() => {
    if (!pendingSession) return "Aucune séance planifiée";
    const v2 = (pendingSession as any).aiV2 ?? (pendingSession as any).ai;
    if (v2) {
      const title = v2.title || "Séance IA";
      const focus = v2.focus_primary ? ` · ${v2.focus_primary}` : "";
      const intens = v2.intensity ? ` · ${v2.intensity}` : "";
      const dur =
        typeof v2.duration_min === "number" ? ` · ${Math.round(v2.duration_min)} min` : "";
      return `${title}${focus}${intens}${dur}`;
    }
    const focus = (pendingSession as any)?.focus ?? (pendingSession as any)?.modality ?? "-";
    const intens = (pendingSession as any)?.intensity ?? "-";
    return `Séance planifiée · ${intens} · ${focus}`;
  }, [pendingSession]);

  const nextSessionShort = useMemo(() => {
    if (!pendingSession) return "Aucune";
    const raw = (pendingSession as any).dateISO ?? (pendingSession as any).date ?? "";
    const dateKey = raw.slice(0, 10);
    if (!dateKey) return "À planifier";
    const target = new Date(`${dateKey}T00:00:00.000Z`);
    const today = devNowISO ? new Date(devNowISO) : new Date();
    const todayKeyLocal = today.toISOString().slice(0, 10);
    let when = format(target, "EEE dd MMM", { locale: fr });
    if (dateKey === todayKeyLocal) when = "Aujourd'hui";
    if (dateKey === addDays(today, 1).toISOString().slice(0, 10)) when = "Demain";

    const v2 = (pendingSession as any).aiV2 ?? (pendingSession as any).ai;
    const focus = v2?.focus_primary || v2?.focus || "";
    const label = focus ? `${when} · ${focus}` : when;
    return label;
  }, [pendingSession, devNowISO]);

  const weekKeySet = useMemo(
    () => new Set(weekDays.map((d) => d.key)),
    [weekDays]
  );

  const plannedThisWeek = useMemo(
    () => weekDays.filter((d) => d.hasPlanned).length,
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
    const remaining = Math.max(0, weeklyGoal - fksCount);
    const message =
      fksCount >= weeklyGoal
        ? "Bonne zone cette semaine."
        : remaining <= 1
        ? "Ajoute une séance légère pour optimiser."
        : `Ajoute ${remaining} séances légères pour optimiser.`;
    return { fksCount, extCount, message };
  }, [sessions, externalLoads, weekKeySet, weeklyGoal]);

  const tsbColor =
    tsb >= 0 ? palette.success : tsb <= -15 ? palette.danger : palette.accent;

  const athleteName = auth.currentUser?.displayName ?? "athlète";

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
      const key = subDays(base, i).toISOString().slice(0, 10);
      if (!activity.has(key)) break;
      count += 1;
    }
    return count;
  }, [sessions, externalLoads, devNowISO]);

  // Cycle info
  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleData = cycleId ? MICROCYCLES[cycleId] : null;
  const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
  const cycleProgressRatio = cycleId ? microIdx / MICROCYCLE_TOTAL_SESSIONS_DEFAULT : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.screenContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SIMPLE */}
        <View style={styles.header}>
          <Text style={styles.headerGreeting}>Salut, {athleteName}</Text>
        </View>

        {DEV_FLAGS.ENABLED && (
          <TouchableOpacity onPress={onRunHarness} style={styles.devChip}>
            <Text style={styles.devChipText}>
              Mode test : injecter charges club/match + externes (7j)
            </Text>
          </TouchableOpacity>
        )}

        {/* READINESS CARD - GROS GRAPHIQUE */}
        <HomeReadinessCard
          todayLabel={todayKey}
          tsb={tsb}
          tsbColor={tsbColor}
          readinessPercent={readinessPercent}
          readinessLabel={readinessLabel}
          fatigueText={fatigueText}
          phase={phase}
          phaseCount={phaseCount}
          atl={atl}
          ctl={ctl}
          tsbHistory={tsbHistory}
        />

        {/* CYCLE HERO */}
        {cycleData ? (
          <HomeCycleHero
            label={cycleData.label}
            sub={`${microIdx}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT} séances complétées`}
            iconName={cycleData.icon}
            progressRatio={cycleProgressRatio}
            primaryLabel="Voir le cycle"
            onPrimary={() => nav.navigate("CycleModal", { mode: "view", cycleId })}
            showManage
            onManage={() => nav.navigate("CycleModal", { mode: "select", origin: "home" })}
          />
        ) : (
          <HomeCycleHero
            label="Aucun cycle sélectionné"
            sub="Choisis un cycle pour structurer ta prépa"
            iconName={null}
            progressRatio={0}
            primaryLabel="Choisir un cycle"
            onPrimary={() => nav.navigate("CycleModal", { mode: "select", origin: "home" })}
          />
        )}

        {/* NEXT SESSION CARD */}
        <HomeNextSessionCard
          hasPending={!!pendingSession}
          upcomingLabel={upcomingSessionLabel}
          onPrimary={pendingSession ? startPendingSession : onPressNew}
          primaryLabel={pendingSession ? "Lancer la séance" : "Générer une séance"}
          onSecondary={onPressPreview}
          secondaryLabel="Voir la séance IA"
          onFeedback={
            pendingSession
              ? () =>
                  nav.navigate(
                    "Feedback" as never,
                    { sessionId: (pendingSession as any).id } as never
                  )
              : undefined
          }
        />

        {/* DASHBOARD CARD */}
        <HomeDashboardCard
          chargeLabel={chargeLabel}
          tsbText={fatigueText}
          tsbValue={tsb}
          tsbColor={tsbColor}
          atlSeries={loadSeries.atlArr}
          ctlSeries={loadSeries.ctlArr}
          weeklyCount={weekSummary.fksCount}
          nextLabel={nextSessionShort}
        />

        {/* WEEK SUMMARY CARD */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cette semaine</Text>
          <HomeWeekSummaryCard
            title=""
            summaryLabel={`${weekSummary.fksCount} FKS · ${weekSummary.extCount} club/match`}
            message={weekSummary.message}
            weekDays={weekDays}
            plannedThisWeek={plannedThisWeek}
            weeklyGoal={weeklyGoal}
            activityStreak={activityStreak}
            onManageRoutine={() => nav.navigate("Routine" as never)}
          />
        </View>

        {/* LIEN PROGRESSION */}
        <TouchableOpacity
          onPress={() => nav.navigate("Progression")}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>Voir ma progression complète</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
    backgroundColor: palette.bg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    marginBottom: 4,
  },
  headerGreeting: {
    fontSize: 28,
    fontWeight: "900",
    color: palette.text,
  },
  devChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  devChipText: {
    fontSize: 11,
    color: palette.sub,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
    paddingHorizontal: 4,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.accent,
  },
  linkArrow: {
    fontSize: 16,
    color: palette.accent,
    fontWeight: "700",
  },
});
