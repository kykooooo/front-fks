// hooks/home/__tests__/adviceGating.test.ts
// H1 — gating des conseils : sans données réelles de charge, aucune règle
// affirmant un état mesuré (TSB fabriqué) ni reprochant l'absence de données
// (no_mobility) ne doit sortir. Les règles calendrier (faits déclarés)
// continuent de se déclencher.
import {
  evaluateAdviceRules,
  REGLES_EXIGEANT_DONNEES_REELLES,
} from "../useContextualAdvice";
import type { AdviceContext } from "../../../domain/adviceRules";

// Contexte d'un compte NEUF : TSB +3 fabriqué par les constantes d'amorçage
// (CTL0=15, ATL0=12), aucun calendrier déclaré, jamais de mobilité (null).
const ctxCompteNeuf = (over: Partial<AdviceContext> = {}): AdviceContext => ({
  tsb: 3,
  atl: 12,
  ctl: 15,
  matchDays: [],
  clubTrainingDays: [],
  daysUntilMatch: null,
  isMatchToday: false,
  isPostMatch: false,
  isClubToday: false,
  microcycleGoal: null,
  microcycleSessionIndex: 0,
  cycleRemaining: 12,
  daysSinceLastMobility: null,
  routineStreak: 0,
  hasActiveInjury: false,
  nowISO: "2026-08-13",
  ...over,
});

describe("evaluateAdviceRules — compte neuf sans données réelles (H1)", () => {
  test("sans le filtre, le premier conseil serait le reproche no_mobility (le mensonge)", () => {
    const advice = evaluateAdviceRules(ctxCompteNeuf(), true);
    expect(advice?.id).toBe("no_mobility");
  });

  test("avec le filtre, aucune règle gated ne sort : advice = null (la carte Conseil disparaît)", () => {
    expect(evaluateAdviceRules(ctxCompteNeuf(), false)).toBeNull();
  });

  test("aucun TSB fabriqué ne produit de conseil d'état sans données (frais comme surchargé)", () => {
    for (const tsb of [-30, -13, -10, 0, 3, 10]) {
      const advice = evaluateAdviceRules(ctxCompteNeuf({ tsb }), false);
      if (advice) {
        expect(REGLES_EXIGEANT_DONNEES_REELLES).not.toContain(advice.id);
      } else {
        expect(advice).toBeNull();
      }
    }
  });

  test("les règles calendrier (faits déclarés) se déclenchent toujours sans données réelles", () => {
    const advice = evaluateAdviceRules(
      ctxCompteNeuf({ isMatchToday: true, matchDays: ["sat"], daysUntilMatch: 0 }),
      false
    );
    expect(advice?.id).toBe("match_today");
  });
});

describe("evaluateAdviceRules — avec données réelles (comportement inchangé)", () => {
  test("tsb >= 0 et mobilité récente → good_shape sort", () => {
    const advice = evaluateAdviceRules(
      ctxCompteNeuf({ tsb: 2, daysSinceLastMobility: 1 }),
      true
    );
    expect(advice?.id).toBe("good_shape");
  });

  test("fallback ready_default disponible dès qu'il y a des données", () => {
    const advice = evaluateAdviceRules(
      ctxCompteNeuf({ tsb: -2, daysSinceLastMobility: 1 }),
      true
    );
    expect(advice?.id).toBe("ready_default");
  });
});
