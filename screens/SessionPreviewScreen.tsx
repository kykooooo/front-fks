// src/screens/SessionPreviewScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Platform,
  Vibration,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useTrainingStore } from '../state/trainingStore';
import { getWarmupForSession } from '../constants/warmups';
import { theme } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useSettingsStore } from '../state/settingsStore';
import { withSessionErrorBoundary } from '../components/withErrorBoundary';

type SessionPreviewRoute = RouteProp<AppStackParamList, 'SessionPreview'>;

// ====== TYPES V2 (alignés avec backend) ======
type BlockItem = {
  name?: string | null;
  description?: string | null;
  exercise_id?: string | null;

  sets?: number | null;
  reps?: number | null;

  // travail au temps
  work_s?: number | null;
  rest_s?: number | null;
  work_rest_sec?: number[] | null; // [work, rest]
  work_rest?: string | null;       // fallback texte ("10x200m / 40s rec")

  duration_min?: number | null;
  duration_per_set_sec?: number | null;

  notes?: string | null;
  modality?: string | null;
};

type Block = {
  id?: string;
  block_id?: string;
  name?: string | null;
  type?: string;
  goal?: string | null;
  focus?: string | null;
  intensity?: string;
  duration_min?: number;
  items?: BlockItem[];
  notes?: string | null;
  timer_presets?: {
    label?: string;
    work_s?: number | null;
    rest_s?: number | null;
    rounds?: number | null;
  }[] | null;
};

// ====== UI HELPERS ======
const palette = theme.colors;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SPACING = 12;

