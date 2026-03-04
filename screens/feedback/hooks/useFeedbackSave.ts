// screens/feedback/hooks/useFeedbackSave.ts
// Logique de sauvegarde du feedback post-séance (cycle, pathway, offline)
import { useState, useRef, useCallback, useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useLoadStore } from '../../../state/stores/useLoadStore';
import { useSessionsStore } from '../../../state/stores/useSessionsStore';
import { useFeedbackStore } from '../../../state/stores/useFeedbackStore';
import { applyFeedback } from '../../../state/orchestrators/applyFeedback';
import type { InjuryRecord, Modality, SessionFeedback } from '../../../domain/types';
import { DEFAULT_MODALITY_WEIGHTS, toRPE1to10, toRating1to5, toRating0to5 } from '../../../domain/types';
import { FEEDBACK_LIMITS } from '../../../constants/feedback';
import { updateTrainingLoad } from '../../../engine/loadModel';
import { showErrorWithRetry, classifyError, ErrorType, retryWithBackoff } from '../../../utils/errorHandler';
import { showToast } from '../../../utils/toast';
import { enqueueAction } from '../../../utils/offlineQueue';
import { trackEvent } from '../../../services/analytics';
import { MICROCYCLES, getPathwayById } from '../../../domain/microcycles';
import { auth, db } from '../../../services/firebase';
import { clamp } from '../feedbackScales';

type SaveParams = {
  targetSessionId: string | undefined;
  targetSession: any;
  sessionDateKey: string | null;
  todayKey: string;
  canSaveToday: boolean;
  rpe: number;
  fatigue: number;
  pain: number;
  recovery: number;
  injury: InjuryRecord | null;
  hasPainDetails: boolean;
  durationClamped: number | undefined;
  navigation: any;
  haptics: { success: () => void; warning: () => void };
};

