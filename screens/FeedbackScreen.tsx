// screens/FeedbackScreen.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTrainingStore } from '../state/trainingStore';
import InjuryForm from '../components/InjuryForm';
import type { InjuryRecord } from '../domain/types';
import { FEEDBACK_LIMITS } from '../constants/feedback';
import type { SessionFeedback } from '../domain/types';
import { toRPE1to10, toRating1to5, toRating0to5 } from '../domain/types';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const localDayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const COLORS = {
  background: '#050509',
  surface: '#080C14',
  surfaceSoft: '#050815',
  border: '#111827',
  text: '#F9FAFB',
  textMuted: '#6B7280',
  accent: '#F97316',
  accentSoft: 'rgba(249,115,22,0.18)',
  danger: '#FB7185',
};

const FATIGUE_SCALE = [
  { value: 1, label: 'Très frais' },
  { value: 2, label: 'Plutôt bien' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Fatigué' },
  { value: 5, label: 'Très fatigué' },
];

const PAIN_SCALE = [
  { value: 0, label: 'Aucune gêne' },
  { value: 1, label: 'Très légère' },
  { value: 2, label: 'Présente' },
  { value: 3, label: 'Gênante' },
  { value: 4, label: 'Importante' },
  { value: 5, label: 'Limitante' },
];

const RECOVERY_SCALE = [
  { value: 1, label: 'Très mal' },
  { value: 2, label: 'Moyen' },
  { value: 3, label: 'Correct' },
  { value: 4, label: 'Bien' },
  { value: 5, label: 'Excellent' },
];

type SegmentedOption = {
  value: number;
  label: string;
};

function SegmentedRow({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[];
  value: number;
  onChange: (v: number) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <View>
      <View style={styles.segmentRow}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.segmentChip, selected && styles.segmentChipSelected]}
            >
              <Text
                style={[
                  styles.segmentValue,
                  selected && styles.segmentValueSelected,
                ]}
              >
                {opt.value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {current && <Text style={styles.segmentHint}>{current.label}</Text>}
    </View>
  );
}

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  React.useLayoutEffect(() => {
    navigation.setOptions?.({
      headerStyle: { backgroundColor: COLORS.background },
      headerTintColor: COLORS.text,
      headerTitleStyle: { color: COLORS.text },
    });
  }, [navigation]);

  const route = useRoute<RouteProp<AppStackParamList, 'Feedback'>>();
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsb = useTrainingStore((s) => s.tsb);

  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const dayStates = useTrainingStore((s) => s.dayStates);
  const setDailyFeedback = useTrainingStore((s) => s.setDailyFeedback);
  const setInjury = useTrainingStore((s) => s.setInjury);
  const getSessionById = useTrainingStore((s) => s.getSessionById);
  const addFeedback = useTrainingStore((s) => s.addFeedback);
  const sessions = useTrainingStore((s) => s.sessions);
  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
  const lastAiContext = useTrainingStore((s) => s.lastAiContext);

  const todayKey = useMemo(() => {
    if (devNowISO) return devNowISO.slice(0, 10);
    return localDayKey(new Date());
  }, [devNowISO]);