const formatTime = (total: number) => {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

function prettifyName(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Exercice';
  // enlève les prefixes techniques
  const noPrefix = trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, '');
  const spaced = noPrefix.replace(/_/g, ' ');
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const intensityTone = (intensity?: string) => {
  const key = (intensity ?? '').toLowerCase();
  if (key.includes('hard') || key.includes('max')) return 'danger';
  if (key.includes('mod')) return 'warn';
  if (key.includes('easy')) return 'ok';
  return 'default';
};

const getCoachTip = (block: Block | undefined, index: number) => {
  if (!block) return 'Qualité d’exécution avant volume.';
  const raw = `${block.type ?? ''} ${block.focus ?? ''} ${block.goal ?? ''}`.toLowerCase();
  if (raw.includes('strength') || raw.includes('force')) {
    return 'Technique propre, amplitude contrôlée, tempo stable.';
  }
  if (raw.includes('speed') || raw.includes('vitesse')) {
    return 'Explosivité max, récup complète, départs propres.';
  }
  if (raw.includes('endurance') || raw.includes('tempo') || raw.includes('run')) {
    return 'Rythme constant, respiration posée, relâchement.';
  }
  if (raw.includes('plyo') || raw.includes('saut')) {
    return 'Contacts courts, gainage actif, atterrissages doux.';
  }
  if (raw.includes('cod') || raw.includes('agility') || raw.includes('appuis')) {
    return 'Appuis bas, changements propres, regard haut.';
  }
  if (raw.includes('mobility') || raw.includes('mobilite')) {
    return 'Amplitude progressive, aucune douleur, respiration lente.';
  }
  return `Bloc ${index + 1} : qualité d’exécution avant volume.`;
};

// ====== SCREEN ======
function SessionPreviewScreen({ route }: { route: SessionPreviewRoute }) {
  const { v2, plannedDateISO, sessionId } = route.params;
  const nav = useNavigation<any>();
  const title = v2.title || 'Séance IA';
  const subtitle = v2.subtitle;
  const blocks: Block[] = Array.isArray(v2.blocks) ? v2.blocks : [];
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const phase = useTrainingStore((s) => s.phase);
  const tsb = useTrainingStore((s) => s.tsb);
  const clubDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const sessions = useTrainingStore((s) => s.sessions);
  const currentSession = sessionId ? sessions.find((s: any) => s.id === sessionId) : null;
  const canStart = !currentSession?.completed;
  const isCompleted = !!currentSession?.completed;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [activeBlock, setActiveBlock] = useState(0);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionSec, setSessionSec] = useState(0);
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restRunning, setRestRunning] = useState(false);
  const [restSec, setRestSec] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockWidth = useMemo(() => Math.max(280, SCREEN_WIDTH - 32), []);
  const itemSize = blockWidth + ITEM_SPACING;
  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const pulseMap = useRef<Record<string, Animated.Value>>({});
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const index = viewableItems[0]?.index ?? 0;
      setActiveBlock(index);
    }
  ).current;
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 70 }).current;

  const warmup = useMemo(() => getWarmupForSession(v2), [v2]);
  const coachTip = useMemo(
    () => getCoachTip(blocks[activeBlock], activeBlock),
    [blocks, activeBlock]
  );
  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const srpe = v2.estimated_load?.srpe ?? null;
  const srpeLabel =
    srpe != null && Number.isFinite(srpe) ? `${Math.round(srpe)} UA` : '—';
  const durationLabel = v2.duration_min != null ? `${v2.duration_min} min` : '—';
  const rpeLabel = v2.rpe_target != null ? `${v2.rpe_target}` : '—';
  const blockCount = blocks.length;
  const tsbLabel = tsb >= 0 ? 'Plutôt frais' : tsb <= -10 ? 'Fatigue élevée' : 'Charge modérée';
  const tsbTone = tsb >= 0 ? 'ok' : tsb <= -10 ? 'danger' : 'warn';

  const playRestSignal = React.useCallback(() => {
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

  const getPulse = (key: string) => {
    if (!pulseMap.current[key]) {
      pulseMap.current[key] = new Animated.Value(1);
    }
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

  const getDisplayName = (it: BlockItem) => {
    const displayNameRaw = (it?.name || '').trim();
    const fallbackId =
      typeof (it as any)?.exercise_id === 'string' && (it as any).exercise_id.trim()
        ? (it as any).exercise_id.trim()
        : typeof (it as any)?.id === 'string' && (it as any).id.trim()
        ? (it as any).id.trim()
        : undefined;
    const displayName =
      displayNameRaw.length > 0
        ? prettifyName(displayNameRaw)
        : fallbackId
        ? prettifyName(fallbackId)
        : it?.modality
        ? prettifyName(String(it.modality))
        : 'Exercice';
    return displayName;
  };

  const getExerciseId = (it: BlockItem) => {
    if (typeof (it as any)?.exercise_id === 'string' && (it as any).exercise_id.trim()) {
      return (it as any).exercise_id.trim();
    }
    if (typeof (it as any)?.id === 'string' && (it as any).id.trim()) {
      return (it as any).id.trim();
    }
    return null;
  };

  const formatItemMeta = (item: BlockItem) => {
    const parts: string[] = [];
    if (item?.sets != null && item.sets > 0) parts.push(`${item.sets}x`);
    if (item?.reps != null && item.reps > 0) parts.push(`${item.reps} reps`);
    if (Array.isArray(item?.work_rest_sec) && item.work_rest_sec.length >= 2) {
      const [w, r] = item.work_rest_sec;
      parts.push(`${w ?? '?'}s/${r ?? '?'}s`);
    } else if (item?.work_s || item?.rest_s) {
      if (item.work_s) parts.push(`${item.work_s}s`);
      if (item.rest_s) parts.push(`/${item.rest_s}s`);
    } else if (item?.work_rest && item.work_rest.trim().length > 0) {
      parts.push(item.work_rest.trim());
    }
    if (item?.duration_per_set_sec) parts.push(`${item.duration_per_set_sec}s / série`);
    if (item?.duration_min) parts.push(`${item.duration_min} min`);
    return parts.join(' · ');
  };

  const totalItems = useMemo(() => {
    return blocks.reduce((acc, block) => acc + (block.items?.length ?? 0), 0);
  }, [blocks]);

  const completedItems = useMemo(() => {
    return Object.values(checked).filter(Boolean).length;
  }, [checked]);

  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  const toggleItem = (blockIndex: number, itemIndex: number) => {
    const key = `${blockIndex}-${itemIndex}`;
    setChecked((prev) => {
      const nextValue = !prev[key];
      if (nextValue) triggerPulse(key);
      return { ...prev, [key]: nextValue };
    });
  };

  const isBlockComplete = (blockIndex: number, items: BlockItem[] = []) => {
    if (items.length === 0) return false;
    return items.every((_, idx) => checked[`${blockIndex}-${idx}`]);
  };

  useEffect(() => {
    if (sessionRunning) {
      sessionRef.current = setInterval(() => {
        setSessionSec((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (sessionRef.current) {
        clearInterval(sessionRef.current);
        sessionRef.current = null;
      }
    };
  }, [sessionRunning]);

  useEffect(() => {
    if (restRunning) {
      restRef.current = setInterval(() => {
        setRestSec((s) => {
          if (s <= 1) {
            setRestRunning(false);
            playRestSignal();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (restRef.current) {
        clearInterval(restRef.current);
        restRef.current = null;
      }
    };
  }, [restRunning, playRestSignal]);

  useEffect(() => {
    if (blocks.length <= 1) return;
    if (Platform.OS === 'web') return;
    if (!hapticsEnabled) return;
    Vibration.vibrate(30);
  }, [activeBlock, blocks.length, hapticsEnabled]);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  useEffect(() => {
    if (!blocks.length) return;
    if (activeBlock >= blocks.length) setActiveBlock(0);
  }, [blocks, activeBlock]);

  const startRest = (seconds: number) => {
    setRestSec(seconds);
    setRestRunning(true);
  };

  const finishLabel = sessionId
    ? 'Terminer et donner le feedback'
    : 'Terminer la séance';

  const finishAction = () => {
    const estimatedRpe = (() => {
      if (typeof v2.rpe_target === 'number' && Number.isFinite(v2.rpe_target)) {
        return Math.max(1, Math.min(10, Math.round(v2.rpe_target)));
      }
      const intensity = (v2.intensity ?? '').toLowerCase();
      if (intensity.includes('hard')) return 8;
      if (intensity.includes('easy')) return 4;
      return 6;
    })();
    const durationMin =
      sessionSec >= 60
        ? Math.max(5, Math.round(sessionSec / 60))
        : typeof v2.duration_min === 'number'
        ? Math.round(v2.duration_min)
        : undefined;
    const intensity = typeof v2.intensity === 'string' ? v2.intensity : undefined;
    const focusRaw = v2.focus_primary ?? v2.focus_secondary;
    const focus = typeof focusRaw === 'string' ? focusRaw : undefined;
    const location = typeof v2.location === 'string' ? v2.location : undefined;
    const summary = {
      title,
      subtitle,
      plannedDateISO,
      completedItems,
      totalItems,
      durationMin,
      rpe: estimatedRpe,
      intensity,
      focus,
      location,
      srpe:
        typeof v2?.estimated_load?.srpe === 'number' && Number.isFinite(v2.estimated_load.srpe)
          ? v2.estimated_load.srpe
          : undefined,
    };
    nav.navigate(
      'SessionSummary' as never,
      {
        sessionId,
        summary,
      } as never
    );
  };

  const goToExercise = (exerciseId: string | null) => {
    if (!exerciseId) return;
    nav.navigate(
      'Tabs' as never,
      { screen: 'VideoLibrary', params: { highlightId: exerciseId } } as never
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.content, { opacity: enter, transform: [{ translateY: enterTranslate }] }]}
        >
          <Card variant="surface" style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Badge label={plannedDateISO} />
            </View>

            <View style={styles.heroTags}>
              {v2.intensity ? (
                <Badge label={v2.intensity} tone={intensityTone(v2.intensity)} />
              ) : null}
              {v2.focus_primary ? <Badge label={v2.focus_primary} /> : null}
              {v2.focus_secondary ? <Badge label={v2.focus_secondary} /> : null}
              {v2.location ? <Badge label={v2.location} /> : null}
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Durée</Text>
                <Text style={styles.heroStatValue}>{durationLabel}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Charge</Text>
                <Text style={styles.heroStatValue}>{srpeLabel}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>RPE cible</Text>
                <Text style={styles.heroStatValue}>{rpeLabel}</Text>
              </View>
            </View>

            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>
                Progression : {completedItems}/{totalItems || '—'}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            {canStart ? (
              <Button
                label="Passer en mode live"
                onPress={() => {
                  setSessionRunning(false);
                  setRestRunning(false);
                  nav.navigate('SessionLive' as never, { v2, plannedDateISO, sessionId } as never);
                }}
                fullWidth
                size="md"
                variant="secondary"
                style={styles.heroCta}
              />
            ) : null}
          </Card>

        {/* BLOCS */}
        {blockCount > 0 ? (
          <>
            <SectionHeader
              title="Bloc en cours"
              right={<Badge label={`${Math.min(activeBlock + 1, blockCount)}/${blockCount}`} />}
              style={styles.sectionHeader}
            />
            <Text style={styles.swipeHint}>Swipe pour passer au bloc suivant.</Text>
            <Animated.FlatList
              data={blocks}
              horizontal
              keyExtractor={(_, index) => `block_${index}`}
              renderItem={({ item: block, index: blockIndex }) => {
                const items = block.items ?? [];
                const blockTitle =
                  block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
                const isComplete = isBlockComplete(blockIndex, items);
                const inputRange = [
                  (blockIndex - 1) * itemSize,
                  blockIndex * itemSize,
                  (blockIndex + 1) * itemSize,
                ];
                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.94, 1, 0.94],
                  extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.6, 1, 0.6],
                  extrapolate: 'clamp',
                });
                return (
                  <Animated.View
                    style={[
                      styles.blockCardWrap,
                      { width: blockWidth, opacity, transform: [{ scale }] },
                    ]}
                  >
                    <Card variant="surface" style={styles.blockCard}>
                      <View style={styles.blockHeader}>
                        <View>
                          <Text style={styles.blockTitle}>{blockTitle}</Text>
                          <Text style={styles.blockMeta}>
                            {block.intensity ?? '—'} · {block.duration_min ?? '?'} min
                          </Text>
                        </View>
                        {isComplete ? <Badge label="OK" tone="ok" /> : null}
                      </View>

                      {items.length === 0 ? (
                        <Text style={styles.blockEmpty}>Bloc sans items détaillés.</Text>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {items.map((item, itemIndex) => {
                            const key = `${blockIndex}-${itemIndex}`;
                            const checkedItem = !!checked[key];
                            const itemName = getDisplayName(item);
                            const meta = formatItemMeta(item);
                            const exerciseId = getExerciseId(item);
                            const pulse = getPulse(key);
                            return (
                              <View key={key} style={styles.itemRow}>
                                <TouchableOpacity
                                  onPress={() => toggleItem(blockIndex, itemIndex)}
                                  activeOpacity={0.85}
                                  style={styles.itemMain}
                                  disabled={isCompleted}
                                >
                                  <Animated.View
                                    style={[
                                      styles.checkbox,
                                      checkedItem && styles.checkboxChecked,
                                      { transform: [{ scale: pulse }] },
                                    ]}
                                  >
                                    {checkedItem ? (
                                      <Text style={styles.checkboxIcon}>✓</Text>
                                    ) : null}
                                  </Animated.View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName}>{itemName}</Text>
                                    {item.description ? (
                                      <Text style={styles.itemNote}>{item.description}</Text>
                                    ) : null}
                                    {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                                    {item.notes ? (
                                      <Text style={styles.itemNote}>{item.notes}</Text>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                                {exerciseId ? (
                                  <TouchableOpacity
                                    onPress={() => goToExercise(exerciseId)}
                                    activeOpacity={0.85}
                                    style={styles.itemLink}
                                  >
                                    <Text style={styles.itemLinkText}>Fiche</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </Card>
                  </Animated.View>
                );
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              ItemSeparatorComponent={() => <View style={{ width: ITEM_SPACING }} />}
              snapToInterval={itemSize}
              decelerationRate="fast"
              snapToAlignment="start"
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: itemSize,
                offset: itemSize * index,
                index,
              })}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            />
            <View style={styles.dotsRow}>
              {blocks.map((_, idx) => {
                const done = isBlockComplete(idx, blocks[idx]?.items ?? []);
                const isActive = idx === activeBlock;
                return (
                  <View
                    key={`dot_${idx}`}
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      isActive && styles.dotActive,
                    ]}
                  />
                );
              })}
            </View>
            {blocks.length > 0 ? (
              <Card variant="soft" style={styles.coachMiniCard}>
                <SectionHeader title={`Focus bloc ${Math.min(activeBlock + 1, blocks.length)}`} />
                <Text style={styles.coachMiniText}>{coachTip}</Text>
              </Card>
            ) : null}
          </>
        ) : (
          <Card variant="soft" style={styles.emptyBlockCard}>
            <Text style={styles.blockEmpty}>Aucun bloc détaillé pour cette séance.</Text>
          </Card>
        )}

        <Card variant="soft" style={styles.timerCard}>
          <SectionHeader title="Chronos" />
          <View style={styles.timerRow}>
            <View style={styles.timerBlock}>
              <Text style={styles.timerLabel}>Séance</Text>
              <Text style={styles.timerValue}>{formatTime(sessionSec)}</Text>
            </View>
            <View style={styles.timerBlock}>
              <Text style={styles.timerLabel}>Repos</Text>
              <Text style={styles.timerValue}>{formatTime(restSec)}</Text>
            </View>
          </View>

          <View style={styles.timerActions}>
            <Button
              label={sessionRunning ? 'Pause' : 'Démarrer'}
              onPress={() => setSessionRunning((v) => !v)}
              size="sm"
              variant={sessionRunning ? 'secondary' : 'primary'}
              style={styles.timerButton}
              disabled={isCompleted}
            />
            <Button
              label="Réinit"
              onPress={() => {
                setSessionRunning(false);
                setSessionSec(0);
              }}
              size="sm"
              variant="ghost"
              style={styles.timerButton}
              disabled={isCompleted}
            />
          </View>

          <View style={styles.restRow}>
            {[30, 60, 90].map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.restChip}
                onPress={() => startRest(s)}
                activeOpacity={0.85}
                disabled={isCompleted}
              >
                <Text style={styles.restChipText}>{s}s</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.restChip, styles.restChipGhost]}
              onPress={() => {
                setRestRunning(false);
                setRestSec(0);
              }}
              disabled={isCompleted}
            >
              <Text style={styles.restChipGhostText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card variant="soft" style={styles.contextCard}>
          <SectionHeader title="Contexte du jour" />
          <View style={styles.contextBadges}>
            <Badge label={`Phase ${phase || '—'}`} />
            <Badge label={`TSB ${tsb.toFixed(1)} · ${tsbLabel}`} tone={tsbTone} />
          </View>
          <Text style={styles.body}>
            Objectif : {v2.focus_primary ?? '—'} · {v2.intensity ?? '-'} · ~{v2.duration_min ?? '?'} min
          </Text>
          <View style={styles.reasonList}>
            {buildReasons(plannedDateISO, clubDays, matchDays).map((r, i) => (
              <Text key={`r_${i}`} style={styles.bullet}>• {r}</Text>
            ))}
          </View>
        </Card>

        {/* WARMUP */}
        {warmup ? (
          <>
            <SectionHeader title="Échauffement recommandé" style={styles.sectionHeader} />
            <Card variant="surface" style={styles.warmupCard}>
              <Text style={styles.cardTitle}>
                {warmup.title} · {warmup.duration}
              </Text>
              <View style={{ marginTop: 6, gap: 4 }}>
                {warmup.steps.map((s, i) => (
                  <Text key={`wu_${i}`} style={styles.bullet}>
                    • {s}
                  </Text>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {/* COACHING */}
        {v2.coaching_tips && v2.coaching_tips.length > 0 ? (
          <Card variant="soft" style={styles.coachCard}>
            <SectionHeader title="Coaching" />
            <View style={{ gap: 6 }}>
              {v2.coaching_tips.map((tip: string, i: number) => (
                <Text key={`tip_${i}`} style={styles.bullet}>
                  • {tip}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {/* SÉCURITÉ */}
        {v2.safety_notes ? (
          <Card variant="soft" style={styles.coachCard}>
            <SectionHeader title="Sécurité" />
            <Text style={styles.body}>{v2.safety_notes}</Text>
          </Card>
        ) : null}

        {/* POST SESSION */}
        {v2.post_session?.mobility && v2.post_session.mobility.length > 0 ? (
          <Card variant="soft" style={styles.coachCard}>
            <SectionHeader title="Post-séance" />
            <View style={{ gap: 6 }}>
              {v2.post_session.mobility.map((m: string, i: number) => (
                <Text key={`mob_${i}`} style={styles.bullet}>
                  • {m}
                </Text>
              ))}
              {v2.post_session.cooldown_min ? (
                <Text style={styles.bullet}>
                  • Retour au calme {v2.post_session.cooldown_min} min
                </Text>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* BOUTON FEEDBACK */}
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
  );
}

// Export avec Error Boundary pour éviter les crashs
export default withSessionErrorBoundary(SessionPreviewScreen);

// ====== STYLES ======
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 14, paddingBottom: 24 },
  content: { gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: palette.text },
  subtitle: { fontSize: 13, color: palette.sub, marginTop: 4 },
  heroCard: { padding: 14, gap: 10, borderRadius: 20, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    top: -90,
    right: -130,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.85,
  },
  heroTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  heroStat: { flex: 1 },
  heroStatLabel: { color: palette.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroStatValue: { color: palette.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: palette.borderSoft, marginHorizontal: 12 },
  heroCta: { marginTop: 4 },
  progressWrap: { gap: 4 },
  progressLabel: { color: palette.sub, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: palette.accent },
  timerCard: { padding: 12, gap: 10 },
  timerRow: { flexDirection: 'row', gap: 10 },
  timerBlock: { flex: 1 },
  timerLabel: { color: palette.sub, fontSize: 12 },
  timerValue: { color: palette.text, fontSize: 22, fontWeight: '800' },
  timerActions: { flexDirection: 'row', gap: 8 },
  timerButton: { flex: 1 },
  restRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  restChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  restChipGhost: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  restChipText: { color: palette.text, fontWeight: '600', fontSize: 12 },
  restChipGhostText: { color: palette.accent, fontWeight: '700', fontSize: 12 },
  contextCard: { padding: 12, gap: 8 },
  contextBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonList: { marginTop: 4, gap: 2 },
  metricsCard: { padding: 14, gap: 10 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricItem: { minWidth: 90, flexGrow: 1 },
  metricLabel: { color: palette.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  metricValue: { color: palette.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  sectionHeader: { marginTop: 12 },
  swipeHint: { color: palette.sub, fontSize: 12, marginTop: -6 },
  blockCardWrap: { marginBottom: 2 },
  blockCard: { padding: 12, gap: 8 },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  blockTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  blockMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  blockEmpty: { color: palette.sub, fontSize: 12 },
  itemRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  itemMain: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  checkboxIcon: { color: palette.bg, fontSize: 12, fontWeight: '800' },
  itemName: { color: palette.text, fontSize: 14, fontWeight: '600' },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  itemLinkText: { color: palette.accent, fontSize: 11, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: palette.borderSoft },
  dotActive: { width: 10, backgroundColor: palette.accent },
  dotDone: { backgroundColor: palette.success },
  emptyBlockCard: { padding: 10 },
  coachMiniCard: { padding: 12, gap: 6 },
  coachMiniText: { color: palette.sub, fontSize: 12, lineHeight: 18 },
  warmupCard: { padding: 10 },
  coachCard: { padding: 12, gap: 8 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  muted: { color: palette.sub, fontSize: 12 },
  bullet: { color: palette.text, marginBottom: 4, fontSize: 13, lineHeight: 18 },
  body: { color: palette.text, fontSize: 13, lineHeight: 18 },
});

function buildReasons(dateISO: string, clubDays: string[], matchDays: string[]) {
  const reasons: string[] = [];
  // Utilise le fuseau local pour coller au ressenti de l'utilisateur
  const d = new Date(`${dateISO}T00:00:00`);
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = map[d.getDay()] ?? '';
  const tomorrow = map[new Date(d.getTime() + 86400000).getDay()] ?? '';

  if (!matchDays.includes(tomorrow) && !matchDays.includes(today)) {
    reasons.push('Pas de match aujourd’hui ou demain');
  }
  if (clubDays.includes(tomorrow)) reasons.push('Veille de jour club : volume surveillé');
  if (!clubDays.includes(today) && !matchDays.includes(today)) {
    reasons.push('Jour libre de club/match → séance cible possible');
  }
  if (reasons.length === 0) reasons.push('Séance adaptée au calendrier déclaré');
  return reasons;
}
