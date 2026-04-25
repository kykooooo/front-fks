// screens/feedback/hooks/useFeedbackSave.ts
// Logique de sauvegarde du feedback post-séance (cycle, pathway, offline)
import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useLoadStore } from '../../../state/stores/useLoadStore';
import { useSessionsStore } from '../../../state/stores/useSessionsStore';
import { useFeedbackStore } from '../../../state/stores/useFeedbackStore';
import { applyFeedback } from '../../../state/orchestrators/applyFeedback';
import type { InjuryRecord, Modality, SessionFeedback } from '../../../domain/types';
import { DEFAULT_MODALITY_WEIGHTS, toRPE1to10, toRating1to5, toRating0to10 } from '../../../domain/types';
import { FEEDBACK_LIMITS } from '../../../constants/feedback';
import { updateTrainingLoad } from '../../../engine/loadModel';
import { getTauForLevel, getFootballLabel } from '../../../config/trainingDefaults';
import { showErrorWithRetry, classifyError, ErrorType, retryWithBackoff } from '../../../utils/errorHandler';
import { showToast } from '../../../utils/toast';
import { enqueueAction } from '../../../utils/offlineQueue';
import { trackEvent } from '../../../services/analytics';
import { scheduleRetestReminder } from '../../../services/notifications';
import { MICROCYCLES, getPathwayById, MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from '../../../domain/microcycles';
import { auth, db } from '../../../services/firebase';
import { clamp } from '../feedbackScales';
import { isSessionCompleted } from '../../../utils/sessionStatus';
import { LIVE_SESSION_KEY } from '../../../utils/sessionEntry';

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
  const playerLevel = useSessionsStore((s) => s.playerLevel);
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

  const onTestProgress = useCallback(() => {
    clearAutoContinue();
    setCyclePromptVisible(false);
    navigation.navigate('Tests');
  }, [clearAutoContinue, navigation]);

  const modality = (targetSession?.modality ??
    targetSession?.exercises?.[0]?.modality) as Modality | undefined;
  const modalityWeight = modality ? DEFAULT_MODALITY_WEIGHTS[modality] ?? 1 : 1;
  const estimatedLoad =
    durationClamped != null ? Math.round(rpe * durationClamped * modalityWeight) : null;
  const { tauAtl, tauCtl } = getTauForLevel(playerLevel);
  const projected =
    estimatedLoad != null ? updateTrainingLoad(atl, ctl, estimatedLoad, { tauAtl, tauCtl }) : null;
  const projectedTsb = projected ? +projected.tsb.toFixed(1) : null;
  const projectedDelta =
    projectedTsb != null ? +(projectedTsb - tsb).toFixed(1) : null;

  const onSave = useCallback(async () => {
    if (isSaving) return;
    if (!targetSessionId || !targetSession) {
      showToast({ type: 'error', title: 'Séance introuvable', message: "La séance n'est pas chargée ou aucun ID n'a été trouvé." });
      return;
    }
    if (isSessionCompleted(targetSession)) {
      showToast({ type: 'warn', title: 'Déjà complétée', message: 'Tu as déjà donné ton retour pour cette séance.' });
      return;
    }
    if (!canSaveToday) {
      showToast({ type: 'warn', title: 'Date non compatible', message: "Tu essaies de valider une séance qui n'est pas datée d'aujourd'hui." });
      return;
    }

    setIsSaving(true);
    try {
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
      // Pain sur échelle EVA 0-10 (unification — voir INJURY_IA_CHARTER.md règle 5).
      const painEVA = clamp(pain, FEEDBACK_LIMITS.painMin ?? 0, FEEDBACK_LIMITS.painMax ?? 10);
      dailyPayload.pain = painEVA;
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
        pain: toRating0to10(painEVA),
        createdAt: new Date().toISOString(),
      };
      if (durationClamped != null) fb.durationMin = durationClamped;

      const res = await Promise.resolve(addFeedback(targetSessionId, fb));
      if (!res) {
        showToast({ type: 'error', title: 'Feedback non appliqué', message: "La séance est introuvable ou déjà complétée." });
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(LIVE_SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { sessionId?: string };
          if (!saved.sessionId || saved.sessionId === targetSessionId) {
            await AsyncStorage.removeItem(LIVE_SESSION_KEY);
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[FeedbackSave] Failed to clear live session cache after completion:', err);
        }
      }
      setDailyFeedback(dayKeyForSession, dailyPayload);
      setInjury(dayKeyForSession, hasPainDetails ? injury : null);

      const afterLoad = useLoadStore.getState();
      const afterSessions = useSessionsStore.getState();
      const footballLabel = getFootballLabel(afterLoad.tsb);
      const completedIdx = Math.max(
        1,
        Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, afterSessions.microcycleSessionIndex ?? 1),
      );
      const cycleLabel = activeGoal
        ? MICROCYCLES[activeGoal as keyof typeof MICROCYCLES]?.label ?? null
        : null;
      const sessionPrefix = activeGoal
        ? `Séance ${completedIdx}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}`
        : 'Séance';
      const cyclePart = cycleLabel ? `Cycle ${cycleLabel} · ` : '';
      trackEvent('feedback_submitted', {
        cycleId: activeGoal ?? 'none',
        rpe: fb.rpe,
        fatigue: fb.fatigue,
        pain: fb.pain,
        durationMin: durationClamped ?? null,
      });
      showToast({
        type: 'success',
        title: `${sessionPrefix} validée ${footballLabel.emoji}`,
        message: `${cyclePart}Tu es ${footballLabel.label.toLowerCase()}. ${footballLabel.message}`,
      });
      haptics.success();

      if (shouldPromptCycleEnd) {
        // Programme un rappel re-test 30j après la fin du cycle — incite le joueur
        // à revenir mesurer ses gains (boucle rétention test → cycle → test).
        if (cycleLabel) {
          scheduleRetestReminder(cycleLabel).catch(() => {
            // silent : pas critique si la notif échoue
          });
        }

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
        const painEVA = clamp(pain, FEEDBACK_LIMITS.painMin ?? 0, FEEDBACK_LIMITS.painMax ?? 10);
        const fb: SessionFeedback = {
          rpe: toRPE1to10(rpe),
          fatigue: toRating1to5(fatigue),
          sleep: toRating1to5(recovery),
          pain: toRating0to10(painEVA),
          createdAt: new Date().toISOString(),
        };
        if (durationClamped != null) fb.durationMin = durationClamped;
        const latestSession = useSessionsStore
          .getState()
          .sessions.find((session) => session.id === targetSessionId);

        if (isSessionCompleted(latestSession)) {
          await enqueueAction('session', { session: latestSession });
          showToast({
            type: 'info',
            title: 'Synchronisation en attente',
            message: 'Ta séance est validée. La synchronisation cloud repartira dès que tu seras reconnecté.',
          });
          continueAfterFeedback();
        } else {
          await enqueueAction('feedback', { sessionId: targetSessionId, feedback: fb });
          showToast({ type: 'info', title: 'Enregistré hors-ligne', message: 'Ton feedback sera synchronisé dès que tu seras reconnecté.' });
          navigation.goBack();
        }
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

  const saveDisabled = isSaving || !targetSession || isSessionCompleted(targetSession) || !canSaveToday;
  const saveLabel = isSaving
    ? 'Enregistrement…'
    : isSessionCompleted(targetSession)
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
    onTestProgress,
    continueAfterFeedback,
    estimatedLoad,
    projectedTsb,
    projectedDelta,
  };
}
