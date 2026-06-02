// state/stores/persistHelpers.ts
//
// Helpers purs pour la persistance Firestore des sessions completees.
// Extraits de useSyncStore.ts pour etre testables sans mocker firebase auth/firestore.

import type { Session } from "../../domain/types";

// ─── Garde-fous client (séances planifiées) ────────────────────────────────
// Le front applique quelques ajustements côté planification (proximité club,
// charge élevée). On émet des TOKENS STABLES (pas de texte lisible, JAMAIS de
// "TSB ...") pour que la persistance reste propre et traduisible par
// domain/coachLabels.ts. Pur → testable sans firebase.

export type PlannedGuardrailInput = {
  clubToday: boolean;
  clubTomorrow: boolean;
  tsb: number;
  intensity: "easy" | "moderate" | "hard" | string | undefined;
};

export type PlannedGuardrailResult = {
  intensity: PlannedGuardrailInput["intensity"];
  guardFactor: number;
  /** Tokens stables `client:*` — jamais de TSB/texte lisible coach. */
  clientTokens: string[];
};

export function computePlannedClientGuardrails(input: PlannedGuardrailInput): PlannedGuardrailResult {
  let intensity = input.intensity;
  let guardFactor = 1;
  const clientTokens: string[] = [];

  if (input.clubToday || input.clubTomorrow) {
    guardFactor *= 0.75;
    clientTokens.push("client:club_proximity_reduction");
    if (intensity === "hard") intensity = "moderate";
  }

  if (typeof input.tsb === "number" && input.tsb < -10) {
    guardFactor *= 0.8;
    clientTokens.push("client:load_high_forced_easy");
    intensity = "easy";
  } else if (typeof input.tsb === "number" && input.tsb < 0 && intensity === "hard") {
    intensity = "moderate";
    clientTokens.push("client:load_negative_intensity_reduced");
  }

  return { intensity, guardFactor, clientTokens };
}

// Décision côté persistance : applique les garde-fous client UNE SEULE FOIS.
// - precomputed=true (payload déjà ajusté par l'orchestrator) → on garde tel quel
//   (pas de seconde réduction du plannedLoad).
// - precomputed=false (payload legacy/externe) → on sécurise une fois.
export function resolvePlannedPersistGuardrails(input: {
  precomputed: boolean;
  intensity: PlannedGuardrailInput["intensity"];
  plannedLoad: number;
  clientGuardrailsApplied?: string[] | undefined;
  clubToday: boolean;
  clubTomorrow: boolean;
  tsb: number;
}): { intensity: PlannedGuardrailInput["intensity"]; plannedLoad: number; clientTokens: string[] } {
  if (input.precomputed) {
    return {
      intensity: input.intensity,
      plannedLoad: Math.max(1, Math.round(input.plannedLoad)),
      clientTokens: Array.isArray(input.clientGuardrailsApplied) ? input.clientGuardrailsApplied : [],
    };
  }
  const g = computePlannedClientGuardrails({
    clubToday: input.clubToday,
    clubTomorrow: input.clubTomorrow,
    tsb: input.tsb,
    intensity: input.intensity,
  });
  return {
    intensity: g.intensity,
    plannedLoad: Math.max(1, Math.round(input.plannedLoad * g.guardFactor)),
    clientTokens: g.clientTokens,
  };
}

// ─── Assemblage du doc Firestore d'une séance planifiée ─────────────────────
// Persiste le blueprint IA sous `ai` (accepte `rest.ai` puis fallback `rest.aiV2`
// que l'orchestrator envoie) + tokens propres + top-level minimal. Aucun champ
// médical. Pur → testable sans firebase.
type PlannedPayloadLike = {
  id?: string | null;
  dateISO?: string;
  phase?: unknown;
  focus?: unknown;
  exercises?: unknown;
  ai?: unknown;
  aiV2?: unknown;
  guardrailsApplied?: string[];
  title?: unknown;
  durationMin?: unknown;
  rpeTarget?: unknown;
  location?: unknown;
  badges?: unknown;
};

export function buildPlannedSessionFirestorePayload(
  rest: PlannedPayloadLike,
  resolved: { intensity: unknown; plannedLoad: number; clientTokens: string[] },
): Record<string, unknown> {
  const sessionId = rest.id ?? null;
  const out: Record<string, unknown> = {
    ...(sessionId ? { id: sessionId } : {}),
    date: rest.dateISO,
    phase: rest.phase,
    focus: rest.focus,
    intensity: resolved.intensity,
    plannedLoad: resolved.plannedLoad,
    exercises: rest.exercises,
  };

  // Blueprint IA : `ai` standard, sinon `aiV2` (clé envoyée par l'orchestrator).
  const aiPayload = rest.ai ?? rest.aiV2;
  if (aiPayload != null) out.ai = aiPayload;

  // Tokens backend propres (club:/age:/tier:…).
  if (Array.isArray(rest.guardrailsApplied) && rest.guardrailsApplied.length > 0) {
    out.guardrailsApplied = rest.guardrailsApplied;
  }
  // Tokens client stables (client:*).
  if (resolved.clientTokens.length > 0) out.clientGuardrailsApplied = resolved.clientTokens;

  // Top-level minimal (fallbacks affichage / Coach Visibility).
  if (typeof rest.title === "string" && rest.title.trim()) out.title = rest.title;
  if (typeof rest.durationMin === "number" && Number.isFinite(rest.durationMin)) out.durationMin = rest.durationMin;
  if (typeof rest.rpeTarget === "number" && Number.isFinite(rest.rpeTarget)) out.rpeTarget = rest.rpeTarget;
  if (typeof rest.location === "string" && rest.location.trim()) out.location = rest.location;
  if (Array.isArray(rest.badges) && rest.badges.length > 0) out.badges = rest.badges;

  return out;
}

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
