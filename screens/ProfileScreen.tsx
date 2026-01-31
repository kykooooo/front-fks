// screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTrainingStore } from '../state/trainingStore';
import { auth } from '../services/firebase';
import { computeStreakStats, lastNDates } from '../state/trainingStore/helpers';
import { toDayKey } from '../engine/dailyAggregation';
import { theme } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Button } from '../components/ui/Button';
import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  type MicrocycleId,
  isMicrocycleId,
} from "../domain/microcycles";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";

const palette = theme.colors;
const TESTS_STORAGE_KEY = "fks_tests_v1";
const TESTS_RECENCY_DAYS = 30;

const daysBetween = (fromTs: number, toTs: number) => {
  const ms = Math.max(0, toTs - fromTs);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
};

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
};

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card variant="soft" style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </Card>
  );
}

type TagTone = "default" | "ok" | "warn" | "danger";

function Tag({ label, tone = "default" }: { label: string; tone?: TagTone }) {
  return <Badge label={label} tone={tone} style={styles.tag} />;
}

type BadgeTone = "default" | "ok" | "warn" | "danger";
type BadgeTier = "none" | "bronze" | "silver" | "gold";
type BadgeThresholds = { bronze: number; silver: number; gold: number };

const tierLabelMap: Record<BadgeTier, string> = {
  none: "Base",
  bronze: "Bronze",
  silver: "Argent",
  gold: "Or",
};

const tierToneMap: Record<BadgeTier, BadgeTone> = {
  none: "default",
  bronze: "warn",
  silver: "ok",
  gold: "ok",
};

const getTier = (value: number, thresholds: BadgeThresholds): BadgeTier => {
  if (value >= thresholds.gold) return "gold";
  if (value >= thresholds.silver) return "silver";
  if (value >= thresholds.bronze) return "bronze";
  return "none";
};

