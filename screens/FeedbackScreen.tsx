// screens/FeedbackScreen.tsx
// Formulaire post-séance — orchestrateur léger
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

import { useLoadStore } from '../state/stores/useLoadStore';
import { useSessionsStore } from '../state/stores/useSessionsStore';
import { useFeedbackStore } from '../state/stores/useFeedbackStore';
import { useDebugStore } from '../state/stores/useDebugStore';
import { useExecutionStore } from '../state/stores/useExecutionStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useHaptics } from '../hooks/useHaptics';
import { toDateKey, isWithinFeedbackWindow } from '../utils/dateHelpers';
import { DEV_FLAGS } from '../config/devFlags';
import { theme } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { ModalContainer, type ModalDismissControl } from '../components/modal/ModalContainer';
import { withSessionErrorBoundary } from '../components/withErrorBoundary';
import { clamp } from './feedback/feedbackScales';
import { summarizeExecution } from '../domain/tracking/execution';
import { markSessionNotDone } from '../state/orchestrators/markSessionNotDone';
import { showToast } from '../utils/toast';

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
import { MonCorpsPrompt } from './feedback/components/MonCorpsPrompt';
import { ExecutionSummaryCard } from './feedback/components/ExecutionSummaryCard';

const COLORS = theme.colors;

