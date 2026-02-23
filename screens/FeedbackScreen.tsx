// screens/FeedbackScreen.tsx
// Formulaire post-séance modernisé - slider RPE, design pro
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useTrainingStore } from '../state/trainingStore';
import { useSettingsStore } from '../state/settingsStore';
import InjuryForm from '../components/InjuryForm';
import type { InjuryRecord, Modality, SessionFeedback } from '../domain/types';
import { FEEDBACK_LIMITS } from '../constants/feedback';
import { theme } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { DEFAULT_MODALITY_WEIGHTS, toRPE1to10, toRating1to5, toRating0to5 } from '../domain/types';
import { updateTrainingLoad } from '../engine/loadModel';
import { DEV_FLAGS } from '../config/devFlags';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { showErrorWithRetry, classifyError, ErrorType } from '../utils/errorHandler';
import { showToast } from '../utils/toast';
import { enqueueAction } from '../utils/offlineQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { trackEvent } from '../services/analytics';
import { ModalContainer } from '../components/modal/ModalContainer';
import { useHaptics } from '../hooks/useHaptics';
import { toDateKey } from '../utils/dateHelpers';
import { MICROCYCLES, getPathwayById } from '../domain/microcycles';
import { auth, db } from '../services/firebase';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const COLORS = theme.colors;

// RPE color gradient (vert -> jaune -> orange -> rouge)
const getRpeColor = (value: number): string => {
  if (value <= 3) return '#16a34a'; // vert
  if (value <= 5) return '#84cc16'; // vert-jaune
  if (value <= 7) return '#f59e0b'; // jaune-orange
  if (value <= 8) return '#f97316'; // orange
  return '#ef4444'; // rouge
};