const labelize = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function ProfileScreen() {
  const nav = useNavigation<any>();

  const sessions = useTrainingStore((s) => s.sessions);
  const phase = useTrainingStore((s) => s.phase);
  const phaseCount = useTrainingStore((s) => s.phaseCount);
  const tsb = useTrainingStore((s) => s.tsb);
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsbHistory = useTrainingStore((s) => s.tsbHistory ?? []);
  const dailyApplied = useTrainingStore((s) => s.dailyApplied ?? {});
  const clubDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
  const profile = useTrainingStore((s) => s.lastAiContext?.profile ?? null);

  const [testsCount, setTestsCount] = useState(0);
  const [lastTestTs, setLastTestTs] = useState<number | null>(null);
  const [lastTestPlaylist, setLastTestPlaylist] = useState<MicrocycleId | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TESTS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Array<any>;
        if (!Array.isArray(parsed)) return;
        if (alive) setTestsCount(parsed.length);
        const latest = [...parsed].sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0))[0];
        const latestTs = Number(latest?.ts ?? 0);
        if (alive && Number.isFinite(latestTs) && latestTs > 0) setLastTestTs(latestTs);
        const pick = latest?.playlist;
        if (alive && isMicrocycleId(pick)) setLastTestPlaylist(pick);
      } catch {
        // best effort
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const athleteName =
    profile?.first_name?.trim() || auth.currentUser?.displayName || 'Athlète';
  const athleteLevel = labelize(profile?.level);
  const athletePosition = labelize(profile?.position);
  const athleteFoot = labelize(profile?.dominant_foot);
  const mainObjective = profile?.main_objective?.trim() ?? null;
  const targetFks =
    typeof profile?.target_fks_sessions_per_week === "number"
      ? profile?.target_fks_sessions_per_week
      : null;
  const clubPerWeek =
    typeof profile?.club_trainings_per_week === "number"
      ? profile?.club_trainings_per_week
      : null;
  const matchesPerWeek =
    typeof profile?.matches_per_week === "number" ? profile?.matches_per_week : null;

  const testsAgeDays = useMemo(() => {
    if (!lastTestTs) return null;
    return daysBetween(lastTestTs, Date.now());
  }, [lastTestTs]);
  const testsFresh = testsAgeDays != null ? testsAgeDays <= TESTS_RECENCY_DAYS : false;
  const shouldSuggestTests = testsCount === 0 || !testsFresh;

  const recommendation = useMemo(
    () => recommendMicrocycle({ mainObjective, lastTestPlaylist }),
    [mainObjective, lastTestPlaylist]
  );
  const recommendedId = recommendation.id;

  const completedCount = useMemo(
    () => sessions.filter((s: any) => s.completed).length,
    [sessions]
  );
  const plannedCount = useMemo(
    () => sessions.filter((s: any) => !s.completed).length,
    [sessions]
  );

  const lastSessionDate = useMemo(() => {
    const done = [...sessions]
      .filter((s: any) => s.completed)
      .sort(
        (a, b) =>
          new Date(b.dateISO ?? b.date ?? 0).getTime() -
          new Date(a.dateISO ?? a.date ?? 0).getTime()
      );
    if (!done.length) return '—';
    const d = done[0].dateISO ?? done[0].date;
    if (!d) return '—';
    return format(new Date(d), "dd MMM", { locale: fr });
  }, [sessions]);

  const recentSessions = useMemo(() => {
    const done = [...sessions]
      .filter((s: any) => s.completed)
      .sort(
        (a, b) =>
          new Date(b.dateISO ?? b.date ?? 0).getTime() -
          new Date(a.dateISO ?? a.date ?? 0).getTime()
      )
      .slice(0, 3);
    return done.map((session: any) => {
      const v2 = session?.aiV2 ?? session?.ai;
      const title =
        v2?.title ||
        session?.focus ||
        session?.modality ||
        'Séance FKS';
      const focus = labelize(v2?.focus_primary ?? session?.focus ?? session?.modality);
      const intensity = labelize(v2?.intensity ?? session?.intensity);
      const dateISO = session?.dateISO ?? session?.date ?? null;
      const dateLabel = dateISO ? format(new Date(dateISO), 'dd MMM', { locale: fr }) : '—';
      const rpe = session?.feedback?.rpe ?? session?.rpe;
      return {
        id: session?.id ?? `${title}_${dateLabel}`,
        title,
        focus,
        intensity,
        dateLabel,
        rpe,
      };
    });
  }, [sessions]);

  const tsbLabel = tsb >= 0 ? 'Frais' : tsb <= -10 ? 'Fatigué' : 'En charge modérée';
  const tsbColor =
    tsb >= 0 ? palette.success : tsb <= -10 ? palette.danger : palette.accent;

  const tsbTrend = useMemo(() => {
    const vals = [...tsbHistory].slice(0, 7);
    if (vals.length < 2) return 'stable';
    const diff = vals[0] - vals[vals.length - 1];
    if (diff > 2) return 'en montée';
    if (diff < -2) return 'en baisse';
    return 'stable';
  }, [tsbHistory]);

  const todayKey = useMemo(
    () => toDayKey(devNowISO ?? new Date().toISOString()),
    [devNowISO]
  );
  const last7Keys = useMemo(() => lastNDates(todayKey, 7), [todayKey]);
  const loadHistory = useMemo(
    () =>
      last7Keys.map((k) => {
        const value = Number(dailyApplied?.[k] ?? 0);
        return Number.isFinite(value) ? Math.max(0, value) : 0;
      }),
    [last7Keys, dailyApplied]
  );
  const loadMax = useMemo(
    () => Math.max(0, ...loadHistory),
    [loadHistory]
  );
  const loadScaleMax = useMemo(
    () => Math.max(10, loadMax || 0),
    [loadMax]
  );
  const loadAvg = useMemo(() => {
    if (loadHistory.length === 0) return 0;
    const total = loadHistory.reduce((sum, v) => sum + v, 0);
    return total / loadHistory.length;
  }, [loadHistory]);

  const fatigueTag =
    tsb <= -15 ? 'Fatigue élevée' : tsb <= -8 ? 'Fatigue modérée' : 'Fatigue OK';
  const riskTag =
    tsb <= -12 ? 'Risque : à surveiller' : tsb < -5 ? 'Risque : modéré' : 'Risque : bas';
  const fatigueTone: TagTone = tsb <= -15 ? "danger" : tsb <= -8 ? "warn" : "ok";
  const riskTone: TagTone = tsb <= -12 ? "danger" : tsb < -5 ? "warn" : "ok";
  const trendTone: TagTone =
    tsbTrend === "en baisse" ? "warn" : tsbTrend === "en montée" ? "ok" : "default";

  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleTotal = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const cycleCompleted = Math.min(cycleTotal, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));
  const cycleNext = Math.min(cycleTotal, cycleCompleted + 1);
  const cycleProgress = cycleId ? cycleCompleted / cycleTotal : null;
  const cycleDone = Boolean(cycleId) && cycleCompleted >= cycleTotal;

  const streaks = useMemo(
    () =>
      computeStreakStats(
        sessions as any,
        [] as any,
        devNowISO ?? new Date().toISOString()
      ),
    [sessions, devNowISO]
  );

  const last7Set = useMemo(() => new Set(last7Keys), [last7Keys]);
  const last7Completed = useMemo(
    () =>
      sessions.filter((s: any) => {
        if (!s?.completed) return false;
        const dayKey = toDayKey(s.dateISO ?? s.date ?? new Date().toISOString());
        return last7Set.has(dayKey);
      }).length,
    [sessions, last7Set]
  );
  const loadDays = useMemo(
    () => loadHistory.filter((v) => v > 0).length,
    [loadHistory]
  );
  const weeklyGoal = Math.max(1, targetFks ?? 2);
  const weeklyThresholds = useMemo(
    () => ({
      bronze: weeklyGoal,
      silver: weeklyGoal + 1,
      gold: weeklyGoal + 2,
    }),
    [weeklyGoal]
  );
  const streakThresholds = useMemo(
    () => ({ bronze: 2, silver: 4, gold: 8 }),
    []
  );
  const loadThresholds = useMemo(
    () => ({ bronze: 4, silver: 5, gold: 6 }),
    []
  );
  const vmaThresholds = useMemo(
    () => ({ bronze: 2, silver: 4, gold: 6 }),
    []
  );
  const badgeItems = useMemo(() => {
    const makeBadge = (
      id: string,
      title: string,
      value: number,
      thresholds: BadgeThresholds,
      unitLabel: string
    ) => {
      const tier = getTier(value, thresholds);
      const progress = Math.min(1, value / thresholds.gold);
      const detail = `Actuel ${value} · Seuils ${thresholds.bronze}/${thresholds.silver}/${thresholds.gold} ${unitLabel}`;
      return {
        id,
        title,
        detail,
        progress,
        tier,
        tierLabel: `Niveau ${tierLabelMap[tier]}`,
        tierTone: tierToneMap[tier],
        earned: tier !== "none",
        statusLabel: tier === "none" ? "En cours" : "Acquis",
        statusTone: tier === "none" ? "warn" : "ok",
      };
    };
    return [
      makeBadge("weekly", "Semaine active", last7Completed, weeklyThresholds, "seances"),
      makeBadge("streak", "Série FKS", streaks.weeksFks, streakThresholds, "semaines"),
      makeBadge("load", "Charge reguliere", loadDays, loadThresholds, "jours"),
      makeBadge("vma", "VMA du mois", streaks.monthlyVmaCount, vmaThresholds, "seances"),
    ];
  }, [
    last7Completed,
    weeklyThresholds,
    streaks,
    streakThresholds,
    loadDays,
    loadThresholds,
    vmaThresholds,
  ]);
  const earnedBadges = badgeItems.filter((badge) => badge.tier !== "none").length;

  const dayMap: Record<string, string> = {
    mon: 'Lundi',
    tue: 'Mardi',
    wed: 'Mercredi',
    thu: 'Jeudi',
    fri: 'Vendredi',
    sat: 'Samedi',
    sun: 'Dimanche',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroGlowAlt} />
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {athleteName
                  .split(' ')
                  .map((p: any[]) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{athleteName}</Text>
              <Text style={styles.heroRole}>
                {[athletePosition, athleteLevel].filter(Boolean).join(' · ') || 'Athlète FKS'}
              </Text>
              <View style={styles.heroTags}>
                {athletePosition ? <Tag label={athletePosition} /> : null}
                {athleteLevel ? <Tag label={athleteLevel} /> : null}
                {athleteFoot ? <Tag label={athleteFoot} /> : null}
              </View>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>TSB</Text>
              <Text style={[styles.heroBadgeValue, { color: tsbColor }]}>
                {tsb.toFixed(1)}
              </Text>
              <Text style={styles.heroBadgeSub}>{tsbLabel}</Text>
            </View>
          </View>

          {mainObjective ? (
            <View style={styles.heroObjectiveRow}>
              <Text style={styles.heroObjectiveLabel}>Objectif</Text>
              <Text style={styles.heroObjectiveValue}>{mainObjective}</Text>
            </View>
          ) : null}

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Séances validées</Text>
              <Text style={styles.heroStatValue}>{completedCount}</Text>
              <Text style={styles.heroStatSub}>Depuis le début</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Planifiées</Text>
              <Text style={styles.heroStatValue}>{plannedCount}</Text>
              <Text style={styles.heroStatSub}>En attente</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Dernière séance</Text>
              <Text style={styles.heroStatValue}>{lastSessionDate}</Text>
              <Text style={styles.heroStatSub}>
                Phase {phase || '—'} · #{phaseCount || 0}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader
            title="Rythme & objectifs"
            right={phase ? <Badge label={`Phase ${phase}`} /> : undefined}
          />
          <View style={styles.metricsGrid}>
            <StatCard
              label="FKS / semaine"
              value={targetFks != null ? String(targetFks) : '—'}
              sub="Objectif perso"
            />
            <StatCard
              label="Club / semaine"
              value={clubPerWeek != null ? String(clubPerWeek) : '—'}
              sub="Séances collectives"
            />
            <StatCard
              label="Matchs / semaine"
              value={matchesPerWeek != null ? String(matchesPerWeek) : '—'}
              sub="Cadence compétitive"
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Cycle"
            right={
              cycleLabel ? (
                <Badge label={cycleLabel} tone={cycleDone ? "ok" : "default"} />
              ) : (
                <Badge label="Aucun" tone="warn" />
              )
            }
          />
          <Card variant="surface" style={styles.cycleCard}>
            {!cycleId ? (
              <>
                <Text style={styles.cycleTitle}>Aucun cycle actif</Text>
                <Text style={styles.cycleSub}>
                  Choisis une playlist pour démarrer (FKS te propose aussi une recommandation) et suivre ta progression (12 séances).
                </Text>
                <View style={styles.cycleReco}>
                  <Text style={styles.cycleRecoLabel}>Recommandation</Text>
                  <Text style={styles.cycleRecoValue}>{MICROCYCLES[recommendedId].label}</Text>
                  {recommendation.reasons[0] ? (
                    <Text style={styles.cycleRecoSub}>{recommendation.reasons[0]}</Text>
                  ) : null}
                </View>
                <View style={styles.cycleActions}>
                  <Button
                    label={`Démarrer ${MICROCYCLES[recommendedId].label}`}
                    fullWidth
                    variant="outline"
                    onPress={() => nav.navigate("CycleModal", { mode: "select", origin: "profile" })}
                  />
                  <Button
                    label="Voir tous les cycles"
                    variant="ghost"
                    fullWidth
                    onPress={() => nav.navigate("CycleModal", { mode: "select", origin: "profile" })}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.cycleHeader}>
                  <Text style={styles.cycleTitle}>
                    {cycleDone ? "Cycle terminé" : `Prochaine séance : ${cycleNext}/${cycleTotal}`}
                  </Text>
                  <Tag
                    label={`${cycleCompleted}/${cycleTotal}`}
                    tone={cycleDone ? "ok" : "warn"}
                  />
                </View>
                <Text style={styles.cycleSub}>
                  {cycleDone
                    ? "Bien joué. Choisis un nouveau cycle pour continuer."
                    : "Garde le cap : une progression stable vaut mieux qu’un changement permanent."}
                </Text>
                <View style={styles.cycleProgressTrack}>
                  <View
                    style={[
                      styles.cycleProgressFill,
                      { width: `${Math.min(1, cycleProgress ?? 0) * 100}%` },
                    ]}
                  />
                </View>
                <View style={styles.cycleActions}>
                  <Button
                    label={cycleDone ? "Choisir un nouveau cycle" : "Continuer"}
                    fullWidth
                    variant="outline"
                    onPress={() =>
                      cycleDone
                        ? nav.navigate("CycleModal", { mode: "select", origin: "profile" })
                        : nav.navigate("NewSession")
                    }
                  />
                  <Button
                    label="Gérer"
                    variant="ghost"
                    fullWidth
                    onPress={() => nav.navigate("CycleModal", { mode: "manage", origin: "profile" })}
                  />
                </View>
                <Text style={styles.cycleHint}>
                  Pour changer, passe par “Gérer” → abandon (rare et sérieux).
                </Text>
              </>
            )}
          </Card>
          {shouldSuggestTests ? (
            <Card variant="soft" style={styles.testsCard}>
              <Text style={styles.testsLabel}>Tests terrain</Text>
              <Text style={styles.testsTitle}>
                {testsCount === 0 ? "À faire pour bien démarrer" : "À remettre à jour"}
              </Text>
              <Text style={styles.testsSub}>
                {testsCount === 0
                  ? "Les tests rendent le suivi plus précis (progrès, choix du cycle)."
                  : testsAgeDays != null
                    ? `Derniers tests : il y a ${testsAgeDays} jours.`
                    : "Tes tests méritent une mise à jour."}
              </Text>
              <Button
                label="Faire mes tests"
                fullWidth
                variant="outline"
                onPress={() => nav.navigate("Tests", { initialPlaylist: cycleId ?? recommendedId })}
              />
            </Card>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Momentum" right={<Tag label={tsbTrend} tone={trendTone} />} />
          <Card variant="soft" style={styles.streakCard}>
            <View style={styles.streakRow}>
              <Text style={styles.streakLabel}>Semaines avec FKS</Text>
              <Tag label={`${streaks.weeksFks} semaine${streaks.weeksFks > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>≥ 1 séance FKS par semaine sans interruption.</Text>

            <View style={[styles.streakRow, { marginTop: 10 }]}>
              <Text style={styles.streakLabel}>Club / match hebdo</Text>
              <Tag label={`${streaks.weeksClubMatch} semaine${streaks.weeksClubMatch > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>Présent chaque semaine en club ou en match.</Text>

            <View style={[styles.streakRow, { marginTop: 10 }]}>
              <Text style={styles.streakLabel}>VMA / tempo (mois)</Text>
              <Tag label={`${streaks.monthlyVmaCount} séance${streaks.monthlyVmaCount > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>Objectif: 4 séances VMA/tempo dans le mois.</Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Charge & forme" right={<Tag label={`Forme : ${tsbTrend}`} tone={trendTone} />} />

          <Card variant="soft" style={styles.loadCard}>
            <Text style={styles.loadMain}>
              ATL {atl.toFixed(1)} · CTL {ctl.toFixed(1)}
            </Text>
            <Text style={styles.loadSub}>
              ATL = charge récente, CTL = charge de fond. TSB = différence entre les deux.
            </Text>

            {/* Chips fatigue / risque */}
            <View style={styles.tagRow}>
              <Tag label={fatigueTag} tone={fatigueTone} />
              <Tag label={riskTag} tone={riskTone} />
            </View>

            {/* Mini-bar chart TSB 7 jours */}
            <Text style={styles.chartTitle}>TSB 7 jours</Text>
            <View style={styles.chartRow}>
              {Array.from({ length: 7 }).map((_, idx) => {
                const val = tsbHistory[idx] ?? tsb;
                const height = Math.max(8, Math.min(60, Math.abs(val) * 2));
                const color = val >= 0 ? palette.success : palette.accent;
                const label =
                  idx === 0
                    ? 'J'
                    : idx === 1
                    ? 'J-1'
                    : idx === 2
                    ? 'J-2'
                    : idx === 3
                    ? 'J-3'
                    : idx === 4
                    ? 'J-4'
                    : idx === 5
                    ? 'J-5'
                    : 'J-6';
                return (
                  <View key={idx} style={styles.barWrapper}>
                    <Text style={styles.barValue}>{val.toFixed(0)}</Text>
                    <View
                      style={[
                        styles.bar,
                        { height, backgroundColor: color },
                      ]}
                    />
                    <Text style={styles.barLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.chartDivider} />

            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Charge 7 jours</Text>
              <View style={styles.chartMetaRow}>
                <Badge label={`Moy ${Math.round(loadAvg)}`} />
                <Badge label={`Max ${Math.round(loadMax)}`} />
              </View>
            </View>
            <View style={styles.loadChartRow}>
              {loadHistory.map((val, idx) => {
                const height = Math.max(6, Math.round((val / loadScaleMax) * 60));
                const label =
                  idx === 0
                    ? 'J'
                    : idx === 1
                    ? 'J-1'
                    : idx === 2
                    ? 'J-2'
                    : idx === 3
                    ? 'J-3'
                    : idx === 4
                    ? 'J-4'
                    : idx === 5
                    ? 'J-5'
                    : 'J-6';
                return (
                  <View key={`load_${idx}`} style={styles.loadBarWrapper}>
                    <Text style={styles.loadBarValue}>{Math.round(val)}</Text>
                    <View style={[styles.loadBar, { height }]} />
                    <Text style={styles.loadBarLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.loadHint}>
              TSB négatif = charge élevée (à surveiller). La charge hebdo montre le volume.
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Badges" right={<Badge label={`${earnedBadges}/${badgeItems.length}`} />} />
          <Card variant="soft" style={styles.badgesCard}>
            {badgeItems.map((badge, index) => (
              <View key={badge.id} style={styles.badgeItem}>
                <View style={styles.badgeRow}>
                  <View style={styles.badgeText}>
                    <Text style={styles.badgeTitle}>{badge.title}</Text>
                    <Text style={styles.badgeMeta}>{badge.detail}</Text>
                  </View>
                  <View style={styles.badgePills}>
                    <Badge label={badge.tierLabel} tone={badge.tierTone} />
                    <Badge label={badge.statusLabel} tone={badge.statusTone as "default" | "ok" | "warn" | "danger" | undefined} />
                  </View>
                </View>
                <View style={styles.badgeProgressTrack}>
                  <View
                    style={[
                      styles.badgeProgressFill,
                      { width: `${Math.min(1, badge.progress) * 100}%` },
                    ]}
                  />
                </View>
                {index < badgeItems.length - 1 ? <View style={styles.badgeDivider} /> : null}
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Semaine type" right={<Text style={styles.sectionSubTitle}>Club + match</Text>} />

          <Card variant="soft" style={styles.weekCard}>
            <Text style={styles.weekTitle}>Entraînements club</Text>
            {clubDays.length === 0 ? (
              <Text style={styles.weekEmpty}>Aucun jour renseigné.</Text>
            ) : (
              <View style={styles.weekTagsRow}>
                {clubDays.map((d) => (
                  <Tag key={d} label={dayMap[d] ?? d} />
                ))}
              </View>
            )}

            <View style={styles.weekDivider} />

              <Text style={styles.weekTitle}>Match</Text>
              {matchDays.length === 0 ? (
                <Text style={styles.weekEmpty}>Jour de match non renseigné.</Text>
              ) : (
              <View style={styles.weekTagsRow}>
                {matchDays.map((d) => (
                  <Tag key={d} label={dayMap[d] ?? d} />
                ))}
              </View>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Dernières séances" />
          <Card variant="soft" style={styles.recentCard}>
            {recentSessions.length === 0 ? (
              <Text style={styles.recentEmpty}>Pas encore de séance validée.</Text>
            ) : (
              <View style={styles.recentList}>
                {recentSessions.map((session, index) => (
                  <View key={session.id}>
                    <View style={styles.recentRow}>
                      <View style={styles.recentMeta}>
                        <Text style={styles.recentTitle}>{session.title}</Text>
                        <View style={styles.recentTags}>
                          <Badge label={session.dateLabel} />
                          {session.focus ? <Badge label={session.focus} /> : null}
                          {session.intensity ? <Badge label={session.intensity} /> : null}
                        </View>
                      </View>
                      <View style={styles.recentRight}>
                        <Text style={styles.recentRpe}>
                          {session.rpe ? `RPE ${Math.round(session.rpe)}` : 'RPE —'}
                        </Text>
                      </View>
                    </View>
                    {index < recentSessions.length - 1 ? (
                      <View style={styles.recentDivider} />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Card variant="surface" style={styles.actionsCard}>
            <SectionHeader title="Actions rapides" />
            <Text style={styles.actionsSub}>
              Gère ton profil, tes préférences et ton accès à l'app.
            </Text>
            <View style={styles.actionsButtons}>
              <Button
                label="Modifier mon profil"
                onPress={() => nav.navigate('ProfileSetup')}
                fullWidth
                size="md"
                variant="outline"
              />
              <Button
                label="Paramètres"
                onPress={() => nav.navigate('Settings')}
                fullWidth
                size="md"
                variant="secondary"
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: palette.bg,
  },

  // HERO
  heroCard: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroGlowAlt: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: palette.info,
    opacity: 0.15,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  heroRole: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  heroBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: 'flex-end',
  },
  heroBadgeLabel: {
    fontSize: 10,
    color: palette.sub,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroBadgeValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  heroBadgeSub: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  heroObjectiveRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    marginBottom: 10,
  },
  heroObjectiveLabel: {
    color: palette.sub,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroObjectiveValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginTop: 2,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
    marginHorizontal: 10,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: palette.sub,
  },

  // Stat cards
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '48%',
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: palette.sub,
    fontSize: 12,
  },
  statValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statSub: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 2,
  },

  // Tag
  tag: {},

  // Cycle
  cycleCard: {
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cycleTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cycleSub: {
    color: palette.sub,
    fontSize: 12,
  },
  cycleProgressTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: 'hidden',
  },
  cycleProgressFill: {
    height: '100%',
    backgroundColor: palette.accent,
  },
  cycleActions: {
    gap: 10,
    marginTop: 10,
  },
  cycleHint: {
    color: palette.sub,
    fontSize: 11,
  },
  cycleReco: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    gap: 4,
  },
  cycleRecoLabel: {
    color: palette.sub,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  cycleRecoValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  cycleRecoSub: {
    color: palette.sub,
    fontSize: 12,
  },

  testsCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  testsLabel: {
    color: palette.sub,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  testsTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  testsSub: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },

  // Charge & forme
  loadCard: {
    borderRadius: 16,
    padding: 14,
  },
  loadMain: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loadSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    height: 80,
  },
  chartTitle: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  chartDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 12,
  },
  chartHeaderRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  barWrapper: {
    alignItems: 'center',
    width: 32,
  },
  barValue: {
    color: palette.sub,
    fontSize: 10,
  },
  bar: {
    width: 16,
    borderRadius: 4,
    opacity: 0.9,
    marginTop: 2,
  },
  barLabel: {
    color: palette.sub,
    fontSize: 10,
    marginTop: 2,
  },
  loadChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
    height: 80,
  },
  loadBarWrapper: {
    alignItems: 'center',
    width: 32,
  },
  loadBarValue: {
    color: palette.sub,
    fontSize: 10,
  },
  loadBar: {
    width: 16,
    borderRadius: 4,
    backgroundColor: palette.info,
    opacity: 0.9,
    marginTop: 2,
  },
  loadBarLabel: {
    color: palette.sub,
    fontSize: 10,
    marginTop: 2,
  },
  loadHint: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 8,
  },

  // Badges
  badgesCard: {
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  badgeItem: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badgePills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    flex: 1,
    gap: 2,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  badgeMeta: {
    fontSize: 11,
    color: palette.sub,
  },
  badgeProgressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    backgroundColor: palette.accent,
  },
  badgeDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 4,
  },

  // Streaks / momentum
  streakCard: {
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  streakHint: {
    fontSize: 11,
    color: palette.sub,
  },

  // Semaine type
  weekCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  weekTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  weekEmpty: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },
  weekTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  weekDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginVertical: 4,
  },

  // Dernieres seances
  recentCard: {
    borderRadius: 16,
    padding: 14,
  },
  recentList: {
    gap: 12,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentMeta: {
    flex: 1,
    gap: 8,
  },
  recentTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  recentRpe: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  recentDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 12,
  },
  recentEmpty: {
    color: palette.sub,
    fontSize: 12,
  },

  // Actions
  actionsCard: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  actionsSub: {
    color: palette.sub,
    fontSize: 12,
  },
  actionsButtons: {
    gap: 10,
  },
});
