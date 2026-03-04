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
import { safeNum } from "./safeNum";

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
  const safeAtl = safeNum(atl, 0, "updateTrainingLoad.atl");
  const safeCtl = safeNum(ctl, 0, "updateTrainingLoad.ctl");
  const safeDelta = safeNum(delta, 0, "updateTrainingLoad.delta");
  const dt = Math.max(1, Math.floor(safeNum(opts?.dtDays, 1, "updateTrainingLoad.dtDays")));
  const kATL = 1 - Math.exp(-dt / ATL_TAU);
  const kCTL = 1 - Math.exp(-dt / CTL_TAU);

  const nextATL = safeAtl + kATL * (safeDelta - safeAtl);
  const nextCTL = safeCtl + kCTL * (safeDelta - safeCtl);
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}

export function decayLoadOverDays(atl: number, ctl: number, days: number) {
  const safeAtl = safeNum(atl, 0, "decayLoad.atl");
  const safeCtl = safeNum(ctl, 0, "decayLoad.ctl");
  const d = Math.max(0, Math.floor(safeNum(days, 0, "decayLoad.days")));
  if (d === 0) return { atl: safeAtl, ctl: safeCtl, tsb: safeCtl - safeAtl };

  const decayATL = Math.exp(-d / ATL_TAU);
  const decayCTL = Math.exp(-d / CTL_TAU);

  const nextATL = safeAtl * decayATL;
  const nextCTL = safeCtl * decayCTL;
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}
