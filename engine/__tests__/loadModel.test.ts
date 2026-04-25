// engine/__tests__/loadModel.test.ts
// Tests unitaires du modèle de charge d'entraînement (EWMA Banister)
//
// Pour lancer : npm run test  (ou yarn test)
// Nécessite : npm install  (jest-expo + @types/jest dans package.json)

import { updateTrainingLoad, decayLoadOverDays } from '../loadModel';
import { getTauForLevel, TAU_BY_LEVEL } from '../../config/trainingDefaults';

describe('updateTrainingLoad', () => {
  test('1. Charge zéro = décroissance pure (ATL et CTL baissent vers 0)', () => {
    const { atl, ctl } = updateTrainingLoad(20, 15, 0, { dtDays: 1 });
    expect(atl).toBeLessThan(20);
    expect(ctl).toBeLessThan(15);
    expect(atl).toBeGreaterThan(0);
    expect(ctl).toBeGreaterThan(0);
  });

  test('2. Charge positive supérieure aux valeurs actuelles = ATL et CTL montent', () => {
    const { atl, ctl } = updateTrainingLoad(10, 10, 100, { dtDays: 1 });
    expect(atl).toBeGreaterThan(10);
    expect(ctl).toBeGreaterThan(10);
  });

  test('3. TSB = CTL - ATL (invariant fondamental)', () => {
    const { atl, ctl, tsb } = updateTrainingLoad(12, 15, 50, { dtDays: 1 });
    expect(tsb).toBeCloseTo(ctl - atl, 10);
  });

  test('4. dtDays=7 décroît plus vite que dtDays=1 (sans charge)', () => {
    const one = updateTrainingLoad(20, 20, 0, { dtDays: 1 });
    const seven = updateTrainingLoad(20, 20, 0, { dtDays: 7 });
    expect(seven.atl).toBeLessThan(one.atl);
    expect(seven.ctl).toBeLessThan(one.ctl);
  });

  test('5. Les résultats sont des nombres finis (pas NaN, pas Infinity)', () => {
    const { atl, ctl, tsb } = updateTrainingLoad(15, 15, 80);
    expect(Number.isFinite(atl)).toBe(true);
    expect(Number.isFinite(ctl)).toBe(true);
    expect(Number.isFinite(tsb)).toBe(true);
  });
});

describe('decayLoadOverDays', () => {
  test('6. 0 jours = aucun changement (idempotent)', () => {
    const { atl, ctl, tsb } = decayLoadOverDays(20, 15, 0);
    expect(atl).toBe(20);
    expect(ctl).toBe(15);
    expect(tsb).toBe(-5); // 15 - 20
  });

  test('7. 90 jours de repos (inter-saison) = valeurs quasi nulles (< 5)', () => {
    // ATL tau=14j → 50 * exp(-90/14) ≈ 0.07  ✓
    // CTL tau=28j → 50 * exp(-90/28) ≈ 2.04  ✓
    const { atl, ctl } = decayLoadOverDays(50, 50, 90);
    expect(atl).toBeLessThan(5);
    expect(ctl).toBeLessThan(5);
  });
});

// ─── Tau dynamiques ────────────────────────────────────────────────

describe('getTauForLevel', () => {
  test('Mapping niveau → tau correct', () => {
    expect(getTauForLevel("Amateur")).toEqual(TAU_BY_LEVEL.debutant);
    expect(getTauForLevel("Regional")).toEqual(TAU_BY_LEVEL.debutant);
    expect(getTauForLevel("National")).toEqual(TAU_BY_LEVEL.intermediaire);
    expect(getTauForLevel("Semi-pro")).toEqual(TAU_BY_LEVEL.confirme);
    expect(getTauForLevel("Pro")).toEqual(TAU_BY_LEVEL.confirme);
  });

  test('Fallback sur intermediaire si niveau inconnu ou null', () => {
    expect(getTauForLevel(null)).toEqual(TAU_BY_LEVEL.intermediaire);
    expect(getTauForLevel(undefined)).toEqual(TAU_BY_LEVEL.intermediaire);
    expect(getTauForLevel("blabla")).toEqual(TAU_BY_LEVEL.intermediaire);
    expect(getTauForLevel("")).toEqual(TAU_BY_LEVEL.intermediaire);
  });
});

describe('Tau dynamiques — decay', () => {
  // TSB -25 : ATL=45, CTL=20
  const ATL_START = 45;
  const CTL_START = 20;

  test('Débutant (tau 7/21) récupère plus vite que confirmé (tau 14/35) après 7 jours', () => {
    const deb = decayLoadOverDays(ATL_START, CTL_START, 7, TAU_BY_LEVEL.debutant);
    const conf = decayLoadOverDays(ATL_START, CTL_START, 7, TAU_BY_LEVEL.confirme);
    // Débutant : ATL decay plus → TSB remonte plus
    expect(deb.tsb).toBeGreaterThan(conf.tsb);
    // Débutant devrait être positif ou quasi (~frais)
    expect(deb.tsb).toBeGreaterThan(-5);
    // Confirmé encore négatif
    expect(conf.tsb).toBeLessThan(0);
  });

  test('Débutant à TSB -25 revient à "En forme" (TSB > -5) en ~7 jours de repos', () => {
    const deb = decayLoadOverDays(ATL_START, CTL_START, 7, TAU_BY_LEVEL.debutant);
    expect(deb.tsb).toBeGreaterThan(-5);
  });

  test('Confirmé à TSB -25 est encore négatif après 7 jours de repos', () => {
    const conf = decayLoadOverDays(ATL_START, CTL_START, 7, TAU_BY_LEVEL.confirme);
    expect(conf.tsb).toBeLessThan(-5);
  });
});

describe('Tau dynamiques — update', () => {
  test('Débutant (tau 7) : ATL monte plus vite que confirmé (tau 14) avec même charge', () => {
    const deb = updateTrainingLoad(12, 15, 155, { dtDays: 1, ...TAU_BY_LEVEL.debutant });
    const conf = updateTrainingLoad(12, 15, 155, { dtDays: 1, ...TAU_BY_LEVEL.confirme });
    // Débutant absorbe plus de fatigue (k plus grand)
    expect(deb.atl).toBeGreaterThan(conf.atl);
  });

  test('Débutant 3 séances/semaine ne descend pas en dessous de TSB -25', () => {
    const { tauAtl, tauCtl } = TAU_BY_LEVEL.debutant;
    let atl = 12, ctl = 15;
    // 3 séances en 7 jours (jours 0, 2, 4), load ~155 chacune
    for (const gap of [0, 2, 2]) {
      if (gap > 0) {
        const dec = decayLoadOverDays(atl, ctl, gap, { tauAtl, tauCtl });
        atl = dec.atl;
        ctl = dec.ctl;
      }
      const next = updateTrainingLoad(atl, ctl, 155, { dtDays: 1, tauAtl, tauCtl });
      atl = next.atl;
      ctl = next.ctl;
    }
    const tsb = ctl - atl;
    expect(tsb).toBeGreaterThan(-25);
    expect(tsb).toBeLessThan(0); // Fatigué mais pas cramé
  });

  test('Sans tau passé → fallback 14/28 (backward compat)', () => {
    const withFallback = updateTrainingLoad(12, 15, 100, { dtDays: 1 });
    const withExplicit = updateTrainingLoad(12, 15, 100, { dtDays: 1, tauAtl: 14, tauCtl: 28 });
    expect(withFallback.atl).toBeCloseTo(withExplicit.atl, 10);
    expect(withFallback.ctl).toBeCloseTo(withExplicit.ctl, 10);
  });
});
