// state/stores/persistHelpers.ts
//
// Helpers purs pour la persistance Firestore des sessions completees.
// Extraits de useSyncStore.ts pour etre testables sans mocker firebase auth/firestore.

import type { Session } from "../../domain/types";

/**
 * Construit le payload Firestore pour `users/{uid}/sessions/{id}`.
 *
 * Inclut explicitement :
 *  - `feedback.rpe` (le RPE reel ressenti — necessaire au backend pour computeFeedbackAdjustments)
 *  - `metrics.atl/ctl/tsb` (snapshot de charge au moment du feedback — necessaire a
 *    detectFatigueTrend cote backend, ../fks/src/fksUtils.ts:62-75)
 *  - `aiV2` (blueprint complet, porte rpeTarget — backend lit s.aiV2.rpeTarget l. 307-310)
 *
 * Sans ces champs persistes, les sessions rechargees depuis Firestore au prochain login
 * perdent les signaux fatigue/RPE → le pont vers le backend redevient muet.
 */
export function buildCompletedSessionFirestorePayload(s: Session): Record<string, unknown> {
  const completedPayload: Record<string, unknown> = {
    date: s.dateISO,
    dateISO: s.dateISO,
    phase: s.phase,
    focus: s.focus,
    intensity: s.intensity,
    exercises: s.exercises,
    rpe: s.rpe,
  };

  if (s.feedback) {
    const fb: Record<string, unknown> = {
      fatigue: s.feedback.fatigue,
      sleep: s.feedback.sleep,
      pain: s.feedback.pain,
      rpe: s.feedback.rpe,
    };
    if (Number.isFinite(s.feedback.recoveryPerceived)) {
      fb.recoveryPerceived = s.feedback.recoveryPerceived;
    }
    if (Number.isFinite(s.feedback.durationMin)) {
      fb.durationMin = s.feedback.durationMin;
    }
    if (s.feedback.createdAt) fb.createdAt = s.feedback.createdAt;
    if (s.feedback.comment) fb.comment = s.feedback.comment;
    if (s.ai != null) fb.ai = s.ai;
    completedPayload.feedback = fb;
  }

  // On utilise Number.isFinite : NaN passe le test typeof === "number" en JS, et un
  // NaN ecrit dans Firestore corromprait les calculs backend ATL/CTL/TSB.
  if (s.metrics) {
    const m: Record<string, unknown> = {};
    if (Number.isFinite(s.metrics.atl)) m.atl = s.metrics.atl;
    if (Number.isFinite(s.metrics.ctl)) m.ctl = s.metrics.ctl;
    if (Number.isFinite(s.metrics.tsb)) m.tsb = s.metrics.tsb;
    if (Object.keys(m).length > 0) completedPayload.metrics = m;
  }

  if (s.aiV2 != null) completedPayload.aiV2 = s.aiV2;
  if (s.title) completedPayload.title = s.title;

  return completedPayload;
}
