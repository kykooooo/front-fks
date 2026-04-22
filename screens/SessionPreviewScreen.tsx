// screens/SessionPreviewScreen.tsx — orchestrator (refactored from 1224 → ~350 lines)
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Vibration,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useLoadStore } from '../state/stores/useLoadStore';
import { useSessionsStore } from '../state/stores/useSessionsStore';
import { getWarmupForSession } from '../constants/warmups';
import { theme, TYPE } from "../constants/theme";
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SafetyBanner } from '../components/ui/SafetyBanner';
import { YouTubePlayer } from '../components/ui/YouTubePlayer';
import { useSettingsStore } from '../state/settingsStore';
import { withSessionErrorBoundary } from '../components/withErrorBoundary';
import { ModalContainer } from '../components/modal/ModalContainer';
import { buildResetExplain } from './newSession/resetExplain';
import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  isMicrocycleId,
} from '../domain/microcycles';
import { EXERCISE_BY_ID } from '../engine/exerciseBank';
import { getExerciseVideoRef } from '../engine/exerciseVideos';

import {
  type Block,
} from './sessionPreview/sessionPreviewConfig';
import { HeroCard } from './sessionPreview/components/HeroCard';
import { FlowStrip } from './sessionPreview/components/FlowStrip';
import { BlockCard } from './sessionPreview/components/BlockCard';
import { TimerCard } from './sessionPreview/components/TimerCard';
import { resolvePlayerPreviewContext } from './sessionPreview/playerContext';
import { getSessionStatus, isSessionCompleted } from '../utils/sessionStatus';
import { useSyncStore } from '../state/stores/useSyncStore';

type SessionPreviewRoute = RouteProp<AppStackParamList, 'SessionPreview'>;
const palette = theme.colors;

