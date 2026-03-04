import type { Session, Modality, SessionFeedback } from '../domain/types';
import { DEFAULT_MODALITY_WEIGHTS } from '../domain/types';
import { toDateKey } from '../utils/dateHelpers';
import { safeNum } from './safeNum';

/** Nombre de jours entre deux dayKeys (YYYY-MM-DD) */
export function diffDays(fromDayKey: string, toDayKeyStr: string): number {
  const a = new Date(fromDayKey + 'T00:00:00Z').getTime();
  const b = new Date(toDayKeyStr + 'T00:00:00Z').getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : 0;
}

/** Durée estimée (minutes) d'une séance */
function estimateDurationMin(session: Session): number {
  if (typeof session.durationMin === 'number' && Number.isFinite(session.durationMin)) {
    return Math.max(0, session.durationMin);
  }
  const sec = session.exercises.reduce(
    (acc, e) => acc + safeNum(e.durationSec, 0, "estimateDuration.durationSec"),
    0,
  );
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
  if (f && typeof f.rpe === 'number' && Number.isFinite(f.rpe)) return f.rpe;
  if (typeof session.rpe === 'number' && Number.isFinite(session.rpe)) return session.rpe;
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
  const fatigue = safeNum(f.fatigue, 3, "feedbackMultiplier.fatigue");
  const sleep = safeNum(f.sleep, 3, "feedbackMultiplier.sleep");
  const pain = safeNum(f.pain, 0, "feedbackMultiplier.pain");

  // Fatigue : élevée -> charge perçue plus forte
  if (fatigue >= 4) m *= 1.15;
  else if (fatigue <= 2) m *= 0.9;

  // Sommeil : faible -> charge plus lourde
  if (sleep <= 2) m *= 1.1;
  else if (sleep >= 4) m *= 0.95;

  // Douleurs : amplifie la charge perçue
  if (pain >= 4) m *= 1.25;
  else if (pain === 3) m *= 1.1;
  else if (pain <= 2) m *= 0.95;

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

    const dayKey = toDateKey(s.dateISO);
    const dur = estimateDurationMin(s);
    const rpe = sessionRPE(s);
    const w = modalityWeight(dominantModality(s));
    const feedback = s.feedback;

    const baseLoad = safeNum(rpe, 5, "sumDailyWeightedLoad.rpe") * safeNum(dur, 30, "sumDailyWeightedLoad.dur") * safeNum(w, 1, "sumDailyWeightedLoad.weight");
    const adjusted = baseLoad * feedbackMultiplier(feedback);

    daily[dayKey] = (daily[dayKey] ?? 0) + (Number.isFinite(adjusted) ? adjusted : 0);
  }
  return daily;
}

/**
 * Garde-fous de charge journalière.
 */
export function clampDailyLoad(x: number, cap: number = 190): number {
  const safeX = safeNum(x, 0, "clampDailyLoad.x");
  const safeCap = safeNum(cap, 190, "clampDailyLoad.cap");
  const k = Math.max(60, safeCap);    // garde-fou
  const adjustedX = Math.max(0, safeX);
  return k * Math.tanh(adjustedX / k);    // soft-cap
}
