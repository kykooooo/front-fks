// screens/feedback/__tests__/feedbackScales.test.ts
//
// Verrou anti-regression pour `buildSessionFeedback` : le SessionFeedback
// construit ici est ce qui atterrit dans `session.feedback` (via applyFeedback),
// puis dans le payload backend `recent_fks_sessions[].feedback.recovery_perceived`
// (services/aiContextHelpers.ts). Avant ce chantier, `useFeedbackSave.ts`
// n'ecrivait que `sleep` (legacy 1-5) et jamais `recoveryPerceived` -> le champ
// backend `recovery_perceived` etait mort silencieusement, cf.
// INDIVIDUALISATION_FINE_DESIGN.md §1.3.

import { buildSessionFeedback, clamp } from "../feedbackScales";
import { FEEDBACK_LIMITS } from "../../../constants/feedback";

describe("buildSessionFeedback", () => {
  test("ecrit recoveryPerceived en plus du champ legacy sleep (verrou anti-regression)", () => {
    const fb = buildSessionFeedback({ rpe: 7, fatigue: 3, pain0to5: 2, recovery: 4 });
    expect(fb.recoveryPerceived).toBe(4);
    expect(fb.sleep).toBe(4); // meme echelle 1-5, les deux doivent etre coherents
  });

  test("recoveryPerceived est clampe a [recoveryMin, recoveryMax]", () => {
    const tropHaut = buildSessionFeedback({ rpe: 5, fatigue: 3, pain0to5: 0, recovery: 8 });
    expect(tropHaut.recoveryPerceived).toBe(FEEDBACK_LIMITS.recoveryMax);
    const tropBas = buildSessionFeedback({ rpe: 5, fatigue: 3, pain0to5: 0, recovery: 0 });
    expect(tropBas.recoveryPerceived).toBe(FEEDBACK_LIMITS.recoveryMin);
  });

  test("rpe/fatigue/pain sont arrondis + clampes sur leurs echelles respectives", () => {
    const fb = buildSessionFeedback({ rpe: 11, fatigue: 0, pain0to5: 7, recovery: 3 });
    expect(fb.rpe).toBe(10);
    expect(fb.fatigue).toBe(1);
    expect(fb.pain).toBe(5);
  });

  test("durationMin present seulement si fourni (jamais 0 ou undefined invente)", () => {
    const withDuration = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3, durationClamped: 45 });
    expect(withDuration.durationMin).toBe(45);
    const withoutDuration = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3 });
    expect(withoutDuration.durationMin).toBeUndefined();
  });

  test("createdAt est un ISO valide", () => {
    const fb = buildSessionFeedback({ rpe: 6, fatigue: 3, pain0to5: 0, recovery: 3 });
    expect(Number.isNaN(new Date(fb.createdAt).getTime())).toBe(false);
  });
});

describe("clamp", () => {
  test("borne dans [min, max]", () => {
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(3, 0, 5)).toBe(3);
  });
});
