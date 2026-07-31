// screens/feedback/feedbackScales.ts
// Constantes et helpers partagés pour le feedback
import { toRPE1to10, toRating1to5, toRating0to5 } from '../../domain/types';
import type { SessionFeedback } from '../../domain/types';
import { FEEDBACK_LIMITS } from '../../constants/feedback';

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const getRpeColor = (value: number): string => {
  if (value <= 3) return '#16a34a';
  if (value <= 5) return '#84cc16';
  if (value <= 7) return '#f59e0b';
  if (value <= 8) return '#f97316';
  return '#ef4444';
};

export const RPE_LABELS: Record<number, string> = {
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

export type SegmentedOption = { value: number; label: string };

export const FATIGUE_SCALE: SegmentedOption[] = [
  { value: 1, label: 'Très frais' },
  { value: 2, label: 'Plutôt bien' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Fatigué' },
  { value: 5, label: 'Très fatigué' },
];

export const PAIN_SCALE: SegmentedOption[] = [
  { value: 0, label: 'Aucune gêne' },
  { value: 1, label: 'Très légère' },
  { value: 2, label: 'Présente' },
  { value: 3, label: 'Gênante' },
  { value: 4, label: 'Importante' },
  { value: 5, label: 'Limitante' },
];

export const RECOVERY_SCALE: SegmentedOption[] = [
  { value: 1, label: 'Très mal' },
  { value: 2, label: 'Moyen' },
  { value: 3, label: 'Correct' },
  { value: 4, label: 'Bien' },
  { value: 5, label: 'Excellent' },
];

/**
 * Construit le `SessionFeedback` stocké sur `session.feedback` (local + Firestore).
 *
 * Verrou anti-régression : `recoveryPerceived` DOIT être écrit ici, en plus du
 * champ legacy `sleep` (1-5, même échelle). C'est `recoveryPerceived` que
 * `buildRecentFeedbackPayload` (services/aiContextHelpers.ts) lit pour
 * transmettre `feedback.recovery_perceived` au backend — l'oubli de ce champ
 * rendait `recovery_perceived` mort silencieusement en prod (aucune session ne
 * le portait), cf. INDIVIDUALISATION_FINE_DESIGN.md §1.3 : "recovery_perceived
 * jamais transmis. Écrit dans session.feedback.sleep, lu comme recoveryPerceived".
 * Extrait en fonction pure (au lieu d'un objet littéral dupliqué dans
 * useFeedbackSave.ts) pour pouvoir le tester sans monter le hook complet.
 */
export const buildSessionFeedback = (params: {
  rpe: number;
  fatigue: number;
  pain0to5: number;
  recovery: number;
  durationClamped?: number;
}): SessionFeedback => {
  const fb: SessionFeedback = {
    rpe: toRPE1to10(params.rpe),
    fatigue: toRating1to5(params.fatigue),
    sleep: toRating1to5(params.recovery),
    pain: toRating0to5(params.pain0to5),
    createdAt: new Date().toISOString(),
    recoveryPerceived: clamp(params.recovery, FEEDBACK_LIMITS.recoveryMin, FEEDBACK_LIMITS.recoveryMax),
  };
  if (params.durationClamped != null) fb.durationMin = params.durationClamped;
  return fb;
};
