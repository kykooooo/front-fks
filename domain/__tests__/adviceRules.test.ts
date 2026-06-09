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
