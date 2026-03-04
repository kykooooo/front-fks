// screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSessionsStore } from '../state/stores/useSessionsStore';
import { useLoadStore } from '../state/stores/useLoadStore';
import { useExternalStore } from '../state/stores/useExternalStore';
import { useDebugStore } from '../state/stores/useDebugStore';
import { auth } from '../services/firebase';
import { computeStreakStats } from '../utils/streakStats';
import { lastNDates } from '../utils/dateHelpers';
import { toDateKey } from '../utils/dateHelpers';
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
  getPathwayById,
} from '../domain/microcycles';
import { recommendMicrocycle } from '../domain/recommendMicrocycle';
import { getFootballLabel } from '../config/trainingDefaults';

const palette = theme.colors;
const TESTS_STORAGE_KEY = 'fks_tests_v1';
const TESTS_RECENCY_DAYS = 30;
const SECTION_COUNT = 9;

/* ─── Badge config ─── */
const BADGE_ICONS: Record<string, { icon: string; tint: string }> = {
  weekly: { icon: 'trophy-outline', tint: palette.accent },
  streak: { icon: 'flame-outline', tint: '#ef4444' },
  load:   { icon: 'fitness-outline', tint: palette.info },
  vma:    { icon: 'speedometer-outline', tint: '#8b5cf6' },
};

const TIER_COLORS: Record<string, { bg: string; border: string }> = {
  none:   { bg: palette.cardSoft, border: palette.borderSoft },
  bronze: { bg: 'rgba(205,127,50,0.12)', border: 'rgba(205,127,50,0.4)' },
  silver: { bg: 'rgba(192,192,192,0.12)', border: 'rgba(192,192,192,0.4)' },
  gold:   { bg: 'rgba(255,193,37,0.14)', border: 'rgba(255,193,37,0.5)' },
};

/* ─── Calendar ─── */
const CAL_DAYS = [
  { id: 'mon', short: 'L' }, { id: 'tue', short: 'M' }, { id: 'wed', short: 'M' },
  { id: 'thu', short: 'J' }, { id: 'fri', short: 'V' }, { id: 'sat', short: 'S' },
  { id: 'sun', short: 'D' },
];

/* ─── Focus tints ─── */
const FOCUS_TINTS: Record<string, string> = {
  run: '#2563eb', strength: '#ef4444', circuit: '#ff7a1a', speed: '#8b5cf6',
  plyo: '#8b5cf6', mobility: '#14b8a6', core: '#06b6d4', force: '#ef4444',
};

/* ─── Helpers ─── */
const daysBetween = (a: number, b: number) => Math.floor(Math.max(0, b - a) / 86_400_000);

type BadgeTier = 'none' | 'bronze' | 'silver' | 'gold';
type BadgeThresholds = { bronze: number; silver: number; gold: number };
type TagTone = 'default' | 'ok' | 'warn' | 'danger';

