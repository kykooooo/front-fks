// src/screens/SessionPreviewScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useTrainingStore } from '../state/trainingStore';
import { getWarmupForSession } from '../constants/warmups';
import { theme } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useSettingsStore } from '../state/settingsStore';
import { withSessionErrorBoundary } from '../components/withErrorBoundary';
import { ModalContainer } from '../components/modal/ModalContainer';
import { getBlockConfig, getBlockLabel, getTransitionLabel } from '../components/session/blockConfig';
import { getExerciseBenefit } from '../engine/exerciseBenefits';
import { buildResetExplain } from './newSession/resetExplain';
import { buildSessionExplain } from './newSession/sessionExplain';

type SessionPreviewRoute = RouteProp<AppStackParamList, 'SessionPreview'>;

// ====== TYPES V2 (alignés avec backend) ======
type BlockItem = {
  name?: string | null;
  description?: string | null;
  football_context?: string | null;
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

const formatTime = (total: number) => {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const cleanDisplayNote = (value?: string | null) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const cleaned = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith('token:'))
    .join('\n')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const formatPresetLabel = (preset: {
  label?: string | null;
  work_s?: number | null;
  rest_s?: number | null;
  rounds?: number | null;
}) => {
  const parts: string[] = [];
  if (preset.label) parts.push(String(preset.label));
  if (Number.isFinite(Number(preset.work_s)) && Number.isFinite(Number(preset.rest_s))) {
    parts.push(`${Number(preset.work_s)}s/${Number(preset.rest_s)}s`);
  }
  if (Number.isFinite(Number(preset.rounds)) && Number(preset.rounds) > 0) {
    parts.push(`x${Number(preset.rounds)}`);
  }
  return parts.join(' · ');
};

function prettifyName(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Exercice';
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
  if (!block) return 'Qualité d\u2019exécution avant volume.';
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
  return `Bloc ${index + 1} : qualité d\u2019exécution avant volume.`;
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
  const profile = useTrainingStore((s) => s.lastAiContext?.profile ?? null);
  const clubDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const sessions = useTrainingStore((s) => s.sessions);
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

  // Stagger animations pour les blocs
  const blockAnims = useRef(blocks.map(() => new Animated.Value(0))).current;

  const warmup = useMemo(() => getWarmupForSession(v2), [v2]);
  const timerPresets = useMemo(() => {
    const globalRaw = Array.isArray(v2.display?.timer_presets) ? v2.display?.timer_presets : [];
    const blockRaw = blocks.flatMap((block) =>
      Array.isArray(block?.timer_presets) ? block.timer_presets : []
    );
    const source = [...globalRaw, ...blockRaw];
    const unique = new Set<string>();
    return source
      .map((preset) => ({
        label: preset.label ?? null,
        work_s: typeof preset.work_s === 'number' ? preset.work_s : null,
        rest_s: typeof preset.rest_s === 'number' ? preset.rest_s : null,
        rounds: typeof preset.rounds === 'number' ? preset.rounds : null,
      }))
      .filter((preset) => preset.label || (preset.work_s != null && preset.rest_s != null))
      .filter((preset) => {
        const key = `${preset.label ?? ''}|${preset.work_s ?? ''}|${preset.rest_s ?? ''}|${preset.rounds ?? ''}`;
        if (unique.has(key)) return false;
        unique.add(key);
        return true;
      })
      .slice(0, 4);
  }, [v2.display?.timer_presets, blocks]);
  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const srpe = v2.estimated_load?.srpe ?? null;
  const srpeLabel =
    srpe != null && Number.isFinite(srpe) ? `${Math.round(srpe)} UA` : '\u2014';
  const durationLabel = v2.duration_min != null ? `${v2.duration_min} min` : '\u2014';
  const rpeLabel = v2.rpe_target != null ? `${v2.rpe_target}` : '\u2014';
  const blockCount = blocks.length;
  const tsbLabel = tsb >= 0 ? 'Plutôt frais' : tsb <= -10 ? 'Fatigue élevée' : 'Charge modérée';
  const tsbTone = tsb >= 0 ? 'ok' : tsb <= -10 ? 'danger' : 'warn';
  const isResetPlan =
    v2?.archetype_id === 'foundation_X_reset' ||
    ((v2 as any)?.selection_debug?.reasons ?? []).includes('reset_selected');
  const resetExplain = useMemo(
    () => (isResetPlan ? buildResetExplain(v2, undefined, v2?.location ?? undefined, profile) : null),
    [isResetPlan, v2, profile]
  );
  const sessionExplain = useMemo(
    () => (!isResetPlan ? buildSessionExplain(v2, profile) : null),
    [isResetPlan, v2, profile]
  );

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
    return parts.join(' \u00b7 ');
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

  // Session timer
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

  // Rest timer
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

  // Entrance animation (hero + top sections)
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // Stagger animation pour les blocs (déclenché après l'entrée)
  useEffect(() => {
    if (blockAnims.length === 0) return;
    const timer = setTimeout(() => {
      Animated.stagger(
        80,
        blockAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          })
        )
      ).start();
    }, 300); // démarre après l'animation d'entrée
    return () => clearTimeout(timer);
  }, [blockAnims]);

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
    const recoveryTips =
      Array.isArray(v2.post_session?.recovery_tips) && v2.post_session!.recovery_tips!.length > 0
        ? v2.post_session!.recovery_tips
        : undefined;
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
      recoveryTips,
    };
    nav.navigate('SessionSummary', {
      sessionId,
      summary,
    });
  };

  const goToExercise = (exerciseId: string | null) => {
    if (!exerciseId) return;
    nav.navigate('ExerciseDetail', { highlightId: exerciseId });
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
          {/* ====== HERO CARD ====== */}
          <Card variant="surface" style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
                {v2.session_theme ? (
                  <View style={styles.sessionThemeRow}>
                    <Ionicons name="color-palette-outline" size={13} color={palette.accent} />
                    <Text style={styles.sessionThemeText}>{v2.session_theme}</Text>
                  </View>
                ) : null}
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
                Progression : {completedItems}/{totalItems || '\u2014'}
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
                  nav.navigate('SessionLive', { v2, plannedDateISO, sessionId });
                }}
                fullWidth
                size="md"
                variant="secondary"
                style={styles.heroCta}
              />
            ) : null}
          </Card>

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
                    <Text style={styles.resetBullet}>•</Text>
                    <Text style={styles.resetBulletText}>{reason}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.resetExplainLabel}>Exemples concrets</Text>
              <View style={styles.resetExplainGroup}>
                {resetExplain.examples.map((example, index) => (
                  <View key={`${example}-${index}`} style={styles.resetBulletRow}>
                    <Text style={styles.resetBullet}>•</Text>
                    <Text style={styles.resetBulletText}>{example}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* ====== SESSION FLOW STRIP ====== */}
          {blockCount > 0 ? (
            <View style={styles.flowSection}>
              <SectionHeader title="Déroulement" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flowStrip}
              >
                {blocks.map((block, idx) => {
                  const cfg = getBlockConfig(block.type);
                  const done = isBlockComplete(idx, block.items ?? []);
                  return (
                    <React.Fragment key={`flow_${idx}`}>
                      {idx > 0 ? (
                        <View style={styles.flowConnector}>
                          <Ionicons name="chevron-forward" size={12} color={palette.borderSoft} />
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.flowCapsule,
                          {
                            backgroundColor: cfg.tintSoft,
                            borderColor: cfg.tint + '30',
                          },
                        ]}
                      >
                        <Ionicons name={cfg.icon as any} size={14} color={cfg.tint} />
                        <Text style={[styles.flowCapsuleText, { color: cfg.tint }]}>
                          {getBlockLabel(block)}
                        </Text>
                        {done ? (
                          <Ionicons name="checkmark-circle" size={12} color={palette.success} />
                        ) : null}
                      </View>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* ====== RATIONALE / POURQUOI CETTE SEANCE ====== */}
          <Card variant="soft" style={styles.rationaleCard}>
            <View style={styles.rationaleHeader}>
              <Ionicons name="bulb-outline" size={16} color={palette.accent} />
              <Text style={styles.rationaleTitle}>Pourquoi cette séance</Text>
            </View>
            {(v2 as any).analytics?.rationale ? (
              <Text style={styles.rationaleBody}>{(v2 as any).analytics.rationale}</Text>
            ) : null}
            {sessionExplain ? (
              <>
                <Text style={styles.rationaleLabel}>Repères rapides</Text>
                <View style={styles.rationaleReasons}>
                  {sessionExplain.reasons.map((r, i) => (
                    <Text key={`why_${i}`} style={styles.bullet}>{'\u2022'} {r}</Text>
                  ))}
                </View>
                <Text style={styles.rationaleLabel}>{sessionExplain.title}</Text>
                <View style={styles.rationaleReasons}>
                  {sessionExplain.examples.map((r, i) => (
                    <Text key={`ex_${i}`} style={styles.bullet}>{'\u2022'} {r}</Text>
                  ))}
                </View>
              </>
            ) : null}
            <View style={styles.rationaleReasons}>
              {buildReasons(plannedDateISO, clubDays, matchDays).map((r, i) => (
                <Text key={`cal_${i}`} style={styles.bullet}>{'\u2022'} {r}</Text>
              ))}
            </View>
            <View style={styles.contextBadges}>
              <Badge label={`Phase ${phase || '\u2014'}`} />
              <Badge label={`Forme ${tsb.toFixed(0)} \u00b7 ${tsbLabel}`} tone={tsbTone} />
            </View>
          </Card>

          {/* ====== WARMUP (avant les blocs) ====== */}
          {warmup ? (
            <>
              <SectionHeader title="Échauffement recommandé" style={styles.sectionHeader} />
              <Card variant="surface" style={styles.warmupCard}>
                <Text style={styles.cardTitle}>
                  {warmup.title} \u00b7 {warmup.duration}
                </Text>
                <View style={{ marginTop: 6, gap: 4 }}>
                  {warmup.steps.map((s, i) => (
                    <Text key={`wu_${i}`} style={styles.bullet}>
                      {'\u2022'} {s}
                    </Text>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {/* ====== BLOCS VERTICAUX ====== */}
          {blockCount > 0 ? (
            <>
              <SectionHeader
                title="Programme"
                right={<Badge label={`${completedItems}/${totalItems}`} />}
                style={styles.sectionHeader}
              />
              {blocks.map((block, blockIndex) => {
                const cfg = getBlockConfig(block.type);
                const items = block.items ?? [];
                const blockTitle =
                  block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
                const isComplete = isBlockComplete(blockIndex, items);
                const tipText = getCoachTip(block, blockIndex);
                const anim = blockAnims[blockIndex];
                const blockOpacity = anim ?? new Animated.Value(1);
                const blockTranslateY = anim
                  ? anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] })
                  : 0;

                return (
                  <React.Fragment key={`block_${blockIndex}`}>
                    {/* Transition chip entre blocs */}
                    {blockIndex > 0 ? (
                      <View style={styles.transitionRow}>
                        <View style={styles.transitionLine} />
                        <View style={styles.transitionChip}>
                          <Ionicons name="arrow-down" size={12} color={palette.sub} />
                          <Text style={styles.transitionText}>
                            {getTransitionLabel(blocks[blockIndex - 1], block)}
                          </Text>
                        </View>
                        <View style={styles.transitionLine} />
                      </View>
                    ) : null}

                    <Animated.View
                      style={{
                        opacity: blockOpacity,
                        transform: [{ translateY: blockTranslateY }],
                      }}
                    >
                      <Card variant="surface" style={styles.vBlockCard}>
                        {/* Barre d'accent colorée à gauche */}
                        <View style={[styles.vBlockAccentBar, { backgroundColor: cfg.tint }]} />

                        <View style={styles.vBlockInner}>
                          {/* Header : icone + titre + badges */}
                          <View style={styles.vBlockHeader}>
                            <View style={[styles.vBlockIconWrap, { backgroundColor: cfg.tintSoft }]}>
                              <Ionicons name={cfg.icon as any} size={16} color={cfg.tint} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.vBlockTitle} numberOfLines={2}>{blockTitle}</Text>
                              <Text style={styles.vBlockMeta}>
                                {getBlockLabel(block)} \u00b7 {block.duration_min ?? '?'} min
                              </Text>
                            </View>
                            <View style={styles.vBlockBadges}>
                              {block.intensity ? (
                                <Badge label={block.intensity} tone={intensityTone(block.intensity)} />
                              ) : null}
                              {isComplete ? <Badge label="OK" tone="ok" /> : null}
                            </View>
                          </View>

                          {/* Notes du bloc */}
                          {cleanDisplayNote(block.notes) ? (
                            <Text style={styles.vBlockNotes}>{cleanDisplayNote(block.notes)}</Text>
                          ) : null}

                          {/* Exercices */}
                          {items.length > 0 ? (
                            <View style={styles.vBlockItems}>
                              {items.map((item, itemIndex) => {
                                const key = `${blockIndex}-${itemIndex}`;
                                const checkedItem = !!checked[key];
                                const itemName = getDisplayName(item);
                                const meta = formatItemMeta(item);
                                const exerciseId = getExerciseId(item);
                                const benefit = getExerciseBenefit(exerciseId);
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
                                          <Text style={styles.checkboxIcon}>{'\u2713'}</Text>
                                        ) : null}
                                      </Animated.View>
                                      <View style={{ flex: 1 }}>
                                        <Text
                                          style={[
                                            styles.itemName,
                                            checkedItem && styles.itemNameChecked,
                                          ]}
                                          numberOfLines={2}
                                        >
                                          {itemName}
                                        </Text>
                                        {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                                        {item.football_context ? (
                                          <Text style={styles.itemContext}>{item.football_context}</Text>
                                        ) : null}
                                        {benefit ? (
                                          <Text style={styles.itemBenefit}>{benefit}</Text>
                                        ) : null}
                                        {cleanDisplayNote(item.notes) ? (
                                          <Text style={styles.itemNote}>{cleanDisplayNote(item.notes)}</Text>
                                        ) : null}
                                      </View>
                                    </TouchableOpacity>
                                    {exerciseId ? (
                                      <TouchableOpacity
                                        onPress={() => goToExercise(exerciseId)}
                                        activeOpacity={0.85}
                                        style={styles.itemLink}
                                      >
                                        <Ionicons
                                          name="play-circle-outline"
                                          size={14}
                                          color={palette.accent}
                                        />
                                        <Text style={styles.itemLinkText}>Fiche</Text>
                                      </TouchableOpacity>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.blockEmpty}>Bloc sans items détaillés.</Text>
                          )}

                          {/* Coaching tip inline */}
                          <View style={styles.vBlockTipRow}>
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={13}
                              color={palette.sub}
                            />
                            <Text style={styles.vBlockTipText}>{tipText}</Text>
                          </View>
                        </View>
                      </Card>
                    </Animated.View>
                  </React.Fragment>
                );
              })}
            </>
          ) : (
            <Card variant="soft" style={styles.emptyBlockCard}>
              <Text style={styles.blockEmpty}>Aucun bloc détaillé pour cette séance.</Text>
            </Card>
          )}

          {/* ====== TIMERS ====== */}
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
            {timerPresets.length > 0 ? (
              <View style={styles.presetRow}>
                {timerPresets.map((preset, idx) => (
                  <Badge key={`preset_${idx}`} label={formatPresetLabel(preset)} />
                ))}
              </View>
            ) : null}
          </Card>

          {/* ====== COACHING ====== */}
          {v2.coaching_tips && v2.coaching_tips.length > 0 ? (
            <Card variant="soft" style={styles.coachCard}>
              <SectionHeader title="Coaching" />
              <View style={{ gap: 6 }}>
                {v2.coaching_tips.map((tip: string, i: number) => (
                  <Text key={`tip_${i}`} style={styles.bullet}>
                    {'\u2022'} {tip}
                  </Text>
                ))}
              </View>
            </Card>
          ) : null}

          {/* ====== SÉCURITÉ ====== */}
          {v2.safety_notes ? (
            <Card variant="soft" style={styles.coachCard}>
              <SectionHeader title="Sécurité" />
              <Text style={styles.body}>{v2.safety_notes}</Text>
            </Card>
          ) : null}

          {/* ====== POST SESSION ====== */}
          {(v2.post_session?.mobility && v2.post_session.mobility.length > 0) ||
           (v2.post_session?.recovery_tips && v2.post_session.recovery_tips.length > 0) ? (
            <Card variant="soft" style={styles.coachCard}>
              <SectionHeader title="Post-séance" />
              <View style={{ gap: 6 }}>
                {v2.post_session?.recovery_tips?.map((tip: string, i: number) => (
                  <View key={`rec_${i}`} style={styles.recoveryTipRow}>
                    <Ionicons name="leaf-outline" size={13} color="#14b8a6" />
                    <Text style={styles.recoveryTipText}>{tip}</Text>
                  </View>
                ))}
                {v2.post_session?.mobility?.map((m: string, i: number) => (
                  <Text key={`mob_${i}`} style={styles.bullet}>
                    {'\u2022'} {m}
                  </Text>
                ))}
                {v2.post_session?.cooldown_min ? (
                  <Text style={styles.bullet}>
                    {'\u2022'} Retour au calme {v2.post_session.cooldown_min} min
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* ====== BOUTON FEEDBACK ====== */}
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

// Export avec Error Boundary
export default withSessionErrorBoundary(SessionPreviewScreen);

// ====== STYLES ======
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
  title: { fontSize: 22, fontWeight: '800', color: palette.text },
  subtitle: { fontSize: 13, color: palette.sub, marginTop: 4 },
  sessionThemeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  sessionThemeText: { fontSize: 12, color: palette.accent, fontWeight: '600', fontStyle: 'italic' },
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

  // Flow strip
  flowSection: { gap: 8 },
  flowStrip: { paddingVertical: 4, alignItems: 'center' },
  flowCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  flowCapsuleText: { fontSize: 12, fontWeight: '700' },
  flowConnector: { paddingHorizontal: 2 },

  // Rationale card
  rationaleCard: { padding: 14, gap: 8 },
  rationaleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rationaleTitle: { fontSize: 13, fontWeight: '800', color: palette.text },
  rationaleBody: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  rationaleLabel: { fontSize: 12, fontWeight: '700', color: palette.text },
  rationaleReasons: { gap: 2 },
  contextBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Reset explain
  resetExplainCard: { padding: 14, gap: 8 },
  resetExplainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetExplainTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
  resetExplainSubtitle: { fontSize: 12, color: palette.sub, lineHeight: 16 },
  resetExplainLabel: { fontSize: 12, fontWeight: '700', color: palette.text },
  resetExplainGroup: { gap: 6 },
  resetBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  resetBullet: { color: palette.accent, fontSize: 12, marginTop: 1 },
  resetBulletText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 16 },

  // Vertical block cards
  vBlockCard: { padding: 0, flexDirection: 'row', overflow: 'hidden' },
  vBlockAccentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
  },
  vBlockInner: { flex: 1, padding: 14, gap: 10 },
  vBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vBlockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vBlockTitle: { fontSize: 15, fontWeight: '700', color: palette.text },
  vBlockMeta: { fontSize: 12, color: palette.sub, marginTop: 2 },
  vBlockBadges: { flexDirection: 'row', gap: 6 },
  vBlockNotes: { fontSize: 12, color: palette.sub, lineHeight: 18 },
  vBlockItems: { gap: 10 },
  vBlockTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  vBlockTipText: { flex: 1, fontSize: 12, color: palette.sub, lineHeight: 16 },

  // Transitions
  transitionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  transitionLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
  transitionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  transitionText: { fontSize: 11, color: palette.sub, fontWeight: '600' },

  // Exercise items
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
  itemNameChecked: { textDecorationLine: 'line-through', color: palette.sub },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemContext: { color: palette.text, fontSize: 11, marginTop: 2 },
  itemBenefit: { color: palette.accent, fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemLink: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  itemLinkText: { color: palette.accent, fontSize: 11, fontWeight: '700' },
  blockEmpty: { color: palette.sub, fontSize: 12 },
  emptyBlockCard: { padding: 10 },

  // Timer
  timerCard: { padding: 12, gap: 10 },
  timerRow: { flexDirection: 'row', gap: 10 },
  timerBlock: { flex: 1 },
  timerLabel: { color: palette.sub, fontSize: 12 },
  timerValue: { color: palette.text, fontSize: 22, fontWeight: '800' },
  timerActions: { flexDirection: 'row', gap: 8 },
  timerButton: { flex: 1 },
  restRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  presetRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
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

  // Sections
  sectionHeader: { marginTop: 12 },
  warmupCard: { padding: 10 },
  coachCard: { padding: 12, gap: 8 },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  bullet: { color: palette.text, marginBottom: 4, fontSize: 13, lineHeight: 18 },
  body: { color: palette.text, fontSize: 13, lineHeight: 18 },
  recoveryTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  recoveryTipText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 18 },
});

function buildReasons(dateISO: string, clubDays: string[], matchDays: string[]) {
  const reasons: string[] = [];
  const d = new Date(`${dateISO}T00:00:00`);
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = map[d.getDay()] ?? '';
  const tomorrow = map[new Date(d.getTime() + 86400000).getDay()] ?? '';

  if (!matchDays.includes(tomorrow) && !matchDays.includes(today)) {
    reasons.push('Pas de match aujourd\u2019hui ou demain');
  }
  if (clubDays.includes(tomorrow)) reasons.push('Veille de jour club : volume surveillé');
  if (!clubDays.includes(today) && !matchDays.includes(today)) {
    reasons.push('Jour libre de club/match \u2192 séance cible possible');
  }
  if (reasons.length === 0) reasons.push('Séance adaptée au calendrier déclaré');
  return reasons;
}
