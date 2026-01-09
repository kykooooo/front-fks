// engine/loadModel.ts

// Tuned pour un public amateur/semi-pro : fatigue moins brusque, forme plus réactive
const ATL_TAU = 14;  // montée fatigue plus progressive
const CTL_TAU = 28;  // forme réagit un peu plus vite pour réduire les plongées TSB

export function updateTrainingLoad(
  atl: number,
  ctl: number,
  delta: number,
  opts?: { dtDays?: number }
) {
  const dt = Math.max(1, Math.floor(opts?.dtDays ?? 1));
  const kATL = 1 - Math.exp(-dt / ATL_TAU);
  const kCTL = 1 - Math.exp(-dt / CTL_TAU);

  const nextATL = atl + kATL * (delta - atl);
  const nextCTL = ctl + kCTL * (delta - ctl);
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}

export function decayLoadOverDays(atl: number, ctl: number, days: number) {
  const d = Math.max(0, Math.floor(days));
  if (d === 0) return { atl, ctl, tsb: ctl - atl };

  const decayATL = Math.exp(-d / ATL_TAU);
  const decayCTL = Math.exp(-d / CTL_TAU);

  const nextATL = atl * decayATL;
  const nextCTL = ctl * decayCTL;
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}