const tierLabelMap: Record<BadgeTier, string> = { none: 'Base', bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

const getTier = (v: number, t: BadgeThresholds): BadgeTier =>
  v >= t.gold ? 'gold' : v >= t.silver ? 'silver' : v >= t.bronze ? 'bronze' : 'none';

const labelize = (v?: string | null) => {
  const r = String(v ?? '').trim();
  if (!r) return null;
  return r.replace(/_/g, ' ').split(' ').filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

const formatDayLabel = (value?: string | null) => {
  const key = toDateKey(value);
  if (!key) return '—';
  const localDate = new Date(`${key}T12:00:00`);
  if (Number.isNaN(localDate.getTime())) return key;
  return format(localDate, 'dd MMM', { locale: fr });
};

/* ══════════════════════════════════════════ */
export default function ProfileScreen() {
  const nav = useNavigation<any>();

  /* ─── Store ─── */
  const sessions = useSessionsStore((s) => s.sessions);
  const phase = useSessionsStore((s) => s.phase);
  const tsb = useLoadStore((s) => s.tsb);
  const atl = useLoadStore((s) => s.atl);
  const ctl = useLoadStore((s) => s.ctl);
  const tsbHistory = useLoadStore((s) => s.tsbHistory ?? []);
  const dailyApplied = useLoadStore((s) => s.dailyApplied ?? {});
  const clubDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useExternalStore((s) => s.matchDays ?? []);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const activePathwayId = useSessionsStore((s) => s.activePathwayId);
  const activePathwayIndex = useSessionsStore((s) => s.activePathwayIndex);
  const profile = useSessionsStore((s) => s.lastAiContext?.profile ?? null);

  /* ─── Tests terrain ─── */
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
      } catch { /* best effort */ }
    })();
    return () => { alive = false; };
  }, []);

  /* ─── Entrance animations ─── */
  const anims = useRef(Array.from({ length: SECTION_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(80, anims.map((a) =>
      Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true })
    )).start();
  }, []);

  const aStyle = (i: number) => ({
    opacity: anims[i],
    transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  /* ─── Derived ─── */
  const athleteName = profile?.first_name?.trim() || auth.currentUser?.displayName || 'Joueur';
  const athleteLevel = labelize(profile?.level);
  const athletePosition = labelize(profile?.position);
  const athleteFoot = labelize(profile?.dominant_foot);
  const mainObjective = profile?.main_objective?.trim() ?? null;
  const targetFks = typeof profile?.target_fks_sessions_per_week === 'number' ? profile.target_fks_sessions_per_week : null;
  const clubPerWeek = typeof profile?.club_trainings_per_week === 'number' ? profile.club_trainings_per_week : null;
  const matchesPerWeek = typeof profile?.matches_per_week === 'number' ? profile.matches_per_week : null;

  const testsAgeDays = useMemo(() => lastTestTs ? daysBetween(lastTestTs, Date.now()) : null, [lastTestTs]);
  const testsFresh = testsAgeDays != null ? testsAgeDays <= TESTS_RECENCY_DAYS : false;
  const shouldSuggestTests = testsCount === 0 || !testsFresh;

  const recommendation = useMemo(() => recommendMicrocycle({ mainObjective, lastTestPlaylist }), [mainObjective, lastTestPlaylist]);
  const recommendedId = recommendation.id;

  const completedCount = useMemo(() => sessions.filter((s: any) => s.completed).length, [sessions]);

  const lastSessionDate = useMemo(() => {
    const done = [...sessions].filter((s: any) => s.completed)
      .sort((a, b) => toDateKey(b.dateISO ?? b.date).localeCompare(toDateKey(a.dateISO ?? a.date)));
    if (!done.length) return '—';
    return formatDayLabel(done[0].dateISO ?? done[0].date);
  }, [sessions]);

  const recentSessions = useMemo(() => {
    return [...sessions].filter((s: any) => s.completed)
      .sort((a, b) => toDateKey(b.dateISO ?? b.date).localeCompare(toDateKey(a.dateISO ?? a.date)))
      .slice(0, 3)
      .map((session: any) => {
        const v2 = session?.aiV2 ?? session?.ai;
        const title = v2?.title || session?.focus || session?.modality || 'Séance FKS';
        const rawFocus = (v2?.focusPrimary ?? v2?.focus_primary ?? session?.focus ?? session?.modality ?? '').toLowerCase();
        const focus = labelize(v2?.focusPrimary ?? v2?.focus_primary ?? session?.focus ?? session?.modality);
        const intensity = labelize(v2?.intensity ?? session?.intensity);
        const dateLabel = formatDayLabel(session?.dateISO ?? session?.date ?? null);
        const rpe = session?.feedback?.rpe ?? session?.rpe;
        return { id: session?.id ?? `${title}_${dateLabel}`, title, focus, rawFocus, intensity, dateLabel, rpe };
      });
  }, [sessions]);

  const footballStatus = getFootballLabel(tsb);
  const tsbLabel = footballStatus.label;
  const tsbColor = footballStatus.color;

  const tsbTrend = useMemo(() => {
    const vals = [...tsbHistory].slice(0, 7);
    if (vals.length < 2) return 'stable';
    const diff = vals[0] - vals[vals.length - 1];
    return diff > 2 ? 'en montée' : diff < -2 ? 'en baisse' : 'stable';
  }, [tsbHistory]);

  const todayKey = useMemo(() => toDateKey(devNowISO ?? new Date()), [devNowISO]);
  const last7Keys = useMemo(() => lastNDates(todayKey, 7), [todayKey]);

  const loadHistory = useMemo(
    () => last7Keys.map((k) => { const v = Number(dailyApplied?.[k] ?? 0); return Number.isFinite(v) ? Math.max(0, v) : 0; }),
    [last7Keys, dailyApplied],
  );
  const loadMax = useMemo(() => Math.max(0, ...loadHistory), [loadHistory]);
  const loadScaleMax = useMemo(() => Math.max(10, loadMax || 0), [loadMax]);
  const loadAvg = useMemo(() => {
    if (!loadHistory.length) return 0;
    return loadHistory.reduce((s, v) => s + v, 0) / loadHistory.length;
  }, [loadHistory]);

  const fatigueTone: TagTone = tsb <= -15 ? 'danger' : tsb <= -8 ? 'warn' : 'ok';
  const riskTone: TagTone = tsb <= -12 ? 'danger' : tsb < -5 ? 'warn' : 'ok';
  const trendTone: TagTone = tsbTrend === 'en baisse' ? 'warn' : tsbTrend === 'en montée' ? 'ok' : 'default';

  /* ─── Cycle ─── */
  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleTotal = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const cycleCompleted = Math.min(cycleTotal, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));
  const cycleNext = Math.min(cycleTotal, cycleCompleted + 1);
  const cycleDone = Boolean(cycleId) && cycleCompleted >= cycleTotal;

  /* ─── Pathway ─── */
  const pathway = useMemo(
    () => activePathwayId ? getPathwayById(activePathwayId) : null,
    [activePathwayId],
  );

  /* ─── Streaks ─── */
  const streaks = useMemo(
    () => computeStreakStats(sessions as any, [] as any, devNowISO ?? new Date().toISOString()),
    [sessions, devNowISO],
  );

  /* ─── Weekly ─── */
  const last7Set = useMemo(() => new Set(last7Keys), [last7Keys]);
  const last7Completed = useMemo(
    () => sessions.filter((s: any) => {
      if (!s?.completed) return false;
      return last7Set.has(toDateKey(s.dateISO ?? s.date));
    }).length,
    [sessions, last7Set],
  );
  const loadDays = useMemo(() => loadHistory.filter((v) => v > 0).length, [loadHistory]);
  const weeklyGoal = Math.max(1, targetFks ?? 2);

  /* ─── Badges ─── */
  const weeklyThresholds = useMemo(() => ({ bronze: weeklyGoal, silver: weeklyGoal + 1, gold: weeklyGoal + 2 }), [weeklyGoal]);
  const streakThresholds = useMemo(() => ({ bronze: 2, silver: 4, gold: 8 }), []);
  const loadThresholds = useMemo(() => ({ bronze: 4, silver: 5, gold: 6 }), []);
  const vmaThresholds = useMemo(() => ({ bronze: 2, silver: 4, gold: 6 }), []);

  const badgeItems = useMemo(() => {
    const make = (id: string, title: string, value: number, thresholds: BadgeThresholds) => {
      const tier = getTier(value, thresholds);
      return { id, title, value, progress: Math.min(1, value / thresholds.gold), tier, earned: tier !== 'none' };
    };
    return [
      make('weekly', 'Semaine active', last7Completed, weeklyThresholds),
      make('streak', 'Régularité', streaks.weeksFks, streakThresholds),
      make('load', 'Constance', loadDays, loadThresholds),
      make('vma', 'Tests du mois', streaks.monthlyVmaCount, vmaThresholds),
    ];
  }, [last7Completed, weeklyThresholds, streaks, streakThresholds, loadDays, loadThresholds, vmaThresholds]);

  const earnedBadges = badgeItems.filter((b) => b.earned).length;
  const barLbl = (i: number) => (i === 0 ? 'J' : `J-${i}`);

  /* ══════════ RENDER ══════════ */
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ─── HERO SHELL (Premium DA) ─── */}
        <Animated.View style={aStyle(0)}>
          <View style={styles.heroShell}>
            <View style={styles.heroGlow} />
            <View style={styles.heroGlowAlt} />
            <View style={styles.heroRing} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>PROFIL</Text>
              </View>
              <Text style={styles.heroDate}>{phase ?? 'FKS'}</Text>
            </View>

            <View style={styles.heroIdentity}>
              <View style={[styles.avatarRing, { borderColor: tsbColor }]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {athleteName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{athleteName}</Text>
                <Text style={styles.heroRole}>
                  {[athletePosition, athleteLevel].filter(Boolean).join(' · ') || 'Joueur FKS'}
                </Text>
              </View>
            </View>

            {mainObjective ? (
              <View style={styles.objectivePill}>
                <Ionicons name="flag-outline" size={14} color={palette.accent} />
                <Text style={styles.objectiveText}>{mainObjective}</Text>
              </View>
            ) : null}

            <View style={styles.quickRow}>
              <View style={styles.quickChip}>
                <Text style={styles.quickLabel}>SÉANCES</Text>
                <Text style={styles.quickValue}>{completedCount}</Text>
              </View>
              <View style={[styles.quickChip, { borderColor: tsbColor }]}>
                <Text style={styles.quickLabel}>ÉTAT</Text>
                <Text style={[styles.quickValue, { color: tsbColor }]}>{tsbLabel}</Text>
              </View>
              <View style={styles.quickChip}>
                <Text style={styles.quickLabel}>DERNIÈRE</Text>
                <Text style={styles.quickValue}>{lastSessionDate}</Text>
              </View>
            </View>

            {(athleteFoot || athletePosition || athleteLevel) ? (
              <View style={styles.heroDetailRow}>
                {athletePosition ? (
                  <View style={styles.heroDetailChip}>
                    <Ionicons name="shirt-outline" size={12} color={palette.sub} />
                    <Text style={styles.heroDetailText}>{athletePosition}</Text>
                  </View>
                ) : null}
                {athleteFoot ? (
                  <View style={styles.heroDetailChip}>
                    <Ionicons name="footsteps-outline" size={12} color={palette.sub} />
                    <Text style={styles.heroDetailText}>{athleteFoot}</Text>
                  </View>
                ) : null}
                {athleteLevel ? (
                  <View style={styles.heroDetailChip}>
                    <Ionicons name="trending-up-outline" size={12} color={palette.sub} />
                    <Text style={styles.heroDetailText}>{athleteLevel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* ─── PARCOURS ─── */}
        {pathway ? (
          <Animated.View style={[styles.section, aStyle(1)]}>
            <SectionHeader title="Parcours" right={<Badge label={pathway.label} />} />
            <Card variant="surface" style={styles.pathwayCard}>
              <View style={styles.pathwayStepper}>
                {pathway.sequence.map((stepId, idx) => {
                  const step = MICROCYCLES[stepId];
                  const isDone = idx < (activePathwayIndex ?? 0);
                  const isCurrent = idx === (activePathwayIndex ?? 0);
                  const isFuture = idx > (activePathwayIndex ?? 0);
                  return (
                    <React.Fragment key={stepId}>
                      {idx > 0 ? (
                        <View style={[styles.pathwayLine, isDone && styles.pathwayLineDone, isCurrent && styles.pathwayLineCurrent]} />
                      ) : null}
                      <View style={styles.pathwayStep}>
                        <View style={[
                          styles.pathwayDot,
                          isDone && styles.pathwayDotDone,
                          isCurrent && styles.pathwayDotCurrent,
                          isFuture && styles.pathwayDotFuture,
                        ]}>
                          {isDone ? (
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          ) : isCurrent ? (
                            <Ionicons name={step.icon as any} size={12} color="#fff" />
                          ) : (
                            <Text style={styles.pathwayDotText}>{idx + 1}</Text>
                          )}
                        </View>
                        <Text style={[
                          styles.pathwayStepLabel,
                          isCurrent && styles.pathwayStepLabelCurrent,
                          isFuture && styles.pathwayStepLabelFuture,
                        ]} numberOfLines={1}>
                          {step.label.split(' ')[0]}
                        </Text>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <Text style={styles.pathwayProgress}>
                Étape {Math.min((activePathwayIndex ?? 0) + 1, pathway.sequence.length)}/{pathway.sequence.length}
              </Text>
            </Card>
          </Animated.View>
        ) : null}

        {/* ─── STATS ─── */}
        <Animated.View style={[styles.section, aStyle(2)]}>
          <SectionHeader title="Mon rythme" right={phase ? <Badge label={`Phase ${phase}`} /> : undefined} />
          <View style={styles.statsRow}>
            {([
              { label: 'FKS / sem', value: targetFks, icon: 'flame-outline', tint: palette.accent },
              { label: 'Club / sem', value: clubPerWeek, icon: 'people-outline', tint: palette.info },
              { label: 'Matchs / sem', value: matchesPerWeek, icon: 'football-outline', tint: palette.success },
            ] as const).map((s) => (
              <Card key={s.label} variant="soft" style={styles.statCard}>
                <View style={[styles.statAccent, { backgroundColor: s.tint }]} />
                <View style={styles.statContent}>
                  <Ionicons name={s.icon as any} size={16} color={s.tint} />
                  <Text style={styles.statValue}>{s.value != null ? String(s.value) : '—'}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              </Card>
            ))}
          </View>
        </Animated.View>

        {/* ─── CYCLE ─── */}
        <Animated.View style={[styles.section, aStyle(3)]}>
          <SectionHeader
            title="Programme"
            right={cycleLabel ? <Badge label={cycleLabel} tone={cycleDone ? 'ok' : 'default'} /> : <Badge label="Aucun" tone="warn" />}
          />
          <Card variant="surface" style={styles.cycleCard}>
            {!cycleId ? (
              <>
                <Text style={styles.cycleTitle}>Pas de programme en cours</Text>
                <Text style={styles.cycleSub}>Choisis un programme pour commencer à progresser.</Text>
                <View style={styles.cycleReco}>
                  <Text style={styles.cycleRecoLbl}>ON TE CONSEILLE</Text>
                  <Text style={styles.cycleRecoVal}>{MICROCYCLES[recommendedId].label}</Text>
                  {recommendation.reasons[0] ? <Text style={styles.cycleRecoSub}>{recommendation.reasons[0]}</Text> : null}
                </View>
                <Button label={`Commencer ${MICROCYCLES[recommendedId].label}`} fullWidth variant="outline"
                  onPress={() => nav.navigate('CycleModal', { mode: 'select', origin: 'profile' })} />
              </>
            ) : (
              <>
                <Text style={styles.cycleTitle}>
                  {cycleDone ? 'Programme terminé !' : `Séance ${cycleNext}/${cycleTotal}`}
                </Text>
                <Text style={styles.cycleSub}>
                  {cycleDone ? 'Bien joué ! Choisis ton prochain programme.' : 'Continue comme ça, tu progresses bien.'}
                </Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: cycleTotal }).map((_, i) => (
                    <View key={i} style={[
                      styles.dot,
                      i < cycleCompleted && styles.dotDone,
                      i === cycleCompleted && !cycleDone && styles.dotCurrent,
                    ]} />
                  ))}
                </View>
                <View style={styles.cycleActions}>
                  <Button label={cycleDone ? 'Nouveau programme' : 'Continuer'} fullWidth variant="outline"
                    onPress={() => cycleDone
                      ? nav.navigate('CycleModal', { mode: 'select', origin: 'profile' })
                      : nav.navigate('NewSession')} />
                  <Button label="Gérer" variant="ghost" fullWidth
                    onPress={() => nav.navigate('CycleModal', { mode: 'manage', origin: 'profile' })} />
                </View>
              </>
            )}
          </Card>
          {shouldSuggestTests ? (
            <Card variant="soft" style={styles.testsCard}>
              <View style={styles.testsRow}>
                <Ionicons name="clipboard-outline" size={18} color={palette.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.testsTitle}>{testsCount === 0 ? 'Fais tes tests' : 'Refais tes tests'}</Text>
                  <Text style={styles.testsSub}>
                    {testsCount === 0 ? 'Ça nous aide à mieux cibler tes séances.'
                      : testsAgeDays != null ? `Derniers tests : il y a ${testsAgeDays} j.` : 'Tes résultats ne sont plus à jour.'}
                  </Text>
                </View>
              </View>
              <Button label="Faire mes tests" fullWidth variant="outline"
                onPress={() => nav.navigate('Tests', { initialPlaylist: cycleId ?? recommendedId })} />
            </Card>
          ) : null}
        </Animated.View>

        {/* ─── MOMENTUM ─── */}
        <Animated.View style={[styles.section, aStyle(4)]}>
          <SectionHeader title="Ta régularité" right={<Badge label={tsbTrend} tone={trendTone} />} />
          <Card variant="soft" style={styles.momentumCard}>
            {([
              { label: 'Semaines FKS', value: streaks.weeksFks, unit: 'sem', icon: 'flame-outline' as const, tint: '#ef4444' },
              { label: 'Club / match', value: streaks.weeksClubMatch, unit: 'sem', icon: 'shield-outline' as const, tint: palette.info },
              { label: 'Tests ce mois', value: streaks.monthlyVmaCount, unit: 'séances', icon: 'speedometer-outline' as const, tint: '#8b5cf6' },
            ]).map((item, idx) => (
              <React.Fragment key={item.label}>
                <View style={styles.momentumRow}>
                  <View style={[styles.momentumIcon, { backgroundColor: `${item.tint}14` }]}>
                    <Ionicons name={item.icon} size={16} color={item.tint} />
                  </View>
                  <Text style={styles.momentumLbl}>{item.label}</Text>
                  <Badge label={`${item.value} ${item.unit}`} />
                </View>
                {idx < 2 ? <View style={styles.momentumDiv} /> : null}
              </React.Fragment>
            ))}
          </Card>
        </Animated.View>

        {/* ─── CHARGE & FORME ─── */}
        <Animated.View style={[styles.section, aStyle(5)]}>
          <SectionHeader title="Ta forme" right={<Badge label={`Tendance : ${tsbTrend}`} tone={trendTone} />} />
          <Card variant="soft" style={styles.chargeCard}>
            <View style={styles.chargeStatusRow}>
              <View style={[styles.chargeStatusDot, { backgroundColor: tsbColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.chargeStatusLabel, { color: tsbColor }]}>{tsbLabel}</Text>
                <Text style={styles.chargeStatusMsg}>{footballStatus.message}</Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              <Badge label={tsb <= -15 ? 'Jambes lourdes' : tsb <= -8 ? 'Un peu de fatigue' : 'Frais'} tone={fatigueTone} />
              <Badge label={tsb <= -12 ? 'Attention blessure' : tsb < -5 ? 'Fais gaffe' : 'C\'est bon'} tone={riskTone} />
            </View>

            <Text style={styles.chartTitle}>Ta forme sur 7 jours</Text>
            <View style={styles.chartRow}>
              {Array.from({ length: 7 }).map((_, idx) => {
                const val = tsbHistory[idx] ?? tsb;
                const h = Math.max(8, Math.min(60, Math.abs(val) * 2));
                const c = val >= 5 ? palette.success : val >= 0 ? '#34d399' : val >= -8 ? palette.warn : palette.danger;
                const isToday = idx === 0;
                return (
                  <View key={idx} style={styles.barCol}>
                    <Text style={[styles.barVal, isToday && { fontWeight: '700', color: palette.text }]}>{val.toFixed(0)}</Text>
                    <View style={[styles.bar, { height: h, backgroundColor: c, opacity: isToday ? 1 : 0.7 }]} />
                    <Text style={[styles.barLbl, isToday && { fontWeight: '700', color: palette.text }]}>{barLbl(idx)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.chartSep} />

            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Intensité 7 jours</Text>
              <View style={styles.chartMetaRow}>
                <Badge label={`Moy ${Math.round(loadAvg)}`} />
                <Badge label={`Max ${Math.round(loadMax)}`} />
              </View>
            </View>
            <View style={styles.chartRow}>
              {loadHistory.map((val, idx) => {
                const h = Math.max(6, Math.round((val / loadScaleMax) * 60));
                const ratio = loadMax > 0 ? val / loadMax : 0;
                const c = ratio > 0.8 ? palette.accent : ratio > 0.5 ? palette.info : '#60a5fa';
                const isToday = idx === 0;
                return (
                  <View key={`l${idx}`} style={styles.barCol}>
                    <Text style={[styles.barVal, isToday && { fontWeight: '700', color: palette.text }]}>{Math.round(val)}</Text>
                    <View style={[styles.bar, { height: h, backgroundColor: c, opacity: isToday ? 1 : 0.7 }]} />
                    <Text style={[styles.barLbl, isToday && { fontWeight: '700', color: palette.text }]}>{barLbl(idx)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        {/* ─── BADGES ─── */}
        <Animated.View style={[styles.section, aStyle(6)]}>
          <SectionHeader title="Trophées" right={<Badge label={`${earnedBadges}/${badgeItems.length}`} />} />
          <View style={styles.badgeGrid}>
            {badgeItems.map((b) => {
              const cfg = BADGE_ICONS[b.id] ?? { icon: 'ribbon-outline', tint: palette.accent };
              const tc = TIER_COLORS[b.tier] ?? TIER_COLORS.none;
              return (
                <Card key={b.id} variant="soft" style={[styles.badgeCell, { borderColor: tc.border }]}>
                  <View style={[styles.badgeIconCircle, { backgroundColor: b.earned ? tc.bg : palette.cardSoft }]}>
                    <Ionicons name={cfg.icon as any} size={22} color={b.earned ? cfg.tint : palette.muted} />
                  </View>
                  <Text style={[styles.badgeCellTitle, !b.earned && { color: palette.muted }]}>{b.title}</Text>
                  <Badge label={tierLabelMap[b.tier]} tone={b.tier === 'gold' || b.tier === 'silver' ? 'ok' : b.tier === 'bronze' ? 'warn' : 'default'} />
                  <View style={styles.badgeCellTrack}>
                    <View style={[styles.badgeCellFill, {
                      width: `${Math.min(1, b.progress) * 100}%`,
                      backgroundColor: b.earned ? cfg.tint : palette.borderSoft,
                    }]} />
                  </View>
                </Card>
              );
            })}
          </View>
        </Animated.View>

        {/* ─── SEMAINE TYPE ─── */}
        <Animated.View style={[styles.section, aStyle(7)]}>
          <SectionHeader title="Ta semaine" />
          <Card variant="soft" style={styles.calCard}>
            <View style={styles.calRow}>
              {CAL_DAYS.map((d) => {
                const isClub = clubDays.includes(d.id);
                const isMatch = matchDays.includes(d.id);
                const active = isClub || isMatch;
                return (
                  <View key={d.id} style={styles.calItem}>
                    <View style={[styles.calCircle, isClub && styles.calClub, isMatch && styles.calMatch]}>
                      {isClub && !isMatch ? <Ionicons name="fitness-outline" size={14} color="#fff" /> : null}
                      {isMatch ? <Ionicons name="football-outline" size={14} color="#fff" /> : null}
                      {!active ? <Text style={styles.calCircleText}>{d.short}</Text> : null}
                    </View>
                    <Text style={[styles.calDayLbl, active && styles.calDayLblActive]}>{d.short}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: palette.accent }]} />
                <Text style={styles.calLegendText}>Club</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendDot, { backgroundColor: palette.success }]} />
                <Text style={styles.calLegendText}>Match</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ─── RECENT + ACTIONS ─── */}
        <Animated.View style={[styles.section, aStyle(8)]}>
          <SectionHeader title="Dernières séances" />
          <Card variant="soft" style={styles.recentCard}>
            {recentSessions.length === 0 ? (
              <Text style={styles.recentEmpty}>Pas encore de séance terminée.</Text>
            ) : (
              recentSessions.map((s, idx) => {
                const tint = FOCUS_TINTS[s.rawFocus] ?? palette.accent;
                return (
                  <View key={s.id} style={styles.tlItem}>
                    <View style={styles.tlTrack}>
                      <View style={[styles.tlDot, { backgroundColor: tint }]} />
                      {idx < recentSessions.length - 1 ? <View style={styles.tlLine} /> : null}
                    </View>
                    <View style={styles.tlContent}>
                      <View style={styles.tlHeader}>
                        <Text style={styles.tlTitle}>{s.title}</Text>
                        <Text style={[styles.tlRpe, { color: tint }]}>
                          {s.rpe ? `RPE ${Math.round(s.rpe)}` : '—'}
                        </Text>
                      </View>
                      <View style={styles.tlTags}>
                        <Badge label={s.dateLabel} />
                        {s.focus ? <Badge label={s.focus} /> : null}
                        {s.intensity ? <Badge label={s.intensity} /> : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <View style={styles.actionsRow}>
            <Button
              label="Mon profil"
              variant="outline"
              size="sm"
              style={styles.actionBtnStyled}
              leftAccessory={<Ionicons name="create-outline" size={14} color={palette.accent} />}
              onPress={() => nav.navigate('ProfileSetup')}
            />
            <Button
              label="Paramètres"
              variant="ghost"
              size="sm"
              style={styles.actionBtnStyled}
              leftAccessory={<Ionicons name="settings-outline" size={14} color={palette.sub} />}
              onPress={() => nav.navigate('Settings')}
            />
            <Button
              label="Historique"
              variant="ghost"
              size="sm"
              style={styles.actionBtnStyled}
              leftAccessory={<Ionicons name="time-outline" size={14} color={palette.sub} />}
              onPress={() => nav.navigate('SessionHistory')}
            />
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ══════════ STYLES ══════════ */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 8 },

  /* Hero Shell (Premium DA) */
  heroShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroGlowAlt: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: palette.cardSoft,
    opacity: 0.9,
  },
  heroRing: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: palette.borderSoft,
    opacity: 0.6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.text,
  },
  heroDate: {
    fontSize: 12,
    color: palette.sub,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 68, height: 68, borderRadius: 999, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 58, height: 58, borderRadius: 999, backgroundColor: palette.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: palette.text },
  heroInfo: { flex: 1, gap: 2 },
  heroName: { fontSize: 22, fontWeight: '800', color: palette.text },
  heroRole: { fontSize: 13, color: palette.sub },
  heroDetailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroDetailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: palette.bgSoft,
  },
  heroDetailText: { fontSize: 11, fontWeight: '600', color: palette.sub },
  objectivePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: palette.cardSoft, borderWidth: 1, borderColor: palette.borderSoft,
  },
  objectiveText: { flex: 1, fontSize: 13, fontWeight: '600', color: palette.text },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickChip: {
    flexGrow: 1,
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  quickLabel: {
    fontSize: 10,
    color: palette.sub,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  quickValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, padding: 0, overflow: 'hidden', flexDirection: 'row' },
  statAccent: { width: 4 },
  statContent: { flex: 1, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: palette.text },
  statLabel: { fontSize: 10, color: palette.sub, textAlign: 'center' },

  /* Cycle */
  cycleCard: { borderRadius: 18, padding: 14, gap: 8 },
  cycleTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
  cycleSub: { fontSize: 12, color: palette.sub },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 8, justifyContent: 'center' },
  dot: {
    width: 20, height: 20, borderRadius: 999,
    backgroundColor: palette.borderSoft, borderWidth: 1, borderColor: palette.border,
  },
  dotDone: { backgroundColor: palette.accent, borderColor: palette.accent },
  dotCurrent: { borderColor: palette.accent, borderWidth: 2, backgroundColor: palette.accentSoft },
  cycleActions: { gap: 8, marginTop: 8 },
  cycleReco: {
    marginTop: 4, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: palette.borderSoft, backgroundColor: palette.cardSoft, gap: 4,
  },
  cycleRecoLbl: { fontSize: 10, color: palette.sub, letterSpacing: 1.2, fontWeight: '800' },
  cycleRecoVal: { fontSize: 14, fontWeight: '800', color: palette.text },
  cycleRecoSub: { fontSize: 12, color: palette.sub },
  /* Pathway */
  pathwayCard: { borderRadius: 18, padding: 16, gap: 10 },
  pathwayStepper: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
    paddingVertical: 4,
  },
  pathwayStep: { alignItems: 'center', gap: 6, width: 64 },
  pathwayDot: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.borderSoft,
    borderWidth: 2, borderColor: palette.borderSoft,
  },
  pathwayDotDone: { backgroundColor: palette.success, borderColor: palette.success },
  pathwayDotCurrent: { backgroundColor: palette.accent, borderColor: palette.accent },
  pathwayDotFuture: { backgroundColor: palette.cardSoft, borderColor: palette.borderSoft },
  pathwayDotText: { fontSize: 11, fontWeight: '700', color: palette.muted },
  pathwayLine: {
    height: 2, flex: 1, backgroundColor: palette.borderSoft,
    marginTop: 13, marginHorizontal: -4,
  },
  pathwayLineDone: { backgroundColor: palette.success },
  pathwayLineCurrent: { backgroundColor: palette.accent },
  pathwayStepLabel: { fontSize: 10, fontWeight: '600', color: palette.text, textAlign: 'center' },
  pathwayStepLabelCurrent: { fontWeight: '800', color: palette.accent },
  pathwayStepLabelFuture: { color: palette.muted },
  pathwayProgress: { fontSize: 11, fontWeight: '600', color: palette.sub, textAlign: 'center' },

  testsCard: { marginTop: 8, borderRadius: 16, padding: 14, gap: 10 },
  testsRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  testsTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
  testsSub: { fontSize: 12, color: palette.sub, marginTop: 2 },

  /* Momentum */
  momentumCard: { borderRadius: 16, padding: 14 },
  momentumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  momentumIcon: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  momentumLbl: { flex: 1, fontSize: 13, fontWeight: '600', color: palette.text },
  momentumDiv: { height: 1, backgroundColor: palette.borderSoft },

  /* Charge */
  chargeCard: { borderRadius: 16, padding: 14 },
  chargeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  chargeStatusDot: { width: 14, height: 14, borderRadius: 999 },
  chargeStatusLabel: { fontSize: 16, fontWeight: '800' },
  chargeStatusMsg: { fontSize: 12, color: palette.sub, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chartTitle: { marginTop: 12, fontSize: 12, fontWeight: '700', color: palette.text },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8, height: 80 },
  chartHeaderRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartMetaRow: { flexDirection: 'row', gap: 6 },
  chartSep: { height: 1, backgroundColor: palette.borderSoft, marginTop: 12 },
  barCol: { flex: 1, alignItems: 'center' },
  barVal: { fontSize: 9, color: palette.sub, marginBottom: 2 },
  bar: { width: 22, borderRadius: 8 },
  barLbl: { fontSize: 9, color: palette.sub, marginTop: 3 },

  /* Badges */
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6 },
  badgeIconCircle: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badgeCellTitle: { fontSize: 12, fontWeight: '700', color: palette.text, textAlign: 'center' },
  badgeCellTrack: { width: '100%', height: 4, borderRadius: 999, backgroundColor: palette.borderSoft, overflow: 'hidden', marginTop: 4 },
  badgeCellFill: { height: '100%' },

  /* Calendar */
  calCard: { borderRadius: 16, padding: 14, gap: 10 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calItem: { alignItems: 'center', gap: 6 },
  calCircle: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: palette.bgSoft,
    borderWidth: 1, borderColor: palette.borderSoft, alignItems: 'center', justifyContent: 'center',
  },
  calClub: { backgroundColor: palette.accent, borderColor: palette.accent },
  calMatch: { backgroundColor: palette.success, borderColor: palette.success },
  calCircleText: { fontSize: 12, fontWeight: '600', color: palette.sub },
  calDayLbl: { fontSize: 10, fontWeight: '600', color: palette.sub },
  calDayLblActive: { color: palette.text, fontWeight: '700' },
  calLegend: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calLegendDot: { width: 8, height: 8, borderRadius: 999 },
  calLegendText: { fontSize: 11, color: palette.sub },

  /* Timeline */
  recentCard: { borderRadius: 16, padding: 14 },
  recentEmpty: { fontSize: 12, color: palette.sub },
  tlItem: { flexDirection: 'row', gap: 12, minHeight: 54 },
  tlTrack: { width: 16, alignItems: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 999, marginTop: 4 },
  tlLine: { flex: 1, width: 2, backgroundColor: palette.borderSoft, marginTop: 4 },
  tlContent: { flex: 1, paddingBottom: 14, gap: 4 },
  tlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tlTitle: { fontSize: 14, fontWeight: '700', color: palette.text, flex: 1 },
  tlRpe: { fontSize: 12, fontWeight: '700' },
  tlTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtnStyled: { flex: 1 },
});