export function useFeedbackSave(params: SaveParams) {
  const {
    targetSessionId, targetSession, sessionDateKey, todayKey,
    canSaveToday, rpe, fatigue, pain, recovery, injury, hasPainDetails,
    durationClamped, navigation, haptics,
  } = params;

  const atl = useLoadStore((s) => s.atl);
  const ctl = useLoadStore((s) => s.ctl);
  const tsb = useLoadStore((s) => s.tsb);
  const addFeedback = applyFeedback;
  const setDailyFeedback = useFeedbackStore((s) => s.setDailyFeedback);
  const setInjury = useFeedbackStore((s) => s.setInjury);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const lastAiContext = useSessionsStore((s) => s.lastAiContext);
  const activePathwayId = useSessionsStore((s) => s.activePathwayId);
  const activePathwayIndex = useSessionsStore((s) => s.activePathwayIndex);
  const setActivePathway = useSessionsStore((s) => s.setActivePathway);
  const setMicrocycleGoal = useSessionsStore((s) => s.setMicrocycleGoal);

  const [isSaving, setIsSaving] = useState(false);
  const [cyclePromptVisible, setCyclePromptVisible] = useState(false);
  const autoContinueRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoContinue = useCallback(() => {
    if (autoContinueRef.current) {
      clearTimeout(autoContinueRef.current);
      autoContinueRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoContinue(), [clearAutoContinue]);

  const continueAfterFeedback = useCallback(() => {
    clearAutoContinue();
    setCyclePromptVisible(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
      })
    );
  }, [clearAutoContinue, navigation]);

  const onChooseNewProgram = useCallback(() => {
    clearAutoContinue();
    setCyclePromptVisible(false);
    navigation.navigate('CycleModal', { mode: 'select', origin: 'feedback' });
  }, [clearAutoContinue, navigation]);

  const modality = (targetSession?.modality ??
    targetSession?.exercises?.[0]?.modality) as Modality | undefined;
  const modalityWeight = modality ? DEFAULT_MODALITY_WEIGHTS[modality] ?? 1 : 1;
  const estimatedLoad =
    durationClamped != null ? Math.round(rpe * durationClamped * modalityWeight) : null;
  const projected =
    estimatedLoad != null ? updateTrainingLoad(atl, ctl, estimatedLoad) : null;
  const projectedTsb = projected ? +projected.tsb.toFixed(1) : null;
  const projectedDelta =
    projectedTsb != null ? +(projectedTsb - tsb).toFixed(1) : null;

  const onSave = useCallback(async () => {
    if (isSaving) return;
    if (!targetSessionId || !targetSession) {
      showToast({ type: 'error', title: 'Séance introuvable', message: "La séance n'est pas chargée ou aucun ID n'a été trouvé." });
      return;
    }
    if (targetSession.completed) {
      showToast({ type: 'warn', title: 'Déjà complétée', message: 'Tu as déjà donné ton retour pour cette séance.' });
      return;
    }
    if (!canSaveToday) {
      showToast({ type: 'warn', title: 'Date non compatible', message: "Tu essaies de valider une séance qui n'est pas datée d'aujourd'hui." });
      return;
    }

    setIsSaving(true);
    try {
      const atlBefore = atl;
      const ctlBefore = ctl;
      const tsbBefore = tsb;
      const dayKeyForSession = sessionDateKey ?? todayKey;

      const activeGoal =
        typeof microcycleGoal === 'string' && microcycleGoal.trim()
          ? microcycleGoal.trim()
          : null;
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
        fatigue: clamp(fatigue, FEEDBACK_LIMITS.fatigueMin, FEEDBACK_LIMITS.fatigueMax),
      };
      const pain0to5 = clamp(pain, FEEDBACK_LIMITS.painMin ?? 0, FEEDBACK_LIMITS.painMax ?? 5);
      dailyPayload.pain = pain0to5;
      if (typeof recovery === 'number') {
        dailyPayload.recoveryPerceived = clamp(
          recovery,
          FEEDBACK_LIMITS.recoveryMin,
          FEEDBACK_LIMITS.recoveryMax,
        );
      }

      const fb: SessionFeedback = {
        rpe: toRPE1to10(rpe),
        fatigue: toRating1to5(fatigue),
        sleep: toRating1to5(recovery),
        pain: toRating0to5(pain0to5),
        createdAt: new Date().toISOString(),
      };
      if (durationClamped != null) fb.durationMin = durationClamped;

      const res = await Promise.resolve(addFeedback(targetSessionId, fb));
      if (!res) {
        showToast({ type: 'error', title: 'Feedback non appliqué', message: "La séance est introuvable ou déjà complétée." });
        return;
      }
      setDailyFeedback(dayKeyForSession, dailyPayload);
      setInjury(dayKeyForSession, hasPainDetails ? injury : null);

      const afterLoad = useLoadStore.getState();
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
        message: `ATL ${afterLoad.atl.toFixed(1)} (${fmt(afterLoad.atl - atlBefore)}) · CTL ${afterLoad.ctl.toFixed(1)} (${fmt(afterLoad.ctl - ctlBefore)}) · TSB ${afterLoad.tsb.toFixed(1)} (${fmt(afterLoad.tsb - tsbBefore)})`,
      });
      haptics.success();

      if (shouldPromptCycleEnd) {
        const pathway = activePathwayId ? getPathwayById(activePathwayId) : null;
        const nextIndex = (activePathwayIndex ?? 0) + 1;
        const hasNextInPathway = pathway && nextIndex < pathway.sequence.length;

        if (hasNextInPathway) {
          const nextCycleId = pathway.sequence[nextIndex];
          const nextCycle = MICROCYCLES[nextCycleId];
          try {
            const uid = auth.currentUser?.uid ?? null;
            if (uid) {
              await setDoc(doc(db, 'users', uid), {
                microcycleGoal: nextCycleId,
                goal: nextCycleId,
                programGoal: nextCycleId,
                microcycleStatus: 'active',
                microcycleTotalSessions: 12,
                microcycleSessionIndex: 0,
                microcycleStartedAt: serverTimestamp(),
                activePathwayId,
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
            setCyclePromptVisible(true);
            clearAutoContinue();
            autoContinueRef.current = setTimeout(continueAfterFeedback, 4500);
          }
        } else if (pathway) {
          setActivePathway(null);
          const uid = auth.currentUser?.uid ?? null;
          if (uid) {
            setDoc(doc(db, 'users', uid), {
              activePathwayId: null,
              activePathwayIndex: 0,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch((err) => {
              if (__DEV__) console.error("[FeedbackSave] Failed to reset pathway in Firestore:", err);
              retryWithBackoff(
                () => setDoc(doc(db, 'users', uid!), {
                  activePathwayId: null,
                  activePathwayIndex: 0,
                  updatedAt: serverTimestamp(),
                }, { merge: true }),
                { maxRetries: 2, baseDelayMs: 1000, context: "pathway_reset" }
              ).catch((retryErr) => {
                if (__DEV__) console.error("[FeedbackSave] Pathway reset failed after retries:", retryErr);
                showToast({ type: "warn", title: "Synchronisation", message: "Le parcours terminé n'a pas pu être synchronisé." });
              });
            });
          }
          showToast({
            type: 'success',
            title: 'Parcours terminé !',
            message: `Tu as terminé le parcours "${pathway.label}". Choisis un nouveau parcours ou programme.`,
          });
          setCyclePromptVisible(true);
          clearAutoContinue();
          autoContinueRef.current = setTimeout(continueAfterFeedback, 4500);
        } else {
          setCyclePromptVisible(true);
          clearAutoContinue();
          autoContinueRef.current = setTimeout(continueAfterFeedback, 4500);
        }
      } else {
        continueAfterFeedback();
      }
    } catch (e) {
      const appError = classifyError(e);
      haptics.warning();

      if (appError.type === ErrorType.NETWORK) {
        const pain0to5 = clamp(pain, FEEDBACK_LIMITS.painMin ?? 0, FEEDBACK_LIMITS.painMax ?? 5);
        const fb: SessionFeedback = {
          rpe: toRPE1to10(rpe),
          fatigue: toRating1to5(fatigue),
          sleep: toRating1to5(recovery),
          pain: toRating0to5(pain0to5),
          createdAt: new Date().toISOString(),
        };
        if (durationClamped != null) fb.durationMin = durationClamped;
        await enqueueAction('feedback', { sessionId: targetSessionId, feedback: fb });
        showToast({ type: 'info', title: 'Enregistré hors-ligne', message: 'Ton feedback sera synchronisé dès que tu seras reconnecté.' });
        navigation.goBack();
      } else {
        showErrorWithRetry(e, 'Enregistrement du feedback', onSave);
      }
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSaving, targetSessionId, targetSession, canSaveToday, sessionDateKey, todayKey,
    rpe, fatigue, pain, recovery, injury, hasPainDetails, durationClamped,
    atl, ctl, tsb, microcycleGoal, microcycleSessionIndex, lastAiContext,
    activePathwayId, activePathwayIndex,
  ]);

  const saveDisabled = isSaving || !targetSession || targetSession?.completed || !canSaveToday;
  const saveLabel = isSaving
    ? 'Enregistrement…'
    : targetSession?.completed
      ? 'Déjà complétée'
      : !canSaveToday
        ? "Séance pas datée d'aujourd'hui"
        : 'Valider mon état';

  return {
    onSave,
    isSaving,
    saveDisabled,
    saveLabel,
    cyclePromptVisible,
    onChooseNewProgram,
    continueAfterFeedback,
    estimatedLoad,
    projectedTsb,
    projectedDelta,
  };
}
