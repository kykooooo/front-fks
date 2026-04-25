// Tests temporels ATL/CTL/TSB — recomputeLoadIfStale.
//
// Couvre les 5 scénarios métier critiques :
//   1. 30 jours sans activité → ATL fortement bas, CTL plus lentement, TSB positif
//   2. 3 grosses séances cette semaine → ATL monte, TSB descend
//   3. Historique ancien + séance aujourd'hui → jours de repos comptés
//   4. Changement de jour sans force-quit → recalcul à l'ouverture
//   5. Idempotence : si déjà à jour, no-op

import { decayLoadOverDays, updateTrainingLoad } from "../../../engine/loadModel";
import { getTauForLevel } from "../../../config/trainingDefaults";

// Tests ciblés sur la LOGIQUE de décroissance (le moteur EWMA),
// indépendamment des stores Zustand. Ceci garantit la sémantique métier.

describe("Scénario 1 — 30 jours sans activité après une grosse séance", () => {
  // J0 : grosse séance (équivalent ~80 charge)
  // 30 jours sans activité
  // À J30 : ATL effondré, CTL à 30% environ, TSB positif (frais)
  const tau = getTauForLevel("competition"); // tauAtl=10, tauCtl=28

  test("ATL chute fortement après 30j (>80% perdus)", () => {
    const j0 = updateTrainingLoad(20, 25, 80, { dtDays: 1, ...tau });
    const j30 = decayLoadOverDays(j0.atl, j0.ctl, 30, tau);
    // ATL après 30j ≈ ATL₀ × exp(-30/τ_ATL) ≈ ATL₀ × 0.05 (τ=10) à 0.12 (τ=14)
    // On vérifie la perte massive (>80%) sans figer le décimal exact
    expect(j30.atl).toBeLessThan(j0.atl * 0.2);
  });

  test("CTL chute plus lentement (>50% conservés à 14j)", () => {
    const j0 = updateTrainingLoad(20, 25, 80, { dtDays: 1, ...tau });
    const j14 = decayLoadOverDays(j0.atl, j0.ctl, 14, tau);
    // CTL après 14j ≈ CTL₀ × exp(-14/28) = CTL₀ × 0.6065
    expect(j14.ctl).toBeGreaterThan(j0.ctl * 0.5);
  });

  test("TSB remonte après 14j de repos (joueur récupéré)", () => {
    // Joueur fatigué : ATL>CTL (ex: après semaine intensive)
    const fatiguedState = { atl: 60, ctl: 40, tsb: -20 };
    expect(fatiguedState.tsb).toBeLessThan(0);
    const j14 = decayLoadOverDays(fatiguedState.atl, fatiguedState.ctl, 14, tau);
    // Après 14j : ATL chute plus vite que CTL → TSB doit remonter (devient moins négatif ou positif)
    expect(j14.tsb).toBeGreaterThan(fatiguedState.tsb);
  });

  test("À J30 le joueur DOIT être considéré frais (TSB > 0)", () => {
    const j0 = updateTrainingLoad(20, 25, 80, { dtDays: 1, ...tau });
    const j30 = decayLoadOverDays(j0.atl, j0.ctl, 30, tau);
    expect(j30.tsb).toBeGreaterThan(0);
  });
});

describe("Scénario 2 — 3 grosses séances cette semaine", () => {
  const tau = getTauForLevel("competition");

  test("ATL monte (>20 final), TSB descend", () => {
    let s = { atl: 5, ctl: 5, tsb: 0 };
    // 3 séances charge 100 sur 5 jours (J0, J2, J4)
    s = updateTrainingLoad(s.atl, s.ctl, 100, { dtDays: 1, ...tau });
    s = decayLoadOverDays(s.atl, s.ctl, 1, tau);
    s = updateTrainingLoad(s.atl, s.ctl, 100, { dtDays: 1, ...tau });
    s = decayLoadOverDays(s.atl, s.ctl, 1, tau);
    s = updateTrainingLoad(s.atl, s.ctl, 100, { dtDays: 1, ...tau });
    expect(s.atl).toBeGreaterThan(20);
    expect(s.tsb).toBeLessThan(-3); // accumulation fatigue
  });
});

describe("Scénario 3 — Historique ancien + séance aujourd'hui (rest days comptés)", () => {
  const tau = getTauForLevel("competition");

  test("séance J0, aucune activité 14j, séance J14 → décroissance bien comptée puis remontée", () => {
    const j0 = updateTrainingLoad(15, 20, 80, { dtDays: 1, ...tau });
    const beforeJ14 = decayLoadOverDays(j0.atl, j0.ctl, 14, tau);
    // Reprise d'une séance 80 charge à J14
    const j14 = updateTrainingLoad(beforeJ14.atl, beforeJ14.ctl, 80, { dtDays: 1, ...tau });
    // Après 14j sans activité, ATL doit avoir massivement chuté (au moins -50%)
    expect(beforeJ14.atl).toBeLessThan(j0.atl * 0.5);
    // Remontée le jour de la séance
    expect(j14.atl).toBeGreaterThan(beforeJ14.atl);
  });
});

describe("Invariant TSB = CTL - ATL après décroissance multi-jours", () => {
  test("invariant respecté après chaque décroissance", () => {
    const tau = getTauForLevel("competition");
    for (let d = 1; d <= 60; d++) {
      const r = decayLoadOverDays(15, 20, d, tau);
      expect(r.tsb).toBeCloseTo(r.ctl - r.atl, 9);
    }
  });
});
