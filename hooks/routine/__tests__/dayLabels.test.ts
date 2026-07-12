// hooks/routine/__tests__/dayLabels.test.ts
//
// Revue web post-É1.5 : couvre les deux fixes centraux -
// (1) explainDay ne décrit plus jamais un jour passé comme "à faire" (fait
//     vs neutre, jamais un jugement), et
// (2) buildWeekSummary("current" vs "next") - la même fonction alimente le
//     Home et l'écran combiné, ce qui élimine le texte contradictoire trouvé
//     en revue ("Aucune séance" ici / "1 séance : jeudi" là-bas).
import { computeWeekPlan, WeekPlanInputs } from "../../../domain/weekPlanning";
import { applyWeekPlanMoves } from "../weekPlanOverrides";
import { explainDay, buildWeekSummary } from "../dayLabels";
import type { WeekDay } from "../useWeekPlan";

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
function weekDays(opts: { isPast?: (dow: string) => boolean; isDone?: (dow: string) => boolean } = {}): WeekDay[] {
  const plan = computeWeekPlan(base({}));
  const merged = applyWeekPlanMoves(plan, []);
  return merged.map((d) => ({
    ...d,
    isPast: opts.isPast?.(d.dow) ?? false,
    isDone: opts.isDone?.(d.dow) ?? false,
  }));
}

describe("explainDay — jours passés (point 2 revue web)", () => {
  test("jour passé avec séance placée mais PAS complétée -> neutre/estompé, jamais 'à faire'", () => {
    const days = weekDays({ isPast: (dow) => dow === "thu" });
    const thu = days.find((d) => d.dow === "thu")!;
    expect(thu.placement).toBe("full"); // le plan auto y prescrivait une séance
    const explanation = explainDay(thu);
    expect(explanation.state).toBe("rest_available");
    expect(explanation.title).toBe("Repos");
    expect(explanation.detail).not.toMatch(/prévue|complète/i);
  });

  test("jour passé avec séance complétée -> 'Fait', jamais 'Séance' comme si c'était à venir", () => {
    const days = weekDays({ isPast: (dow) => dow === "thu", isDone: (dow) => dow === "thu" });
    const thu = days.find((d) => d.dow === "thu")!;
    const explanation = explainDay(thu);
    expect(explanation.state).toBe("done");
    expect(explanation.title).toBe("Fait");
  });

  test("jour FUTUR avec séance placée -> comportement inchangé (pas neutralisé)", () => {
    const days = weekDays({ isPast: () => false });
    const thu = days.find((d) => d.dow === "thu")!;
    const explanation = explainDay(thu);
    expect(explanation.state).toBe("full");
    expect(explanation.title).toBe("Séance");
  });

  test("match/club restent match/club même passés (jamais 'neutralisés')", () => {
    const days = weekDays({ isPast: () => true });
    const mon = days.find((d) => d.dow === "mon")!; // club
    const sun = days.find((d) => d.dow === "sun")!; // match
    expect(explainDay(mon).state).toBe("club");
    expect(explainDay(sun).state).toBe("match");
  });
});

describe("buildWeekSummary — scope current/next (point 1 revue web)", () => {
  test("scope 'current' décrit le texte habituel ('cette semaine')", () => {
    const text = buildWeekSummary(
      { target: 2, placedCount: 1, placedDows: ["thu"] as any, warnings: [] },
      "current"
    );
    expect(text).toBe("1 séance cette semaine : jeudi.");
  });

  test("scope 'next' décrit la semaine prochaine avec le même jour, jamais 'cette semaine'", () => {
    const text = buildWeekSummary(
      { target: 2, placedCount: 1, placedDows: ["thu"] as any, warnings: [] },
      "next"
    );
    expect(text).toBe("Semaine prochaine : 1 séance prévue jeudi.");
  });

  test("scope 'next' pluriel", () => {
    const text = buildWeekSummary(
      { target: 2, placedCount: 2, placedDows: ["tue", "thu"] as any, warnings: [] },
      "next"
    );
    expect(text).toBe("Semaine prochaine : 2 séances prévues mardi et jeudi.");
  });

  test("no_active_cycle identique quel que soit le scope (jamais de 'semaine prochaine' trompeur)", () => {
    const plan = { target: 0, placedCount: 0, placedDows: [] as any, warnings: ["plan:no_active_cycle"] };
    expect(buildWeekSummary(plan, "current")).toBe(buildWeekSummary(plan, "next"));
  });
});