function SessionPreviewScreen({ route }: { route: SessionPreviewRoute }) {
  const { v2, plannedDateISO, sessionId } = route.params;
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const title = v2.title || 'Séance personnalisée';
  const subtitle = v2.subtitle;
  const blocks: Block[] = Array.isArray(v2.blocks) ? v2.blocks : [];
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const phase = useSessionsStore((s) => s.phase);
  const tsb = useLoadStore((s) => s.tsb);
  const profile = useSessionsStore((s) => s.lastAiContext?.profile ?? null);
  const sessions = useSessionsStore((s) => s.sessions);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const setSessionStatus = useSessionsStore((s) => s.setSessionStatus);
  const persistSessionStatus = useSyncStore((s) => s.persistSessionStatus);
  const currentSession = sessionId ? sessions.find((s: any) => s.id === sessionId) : null;
  const sessionStatus = getSessionStatus(currentSession);
  const canStart = !isSessionCompleted(currentSession);
  const isCompleted = isSessionCompleted(currentSession);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionSec, setSessionSec] = useState(0);
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restRunning, setRestRunning] = useState(false);
  const [restSec, setRestSec] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  const [videoPlayerLabel, setVideoPlayerLabel] = useState('');
  const [showTimerTools, setShowTimerTools] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const pulseMap = useRef<Record<string, Animated.Value>>({});
  const blockAnims = useRef(blocks.map(() => new Animated.Value(0))).current;

  const warmup = useMemo(() => getWarmupForSession(v2), [v2]);
  const timerPresets = useMemo(() => {
    const globalRaw = Array.isArray(v2.display?.timerPresets) ? v2.display?.timerPresets : [];
    const blockRaw = blocks.flatMap((block) =>
      Array.isArray(block?.timerPresets) ? block.timerPresets : []
    );
    const source = [...globalRaw, ...blockRaw];
    const unique = new Set<string>();
    return source
      .map((preset) => ({
        label: preset.label ?? null,
        workS: typeof preset.workS === 'number' ? preset.workS : null,
        restS: typeof preset.restS === 'number' ? preset.restS : null,
        rounds: typeof preset.rounds === 'number' ? preset.rounds : null,
      }))
      .filter((preset) => preset.label || (preset.workS != null && preset.restS != null))
      .filter((preset) => {
        const key = `${preset.label ?? ''}|${preset.workS ?? ''}|${preset.restS ?? ''}|${preset.rounds ?? ''}`;
        if (unique.has(key)) return false;
        unique.add(key);
        return true;
      })
      .slice(0, 4);
  }, [v2.display?.timerPresets, blocks]);

  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  // ─── Computed labels ───
  const durationLabel = v2.durationMin != null ? `${v2.durationMin} min` : '\u2014';
  const rpeLabel = v2.rpeTarget != null ? `${v2.rpeTarget}` : '\u2014';
  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const fallbackSessionNumber = Math.min(
    MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
    Math.max(1, Math.trunc(microcycleSessionIndex ?? 0) + 1)
  );
  const fallbackCyclePhaseLabel = (() => {
    const phaseKey = String(phase ?? '').toLowerCase().trim();
    if (phaseKey === 'playlist') return 'Mise en route';
    if (phaseKey === 'construction') return 'Construction';
    if (phaseKey === 'progression') return 'Progression';
    if (phaseKey === 'performance') return 'Progression';
    if (phaseKey === 'deload') return 'Deload';
    return null;
  })();
  const canUseLiveCycleFallback = !isSessionCompleted(currentSession);
  const playerPreviewContext = useMemo(
    () =>
      resolvePlayerPreviewContext({
        v2,
        canUseLiveCycleFallback,
        fallbackCycleLabel: cycleDef?.label ?? null,
        fallbackCycleProgressLabel:
          canUseLiveCycleFallback && cycleId
            ? `Séance ${fallbackSessionNumber}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}`
            : null,
        fallbackCyclePhaseLabel,
        profilePosition: typeof profile?.position === 'string' ? profile.position : null,
        tsb,
      }),
    [
      v2,
      canUseLiveCycleFallback,
      cycleDef?.label,
      cycleId,
      fallbackSessionNumber,
      fallbackCyclePhaseLabel,
      profile?.position,
      tsb,
    ]
  );
  const blockCount = blocks.length;
  const isResetPlan =
    v2?.archetypeId === 'foundation_X_reset' ||
    (v2?.selectionDebug?.reasons ?? []).includes('reset_selected');
  const resetExplain = useMemo(
    () => (isResetPlan ? buildResetExplain(v2, undefined, v2?.location ?? undefined, profile) : null),
    [isResetPlan, v2, profile]
  );

  const totalItems = useMemo(() => {
    return blocks.reduce((acc, block) => acc + (block.items?.length ?? 0), 0);
  }, [blocks]);
  const completedItems = useMemo(() => {
    return Object.values(checked).filter(Boolean).length;
  }, [checked]);
  const progress = totalItems > 0 ? completedItems / totalItems : 0;
  const hasStarted = sessionRunning || completedItems > 0 || sessionStatus === 'in_progress';

  // ─── Timers & signals ───
  const playRestSignal = useCallback(() => {
    if (soundsEnabled && Platform.OS === 'web') {
      const AudioContext =
        (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        osc.onended = () => ctx.close();
        return;
      }
    }
    if (hapticsEnabled && Platform.OS !== 'web') {
      Vibration.vibrate([0, 120, 80, 120]);
    }
  }, [soundsEnabled, hapticsEnabled]);

  useEffect(() => {
    if (sessionRunning) {
      sessionRef.current = setInterval(() => setSessionSec((s) => s + 1), 1000);
    }
    return () => {
      if (sessionRef.current) { clearInterval(sessionRef.current); sessionRef.current = null; }
    };
  }, [sessionRunning]);

  useEffect(() => {
    if (restRunning) {
      restRef.current = setInterval(() => {
        setRestSec((s) => {
          if (s <= 1) { setRestRunning(false); playRestSignal(); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    };
  }, [restRunning, playRestSignal]);

  const markSessionInProgress = useCallback(() => {
    if (!sessionId || isCompleted) return;
    if (sessionStatus === 'in_progress' || sessionStatus === 'completed') return;
    const startedAt = currentSession?.startedAt ?? new Date().toISOString();
    setSessionStatus(sessionId, 'in_progress', { startedAt });
    persistSessionStatus(sessionId, 'in_progress', { startedAt }).catch((err) => {
      if (__DEV__) {
        console.error('[SessionPreview] Failed to persist in-progress status:', err);
      }
    });
  }, [
    sessionId,
    isCompleted,
    sessionStatus,
    currentSession,
    setSessionStatus,
    persistSessionStatus,
  ]);

  useEffect(() => {
    if (!hasStarted || isCompleted) return;
    markSessionInProgress();
  }, [hasStarted, isCompleted, markSessionInProgress]);

  // ─── Animations ───
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    if (blockAnims.length === 0) return;
    const timer = setTimeout(() => {
      Animated.stagger(
        80,
        blockAnims.map((anim) =>
          Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true })
        )
      ).start();
    }, 300);
    return () => clearTimeout(timer);
  }, [blockAnims]);

  // ─── Callbacks ───
  const getPulse = (key: string) => {
    if (!pulseMap.current[key]) pulseMap.current[key] = new Animated.Value(1);
    return pulseMap.current[key];
  };

  const triggerPulse = (key: string) => {
    const pulse = getPulse(key);
    pulse.setValue(0.86);
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.08, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const toggleItem = (blockIndex: number, itemIndex: number) => {
    const key = `${blockIndex}-${itemIndex}`;
    if (!isCompleted) {
      markSessionInProgress();
    }
    setChecked((prev) => {
      const nextValue = !prev[key];
      if (nextValue) triggerPulse(key);
      return { ...prev, [key]: nextValue };
    });
    if (!sessionRunning && !isCompleted) {
      setSessionRunning(true);
    }
  };

  const isBlockComplete = (blockIndex: number) => {
    const items = blocks[blockIndex]?.items ?? [];
    if (items.length === 0) return false;
    return items.every((_, idx) => checked[`${blockIndex}-${idx}`]);
  };

  const openExerciseVideo = useCallback((exerciseId: string | null) => {
    if (!exerciseId) return;
    const ref = getExerciseVideoRef(exerciseId);
    const exercise = EXERCISE_BY_ID[exerciseId];
    setVideoPlayerLabel(exercise?.name ?? "Video de l'exercice");
    setVideoPlayerUrl(ref.url);
  }, []);

  const finishLabel = sessionId ? 'Terminer et donner le feedback' : 'Terminer la seance';
  const heroCtaLabel = sessionRunning
    ? 'Seance en cours'
    : hasStarted
      ? 'Reprendre la seance'
      : 'Commencer la seance';

  const handleStartSession = useCallback(() => {
    if (isCompleted) return;
    setSessionRunning(true);
    setRestRunning(false);
    markSessionInProgress();
  }, [isCompleted, markSessionInProgress]);

  const finishAction = () => {
    const estimatedRpe = (() => {
      if (typeof v2.rpeTarget === 'number' && Number.isFinite(v2.rpeTarget)) {
        return Math.max(1, Math.min(10, Math.round(v2.rpeTarget)));
      }
      const intensity = (v2.intensity ?? '').toLowerCase();
      if (intensity.includes('hard')) return 8;
      if (intensity.includes('easy')) return 4;
      return 6;
    })();
    const durationMin =
      sessionSec >= 60
        ? Math.max(5, Math.round(sessionSec / 60))
        : typeof v2.durationMin === 'number'
        ? Math.round(v2.durationMin)
        : undefined;
    const intensity = typeof v2.intensity === 'string' ? v2.intensity : undefined;
    const focusRaw = v2.focusPrimary ?? v2.focusSecondary;
    const focus = typeof focusRaw === 'string' ? focusRaw : undefined;
    const location = typeof v2.location === 'string' ? v2.location : undefined;
    // Backend emet recovery_tips au top-level (fksSchema.ts:102), pas dans post_session.
    // Fallback sur postSession.recoveryTips pour compat retro.
    const recoveryTipsSource =
      (Array.isArray(v2.recoveryTips) && v2.recoveryTips.length > 0)
        ? v2.recoveryTips
        : (Array.isArray(v2.postSession?.recoveryTips) && v2.postSession!.recoveryTips!.length > 0)
        ? v2.postSession!.recoveryTips
        : undefined;
    const recoveryTips = recoveryTipsSource;
    nav.navigate('SessionSummary', {
      sessionId,
      summary: {
        title, subtitle, plannedDateISO, completedItems, totalItems,
        durationMin, rpe: estimatedRpe, intensity, focus, location,
        srpe: typeof v2?.estimatedLoad?.srpe === 'number' && Number.isFinite(v2.estimatedLoad.srpe)
          ? v2.estimatedLoad.srpe : undefined,
        recoveryTips,
        sessionTheme: v2.sessionTheme ?? null,
        cycleLabel: playerPreviewContext.cycleLabel,
        cycleProgressLabel: playerPreviewContext.cycleProgressLabel,
        cyclePhaseLabel: playerPreviewContext.cyclePhaseLabel,
        adaptationLabels: playerPreviewContext.adaptationLabels,
        playerRationaleTitle: playerPreviewContext.playerRationaleTitle,
        playerRationale: playerPreviewContext.playerRationale,
        coachNote: playerPreviewContext.coachNote,
      },
    });
  };

  return (
    <View style={styles.modalRoot}>
      <ModalContainer
        visible
        onClose={() => nav.goBack()}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss
        allowSwipeDismiss
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'left', 'bottom']}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Séance</Text>
            <TouchableOpacity onPress={() => nav.goBack()} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.container,
              { paddingBottom: Math.max(24, insets.bottom + 20) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[styles.content, { opacity: enter, transform: [{ translateY: enterTranslate }] }]}
            >
              {/* Hero */}
              <HeroCard
                title={title}
                subtitle={subtitle}
                sessionTheme={v2.sessionTheme}
                playerRationaleTitle={playerPreviewContext.playerRationaleTitle}
                playerRationale={playerPreviewContext.playerRationale}
                cycleLabel={playerPreviewContext.cycleLabel}
                cycleProgressLabel={playerPreviewContext.cycleProgressLabel}
                cyclePhaseLabel={playerPreviewContext.cyclePhaseLabel}
                adaptationLabels={playerPreviewContext.adaptationLabels}
                plannedDateISO={plannedDateISO}
                intensity={v2.intensity}
                focusPrimary={v2.focusPrimary}
                focusSecondary={v2.focusSecondary}
                location={playerPreviewContext.locationTag}
                durationLabel={durationLabel}
                rpeLabel={rpeLabel}
                completedItems={completedItems}
                totalItems={totalItems}
                progress={progress}
                canStart={canStart}
                onGoLive={handleStartSession}
                ctaLabel={heroCtaLabel}
                ctaDisabled={sessionRunning}
                cycleType={microcycleGoal}
              />

              {playerPreviewContext.coachNote ? (
                <Card variant="surface" style={styles.coachNoteCard}>
                  <View style={styles.coachNoteHeader}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={palette.accent} />
                    <Text style={styles.coachNoteTitle}>Note du prépa</Text>
                  </View>
                  <Text style={styles.coachNoteText}>{playerPreviewContext.coachNote}</Text>
                </Card>
              ) : null}

              {/* Reset explain */}
              {isResetPlan && resetExplain ? (
                <Card variant="surface" style={styles.resetExplainCard}>
                  <View style={styles.resetExplainHeader}>
                    <Ionicons name="alert-circle-outline" size={16} color={palette.accent} />
                    <Text style={styles.resetExplainTitle}>{resetExplain.title}</Text>
                  </View>
                  <Text style={styles.resetExplainSubtitle}>{resetExplain.subtitle}</Text>
                  <View style={styles.resetExplainGroup}>
                    {resetExplain.reasons.map((reason, index) => (
                      <View key={`${reason}-${index}`} style={styles.resetBulletRow}>
                        <Text style={styles.resetBullet}>{'\u2022'}</Text>
                        <Text style={styles.resetBulletText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.resetExplainLabel}>Exemples concrets</Text>
                  <View style={styles.resetExplainGroup}>
                    {resetExplain.examples.map((example, index) => (
                      <View key={`${example}-${index}`} style={styles.resetBulletRow}>
                        <Text style={styles.resetBullet}>{'\u2022'}</Text>
                        <Text style={styles.resetBulletText}>{example}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* Flow strip */}
              <FlowStrip blocks={blocks} isBlockComplete={isBlockComplete} />

              {/* Rationale — masqué en production (trop technique pour les joueurs) */}

              {/* Warmup */}
              {warmup ? (
                <>
                  <SectionHeader title="Échauffement recommandé" style={styles.sectionHeader} />
                  <Card variant="surface" style={styles.warmupCard}>
                    <Text style={styles.cardTitle}>
                      {warmup.title} {'\u00b7'} {warmup.duration}
                    </Text>
                    <View style={{ marginTop: 6, gap: 4 }}>
                      {warmup.steps.map((s, i) => (
                        <Text key={`wu_${i}`} style={styles.bullet}>{'\u2022'} {s}</Text>
                      ))}
                    </View>
                  </Card>
                </>
              ) : null}

              {/* Blocks */}
              {blockCount > 0 ? (
                <>
                  <SectionHeader
                    title="Programme"
                    right={<Badge label={`${completedItems}/${totalItems}`} />}
                    style={styles.sectionHeader}
                  />
                  {blocks.map((block, blockIndex) => (
                    <BlockCard
                      key={`block_${blockIndex}`}
                      block={block}
                      blockIndex={blockIndex}
                      previousBlock={blockIndex > 0 ? blocks[blockIndex - 1] : undefined}
                      checked={checked}
                      isComplete={isBlockComplete(blockIndex)}
                      isCompleted={isCompleted}
                      blockAnim={blockAnims[blockIndex] ?? new Animated.Value(1)}
                      onToggleItem={toggleItem}
                      onOpenVideo={openExerciseVideo}
                      getPulse={getPulse}
                    />
                  ))}
                </>
              ) : (
                <Card variant="soft" style={styles.emptyBlockCard}>
                  <Text style={styles.blockEmpty}>Aucun bloc détaillé pour cette séance.</Text>
                </Card>
              )}

              <Card variant="soft" style={styles.toolsCard}>
                <TouchableOpacity
                  style={styles.toolsRow}
                  onPress={() => setShowTimerTools((v) => !v)}
                  activeOpacity={0.85}
                >
                  <View style={styles.toolsLabelWrap}>
                    <Ionicons name="time-outline" size={16} color={palette.accent} />
                    <Text style={styles.toolsTitle}>Outils de seance (optionnel)</Text>
                  </View>
                  <Ionicons
                    name={showTimerTools ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.sub}
                  />
                </TouchableOpacity>
              </Card>

              {showTimerTools ? (
                <TimerCard
                  sessionSec={sessionSec}
                  sessionRunning={sessionRunning}
                  restSec={restSec}
                  timerPresets={timerPresets}
                  isCompleted={isCompleted}
                  onToggleSession={() => {
                    if (!sessionRunning && !isCompleted) {
                      markSessionInProgress();
                    }
                    setSessionRunning((v) => !v);
                  }}
                  onResetSession={() => { setSessionRunning(false); setSessionSec(0); }}
                  onStartRest={(s) => { setRestSec(s); setRestRunning(true); }}
                  onStopRest={() => { setRestRunning(false); setRestSec(0); }}
                />
              ) : null}

              {/* Pourquoi cette séance (rationale IA) */}
              {v2.analytics?.rationale ? (
                <Card variant="soft" style={styles.coachCard}>
                  <View style={styles.rationaleHeader}>
                    <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
                    <Text style={styles.rationaleTitle}>Pourquoi cette séance</Text>
                  </View>
                  <Text style={styles.body}>{v2.analytics.rationale}</Text>
                </Card>
              ) : null}

              {/* Coaching */}
              {v2.coachingTips && v2.coachingTips.length > 0 ? (
                <Card variant="soft" style={styles.coachCard}>
                  <SectionHeader title="Coaching" />
                  <View style={{ gap: 6 }}>
                    {v2.coachingTips.map((tip: string, i: number) => (
                      <Text key={`tip_${i}`} style={styles.bullet}>{'\u2022'} {tip}</Text>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* Safety notes from backend (conditional) */}
              {v2.safetyNotes ? (
                <Card variant="soft" style={styles.coachCard}>
                  <SectionHeader title="Sécurité" />
                  <Text style={styles.body}>{v2.safetyNotes}</Text>
                </Card>
              ) : null}

              {/* Permanent safety banner */}
              <SafetyBanner />

              {/* Post session */}
              {(() => {
                const recoveryTipsDisplay =
                  (Array.isArray(v2.recoveryTips) && v2.recoveryTips.length > 0)
                    ? v2.recoveryTips
                    : (v2.postSession?.recoveryTips ?? []);
                const hasMobility = v2.postSession?.mobility && v2.postSession.mobility.length > 0;
                const hasRecovery = recoveryTipsDisplay.length > 0;
                if (!hasMobility && !hasRecovery) return null;
                return (
                <Card variant="soft" style={styles.coachCard}>
                  <SectionHeader title="Post-séance" />
                  <View style={{ gap: 6 }}>
                    {recoveryTipsDisplay.map((tip: string, i: number) => (
                      <View key={`rec_${i}`} style={styles.recoveryTipRow}>
                        <Ionicons name="leaf-outline" size={13} color={theme.colors.teal500} />
                        <Text style={styles.recoveryTipText}>{tip}</Text>
                      </View>
                    ))}
                    {v2.postSession?.mobility?.map((m: string, i: number) => (
                      <Text key={`mob_${i}`} style={styles.bullet}>{'\u2022'} {m}</Text>
                    ))}
                    {v2.postSession?.cooldownMin ? (
                      <Text style={styles.bullet}>
                        {'\u2022'} Retour au calme {v2.postSession.cooldownMin} min
                      </Text>
                    ) : null}
                  </View>
                </Card>
                );
              })()}

              {/* Finish */}
              <View style={{ marginBottom: 24 }}>
                <Button
                  label={finishLabel}
                  onPress={finishAction}
                  fullWidth
                  size="lg"
                  disabled={isCompleted}
                />
              </View>
            </Animated.View>
          </ScrollView>
          <YouTubePlayer
            visible={videoPlayerUrl !== null}
            url={videoPlayerUrl}
            label={videoPlayerLabel}
            onClose={() => setVideoPlayerUrl(null)}
          />
        </SafeAreaView>
      </ModalContainer>
    </View>
  );
}

export default withSessionErrorBoundary(SessionPreviewScreen);

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'transparent' },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  modalHeaderTitle: { fontSize: TYPE.body.fontSize, fontWeight: '800', color: palette.text },
  modalClose: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 44, minHeight: 44, alignItems: "center" as const, justifyContent: "center" as const },
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 14, paddingBottom: 24 },
  content: { gap: 12 },
  coachNoteCard: {
    padding: 14,
    gap: 8,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    ...theme.shadow.soft,
  },
  coachNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachNoteTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: '800',
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  coachNoteText: { color: palette.text, fontSize: TYPE.body.fontSize, lineHeight: 20, fontWeight: '800' },
  resetExplainCard: { padding: 14, gap: 8 },
  resetExplainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetExplainTitle: { fontSize: TYPE.body.fontSize, fontWeight: '800', color: palette.text },
  resetExplainSubtitle: { fontSize: TYPE.caption.fontSize, color: palette.sub, lineHeight: 16 },
  resetExplainLabel: { fontSize: TYPE.caption.fontSize, fontWeight: '700', color: palette.text },
  resetExplainGroup: { gap: 6 },
  resetBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  resetBullet: { color: palette.accent, fontSize: TYPE.caption.fontSize, marginTop: 1 },
  resetBulletText: { flex: 1, color: palette.text, fontSize: TYPE.caption.fontSize, lineHeight: 16 },
  sectionHeader: { marginTop: 12 },
  warmupCard: { padding: 10 },
  cardTitle: { color: palette.text, fontSize: TYPE.body.fontSize, fontWeight: '700' },
  bullet: { color: palette.text, marginBottom: 4, fontSize: TYPE.caption.fontSize, lineHeight: 18 },
  body: { color: palette.text, fontSize: TYPE.caption.fontSize, lineHeight: 18 },
  coachCard: { padding: 12, gap: 8 },
  rationaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  rationaleTitle: {
    fontSize: TYPE.bodyBold.fontSize,
    fontWeight: "800",
    color: palette.accent,
    letterSpacing: 0.2,
  },
  recoveryTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  recoveryTipText: { flex: 1, color: palette.text, fontSize: TYPE.caption.fontSize, lineHeight: 18 },
  toolsCard: { paddingHorizontal: 12, paddingVertical: 10 },
  toolsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolsLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolsTitle: { color: palette.text, fontSize: TYPE.caption.fontSize, fontWeight: '700' },
  blockEmpty: { color: palette.sub, fontSize: TYPE.caption.fontSize },
  emptyBlockCard: { padding: 10 },
});
