// domain/__tests__/adviceRules.test.ts
// Garde-fou wording U15-safe : aucun terme interdit ne doit apparaître dans les
// textes VISIBLES (conseils Home + labels d'état). Le test échoue si un terme
// interdit réapparaît (ex. réintroduction de "cramé", "blessure", "les pros"…).

import { ADVICE_RULES, type AdviceContext } from "../adviceRules";
import { FOOTBALL_LABELS } from "../../config/trainingDefaults";

const FORBIDDEN =
  /cram[ée]|cuit|surentra[iî]nement|risque|blessure|se blesser|protection|prot[èe]ge|m[ée]dical|les pros|3 matchs|pas te blesser/i;

const baseCtx = (over: Partial<AdviceContext> = {}): AdviceContext => ({
  tsb: -15,
  atl: 20,
  ctl: 10,
  matchDays: ["sat"],
  clubTrainingDays: ["tue", "thu"],
  daysUntilMatch: 1,
  isMatchToday: true,
  isPostMatch: true,
  isClubToday: true,
  microcycleGoal: "force",
  microcycleSessionIndex: 10,
  cycleRemaining: 2,
  daysSinceLastMobility: 6,
  routineStreak: 6,
  hasActiveInjury: true,
  injuryArea: "genou",
  nowISO: "2026-06-08",
  ...over,
});

const stringsOf = (a: { title: string; message: string; tip?: string; actionLabel?: string }) =>
  [a.title, a.message, a.tip ?? "", a.actionLabel ?? ""];

describe("adviceRules — wording U15-safe (garde-fou)", () => {
  // Plusieurs contextes pour couvrir les branches dépendantes du TSB.
  const contexts = [baseCtx({ tsb: -25 }), baseCtx({ tsb: -2 }), baseCtx({ tsb: 8 })];

  test("aucun terme interdit dans les conseils (title/message/tip/actionLabel)", () => {
    for (const rule of ADVICE_RULES) {
      for (const ctx of contexts) {
        const advice = rule.build(ctx);
        for (const s of stringsOf(advice)) {
          expect(s).not.toMatch(FORBIDDEN);
        }
      }
    }
  });

  test("aucun terme interdit dans FOOTBALL_LABELS (label/message)", () => {
    for (const key of Object.keys(FOOTBALL_LABELS)) {
      const f = FOOTBALL_LABELS[key];
      expect(f.label).not.toMatch(FORBIDDEN);
      expect(f.message).not.toMatch(FORBIDDEN);
    }
  });

  test("le label d'état chargé reste sobre et non anxiogène", () => {
    expect(FOOTBALL_LABELS.OVERTRAINED.label).toBe("Journée légère");
    expect(FOOTBALL_LABELS.OVERREACHING.label).toBe("À alléger");
    expect(FOOTBALL_LABELS.LOADED.label).toBe("Un peu chargé");
  });
});

// Sélection de règle : première règle (par priorité) dont la condition matche.
const pickAdvice = (ctx: AdviceContext) => {
  const sorted = [...ADVICE_RULES].sort((a, b) => a.priority - b.priority);
  const rule = sorted.find((r) => r.condition(ctx));
  return rule ? rule.build(ctx) : null;
};

describe("adviceRules — no_mobility (daysSinceLastMobility null)", () => {
  test("null → message sans nombre ni 'null'", () => {
    const rule = ADVICE_RULES.find((r) => r.id === "no_mobility")!;
    const ctx = baseCtx({ daysSinceLastMobility: null });
    expect(rule.condition(ctx)).toBe(true);
    const advice = rule.build(ctx);
    expect(advice.message).not.toMatch(/null|undefined|\d/);
    expect(advice.message).toBe("Jamais fait de mobilité ? Tes articulations te remercieront.");
  });

  test("nombre → message avec le nombre de jours", () => {
    const rule = ADVICE_RULES.find((r) => r.id === "no_mobility")!;
    const advice = rule.build(baseCtx({ daysSinceLastMobility: 6 }));
    expect(advice.message).toContain("6 jours sans mobilité");
  });
});

describe("adviceRules — cohérence seuils TSB avec le CTA récup (<= -15)", () => {
  // Contexte neutre : seules les règles TSB peuvent matcher.
  const quietCtx = (tsb: number) =>
    baseCtx({
      tsb,
      daysUntilMatch: null,
      isMatchToday: false,
      isPostMatch: false,
      isClubToday: false,
      hasActiveInjury: false,
      microcycleGoal: null,
      cycleRemaining: 5,
      daysSinceLastMobility: 1,
      routineStreak: 0,
    });

  test("TSB <= -15 → conseil récup (pas 'Tu peux t'entraîner')", () => {
    for (const tsb of [-15, -16, -20, -30]) {
      const advice = pickAdvice(quietCtx(tsb));
      expect(advice?.id).toBe("tsb_extreme_fatigue");
      expect(advice?.message).not.toMatch(/tu peux t'entra[iî]ner/i);
    }
  });

  test("-15 < TSB <= -12 → fatigue modérée (entraînement possible)", () => {
    for (const tsb of [-14, -12.5]) {
      const advice = pickAdvice(quietCtx(tsb));
      expect(advice?.id).toBe("tsb_fatigue");
    }
  });
});