const getSessionDateKey = (s: any) => {
  const iso = typeof s?.dateISO === 'string' ? s.dateISO : typeof s?.date === 'string' ? s.date : '';
  const key = iso.length >= 10 ? iso.slice(0, 10) : '';
  const d = iso ? new Date(iso) : null;
  const ts = d && Number.isFinite(d.getTime()) ? d.getTime() : 0;
  return { key, ts };
};

  const day = dayStates[todayKey];
  const sessionIdFromRoute = route.params?.sessionId;

  const targetSessionId = useMemo(() => {
    if (sessionIdFromRoute) return sessionIdFromRoute;
    if (!Array.isArray(sessions) || sessions.length === 0) return undefined;

    const today = todayKey;
    const open = sessions.filter((s) => !s.completed);
    const openCurrent = open
      .filter((s) => (s.dateISO ?? '').slice(0, 10) <= today)
      .map((s) => ({ s, meta: getSessionDateKey(s) }))
      .filter(({ meta }) => meta.ts > 0 && meta.key <= today)
      .sort((a, b) => b.meta.ts - a.meta.ts)
      .map(({ s }) => s);
    if (openCurrent.length) return openCurrent[0].id;
    const sortedOpen = [...open]
      .filter((s) => getSessionDateKey(s).ts > 0)
      .sort((a, b) => getSessionDateKey(b).ts - getSessionDateKey(a).ts);
    if (sortedOpen.length) return sortedOpen[0].id;

    // fallback: dernière séance connue
    const sortedAll = [...sessions]
      .filter((s) => getSessionDateKey(s).ts > 0)
      .sort((a, b) => getSessionDateKey(b).ts - getSessionDateKey(a).ts);
    return sortedAll[0]?.id;
  }, [sessionIdFromRoute, sessions, todayKey]);

  const targetSession = useMemo(() => {
    if (!targetSessionId) return undefined;
    return getSessionById(targetSessionId);
  }, [targetSessionId, getSessionById, sessions]);

  // UI state
  const [rpe, setRpe] = useState<number>(5);
  const [fatigue, setFatigue] = useState<number>(day?.feedback?.fatigue ?? 3);
  const [pain, setPain] = useState<number>(day?.feedback?.pain ?? 0);
  const [recovery, setRecovery] = useState<number>(
    day?.feedback?.recoveryPerceived ?? 3
  );
  const [injury, setInjuryLocal] = useState<InjuryRecord | null>(
    day?.feedback?.injury ?? null
  );
  const [isSaving, setIsSaving] = useState(false);

  const [hasPainDetails, setHasPainDetails] = useState<boolean>(
    !!day?.feedback?.injury
  );
  const [cyclePromptVisible, setCyclePromptVisible] = useState(false);
  const autoContinueRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoContinue = () => {
    if (autoContinueRef.current) {
      clearTimeout(autoContinueRef.current);
      autoContinueRef.current = null;
    }
  };

  const continueAfterFeedback = () => {
    clearAutoContinue();
    setCyclePromptVisible(false);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home' as never);
  };

  useEffect(() => {
    return () => {
      clearAutoContinue();
    };
  }, []);

  useEffect(() => {
    const d = dayStates[todayKey];
    const fb = targetSession?.feedback;
    setFatigue((fb?.fatigue as number) ?? d?.feedback?.fatigue ?? 3);
    const painFromDay = d?.feedback?.pain;
    const painFromFb =
      typeof (fb as any)?.pain === 'number' ? (fb as any).pain : undefined;
    setPain(typeof painFromDay === 'number' ? painFromDay : painFromFb ?? 0);
    setRecovery((fb?.sleep as number) ?? d?.feedback?.recoveryPerceived ?? 3);
    setInjuryLocal((fb as any)?.injury ?? d?.feedback?.injury ?? null);
    setHasPainDetails(!!((fb as any)?.injury ?? d?.feedback?.injury));
    setRpe((typeof fb?.rpe === 'number' ? fb?.rpe : targetSession?.rpe) ?? 5);
  }, [todayKey, dayStates, targetSession]);

  // Score "readiness" 0–100
  const readiness = useMemo(() => {
    const fatigueScore = (5 - (fatigue - 1)) / 4; // 1 ->1, 5 ->0
    const painScore = (5 - pain) / 5; // 0 ->1, 5 ->0
    const recScore = (recovery - 1) / 4; // 1 ->0, 5 ->1
    const raw = (fatigueScore + painScore + recScore) / 3;
    return Math.round(clamp(raw, 0, 1) * 100);
  }, [fatigue, pain, recovery]);

  const readinessLabel = useMemo(() => {
    if (readiness >= 80) return 'Prêt à performer';
    if (readiness >= 60) return 'OK pour pousser';
    if (readiness >= 40) return 'Charge contrôlée';
    return 'Focus gestion / récup';
  }, [readiness]);

  const rpeLabel = useMemo(() => {
    if (rpe <= 3) return 'Très facile';
    if (rpe <= 6) return 'Contrôlé';
    if (rpe <= 8) return 'Intense';
    return 'Très dur';
  }, [rpe]);

  const sessionDateKey = useMemo(() => {
    if (!targetSession) return null;
    const { key } = getSessionDateKey(targetSession);
    return key || null;
  }, [targetSession]);

  const sessionIsToday = sessionDateKey ? sessionDateKey === todayKey : false;

  const onSave = async () => {
    if (isSaving) return;
    if (!targetSessionId || !targetSession) {
      Alert.alert(
        'Séance introuvable',
        "La séance n'est pas chargée ou aucun ID n'a été trouvé. Reviens depuis la séance ou attends une seconde puis réessaie."
      );
      return;
    }
    if (targetSession.completed) {
      Alert.alert('Déjà complétée', 'Le feedback de cette séance est déjà enregistré.');
      return;
    }
    if (!sessionIsToday) {
      Alert.alert(
        'Date non compatible',
        "Tu essaies de valider une séance qui n'est pas datée d'aujourd'hui. Reviens le jour même ou ajuste la date de la séance."
      );
      return;
    }

    setIsSaving(true);
    try {
      const atlBefore = atl;
      const ctlBefore = ctl;
      const tsbBefore = tsb;
      const dayKeyForSession = sessionDateKey ?? todayKey;
      const activeGoal = (() => {
        if (typeof microcycleGoal === 'string' && microcycleGoal.trim()) return microcycleGoal;
        const ctxGoal =
          lastAiContext?.profile?.microcycle_goal ??
          lastAiContext?.profile?.goal ??
          lastAiContext?.goal;
        return typeof ctxGoal === 'string' ? ctxGoal : null;
      })();
      const rawPlaylistLen =
        lastAiContext?.profile?.explosivite_playlist_len ??
        lastAiContext?.explosivite_playlist_len ??
        lastAiContext?.profile?.explosivitePlaylistLen ??
        lastAiContext?.explosivitePlaylistLen;
      const playlistLen = (() => {
        const parsed =
          typeof rawPlaylistLen === 'number'
            ? rawPlaylistLen
            : typeof rawPlaylistLen === 'string'
              ? Number(rawPlaylistLen)
              : NaN;
        const normalized = Number.isFinite(parsed) ? Math.trunc(parsed) : 12;
        return normalized === 8 || normalized === 12 ? normalized : 12;
      })();
      const microIdx =
        typeof microcycleSessionIndex === 'number' && Number.isFinite(microcycleSessionIndex)
          ? Math.max(0, Math.trunc(microcycleSessionIndex))
          : 0;
      const shouldPromptCycleEnd =
        activeGoal === 'explosivite' &&
        playlistLen > 0 &&
        microIdx % playlistLen === playlistLen - 1;

      const dailyPayload: any = {
        fatigue: clamp(
          fatigue,
          FEEDBACK_LIMITS.fatigueMin,
          FEEDBACK_LIMITS.fatigueMax
        ),
      };
      const pain0to5 = clamp(
        pain,
        FEEDBACK_LIMITS.painMin ?? 0,
        FEEDBACK_LIMITS.painMax ?? 5
      );
      dailyPayload.pain = pain0to5;

      if (typeof recovery === 'number') {
        const recClamped = clamp(
          recovery,
          FEEDBACK_LIMITS.recoveryMin,
          FEEDBACK_LIMITS.recoveryMax
        );
        dailyPayload.recoveryPerceived = recClamped;
      }

      const fb: SessionFeedback = {
        rpe: toRPE1to10(rpe),
        fatigue: toRating1to5(fatigue),
        sleep: toRating1to5(recovery),
        pain: toRating0to5(pain0to5),
        createdAt: new Date().toISOString(),
      };
      const res = await Promise.resolve(addFeedback(targetSessionId, fb));
      if (!res) {
        Alert.alert(
          'Feedback non appliqué',
          "La séance est introuvable ou déjà complétée. Vérifie l'état de la séance et réessaie."
        );
        return;
      }
      setDailyFeedback(dayKeyForSession, dailyPayload);
      setInjury(dayKeyForSession, hasPainDetails ? injury : null);
      const after = useTrainingStore.getState();
      const atlDelta = +(after.atl - atlBefore).toFixed(1);
      const ctlDelta = +(after.ctl - ctlBefore).toFixed(1);
      const tsbDelta = +(after.tsb - tsbBefore).toFixed(1);
      const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
      Alert.alert(
        'Feedback enregistré',
        `ATL ${after.atl.toFixed(1)} (${fmt(atlDelta)}) · CTL ${after.ctl.toFixed(1)} (${fmt(ctlDelta)}) · TSB ${after.tsb.toFixed(1)} (${fmt(tsbDelta)})`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (shouldPromptCycleEnd) {
                setCyclePromptVisible(true);
                clearAutoContinue();
                autoContinueRef.current = setTimeout(() => {
                  continueAfterFeedback();
                }, 4500);
                return;
              }
              continueAfterFeedback();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (e) {
      console.warn('Feedback save failed', e);
      Alert.alert(
        'Erreur',
        "Impossible d'enregistrer ton feedback. Réessaie dans un instant."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['right', 'left', 'bottom']}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO — Readiness */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroHeaderRow}>
              <Text style={styles.heroTitle}>État du joueur</Text>
              <Text style={styles.heroDate}>{todayKey}</Text>
            </View>
            <View style={styles.heroBodyRow}>
              <View style={styles.heroScoreCircle}>
                <Text style={styles.heroScore}>{readiness}</Text>
                <Text style={styles.heroScoreSuffix}>/100</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTag}>Readiness</Text>
                <Text style={styles.heroLabel}>{readinessLabel}</Text>
                <Text style={styles.heroSub}>
                  FKS ajuste la prochaine séance en fonction de ton état réel.
                </Text>
              </View>
            </View>
          </View>

          {/* Bloc RPE */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, styles.metricCardFull]}>
              <View style={styles.metricHeaderRow}>
                <Text style={styles.metricTitle}>RPE séance</Text>
                <Text style={styles.metricBadge}>{rpeLabel}</Text>
              </View>
              <View style={styles.rpeScaleRow}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const v = i + 1;
                  const selected = v === rpe;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setRpe(v)}
                      style={[styles.rpeDot, selected && styles.rpeDotSelected]}
                    >
                      <Text
                        style={[
                          styles.rpeDotText,
                          selected && styles.rpeDotTextSelected,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Fatigue + Récup */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Fatigue</Text>
              <SegmentedRow
                options={FATIGUE_SCALE}
                value={fatigue}
                onChange={setFatigue}
              />
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Récupération</Text>
              <SegmentedRow
                options={RECOVERY_SCALE}
                value={recovery}
                onChange={setRecovery}
              />
            </View>
          </View>

          {/* Douleurs + blessure */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Douleurs</Text>
              <SegmentedRow
                options={PAIN_SCALE}
                value={pain}
                onChange={setPain}
              />
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Blessure</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleChip,
                    !hasPainDetails && styles.toggleChipSelected,
                  ]}
                  onPress={() => {
                    setHasPainDetails(false);
                    setInjuryLocal(null);
                  }}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !hasPainDetails && styles.toggleTextSelected,
                    ]}
                  >
                    Aucune
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleChip,
                    hasPainDetails && styles.toggleChipSelected,
                  ]}
                  onPress={() => setHasPainDetails(true)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      hasPainDetails && styles.toggleTextSelected,
                    ]}
                  >
                    À préciser
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {hasPainDetails && (
            <View style={styles.injuryCard}>
              <InjuryForm value={injury} onChange={setInjuryLocal} />
            </View>
          )}

          {/* Debug (dev only) */}
          {day?.adaptive && (
            <View style={styles.debug}>
              <Text style={styles.debugTitle}>DEBUG — Facteurs adaptatifs</Text>
              <Text style={styles.debugText}>
                fatigueSmoothed: {day.adaptive.fatigueSmoothed}
              </Text>
              <Text style={styles.debugText}>
                fatigueFactor: {day.adaptive.fatigueFactor}
              </Text>
              <Text style={styles.debugText}>
                painFactor: {day.adaptive.painFactor}
              </Text>
              <Text style={styles.debugText}>
                combined: {day.adaptive.combined}
              </Text>
            </View>
          )}
        </ScrollView>

        {cyclePromptVisible && (
          <View style={styles.cyclePrompt}>
            <Text style={styles.cyclePromptText}>
              Fin du cycle explosivité : veux-tu continuer ce cycle, ou changer de programme ?
            </Text>
            <View style={styles.cycleActions}>
              <TouchableOpacity
                onPress={continueAfterFeedback}
                style={[styles.cycleButton, styles.cycleButtonPrimary]}
              >
                <Text style={styles.cycleButtonPrimaryText}>Continuer explosivité</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  clearAutoContinue();
                  setCyclePromptVisible(false);
                  navigation.navigate('PrebuiltSessions' as never);
                }}
                style={[styles.cycleButton, styles.cycleButtonGhost]}
              >
                <Text style={styles.cycleButtonGhostText}>Changer de playlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (isSaving || !targetSession || targetSession?.completed || !sessionIsToday) && { opacity: 0.6 },
            ]}
            onPress={onSave}
            disabled={isSaving || !targetSession || targetSession?.completed || !sessionIsToday}
          >
            <Text style={styles.saveText}>
              {isSaving
                ? 'Enregistrement…'
                : targetSession?.completed
                  ? 'Déjà complétée'
                  : !sessionIsToday
                    ? "Séance pas datée d'aujourd'hui"
                    : 'Valider mon état'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 16,
  },

  // HERO
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    opacity: 0.9,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  heroDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  // 👉 Cercle beaucoup plus gros ici
  heroScoreCircle: {
    width: 110,
    height: 110,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  heroScore: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroScoreSuffix: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  heroInfo: {
    flex: 1,
  },
  heroTag: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.accent,
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Metrics layout
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },
  metricCardFull: {
    flex: 1,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  metricBadge: {
    fontSize: 11,
    color: COLORS.accent,
  },

  // RPE
  rpeScaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  rpeDot: {
    minWidth: 30,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  rpeDotSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rpeDotText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  rpeDotTextSelected: {
    color: '#0B0F19',
    fontWeight: '700',
  },

  // Segments 1–5 / 0–5
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  segmentChip: {
    flexGrow: 1,
    minWidth: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    alignItems: 'center',
  },
  segmentChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  segmentValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  segmentValueSelected: {
    color: COLORS.accent,
  },
  segmentHint: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Toggle blessure
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  toggleText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  toggleTextSelected: {
    color: COLORS.accent,
  },
  injuryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },

  // Fin de cycle
  cyclePrompt: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cyclePromptText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  cycleActions: { marginTop: 10, gap: 8 },
  cycleButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cycleButtonPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accentSoft,
  },
  cycleButtonPrimaryText: { color: COLORS.background, fontWeight: '700', fontSize: 13 },
  cycleButtonGhost: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  cycleButtonGhostText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  saveText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 15,
  },

  // Debug
  debug: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    backgroundColor: COLORS.surfaceSoft,
  },
  debugTitle: {
    fontWeight: '700',
    marginBottom: 4,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  debugText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
