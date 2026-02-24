// engine/__tests__/loadModel.test.ts
// Tests unitaires du modèle de charge d'entraînement (EWMA Banister)
//
// Pour lancer : npm run test  (ou yarn test)
// Nécessite : npm install  (jest-expo + @types/jest dans package.json)

import { updateTrainingLoad, decayLoadOverDays } from '../loadModel';

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
