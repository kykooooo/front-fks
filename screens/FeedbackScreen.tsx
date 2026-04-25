// screens/FeedbackScreen.tsx
// Formulaire post-séance — orchestrateur léger
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

import { useLoadStore } from '../state/stores/useLoadStore';
import { useSessionsStore } from '../state/stores/useSessionsStore';
import { useFeedbackStore } from '../state/stores/useFeedbackStore';
import { useDebugStore } from '../state/stores/useDebugStore';
import { useSettingsStore } from '../state/settingsStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useHaptics } from '../hooks/useHaptics';
import { toDateKey } from '../utils/dateHelpers';
import { DEV_FLAGS } from '../config/devFlags';
import { theme, TYPE, RADIUS } from "../constants/theme";
import { isSessionCompleted } from '../utils/sessionStatus';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { ModalContainer } from '../components/modal/ModalContainer';
import { clamp } from './feedback/feedbackScales';

// Hooks extraits
import { useSessionResolution } from './feedback/hooks/useSessionResolution';
import { useReadinessScore } from './feedback/hooks/useReadinessScore';
import { useSuggestions } from './feedback/hooks/useSuggestions';
import { useFeedbackSave } from './feedback/hooks/useFeedbackSave';

// Composants extraits
import { HeroReadinessCard } from './feedback/components/HeroReadinessCard';
import { SuggestionsCard } from './feedback/components/SuggestionsCard';
import { RPEBlock } from './feedback/components/RPEBlock';
import { MetricsRow } from './feedback/components/MetricsRow';
import { FatigueRecoveryRow } from './feedback/components/FatigueRecoveryRow';
import { PainInjuryRow } from './feedback/components/PainInjuryRow';
import { CyclePrompt } from './feedback/components/CyclePrompt';

