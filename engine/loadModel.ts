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

// Fallback (legacy) — utilisé uniquement si aucun tau n'est passé
const DEFAULT_TAU_ATL = TAU.ATL;  // 14
const DEFAULT_TAU_CTL = TAU.CTL;  // 28

/**
 * Met à jour ATL/CTL/TSB après une charge d'entraînement.
 *
 * Formule EWMA :
 *   k = 1 - exp(-dt / τ)
 *   next = current + k × (delta - current)
 *
 * @param atl - ATL actuel
 * @param ctl - CTL actuel
 * @param delta - Charge journalière à appliquer
 * @param opts.dtDays - Nombre de jours (défaut: 1)
 * @param opts.tauAtl - Constante tau ATL (défaut: 14)
 * @param opts.tauCtl - Constante tau CTL (défaut: 28)
 */
export function updateTrainingLoad(
  atl: number,
  ctl: number,
  delta: number,
  opts?: { dtDays?: number; tauAtl?: number; tauCtl?: number }
) {
  const safeAtl = safeNum(atl, 0, "updateTrainingLoad.atl");
  const safeCtl = safeNum(ctl, 0, "updateTrainingLoad.ctl");
  const safeDelta = safeNum(delta, 0, "updateTrainingLoad.delta");
  const dt = Math.max(1, Math.floor(safeNum(opts?.dtDays, 1, "updateTrainingLoad.dtDays")));
  const tauAtl = opts?.tauAtl ?? DEFAULT_TAU_ATL;
  const tauCtl = opts?.tauCtl ?? DEFAULT_TAU_CTL;
  const kATL = 1 - Math.exp(-dt / tauAtl);
  const kCTL = 1 - Math.exp(-dt / tauCtl);

  const nextATL = safeAtl + kATL * (safeDelta - safeAtl);
  const nextCTL = safeCtl + kCTL * (safeDelta - safeCtl);
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}

/**
 * Décroissance exponentielle pure sur N jours de repos.
 *
 * @param opts.tauAtl - Constante tau ATL (défaut: 14)
 * @param opts.tauCtl - Constante tau CTL (défaut: 28)
 */
export function decayLoadOverDays(
  atl: number,
  ctl: number,
  days: number,
  opts?: { tauAtl?: number; tauCtl?: number }
) {
  const safeAtl = safeNum(atl, 0, "decayLoad.atl");
  const safeCtl = safeNum(ctl, 0, "decayLoad.ctl");
  const d = Math.max(0, Math.floor(safeNum(days, 0, "decayLoad.days")));
  if (d === 0) return { atl: safeAtl, ctl: safeCtl, tsb: safeCtl - safeAtl };

  const tauAtl = opts?.tauAtl ?? DEFAULT_TAU_ATL;
  const tauCtl = opts?.tauCtl ?? DEFAULT_TAU_CTL;
  const decayATL = Math.exp(-d / tauAtl);
  const decayCTL = Math.exp(-d / tauCtl);

  const nextATL = safeAtl * decayATL;
  const nextCTL = safeCtl * decayCTL;
  const tsb = nextCTL - nextATL;
  return { atl: nextATL, ctl: nextCTL, tsb };
}
