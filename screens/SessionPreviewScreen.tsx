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
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useLoadStore } from '../state/stores/useLoadStore';
import { useSessionsStore } from '../state/stores/useSessionsStore';
import { useExternalStore } from '../state/stores/useExternalStore';
import { getWarmupForSession } from '../constants/warmups';
import { theme } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useSettingsStore } from '../state/settingsStore';
import { withSessionErrorBoundary } from '../components/withErrorBoundary';
import { ModalContainer } from '../components/modal/ModalContainer';
import { buildResetExplain } from './newSession/resetExplain';

import {
  type Block,
  intensityTone,
} from './sessionPreview/sessionPreviewConfig';
import { HeroCard } from './sessionPreview/components/HeroCard';
import { FlowStrip } from './sessionPreview/components/FlowStrip';
import { BlockCard } from './sessionPreview/components/BlockCard';
import { TimerCard } from './sessionPreview/components/TimerCard';

type SessionPreviewRoute = RouteProp<AppStackParamList, 'SessionPreview'>;
const palette = theme.colors;

function SessionPreviewScreen({ route }: { route: SessionPreviewRoute }) {
  const { v2, plannedDateISO, sessionId } = route.params;
  const nav = useNavigation<any>();
  const title = v2.title || 'Séance IA';
  const subtitle = v2.subtitle;
  const blocks: Block[] = Array.isArray(v2.blocks) ? v2.blocks : [];
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const phase = useSessionsStore((s) => s.phase);
  const tsb = useLoadStore((s) => s.tsb);
  const profile = useSessionsStore((s) => s.lastAiContext?.profile ?? null);
  const clubDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useExternalStore((s) => s.matchDays ?? []);
  const sessions = useSessionsStore((s) => s.sessions);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const currentSession = sessionId ? sessions.find((s: any) => s.id === sessionId) : null;
  const canStart = !currentSession?.completed;
  const isCompleted = !!currentSession?.completed;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionSec, setSessionSec] = useState(0);
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restRunning, setRestRunning] = useState(false);
  const [restSec, setRestSec] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const srpe = v2.estimatedLoad?.srpe ?? null;
  const srpeLabel = srpe != null && Number.isFinite(srpe) ? `${Math.round(srpe)} UA` : '\u2014';
  const durationLabel = v2.durationMin != null ? `${v2.durationMin} min` : '\u2014';
  const rpeLabel = v2.rpeTarget != null ? `${v2.rpeTarget}` : '\u2014';
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
    setChecked((prev) => {
      const nextValue = !prev[key];
      if (nextValue) triggerPulse(key);
      return { ...prev, [key]: nextValue };
    });
  };

  const isBlockComplete = (blockIndex: number) => {
    const items = blocks[blockIndex]?.items ?? [];
    if (items.length === 0) return false;
    return items.every((_, idx) => checked[`${blockIndex}-${idx}`]);
  };

  const goToExercise = (exerciseId: string | null) => {
    if (!exerciseId) return;
    nav.navigate('ExerciseDetail', { highlightId: exerciseId });
  };

  const finishLabel = sessionId ? 'Terminer et donner le feedback' : 'Terminer la séance';

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
    const recoveryTips =
      Array.isArray(v2.postSession?.recoveryTips) && v2.postSession!.recoveryTips!.length > 0
        ? v2.postSession!.recoveryTips
        : undefined;
    nav.navigate('SessionSummary', {
      sessionId,
      summary: {
        title, subtitle, plannedDateISO, completedItems, totalItems,
        durationMin, rpe: estimatedRpe, intensity, focus, location,
        srpe: typeof v2?.estimatedLoad?.srpe === 'number' && Number.isFinite(v2.estimatedLoad.srpe)
          ? v2.estimatedLoad.srpe : undefined,
        recoveryTips,
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
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Séance</Text>
            <TouchableOpacity onPress={() => nav.goBack()} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.container}
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
                plannedDateISO={plannedDateISO}
                intensity={v2.intensity}
                focusPrimary={v2.focusPrimary}
                focusSecondary={v2.focusSecondary}
                location={v2.location}
                durationLabel={durationLabel}
                srpeLabel={srpeLabel}
                rpeLabel={rpeLabel}
                completedItems={completedItems}
                totalItems={totalItems}
                progress={progress}
                canStart={canStart}
                onGoLive={() => {
                  setSessionRunning(false);
                  setRestRunning(false);
                  nav.navigate('SessionLive', { v2, plannedDateISO, sessionId });
                }}
                cycleType={microcycleGoal}
              />

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
                      onGoToExercise={goToExercise}
                      getPulse={getPulse}
                    />
                  ))}
                </>
              ) : (
                <Card variant="soft" style={styles.emptyBlockCard}>
                  <Text style={styles.blockEmpty}>Aucun bloc détaillé pour cette séance.</Text>
                </Card>
              )}

              {/* Timer */}
              <TimerCard
                sessionSec={sessionSec}
                sessionRunning={sessionRunning}
                restSec={restSec}
                timerPresets={timerPresets}
                isCompleted={isCompleted}
                onToggleSession={() => setSessionRunning((v) => !v)}
                onResetSession={() => { setSessionRunning(false); setSessionSec(0); }}
                onStartRest={(s) => { setRestSec(s); setRestRunning(true); }}
                onStopRest={() => { setRestRunning(false); setRestSec(0); }}
              />

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

              {/* Safety */}
              {v2.safetyNotes ? (
                <Card variant="soft" style={styles.coachCard}>
                  <SectionHeader title="Sécurité" />
                  <Text style={styles.body}>{v2.safetyNotes}</Text>
                </Card>
              ) : null}

              {/* Post session */}
              {(v2.postSession?.mobility && v2.postSession.mobility.length > 0) ||
               (v2.postSession?.recoveryTips && v2.postSession.recoveryTips.length > 0) ? (
                <Card variant="soft" style={styles.coachCard}>
                  <SectionHeader title="Post-séance" />
                  <View style={{ gap: 6 }}>
                    {v2.postSession?.recoveryTips?.map((tip: string, i: number) => (
                      <View key={`rec_${i}`} style={styles.recoveryTipRow}>
                        <Ionicons name="leaf-outline" size={13} color="#14b8a6" />
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
              ) : null}

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
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: palette.text },
  modalClose: { paddingHorizontal: 8, paddingVertical: 6 },
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 14, paddingBottom: 24 },
  content: { gap: 12 },
  resetExplainCard: { padding: 14, gap: 8 },
  resetExplainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetExplainTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
  resetExplainSubtitle: { fontSize: 12, color: palette.sub, lineHeight: 16 },
  resetExplainLabel: { fontSize: 12, fontWeight: '700', color: palette.text },
  resetExplainGroup: { gap: 6 },
  resetBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  resetBullet: { color: palette.accent, fontSize: 12, marginTop: 1 },
  resetBulletText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 16 },
  sectionHeader: { marginTop: 12 },
  warmupCard: { padding: 10 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  bullet: { color: palette.text, marginBottom: 4, fontSize: 13, lineHeight: 18 },
  body: { color: palette.text, fontSize: 13, lineHeight: 18 },
  coachCard: { padding: 12, gap: 8 },
  recoveryTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  recoveryTipText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 18 },
  blockEmpty: { color: palette.sub, fontSize: 12 },
  emptyBlockCard: { padding: 10 },
});
