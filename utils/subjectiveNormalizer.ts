import { FEEDBACK_NORM as N } from '../config/feedbackNormalization';

type Scalar = number; // 1..5 pour fatigue, douleur, récup

export type NormedFeedback = {
  fatigue: Scalar, pain?: Scalar, recoveryPerceived?: Scalar,
  fatigueEMA: Scalar, painEMA?: Scalar, recoveryEMA?: Scalar,
  reliability: number,          // r ∈ [0..1]
  adjustedRPE: number           // 1..10
};

// Helpers robustes
const clamp = (x:number, a:number, b:number)=> Math.max(a, Math.min(b, x));
const median = (arr:number[]) => {
  const a = [...arr].sort((x,y)=>x-y); const m = Math.floor(a.length/2);
  return a.length ? (a.length%2?a[m]:(a[m-1]+a[m])/2) : 0;
};
const mad = (arr:number[], m:number) => median(arr.map(x=>Math.abs(x-m))) || 1;

export function robustNormalize(x:number, history:number[]): number {
  if (!history.length) return x;
  const m = median(history); const d = mad(history, m);
  const z = clamp((x - m) / (1.4826*d), -N.zClip, N.zClip);
  // Remap: m±zClip*1.4826*d → borne 1..5
  const z01 = (z + N.zClip) / (2*N.zClip); // 0..1
  return clamp(1 + 4*z01, 1, 5);
}

export function ema(prev:number|undefined, x:number, alpha:number): number {
  return prev == null ? x : (alpha*x + (1-alpha)*prev);
}

export function rpeAdaptiveAdjust(rawRPE:number, fatigue:number, recovery:number, pain:number|undefined): number {
  // heuristique simple: tendance = (fatigue - recovery) + bonus douleur
  const trend = (fatigue - recovery) + (pain && pain>=3 ? 0.5 : 0);
  const k = clamp(1 + 0.1*trend, N.rpeAdjustMin, N.rpeAdjustMax);
  return clamp(rawRPE * k, 1, 10);
}

export function computeReliability(
  fatigue:number, recovery:number, pain:number|undefined,
  prevFatigue:number|undefined, prevRecovery:number|undefined
): number {
  // concordance fatigue↑ & récup↓ (+ douleur) => r monte
  let r = 0.6;
  if (fatigue>=4 && recovery<=2) r += 0.2;
  if ((pain??0) >= 2) r += 0.1;
  if (prevFatigue!=null && prevRecovery!=null) {
    const cf = fatigue - prevFatigue;
    const cr = prevRecovery - recovery;
    if (cf>0 && cr>0) r += 0.1; // tendance cohérente
  }
  return clamp(r, N.rMin, N.rMax);
}

// Mix adaptatif de l'effet: 1 + r*(combined-1)
export function mixByReliability(combined:number, r:number): number {
  return 1 + r*(combined - 1);
}

// Entrée: valeurs “brutes” 1..5 et RPE 1..10
export function normalizeFeedback(
  raw: { fatigue:number, recoveryPerceived?:number, pain?:number, rpe:number },
  history: { fatigue:number[], recovery:number[], pain:number[] },
  prevEMA: { fatigue?:number, recovery?:number, pain?:number }
): NormedFeedback {
  const fN = robustNormalize(raw.fatigue, history.fatigue);
  const rN = robustNormalize(raw.recoveryPerceived ?? 3, history.recovery);
  const pN = raw.pain!=null ? robustNormalize(raw.pain, history.pain) : undefined;

  const fEMA = ema(prevEMA.fatigue, fN, N.emaAlpha);
  const rEMA = ema(prevEMA.recovery, rN, N.emaAlpha);
  const pEMA = pN!=null ? ema(prevEMA.pain, pN, N.emaAlpha) : undefined;

  const r = computeReliability(fEMA, rEMA, pEMA, prevEMA.fatigue, prevEMA.recovery);
  const adjRPE = rpeAdaptiveAdjust(raw.rpe, fEMA, rEMA, pEMA);

  return {
    fatigue: fN, pain: pN, recoveryPerceived: rN,
    fatigueEMA: fEMA, painEMA: pEMA, recoveryEMA: rEMA,
    reliability: r, adjustedRPE: adjRPE
  };
}
