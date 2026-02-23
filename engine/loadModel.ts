// engine/loadModel.ts
// ===========================================================================
// FKS Load Model - Exponential Weighted Moving Average (EWMA)
// ===========================================================================
// Basé sur le modèle Banister Impulse-Response (1975)
// ATL = Acute Training Load (fatigue, répond vite)
// CTL = Chronic Training Load (fitness, répond lentement)
// TSB = Training Stress Balance = CTL - ATL
// ===========================================================================

import { TAU } from "../config/trainingDefaults";

// Constantes de temps (importées depuis config)
const ATL_TAU = TAU.ATL;  // 14 jours - fatigue décroît plus vite
const CTL_TAU = TAU.CTL;  // 28 jours - forme persiste plus longtemps

/**
 * Met à jour ATL/CTL/TSB après une charge d'entraînement.
 *
 * Formule EWMA :
 *   k = 1 - exp(-dt / τ)
 *   next = current + k × (delta - current)
 *
 * Où :
 *   - dt = nombre de jours depuis la dernière mise à jour
 *   - τ (tau) = constante de temps (14 pour ATL, 28 pour CTL)
 *   - delta = charge du jour
 *
 * @param atl - ATL actuel
 * @param ctl - CTL actuel
 * @param delta - Charge journalière à appliquer
 * @param opts.dtDays - Nombre de jours (défaut: 1)
 */
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
