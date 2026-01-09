// utils/feedbackFactor.ts
import { EMA_CONFIG, FACTOR_BOUNDS, FEEDBACK_LIMITS, PAIN_THRESHOLDS } from '../constants/feedback';
import { AdaptiveFactors } from '../domain/types';
import { ema } from './ema';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Calcule les facteurs adaptatifs bornés à partir du feedback du jour.
 * - fatigue (1..5) : léger +/-8% max après EMA
 * - pain (0..5)    : -0..5% à partir de 3+
 * Retourne aussi la fatigue lissée (debug).
 */
export function computeAdaptiveFactors(params: {
  fatigue: number;
  pain?: number;
  prevFatigueSmoothed?: number | null;
}): AdaptiveFactors {
  const fatigueRaw = clamp(params.fatigue, FEEDBACK_LIMITS.fatigueMin, FEEDBACK_LIMITS.fatigueMax);
  const pain = params.pain == null ? undefined : clamp(params.pain, FEEDBACK_LIMITS.painMin, FEEDBACK_LIMITS.painMax);

  // 1) Lissage fatigue
  const fatigueSmoothed = ema(fatigueRaw, params.prevFatigueSmoothed ?? null, EMA_CONFIG.alpha, EMA_CONFIG.seed);

  // 2) Mapper fatigue lissée -> facteur [0.92..1.08]
  //    Interpolation linéaire autour du pivot 3 (neutre).
  //    1 -> minFactor, 3 -> 1.0, 5 -> maxFactor.
  const pivot = 3;
  const rangeLow = FEEDBACK_LIMITS.fatigueMin;  // 1
  const rangeHigh = FEEDBACK_LIMITS.fatigueMax; // 5
  let fatigueFactor = 1.0;
  if (fatigueSmoothed <= pivot) {
    const t = (fatigueSmoothed - pivot) / (rangeLow - pivot); // 3..1 => 0..1
    fatigueFactor = 1.0 + t * (FACTOR_BOUNDS.fatigueMinFactor - 1.0); // vers 0.92
  } else {
    const t = (fatigueSmoothed - pivot) / (rangeHigh - pivot); // 3..5 => 0..1
    fatigueFactor = 1.0 + t * (FACTOR_BOUNDS.fatigueMaxFactor - 1.0); // vers 1.08
  }
  // Sécurité clamp
  fatigueFactor = clamp(fatigueFactor, FACTOR_BOUNDS.fatigueMinFactor, FACTOR_BOUNDS.fatigueMaxFactor);

  // 3) Pain -> petite réduction dès 3+
  let painFactor = FACTOR_BOUNDS.painNeutral;
  if (typeof pain === 'number' && pain >= PAIN_THRESHOLDS.smallEffectFrom) {
    // Map 3..5 -> 0..maxReduction
    const t = (pain - PAIN_THRESHOLDS.smallEffectFrom) / (FEEDBACK_LIMITS.painMax - PAIN_THRESHOLDS.smallEffectFrom); // 0..1
    const reduction = clamp(t * PAIN_THRESHOLDS.maxReduction, 0, PAIN_THRESHOLDS.maxReduction);
    painFactor = 1.0 - reduction;
  }

  const combined = +(fatigueFactor * painFactor).toFixed(4);

  return {
    fatigueFactor: +fatigueFactor.toFixed(4),
    painFactor: +painFactor.toFixed(4),
    combined,
    fatigueSmoothed: +fatigueSmoothed.toFixed(3),
  };
}