const COLORS = theme.colors;

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<AppStackParamList, 'Feedback'>>();
  const haptics = useHaptics();
  const { isOnline, queueCount } = useNetworkStatus();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const tsb = useLoadStore((s) => s.tsb);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(
        60,
        cardAnims.map((anim) =>
          Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true })
        )
      ).start();
    });
  }, [fadeAnim, slideAnim, cardAnims]);

  // Session resolution
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const dayStates = useFeedbackStore((s) => s.dayStates);
  const sessions = useSessionsStore((s) => s.sessions);
  const getSessionById = useSessionsStore((s) => s.getSessionById);

  const todayKey = useMemo(() => {
    const base = devNowISO ? new Date(devNowISO) : new Date();
    return toDateKey(base);
  }, [devNowISO]);

  const sessionIdFromRoute = route.params?.sessionId;
  const prefill = route.params?.prefill;

  const { targetSessionId, targetSession, sessionDateKey } = useSessionResolution(
    sessionIdFromRoute, sessions, todayKey, getSessionById,
  );

  // Prefills
  const prefillRpe =
    typeof prefill?.rpe === 'number' && Number.isFinite(prefill.rpe)
      ? clamp(Math.round(prefill.rpe), 1, 10)
      : undefined;

  const durationPrefill = useMemo(() => {
    if (typeof prefill?.durationMin === 'number' && Number.isFinite(prefill.durationMin))
      return Math.max(1, Math.round(prefill.durationMin));
    if (typeof targetSession?.durationMin === 'number' && Number.isFinite(targetSession.durationMin))
      return Math.max(1, Math.round(targetSession.durationMin));
    const aiDuration = targetSession?.aiV2?.durationMin ?? targetSession?.aiV2?.duration_min;
    if (typeof aiDuration === 'number' && Number.isFinite(aiDuration))
      return Math.max(1, Math.round(aiDuration));
    return undefined;
  }, [prefill?.durationMin, targetSession]);

  // Form state
  const day = dayStates[todayKey];
  const [rpe, setRpe] = useState<number>(prefillRpe ?? 5);
  const [durationMin, setDurationMin] = useState<string>(durationPrefill ? String(durationPrefill) : '');
  const [fatigue, setFatigue] = useState<number>(day?.feedback?.fatigue ?? 3);
  const [pain, setPain] = useState<number>(day?.feedback?.pain ?? 0);
  const [recovery, setRecovery] = useState<number>(day?.feedback?.recoveryPerceived ?? 3);
  const [injury, setInjuryLocal] = useState<any>(day?.feedback?.injury ?? null);
  const [hasPainDetails, setHasPainDetails] = useState<boolean>(!!day?.feedback?.injury);
  const allowCloseRef = useRef(false);

  useEffect(() => {
    if (!durationMin && durationPrefill) setDurationMin(String(durationPrefill));
  }, [durationPrefill, durationMin]);

  useEffect(() => {
    const d = dayStates[todayKey];
    const fb = targetSession?.feedback;
    setFatigue((fb?.fatigue as number) ?? d?.feedback?.fatigue ?? 3);
    const painFromDay = d?.feedback?.pain;
    const painFromFb = typeof fb?.pain === 'number' ? fb.pain : undefined;
    setPain(typeof painFromDay === 'number' ? painFromDay : painFromFb ?? 0);
    setRecovery((fb?.sleep as number) ?? d?.feedback?.recoveryPerceived ?? 3);
    setInjuryLocal((fb as unknown as Record<string, unknown>)?.injury ?? d?.feedback?.injury ?? null);
    setHasPainDetails(!!((fb as unknown as Record<string, unknown>)?.injury ?? d?.feedback?.injury));
    setRpe((typeof fb?.rpe === 'number' ? fb?.rpe : targetSession?.rpe) ?? 5);
  }, [todayKey, dayStates, targetSession]);

  // Derived values
  const durationValue = Number(durationMin);
  const durationValid = Number.isFinite(durationValue) && durationValue >= 5 && durationValue <= 300;
  const durationClamped = durationValid ? Math.round(durationValue) : undefined;

  const sessionIsToday = sessionDateKey ? sessionDateKey === todayKey : false;
  const canSaveToday = DEV_FLAGS.ENABLED || sessionIsToday;
  const initialPainFromDay = day?.feedback?.pain;
  const initialPainFromFeedback =
    typeof targetSession?.feedback?.pain === 'number' ? targetSession.feedback.pain : undefined;
  const initialRpe =
    (typeof targetSession?.feedback?.rpe === 'number' ? targetSession.feedback.rpe : targetSession?.rpe)
    ?? prefillRpe
    ?? 5;
  const initialFatigue = (targetSession?.feedback?.fatigue as number) ?? day?.feedback?.fatigue ?? 3;
  const initialPain =
    typeof initialPainFromDay === 'number' ? initialPainFromDay : initialPainFromFeedback ?? 0;
  const initialRecovery =
    (targetSession?.feedback?.sleep as number) ?? day?.feedback?.recoveryPerceived ?? 3;
  const initialInjury =
    (targetSession?.feedback as unknown as Record<string, unknown>)?.injury ?? day?.feedback?.injury ?? null;
  const initialHasPainDetails = !!initialInjury;
  const initialDuration = durationPrefill ? String(durationPrefill) : '';
  const hasPendingSessionFeedback = !!targetSessionId && !isSessionCompleted(targetSession);
  const isDirty = useMemo(() => {
    return (
      rpe !== initialRpe ||
      durationMin !== initialDuration ||
      fatigue !== initialFatigue ||
      pain !== initialPain ||
      recovery !== initialRecovery ||
      hasPainDetails !== initialHasPainDetails ||
      JSON.stringify(injury ?? null) !== JSON.stringify(initialInjury ?? null)
    );
  }, [
    rpe,
    initialRpe,
    durationMin,
    initialDuration,
    fatigue,
    initialFatigue,
    pain,
    initialPain,
    recovery,
    initialRecovery,
    hasPainDetails,
    initialHasPainDetails,
    injury,
    initialInjury,
  ]);

  // Hooks
  const { readiness, readinessLabel } = useReadinessScore(fatigue, pain, recovery);
  const suggestion = useSuggestions(prefillRpe, targetSession);

  const {
    onSave, isSaving, saveDisabled, saveLabel,
    cyclePromptVisible, onChooseNewProgram, onTestProgress, continueAfterFeedback,
    estimatedLoad, projectedTsb, projectedDelta,
  } = useFeedbackSave({
    targetSessionId, targetSession, sessionDateKey, todayKey, canSaveToday,
    rpe, fatigue, pain, recovery, injury, hasPainDetails, durationClamped,
    navigation, haptics,
  });

  // Callbacks pour suggestions
  const applyRpe = useCallback(() => { setRpe(suggestion.rpe); haptics.impactLight(); }, [suggestion.rpe, haptics]);
  const applyFatigue = useCallback(() => { setFatigue(suggestion.fatigue); haptics.impactLight(); }, [suggestion.fatigue, haptics]);
  const applyRecovery = useCallback(() => { setRecovery(suggestion.recovery); haptics.impactLight(); }, [suggestion.recovery, haptics]);
  const applyPain = useCallback(() => { setPain(suggestion.pain); haptics.impactLight(); }, [suggestion.pain, haptics]);
  const applyAll = useCallback(() => {
    setRpe(suggestion.rpe);
    setFatigue(suggestion.fatigue);
    setRecovery(suggestion.recovery);
    setPain(suggestion.pain);
    haptics.success();
  }, [suggestion, haptics]);

  const onRpeChange = useCallback((v: number) => { setRpe(v); haptics.impactLight(); }, [haptics]);
  const onFatigueChange = useCallback((v: number) => { setFatigue(v); haptics.impactLight(); }, [haptics]);
  const onRecoveryChange = useCallback((v: number) => { setRecovery(v); haptics.impactLight(); }, [haptics]);
  const onPainChange = useCallback((v: number) => { setPain(v); haptics.impactLight(); }, [haptics]);
  const onTogglePainDetails = useCallback((v: boolean) => {
    setHasPainDetails(v);
    if (!v) setInjuryLocal(null);
    haptics.impactLight();
  }, [haptics]);

  const finishClose = useCallback(() => {
    allowCloseRef.current = true;
    if (hasPendingSessionFeedback) {
      continueAfterFeedback();
      return;
    }
    navigation.goBack();
  }, [continueAfterFeedback, hasPendingSessionFeedback, navigation]);

  const requestClose = useCallback(() => {
    if (isSaving) return;
    if (!isDirty) {
      finishClose();
      return;
    }
    Alert.alert(
      'Quitter le feedback ?',
      'Tes changements non enregistres seront perdus.',
      [
        { text: 'Rester', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: finishClose,
        },
      ]
    );
  }, [finishClose, isDirty, isSaving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (allowCloseRef.current) {
        allowCloseRef.current = false;
        return;
      }
      if (isSaving) {
        e.preventDefault();
        return;
      }
      if (!isDirty && !hasPendingSessionFeedback) return;
      e.preventDefault();
      if (!isDirty) {
        finishClose();
        return;
      }
      Alert.alert(
        'Quitter le feedback ?',
        'Tes changements non enregistres seront perdus.',
        [
          { text: 'Rester', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: finishClose,
          },
        ]
      );
    });
    return unsubscribe;
  }, [finishClose, hasPendingSessionFeedback, isDirty, isSaving, navigation]);

  // Helper pour animation stagger
  const staggerStyle = (index: number) => ({
    opacity: cardAnims[index],
    transform: [{
      translateY: cardAnims[index].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
    }],
  });

  return (
    <View style={styles.modalRoot}>
      <ModalContainer
        visible
        onClose={requestClose}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss={!isSaving}
        allowSwipeDismiss={!isSaving}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'left', 'bottom']}>
          <StatusBar
            barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor={COLORS.background}
          />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Feedback</Text>
            <TouchableOpacity onPress={requestClose} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Fermer le feedback">
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.container,
                  { flexGrow: 1, paddingBottom: Math.max(24, insets.bottom + 20) },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                {(!isOnline || queueCount > 0) && (
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
                )}

                <HeroReadinessCard
                  readiness={readiness}
                  readinessLabel={readinessLabel}
                  todayKey={todayKey}
                  fadeAnim={fadeAnim}
                  slideAnim={slideAnim}
                />

                <SuggestionsCard
                  suggestion={suggestion}
                  fadeAnim={fadeAnim}
                  slideAnim={slideAnim}
                  onApplyRpe={applyRpe}
                  onApplyFatigue={applyFatigue}
                  onApplyRecovery={applyRecovery}
                  onApplyPain={applyPain}
                  onApplyAll={applyAll}
                />

                <Animated.View style={[styles.metricsRow, staggerStyle(0)]}>
                  <RPEBlock rpe={rpe} onRpeChange={onRpeChange} />
                </Animated.View>

                <Animated.View style={[styles.metricsRow, staggerStyle(1)]}>
                  <MetricsRow
                    durationMin={durationMin}
                    durationValid={durationValid}
                    estimatedLoad={estimatedLoad}
                    tsb={tsb}
                    projectedTsb={projectedTsb}
                    projectedDelta={projectedDelta}
                    onDurationChange={setDurationMin}
                  />
                </Animated.View>

                <Animated.View style={[styles.metricsRow, staggerStyle(2)]}>
                  <FatigueRecoveryRow
                    fatigue={fatigue}
                    recovery={recovery}
                    onFatigueChange={onFatigueChange}
                    onRecoveryChange={onRecoveryChange}
                  />
                </Animated.View>

                <Animated.View style={[styles.metricsRow, staggerStyle(3)]}>
                  <PainInjuryRow
                    pain={pain}
                    hasPainDetails={hasPainDetails}
                    injury={injury}
                    onPainChange={onPainChange}
                    onTogglePainDetails={onTogglePainDetails}
                    onInjuryChange={setInjuryLocal}
                    injuryCardAnim={cardAnims[4]}
                  />
                </Animated.View>

                {__DEV__ && day?.adaptive && (
                  <View style={styles.debug}>
                    <Text style={styles.debugTitle}>DEBUG — Facteurs adaptatifs</Text>
                    <Text style={styles.debugText}>fatigueSmoothed: {day.adaptive.fatigueSmoothed}</Text>
                    <Text style={styles.debugText}>fatigueFactor: {day.adaptive.fatigueFactor}</Text>
                    <Text style={styles.debugText}>painFactor: {day.adaptive.painFactor}</Text>
                    <Text style={styles.debugText}>combined: {day.adaptive.combined}</Text>
                  </View>
                )}
              </ScrollView>
            </TouchableWithoutFeedback>

            {cyclePromptVisible && (
              <CyclePrompt
                onChooseNewProgram={onChooseNewProgram}
                onTestProgress={onTestProgress}
                onLater={continueAfterFeedback}
              />
            )}

            <View
              style={[
                styles.bottomBar,
                { paddingBottom: Math.max(16, insets.bottom + 12) },
              ]}
            >
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
            submessage="Mise à jour de ta charge d'entraînement en cours."
          />
        </SafeAreaView>
      </ModalContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'transparent' },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  modalHeaderTitle: { fontSize: TYPE.body.fontSize, fontWeight: '800', color: COLORS.text },
  modalClose: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 44, minHeight: 44, alignItems: "center" as const, justifyContent: "center" as const },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 16 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  syncBannerText: { flex: 1, fontSize: TYPE.caption.fontSize, color: COLORS.textMuted },
  metricsRow: { flexDirection: 'row', gap: 12 },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  saveText: { color: COLORS.background, fontWeight: '700', fontSize: TYPE.body.fontSize },
  debug: {
    marginTop: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    backgroundColor: COLORS.surfaceSoft,
  },
  debugTitle: { fontWeight: '700', marginBottom: 4, color: COLORS.textMuted, fontSize: TYPE.caption.fontSize },
  debugText: { color: COLORS.textMuted, fontSize: TYPE.micro.fontSize },
});
