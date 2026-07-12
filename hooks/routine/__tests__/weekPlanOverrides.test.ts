// hooks/routine/__tests__/weekPlanOverrides.test.ts
import { computeWeekPlan, WeekPlanInputs } from "../../../domain/weekPlanning";
import { applyWeekPlanMoves } from "../weekPlanOverrides";

const base = (overrides: Partial<WeekPlanInputs>): WeekPlanInputs => ({
  ageCategory: "Senior",
  clubTrainingDays: ["mon", "wed", "fri"],
  matchDays: ["sun"],
  targetFksSessionsPerWeek: undefined,
  microcycleGoal: "fondation",
  weekStart: "mon",
  ...overrides,
});

// Profil "Senior 3 club (lun/mer/ven) + 1 match (dim)" — plan auto = [mar (modérée), jeu (pleine)].
const plan = () => computeWeekPlan(base({}));

describe("applyWeekPlanMoves", () => {
  test("sans déplacement, le plan est retourné tel quel (movedFrom/movedTo null)", () => {
    const days = applyWeekPlanMoves(plan(), []);
    for (const d of days) {
      expect(d.movedFrom).toBeNull();
      expect(d.movedTo).toBeNull();
    }
    expect(days.find((d) => d.dow === "tue")?.placement).toBe("moderate");
    expect(days.find((d) => d.dow === "thu")?.placement).toBe("full");
  });

  test("déplacement valide : l'origine redevient repos, la cible porte la séance", () => {
    const days = applyWeekPlanMoves(plan(), [{ from: "thu", to: "sat" }]);
    const thu = days.find((d) => d.dow === "thu")!;
    const sat = days.find((d) => d.dow === "sat")!;
    expect(thu.placement).toBeNull();
    expect(thu.movedTo).toBe("sat");
    expect(sat.placement).toBe("full"); // reprend le placement d'origine de jeudi
    expect(sat.movedFrom).toBe("thu");
    expect(sat.reasons).toContain("plan:p8_moved_here");
  });

  test("déplacement dont l'origine n'a pas de prescription auto -> ignoré (défensif)", () => {
    // "mon" est un jour club (pas de prescription) dans le plan auto.
    const days = applyWeekPlanMoves(plan(), [{ from: "mon", to: "sat" }]);
    for (const d of days) {
      expect(d.movedFrom).toBeNull();
      expect(d.movedTo).toBeNull();
    }
  });

  test("deux déplacements simultanés (mar et jeu vers deux jours différents)", () => {
    const days = applyWeekPlanMoves(plan(), [
      { from: "tue", to: "sat" },
      { from: "thu", to: "sun" }, // cible invalide en pratique (jour de match) mais la fusion ne juge pas — evaluateManualMove l'aurait refusé en amont
    ]);
    const tue = days.find((d) => d.dow === "tue")!;
    const sat = days.find((d) => d.dow === "sat")!;
    const thu = days.find((d) => d.dow === "thu")!;
    const sun = days.find((d) => d.dow === "sun")!;
    expect(tue.movedTo).toBe("sat");
    expect(sat.movedFrom).toBe("tue");
    expect(sat.placement).toBe("moderate");
    expect(thu.movedTo).toBe("sun");
    expect(sun.movedFrom).toBe("thu");
  });
});
