import type { Session, Modality, SessionFeedback } from '../domain/types';
import { DEFAULT_MODALITY_WEIGHTS } from '../domain/types';

/** YYYY-MM-DD depuis une ISO string */
export function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Nombre de jours entre deux dayKeys (YYYY-MM-DD) */
export function diffDays(fromDayKey: string, toDayKeyStr: string): number {
  const a = new Date(fromDayKey + 'T00:00:00Z').getTime();
  const b = new Date(toDayKeyStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Durée estimée (minutes) d'une séance */
function estimateDurationMin(session: Session): number {
  if (typeof session.durationMin === 'number' && isFinite(session.durationMin)) {
    return Math.max(0, session.durationMin);
  }
  const sec = session.exercises.reduce((acc, e) => acc + (e.durationSec ?? 0), 0);
  if (sec > 0) return sec / 60;
  return 30; // fallback minimaliste
}

/** Modalité dominante d'une séance */
function dominantModality(session: Session): Modality | undefined {
  if (session.modality) return session.modality;
  if (!session.exercises.length) return undefined;

  const buckets = new Map<Modality, number>();
  for (const e of session.exercises) {
    const add = (e.durationSec ?? 0) / 60 || 1;
    buckets.set(e.modality, (buckets.get(e.modality) ?? 0) + add);
  }
  let best: Modality | undefined;
  let bestVal = -1;
  for (const [mod, val] of buckets) {
    if (val > bestVal) {
      bestVal = val;
      best = mod;
    }
  }
  return best;
}

/** RPE utilisé pour la charge (feedback prioritaire) */
function sessionRPE(session: Session): number {
  const f: SessionFeedback | undefined = session.feedback;
  if (f && typeof f.rpe === 'number') return f.rpe;
  if (typeof session.rpe === 'number') return session.rpe;
  return 5; // neutre
}

/** Poids modalité */
function modalityWeight(mod: Modality | undefined): number {
  if (!mod) return 1.0;
  return DEFAULT_MODALITY_WEIGHTS[mod] ?? 1.0;
}

/** Ajustement multiplicatif de la charge selon le feedback (fatigue, sommeil, douleurs) */
function feedbackMultiplier(f?: SessionFeedback): number {
  if (!f) return 1.0;

  let m = 1.0;

  // Fatigue : élevée -> charge perçue plus forte
  if (f.fatigue >= 4) m *= 1.15;
  else if (f.fatigue <= 2) m *= 0.9;

  // Sommeil : faible -> charge plus lourde
  if (f.sleep <= 2) m *= 1.1;
  else if (f.sleep >= 4) m *= 0.95;

  // Douleurs : amplifie la charge perçue
  if (f.pain >= 4) m *= 1.25;
  else if (f.pain === 3) m *= 1.1;
  else if (f.pain <= 2) m *= 0.95;

  // bornes globales
  return Math.min(Math.max(m, 0.8), 1.4);
}

/**
 * Calcule une map { dayKey: dailyLoad } avec pondération par feedback.
 * sRPE pondéré = (RPE × durée × poids modalité) × feedbackMultiplier
 */
export function sumDailyWeightedLoad(sessions: Session[]): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.completed) continue;

    const dayKey = toDayKey(s.dateISO);
    const dur = estimateDurationMin(s);
    const rpe = sessionRPE(s);
    const w = modalityWeight(dominantModality(s));
    const feedback = s.feedback;

    const baseLoad = rpe * dur * w;
    const adjusted = baseLoad * feedbackMultiplier(feedback);

    daily[dayKey] = (daily[dayKey] ?? 0) + adjusted;
  }
  return daily;
}

/**
 * Garde-fous de charge journalière.
 */
export function clampDailyLoad(x: number, cap: number = 190): number {
  const k = Math.max(60, cap);    // garde-fou
  const adjustedX = Math.max(0, x);
  return k * Math.tanh(adjustedX / k);    // soft-cap
}
