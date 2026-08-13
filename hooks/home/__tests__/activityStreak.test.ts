// hooks/home/__tests__/activityStreak.test.ts
// H3 — la série ne compte que l'activité CONFIRMÉE : les charges auto-injectées
// (id "auto_*", cases club/match du setup) ne gonflent plus la série ; une
// charge saisie à la main compte toujours, quelle que soit sa source.
import { subDays } from "date-fns";
import { computeActivityStreak } from "../useActivityStreak";
import { toDateKey } from "../../../utils/dateHelpers";
import type { Session } from "../../../domain/types";
import type { ExternalLoad } from "../../../state/stores/types";

const NOW = "2026-08-13T12:00:00";
// Clés locales calculées avec les mêmes helpers que le hook (TZ-safe).
const key = (daysAgo: number) => toDateKey(subDays(new Date(NOW), daysAgo));

const autoLoad = (dayKey: string, source: "club" | "match" = "club"): ExternalLoad => ({
  id: `auto_${source}_${dayKey}`,
  source,
  dateISO: dayKey,
  rpe: 7,
  durationMin: 90,
  notes: "Auto (profil club/match)",
});

// genId() réel = `${Date.now().toString(36)}-${random6}` — jamais préfixé "auto_".
const manualLoad = (dayKey: string, source: ExternalLoad["source"] = "other"): ExternalLoad => ({
  id: "m3ab12-x7k9q2",
  source,
  dateISO: dayKey,
  rpe: 6,
  durationMin: 60,
});

const completedSession = (dayKey: string): Session =>
  ({
    id: `s_${dayKey}`,
    dateISO: `${dayKey}T18:30:00.000Z`,
    date: dayKey,
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: true,
  } as unknown as Session);

describe("computeActivityStreak — H3", () => {
  test("(a) 5 jours de charges auto seules → série 0 (plus de « Série 5 j » fabriquée)", () => {
    const externals = [
      autoLoad(key(0)),
      autoLoad(key(1), "match"),
      autoLoad(key(2)),
      autoLoad(key(3)),
      autoLoad(key(4), "match"),
    ];
    expect(computeActivityStreak([], externals, NOW)).toBe(0);
  });

  test("(b) mêmes jours auto + 1 séance terminée aujourd'hui → série 1", () => {
    const externals = [
      autoLoad(key(0)),
      autoLoad(key(1), "match"),
      autoLoad(key(2)),
      autoLoad(key(3)),
      autoLoad(key(4), "match"),
    ];
    expect(computeActivityStreak([completedSession(key(0))], externals, NOW)).toBe(1);
  });

  test("(c) externe MANUELLE hier + séance aujourd'hui → série 2 (la saisie main compte, même source club)", () => {
    expect(
      computeActivityStreak([completedSession(key(0))], [manualLoad(key(1), "club")], NOW)
    ).toBe(2);
  });

  test("(d) jour de grâce préservé : activité hier, rien aujourd'hui → série 1", () => {
    expect(computeActivityStreak([completedSession(key(1))], [], NOW)).toBe(1);
  });

  test("(e) mix revue adversariale : 2 séances (J0, J-1) + 1 manuelle (J-2) + 3 autos (J-3..J-5) → série 3 exactement (l'ancien code disait 6)", () => {
    const sessions = [completedSession(key(0)), completedSession(key(1))];
    const externals = [
      manualLoad(key(2), "club"),
      autoLoad(key(3)),
      autoLoad(key(4), "match"),
      autoLoad(key(5)),
    ];
    expect(computeActivityStreak(sessions, externals, NOW)).toBe(3);
  });

  test("séance non terminée ne compte pas (comportement historique conservé)", () => {
    const s = { ...completedSession(key(0)), completed: false } as Session;
    expect(computeActivityStreak([s], [], NOW)).toBe(0);
  });
});
