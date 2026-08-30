// hooks/home/__tests__/needsCycleChoice.test.ts
// H5 — le CTA ne doit jamais dire « Préparer ma séance » quand presser ouvre
// en réalité CycleModal : computeNeedsCycleChoice duplique le calcul de
// onPressNew (usePrimaryCta) ; ce test fige la logique pour prévenir toute
// divergence texte/navigation.
import { computeNeedsCycleChoice } from "../usePrimaryCta";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../../domain/microcycles";

describe("computeNeedsCycleChoice — H5", () => {
  test("aucun cycle actif (null) → true (la vraie cible est CycleModal)", () => {
    expect(computeNeedsCycleChoice(null, 0)).toBe(true);
    expect(computeNeedsCycleChoice(null, undefined)).toBe(true);
  });

  test("cycle actif en cours (« force » + 0) → false (la vraie cible est la génération)", () => {
    expect(computeNeedsCycleChoice("force", 0)).toBe(false);
    expect(computeNeedsCycleChoice("force", MICROCYCLE_TOTAL_SESSIONS_DEFAULT - 1)).toBe(false);
  });

  test("cycle terminé (« force » + 12) → true (retour au choix de cycle)", () => {
    expect(computeNeedsCycleChoice("force", MICROCYCLE_TOTAL_SESSIONS_DEFAULT)).toBe(true);
    expect(computeNeedsCycleChoice("force", MICROCYCLE_TOTAL_SESSIONS_DEFAULT + 3)).toBe(true);
  });

  test("valeur non-cycle (legacy/corrompue) → true (même garde que onPressNew)", () => {
    expect(computeNeedsCycleChoice("coach", 0)).toBe(true);
    expect(computeNeedsCycleChoice("", 0)).toBe(true);
  });

  test("index négatif ou non entier normalisé comme onPressNew (trunc + plancher 0)", () => {
    expect(computeNeedsCycleChoice("force", -3)).toBe(false);
    expect(computeNeedsCycleChoice("force", 11.9)).toBe(false);
  });
});