function FeedbackScreen() {
  const navigation = useNavigation<any>();
  // Insets via hook (provider racine, fiable dès le 1er rendu) : le composant
  // SafeAreaView edges=['top'] appliquait l'inset en retard dans ce modal
  // transparent animé → header/croix collés sous la Dynamic Island, croix
  // intouchable par intermittence.
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<AppStackParamList, 'Feedback'>>();
  const haptics = useHaptics();
  const { isOnline, queueCount } = useNetworkStatus();
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

  // Execution finalisee de la séance cible (Lot 1/2, useExecutionStore).
  // Sans exécution -> écran strictement identique à avant ce lot.
  const rawExecution = useExecutionStore((s) =>
    targetSessionId ? s.getExecutionForSession(targetSessionId) : undefined
  );
  const finalizedExecution = rawExecution && rawExecution.finishedAtISO ? rawExecution : undefined;
  const executionSummary = useMemo(
    () => (finalizedExecution ? summarizeExecution(finalizedExecution) : null),
    [finalizedExecution]
  );

  // Prefills
  const prefillRpe =
    typeof prefill?.rpe === 'number' && Number.isFinite(prefill.rpe)
      ? clamp(Math.round(prefill.rpe), 1, 10)
      : undefined;

  const durationPrefill = useMemo(() => {
    // Priorité à la durée réelle de l'exécution live (chrono), avant les
    // autres prefills (cf. brief Lot 4 §4.2).
    if (
      typeof finalizedExecution?.actualDurationMin === 'number' &&
      Number.isFinite(finalizedExecution.actualDurationMin)
    )
      return Math.max(1, Math.round(finalizedExecution.actualDurationMin));
    if (typeof prefill?.durationMin === 'number' && Number.isFinite(prefill.durationMin))
      return Math.max(1, Math.round(prefill.durationMin));
    if (typeof targetSession?.durationMin === 'number' && Number.isFinite(targetSession.durationMin))
      return Math.max(1, Math.round(targetSession.durationMin));
    const aiDuration = targetSession?.aiV2?.durationMin ?? targetSession?.aiV2?.duration_min;
    if (typeof aiDuration === 'number' && Number.isFinite(aiDuration))
      return Math.max(1, Math.round(aiDuration));
    return undefined;
  }, [finalizedExecution, prefill?.durationMin, targetSession]);

  // Form state
  const day = dayStates[todayKey];
  const [rpe, setRpe] = useState<number>(prefillRpe ?? 5);
  const [durationMin, setDurationMin] = useState<string>(durationPrefill ? String(durationPrefill) : '');
  const [fatigue, setFatigue] = useState<number>(day?.feedback?.fatigue ?? 3);
  const [pain, setPain] = useState<number>(day?.feedback?.pain ?? 0);
  const [recovery, setRecovery] = useState<number>(day?.feedback?.recoveryPerceived ?? 3);

  // Le re-prefill ne doit jamais se battre avec une saisie utilisateur :
  // une fois le champ touché (y compris vidé au focus), on ne re-remplit plus.
  const durationTouched = useRef(false);
  const onDurationChange = useCallback((v: string) => {
    durationTouched.current = true;
    setDurationMin(v.replace(',', '.'));
  }, []);

  useEffect(() => {
    if (durationTouched.current) return;
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
    setRpe((typeof fb?.rpe === 'number' ? fb?.rpe : targetSession?.rpe) ?? prefillRpe ?? 5);
  }, [todayKey, dayStates, targetSession, prefillRpe]);

  // Derived values
  const durationValue = Number(durationMin);
  const durationValid = Number.isFinite(durationValue) && durationValue >= 5 && durationValue <= 300;
  const durationClamped = durationValid ? Math.round(durationValue) : undefined;
  const durationInvalid = durationMin.length > 0 && !durationValid;

  // Fenêtre de validation partagée (aujourd'hui, J-1, J-2, demain) — même
  // source de vérité que usePrimaryCta et NewSessionScreen (isWithinFeedbackWindow).
  const sessionIsRecent = isWithinFeedbackWindow(sessionDateKey, todayKey);
  const canSaveToday = DEV_FLAGS.ENABLED || sessionIsRecent;

  // Hooks
  const { readiness, readinessLabel } = useReadinessScore(fatigue, pain, recovery);
  const suggestion = useSuggestions(prefillRpe, targetSession);

  const {
    onSave, isSaving, saveDisabled, saveLabel,
    cyclePromptVisible, onChooseNewProgram, continueAfterFeedback,
    estimatedLoad, projectedTsb, projectedDelta,
    monCorpsPromptVisible, zoneGeneEnCours, ouvrirMonCorps, repondreSurGeneEnCours,
  } = useFeedbackSave({
    targetSessionId, targetSession, sessionDateKey, todayKey, canSaveToday,
    rpe, fatigue, pain, recovery, durationClamped, durationInvalid,
    navigation, haptics,
  });

  // Fermeture (backdrop/swipe/croix) : ne pas laisser croire que le feedback est parti.
  // « Rester » doit RÉTABLIR le modal : après un swipe, la feuille est déjà
  // hors écran et le verrou anti double-dismiss est posé — sans cancelDismiss,
  // le joueur restait devant un fond flouté vide (P0-2 inventaire clubs).
  const dismissControl = useRef<ModalDismissControl | null>(null);
  const stayInFeedback = useCallback(() => {
    dismissControl.current?.cancelDismiss();
  }, []);
  const confirmClose = useCallback(() => {
    if (targetSession && !targetSession.completed) {
      Alert.alert(
        'Feedback non enregistré',
        'Quitter sans valider ton retour ?',
        [
          { text: 'Rester', style: 'cancel', onPress: stayInFeedback },
          { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
        ],
        // Android : l'alerte peut se fermer d'un tap hors dialogue — même issue
        // que « Rester », sinon l'écran mort revient par cette porte-là.
        { cancelable: true, onDismiss: stayInFeedback }
      );
      return;
    }
    navigation.goBack();
  }, [navigation, targetSession, stayInFeedback]);

  // « Je ne l'ai pas faite » (décision Kyllian 15/08, P1-08) : l'issue honnête
  // pour une séance générée mais jamais ouverte. Archive SANS charge (aucun
  // RPE inventé, ATL/CTL intacts — l'orchestrateur ne touche pas au feedback)
  // et libère immédiatement le CTA et la génération. Proposée seulement quand
  // aucune exécution réelle n'existe : un joueur qui a coché des séries en
  // Live a forcément fait quelque chose — son chemin, c'est le feedback.
  const canDeclareNotDone = Boolean(
    targetSession && !targetSession.completed && !executionSummary
  );
  const onNotDone = useCallback(() => {
    if (!targetSessionId) return;
    Alert.alert(
      "Tu n'as pas fait cette séance ?",
      "Elle sera archivée sans charge d'entraînement. Ça arrive — ta prochaine séance n'en tiendra pas compte.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, pas faite',
          style: 'destructive',
          onPress: () => {
            const ok = markSessionNotDone(targetSessionId);
            if (ok) {
              haptics.impactLight();
              showToast({
                type: 'success',
                title: 'Séance archivée',
                message: 'Aucune charge comptée. Tu peux passer à la suite.',
              });
              navigation.goBack();
            } else {
              showToast({ type: 'error', title: 'Impossible', message: 'Cette séance est déjà réglée.' });
            }
          },
        },
      ]
    );
  }, [targetSessionId, navigation, haptics]);

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
        onClose={confirmClose}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss
        allowSwipeDismiss
        dismissControl={dismissControl}
      >
        <View
          style={[
            styles.safeArea,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 8),
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle}>Feedback</Text>
            <TouchableOpacity
              onPress={confirmClose}
              style={styles.modalClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer le feedback"
            >
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          >
            {/* AUDIT TACTILE (P1-16, même motif que b708fe9 / recette 03/08) :
                le TouchableWithoutFeedback qui enveloppait ce ScrollView pose
                un responder sur TOUS ses descendants et peut avaler les taps
                (RN 0.81 / new arch). Supprimé ; le clavier se ferme par
                glissement, comme sur l'onboarding. */}
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.container, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
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

                {executionSummary && (
                  <ExecutionSummaryCard
                    completionPct={executionSummary.completionPct}
                    adapted={executionSummary.adapted}
                    skipped={executionSummary.skipped}
                    replaced={executionSummary.replaced}
                    mainReasons={executionSummary.mainReasons}
                    rpeTarget={finalizedExecution?.snapshot.rpeTarget ?? null}
                    rpeFelt={rpe}
                  />
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
                    onDurationChange={onDurationChange}
                    plannedFallbackMin={durationPrefill}
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
                  <PainInjuryRow pain={pain} onPainChange={onPainChange} />
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

            {cyclePromptVisible && (
              <CyclePrompt
                onChooseNewProgram={onChooseNewProgram}
                onLater={continueAfterFeedback}
              />
            )}

            {/* Passerelle « Mon corps » (D3) : APRÈS l'enregistrement, jamais
                avant. Le feedback est déjà appliqué quand cette carte paraît ;
                « Plus tard » n'écrit rien du tout. */}
            {monCorpsPromptVisible && (
              <MonCorpsPrompt
                zoneEnCours={zoneGeneEnCours}
                onSituer={() => ouvrirMonCorps(!zoneGeneEnCours)}
                onToujoursLa={() => repondreSurGeneEnCours('active')}
                onEnReprise={() => repondreSurGeneEnCours('recovering')}
                onPlusTard={continueAfterFeedback}
              />
            )}

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
              {canDeclareNotDone ? (
                <TouchableOpacity
                  onPress={onNotDone}
                  style={styles.notDoneLink}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Je n'ai pas fait cette séance, l'archiver sans charge"
                >
                  <Text style={styles.notDoneLinkText}>Je ne l'ai pas faite</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>

          <LoadingOverlay
            visible={isSaving}
            message="Enregistrement de ton feedback..."
            submessage="Mise à jour de ta charge d'entraînement en cours."
          />
        </View>
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
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  syncBannerText: { flex: 1, fontSize: 12, color: COLORS.textMuted },
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
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  saveText: { color: COLORS.background, fontWeight: '700', fontSize: 15 },
  // Issue « pas faite » : lien discret sous le CTA — jamais un second bouton
  // qui se disputerait la hiérarchie avec « Valider ».
  notDoneLink: { alignSelf: 'center', paddingVertical: 10, marginTop: 2 },
  notDoneLinkText: { fontSize: 13, fontWeight: '600', color: COLORS.sub },
  debug: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    backgroundColor: COLORS.surfaceSoft,
  },
  debugTitle: { fontWeight: '700', marginBottom: 4, color: COLORS.textMuted, fontSize: 12 },
  debugText: { color: COLORS.textMuted, fontSize: 11 },
});

export default withSessionErrorBoundary(FeedbackScreen);