const RPE_LABELS: Record<number, string> = {
  1: 'Repos',
  2: 'Très léger',
  3: 'Léger',
  4: 'Modéré',
  5: 'Contrôlé',
  6: 'Soutenu',
  7: 'Difficile',
  8: 'Très dur',
  9: 'Extrême',
  10: 'Maximum',
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
  const haptics = useHaptics();
  const { isOnline, queueCount } = useNetworkStatus();

  // Stagger animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Stagger les cards après l'entrée principale
      Animated.stagger(
        60,
        cardAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        )
      ).start();
    });
  }, [fadeAnim, slideAnim, cardAnims]);

  const route = useRoute<RouteProp<AppStackParamList, 'Feedback'>>();
  const themeMode = useSettingsStore((s) => s.themeMode);
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
  const activePathwayId = useTrainingStore((s) => s.activePathwayId);
  const activePathwayIndex = useTrainingStore((s) => s.activePathwayIndex);
  const setActivePathway = useTrainingStore((s) => s.setActivePathway);
  const setMicrocycleGoal = useTrainingStore((s) => s.setMicrocycleGoal);

  const todayKey = useMemo(() => {
    const base = devNowISO ? new Date(devNowISO) : new Date();
    return toDateKey(base);
  }, [devNowISO]);

  const getSessionDateKey = (s: any) => {
    const iso =
      typeof s?.dateISO === 'string'
        ? s.dateISO
        : typeof s?.date === 'string'
          ? s.date
          : '';
    const key = iso ? toDateKey(iso) : '';
    const d = key ? new Date(`${key}T12:00:00`) : null;
    const ts = d && Number.isFinite(d.getTime()) ? d.getTime() : 0;
    return { key, ts };
  };

  const day = dayStates[todayKey];
  const sessionIdFromRoute = route.params?.sessionId;
  const prefill = route.params?.prefill;

  const targetSessionId = useMemo(() => {
    if (sessionIdFromRoute) return sessionIdFromRoute;
    if (!Array.isArray(sessions) || sessions.length === 0) return undefined;

    const today = todayKey;
    const open = sessions.filter((s) => !s.completed);
    const openCurrent = open
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
  const prefillRpe =
    typeof prefill?.rpe === 'number' && Number.isFinite(prefill.rpe)
      ? clamp(Math.round(prefill.rpe), 1, 10)
      : undefined;
  const durationPrefill = useMemo(() => {
    if (typeof prefill?.durationMin === 'number' && Number.isFinite(prefill.durationMin)) {
      return Math.max(1, Math.round(prefill.durationMin));
    }
    if (typeof targetSession?.durationMin === 'number' && Number.isFinite(targetSession.durationMin)) {
      return Math.max(1, Math.round(targetSession.durationMin));
    }
    const aiDuration = (targetSession as any)?.aiV2?.duration_min;
    if (typeof aiDuration === 'number' && Number.isFinite(aiDuration)) {
      return Math.max(1, Math.round(aiDuration));
    }
    return undefined;
  }, [prefill?.durationMin, targetSession]);

  const [rpe, setRpe] = useState<number>(prefillRpe ?? 5);
  const [durationMin, setDurationMin] = useState<string>(
    durationPrefill ? String(durationPrefill) : ''
  );
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
  const durationValue = Number(durationMin);
  const durationValid =
    Number.isFinite(durationValue) && durationValue >= 5 && durationValue <= 300;
  const durationClamped = durationValid ? Math.round(durationValue) : undefined;
  const modality = (targetSession?.modality ??
    targetSession?.exercises?.[0]?.modality) as Modality | undefined;
  const modalityWeight = modality ? DEFAULT_MODALITY_WEIGHTS[modality] ?? 1 : 1;
  const estimatedLoad =
    durationClamped != null ? Math.round(rpe * durationClamped * modalityWeight) : null;
  const projected = estimatedLoad != null ? updateTrainingLoad(atl, ctl, estimatedLoad) : null;
  const projectedTsb = projected ? +projected.tsb.toFixed(1) : null;
  const projectedDelta = projectedTsb != null ? +(projectedTsb - tsb).toFixed(1) : null;

  const clearAutoContinue = () => {
    if (autoContinueRef.current) {
      clearTimeout(autoContinueRef.current);
      autoContinueRef.current = null;
    }
  };

  useEffect(() => {
    if (!durationMin && durationPrefill) {
      setDurationMin(String(durationPrefill));
    }
  }, [durationPrefill, durationMin]);

  const continueAfterFeedback = () => {
    clearAutoContinue();
    setCyclePromptVisible(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
      })
    );
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
    if (readiness >= 40) return 'Effort modéré';
    return 'Focus gestion / récup';
  }, [readiness]);

  const rpeLabel = useMemo(() => {
    if (rpe <= 3) return 'Très facile';
    if (rpe <= 6) return 'Contrôlé';
    if (rpe <= 8) return 'Intense';
    return 'Très dur';
  }, [rpe]);

  const suggestion = useMemo(() => {
    const intensityRaw =
      (targetSession as any)?.aiV2?.intensity ??
      (targetSession as any)?.intensity ??
      '';
    const intensity = String(intensityRaw).toLowerCase();
    const suggestedRpe =
      prefillRpe ??
      (typeof (targetSession as any)?.aiV2?.rpe_target === 'number'
        ? Math.max(1, Math.min(10, Math.round((targetSession as any).aiV2.rpe_target)))
        : intensity.includes('hard')
        ? 8
        : intensity.includes('easy')
        ? 4
        : 6);
    const suggestedFatigue = intensity.includes('hard') ? 4 : intensity.includes('easy') ? 2 : 3;
    const suggestedRecovery = intensity.includes('hard') ? 3 : intensity.includes('easy') ? 4 : 3;
    const suggestedPain = 0;
    return {
      rpe: suggestedRpe,
      fatigue: suggestedFatigue,
      recovery: suggestedRecovery,
      pain: suggestedPain,
      intensityLabel: intensity,
    };
  }, [prefillRpe, targetSession]);

  const sessionDateKey = useMemo(() => {
    if (!targetSession) return null;
    const { key } = getSessionDateKey(targetSession);
    return key || null;
  }, [targetSession]);

  const sessionIsToday = sessionDateKey ? sessionDateKey === todayKey : false;
  const allowAnyDate = DEV_FLAGS.ENABLED;
  const canSaveToday = allowAnyDate || sessionIsToday;

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
      Alert.alert('Déjà complétée', 'Tu as déjà donné ton retour pour cette séance.');
      return;
    }
    if (!canSaveToday) {
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
      const activeGoal = typeof microcycleGoal === "string" && microcycleGoal.trim() ? microcycleGoal.trim() : null;
      const rawPlaylistLen = lastAiContext?.profile?.explosivite_playlist_len;
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
        Boolean(activeGoal) && playlistLen > 0 && microIdx % playlistLen === playlistLen - 1;

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
      if (durationClamped != null) {
        fb.durationMin = durationClamped;
      }
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
      trackEvent('feedback_submitted', {
        cycleId: activeGoal ?? 'none',
        rpe: fb.rpe,
        fatigue: fb.fatigue,
        pain: fb.pain,
        durationMin: durationClamped ?? null,
      });
      showToast({
        type: 'success',
        title: 'Feedback enregistré',
        message: `ATL ${after.atl.toFixed(1)} (${fmt(atlDelta)}) · CTL ${after.ctl.toFixed(1)} (${fmt(ctlDelta)}) · TSB ${after.tsb.toFixed(1)} (${fmt(tsbDelta)})`,
      });
      haptics.success();
      if (shouldPromptCycleEnd) {
        const pathway = activePathwayId ? getPathwayById(activePathwayId) : null;
        const nextIndex = (activePathwayIndex ?? 0) + 1;
        const hasNextInPathway = pathway && nextIndex < pathway.sequence.length;

        if (hasNextInPathway) {
          // Auto-advance: start the next cycle in the pathway
          const nextCycleId = pathway.sequence[nextIndex];
          const nextCycle = MICROCYCLES[nextCycleId];
          try {
            const uid = auth.currentUser?.uid ?? null;
            if (uid) {
              await setDoc(doc(db, "users", uid), {
                microcycleGoal: nextCycleId,
                goal: nextCycleId,
                programGoal: nextCycleId,
                microcycleStatus: "active",
                microcycleTotalSessions: 12,
                microcycleSessionIndex: 0,
                microcycleStartedAt: serverTimestamp(),
                activePathwayId: activePathwayId,
                activePathwayIndex: nextIndex,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            }
            setMicrocycleGoal(nextCycleId);
            setActivePathway(activePathwayId, nextIndex);
            showToast({
              type: 'success',
              title: 'Programme suivant',
              message: `${nextCycle.label} démarre automatiquement (${nextIndex + 1}/${pathway.sequence.length}).`,
            });
            haptics.success();
            continueAfterFeedback();
          } catch {
            // Fallback: show manual prompt if auto-advance fails
            setCyclePromptVisible(true);
            clearAutoContinue();
            autoContinueRef.current = setTimeout(() => {
              continueAfterFeedback();
            }, 4500);
          }
        } else if (pathway) {
          // Last cycle of the pathway completed
          setActivePathway(null);
          const uid = auth.currentUser?.uid ?? null;
          if (uid) {
            setDoc(doc(db, "users", uid), {
              activePathwayId: null,
              activePathwayIndex: 0,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          }
          showToast({
            type: 'success',
            title: 'Parcours terminé !',
            message: `Tu as terminé le parcours "${pathway.label}". Choisis un nouveau parcours ou programme.`,
          });
          setCyclePromptVisible(true);
          clearAutoContinue();
          autoContinueRef.current = setTimeout(() => {
            continueAfterFeedback();
          }, 4500);
        } else {
          // No pathway: existing behavior (prompt to choose a cycle)
          setCyclePromptVisible(true);
          clearAutoContinue();
          autoContinueRef.current = setTimeout(() => {
            continueAfterFeedback();
          }, 4500);
        }
      } else {
        continueAfterFeedback();
      }
    } catch (e) {
      const appError = classifyError(e);
      haptics.warning();

      // Si c'est une erreur réseau, on enregistre dans la queue hors-ligne
      if (appError.type === ErrorType.NETWORK) {
        // Construire le feedback à nouveau pour l'enregistrer dans la queue
        const pain0to5 = clamp(
          pain,
          FEEDBACK_LIMITS.painMin ?? 0,
          FEEDBACK_LIMITS.painMax ?? 5
        );
        const fb: SessionFeedback = {
          rpe: toRPE1to10(rpe),
          fatigue: toRating1to5(fatigue),
          sleep: toRating1to5(recovery),
          pain: toRating0to5(pain0to5),
          createdAt: new Date().toISOString(),
        };
        if (durationClamped != null) {
          fb.durationMin = durationClamped;
        }

        // Ajouter à la queue
        await enqueueAction('feedback', {
          sessionId: targetSessionId,
          feedback: fb,
        });

        showToast({ type: 'info', title: 'Enregistré hors-ligne', message: 'Ton feedback sera synchronisé dès que tu seras reconnecté.' });
        navigation.goBack();
      } else {
        // Autre type d'erreur, utiliser le système normal
        showErrorWithRetry(e, 'Enregistrement du feedback', onSave);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveDisabled =
    isSaving || !targetSession || targetSession?.completed || !canSaveToday;
  const saveLabel = isSaving
    ? 'Enregistrement…'
    : targetSession?.completed
      ? 'Déjà complétée'
      : !canSaveToday
        ? "Séance pas datée d'aujourd'hui"
        : 'Valider mon état';

  return (
    <View style={styles.modalRoot}>
      <ModalContainer
        visible
        onClose={() => navigation.goBack()}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss
        allowSwipeDismiss
      >
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'right', 'left', 'bottom']}
        >
          <StatusBar
            barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor={COLORS.background}
          />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Feedback</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.container, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
            >
          {!isOnline || queueCount > 0 ? (
            <View style={styles.syncBanner}>
              <Ionicons
                name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
                size={14}
                color={isOnline ? COLORS.accent : COLORS.warn}
              />
              <Text style={styles.syncBannerText}>
                {isOnline
                  ? `${queueCount} action(s) en attente de synchro`
                  : 'Hors-ligne : ton feedback sera synchronisé automatiquement'}
              </Text>
            </View>
          ) : null}
          {/* HERO — Readiness */}
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTitleRow}>
                <LinearGradient
                  colors={['#ff7a1a', '#ff9a4a']}
                  style={styles.heroIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="heart-outline" size={18} color="#fff" />
                </LinearGradient>
                <Text style={styles.heroTitle}>État du joueur</Text>
              </View>
              <View style={styles.heroDateBadge}>
                <Text style={styles.heroDate}>{todayKey}</Text>
              </View>
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
          </Animated.View>

          {/* Suggestions rapides */}
          <Animated.View
            style={[
              styles.suggestCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.suggestHeader}>
              <View style={styles.suggestTitleRow}>
                <Ionicons name="sparkles-outline" size={16} color={COLORS.accent} />
                <Text style={styles.suggestTitle}>Suggestions rapides</Text>
              </View>
              <Text style={styles.suggestSubtitle}>
                Basées sur l'intensité {suggestion.intensityLabel || 'du jour'}
              </Text>
            </View>
            <View style={styles.suggestRow}>
              <TouchableOpacity
                style={styles.suggestChip}
                onPress={() => {
                  setRpe(suggestion.rpe);
                  haptics.impactLight();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestChipText}>RPE {suggestion.rpe}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestChip}
                onPress={() => {
                  setFatigue(suggestion.fatigue);
                  haptics.impactLight();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestChipText}>Fatigue {suggestion.fatigue}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestChip}
                onPress={() => {
                  setRecovery(suggestion.recovery);
                  haptics.impactLight();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestChipText}>Récup {suggestion.recovery}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestChip}
                onPress={() => {
                  setPain(suggestion.pain);
                  haptics.impactLight();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestChipText}>Douleur {suggestion.pain}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.suggestApply}
              onPress={() => {
                setRpe(suggestion.rpe);
                setFatigue(suggestion.fatigue);
                setRecovery(suggestion.recovery);
                setPain(suggestion.pain);
                haptics.success();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />
              <Text style={styles.suggestApplyText}>Appliquer tout</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bloc RPE - Design moderne avec slider visuel */}
          <Animated.View
            style={[
              styles.metricsRow,
              {
                opacity: cardAnims[0],
                transform: [
                  {
                    translateY: cardAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.metricCard, styles.metricCardFull, styles.rpeCard]}>
              <View style={styles.rpeHeader}>
                <View style={styles.rpeHeaderLeft}>
                  <LinearGradient
                    colors={[getRpeColor(rpe), getRpeColor(Math.min(10, rpe + 1))]}
                    style={styles.rpeIconCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="pulse-outline" size={18} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.metricTitle}>RPE séance</Text>
                    <Text style={styles.rpeSubtitle}>Effort perçu</Text>
                  </View>
                </View>
                <View style={[styles.rpeBadge, { backgroundColor: getRpeColor(rpe) + '20', borderColor: getRpeColor(rpe) }]}>
                  <Text style={[styles.rpeBadgeText, { color: getRpeColor(rpe) }]}>
                    {RPE_LABELS[rpe] || 'RPE ' + rpe}
                  </Text>
                </View>
              </View>

              {/* Valeur principale */}
              <View style={styles.rpeValueRow}>
                <Text style={[styles.rpeValue, { color: getRpeColor(rpe) }]}>{rpe}</Text>
                <Text style={styles.rpeValueSuffix}>/10</Text>
              </View>

              {/* Barre de progression visuelle */}
              <View style={styles.rpeBarTrack}>
                <LinearGradient
                  colors={['#16a34a', '#84cc16', '#f59e0b', '#f97316', '#ef4444']}
                  style={[styles.rpeBarFill, { width: `${rpe * 10}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>

              {/* Sélecteur de valeurs */}
              <View style={styles.rpeSelector}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const v = i + 1;
                  const selected = v === rpe;
                  const color = getRpeColor(v);
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => {
                        setRpe(v);
                        haptics.impactLight();
                      }}
                      style={[
                        styles.rpeDot,
                        selected && { backgroundColor: color, borderColor: color },
                      ]}
                      activeOpacity={0.8}
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
          </Animated.View>

          {/* Durée + charge */}
          <Animated.View
            style={[
              styles.metricsRow,
              {
                opacity: cardAnims[1],
                transform: [
                  {
                    translateY: cardAnims[1].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.accent} />
                <Text style={styles.metricTitle}>Durée réelle</Text>
              </View>
              <TextInput
                value={durationMin}
                onChangeText={setDurationMin}
                placeholder="ex: 60"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                style={[
                  styles.durationInput,
                  !durationValid && durationMin ? styles.durationInputError : null
                ]}
                accessibilityLabel="Durée de la séance"
                accessibilityHint="Entre la durée réelle en minutes, entre 5 et 300"
              />
              <Text style={styles.metricHint}>minutes</Text>
              {!durationValid && durationMin ? (
                <Text style={styles.metricError}>Entre 5 et 300 min</Text>
              ) : null}
            </View>
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="fitness-outline" size={16} color={COLORS.accent} />
                <Text style={styles.metricTitle}>Charge estimée</Text>
              </View>
              <Text style={styles.metricValue}>
                {estimatedLoad != null ? `${estimatedLoad} UA` : '—'}
              </Text>
              <Text style={styles.metricHint}>
                TSB {tsb.toFixed(1)} → {projectedTsb ?? '—'}
                {projectedDelta != null ? ` (${projectedDelta >= 0 ? '+' : ''}${projectedDelta})` : ''}
              </Text>
            </View>
          </Animated.View>

          {/* Fatigue + Récup */}
          <Animated.View
            style={[
              styles.metricsRow,
              {
                opacity: cardAnims[2],
                transform: [
                  {
                    translateY: cardAnims[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="battery-half-outline" size={16} color="#f59e0b" />
                <Text style={styles.metricTitle}>Fatigue</Text>
              </View>
              <SegmentedRow
                options={FATIGUE_SCALE}
                value={fatigue}
                onChange={(v) => {
                  setFatigue(v);
                  haptics.impactLight();
                }}
              />
            </View>
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="bed-outline" size={16} color="#06b6d4" />
                <Text style={styles.metricTitle}>Récupération</Text>
              </View>
              <SegmentedRow
                options={RECOVERY_SCALE}
                value={recovery}
                onChange={(v) => {
                  setRecovery(v);
                  haptics.impactLight();
                }}
              />
            </View>
          </Animated.View>

          {/* Douleurs + blessure */}
          <Animated.View
            style={[
              styles.metricsRow,
              {
                opacity: cardAnims[3],
                transform: [
                  {
                    translateY: cardAnims[3].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="bandage-outline" size={16} color="#ef4444" />
                <Text style={styles.metricTitle}>Douleurs</Text>
              </View>
              <SegmentedRow
                options={PAIN_SCALE}
                value={pain}
                onChange={(v) => {
                  setPain(v);
                  haptics.impactLight();
                }}
              />
            </View>
            <View style={styles.metricCard}>
              <View style={styles.metricIconRow}>
                <Ionicons name="medical-outline" size={16} color="#8b5cf6" />
                <Text style={styles.metricTitle}>Blessure</Text>
              </View>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleChip,
                    !hasPainDetails && styles.toggleChipSelected,
                  ]}
                  onPress={() => {
                    setHasPainDetails(false);
                    setInjuryLocal(null);
                    haptics.impactLight();
                  }}
                  activeOpacity={0.8}
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
                  onPress={() => {
                    setHasPainDetails(true);
                    haptics.impactLight();
                  }}
                  activeOpacity={0.8}
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
          </Animated.View>

          {hasPainDetails && (
            <Animated.View
              style={[
                styles.injuryCard,
                {
                  opacity: cardAnims[4],
                  transform: [
                    {
                      translateY: cardAnims[4].interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.injuryHeader}>
                <Ionicons name="body-outline" size={16} color="#8b5cf6" />
                <Text style={styles.injuryTitle}>Détails de la blessure</Text>
              </View>
              <InjuryForm value={injury} onChange={setInjuryLocal} />
            </Animated.View>
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
            </TouchableWithoutFeedback>

            {cyclePromptVisible && (
              <View style={styles.cyclePrompt}>
            <Text style={styles.cyclePromptText}>
              Programme terminé ! Choisis ton prochain programme ou ferme ce message.
            </Text>
            <View style={styles.cycleActions}>
              <Button
                label="Choisir un nouveau programme"
                onPress={() => {
                  clearAutoContinue();
                  setCyclePromptVisible(false);
                  navigation.navigate("CycleModal", { mode: "select", origin: "feedback" });
                }}
                variant="primary"
                size="md"
                fullWidth
              />
              <Button
                label="Plus tard"
                onPress={continueAfterFeedback}
                variant="ghost"
                size="md"
                fullWidth
              />
            </View>
          </View>
            )}

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              <Button
                label={saveLabel}
                onPress={onSave}
                variant="primary"
                size="lg"
                fullWidth
                disabled={saveDisabled}
                style={styles.saveBtn}
                textStyle={styles.saveText}
              />
            </View>
          </KeyboardAvoidingView>

          <LoadingOverlay
            visible={isSaving}
            message="Enregistrement de ton feedback..."
            submessage="Mise à jour de ta charge d'entraînement (ATL/CTL/TSB) en cours."
          />
        </SafeAreaView>
      </ModalContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalClose: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  syncBannerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
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
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  heroDateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroDate: {
    fontSize: 11,
    fontWeight: '600',
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

  // Suggestions
  suggestCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    backgroundColor: COLORS.surface,
    gap: 10,
  },
  suggestHeader: {
    gap: 4,
  },
  suggestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  suggestChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  suggestApply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    alignSelf: 'flex-start',
  },
  suggestApplyText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
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
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  // RPE Card moderne
  rpeCard: {
    padding: 16,
  },
  rpeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rpeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rpeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  rpeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rpeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rpeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  rpeValue: {
    fontSize: 42,
    fontWeight: '800',
  },
  rpeValueSuffix: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  rpeBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  rpeBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  rpeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  durationInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    fontSize: 14,
  },
  durationInputError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  metricValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  metricHint: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metricError: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.danger,
  },

  // RPE
  rpeScaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  rpeDot: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  rpeDotText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  rpeDotTextSelected: {
    color: '#fff',
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
    padding: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  injuryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  injuryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
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
    color: COLORS.background,
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
