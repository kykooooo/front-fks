// hooks/home/__tests__/realLoadData.test.ts
// H1 — prédicat unique "données réelles de charge" : séances terminées +
// charges externes MANUELLES comptent ; les charges auto-injectées ("auto_*")
// et les séances non terminées ne comptent pas.
import {
  countRealActivityDays,
  isAutoExternalLoad,
  POINTS_MIN_POUR_COURBE,
} from "../useRealLoadData";

const autoLoad = (dayKey: string, source: "club" | "match" = "club") => ({
  id: `auto_${source}_${dayKey}`,
  source,
  dateISO: dayKey,
  rpe: 7,
  durationMin: 90,
  notes: "Auto (profil club/match)",
});

// genId() réel = `${Date.now().toString(36)}-${random6}` — ne commence jamais par "auto_".
const manualLoad = (dayKey: string, source: "club" | "match" | "other" = "other") => ({
  id: "m3ab12-x7k9q2",
  source,
  dateISO: dayKey,
  rpe: 6,
  durationMin: 60,
});

const completedSession = (dayKey: string) => ({
  id: `s_${dayKey}`,
  completed: true,
  dateISO: `${dayKey}T18:30:00.000Z`,
  date: dayKey,
});

describe("isAutoExternalLoad", () => {
  test("id préfixé auto_ → true ; id manuel (genId) → false ; id absent → false", () => {
    expect(isAutoExternalLoad(autoLoad("2026-08-11"))).toBe(true);
    expect(isAutoExternalLoad(autoLoad("2026-08-15", "match"))).toBe(true);
    expect(isAutoExternalLoad(manualLoad("2026-08-11"))).toBe(false);
    expect(isAutoExternalLoad({})).toBe(false);
    expect(isAutoExternalLoad(null)).toBe(false);
    expect(isAutoExternalLoad(undefined)).toBe(false);
  });

  test("une saisie manuelle club/match reste manuelle (source non discriminante)", () => {
    expect(isAutoExternalLoad(manualLoad("2026-08-11", "club"))).toBe(false);
    expect(isAutoExternalLoad(manualLoad("2026-08-11", "match"))).toBe(false);
  });
});

describe("countRealActivityDays — H1", () => {
  test("vide → 0 (donc hasRealLoadData=false)", () => {
    expect(countRealActivityDays([], [])).toBe(0);
    expect(countRealActivityDays(null, undefined)).toBe(0);
  });

  test("charges auto_ seules (cases club/match cochées, 0 action) → 0", () => {
    const externals = [
      autoLoad("2026-08-09"),
      autoLoad("2026-08-11"),
      autoLoad("2026-08-15", "match"),
    ];
    expect(countRealActivityDays([], externals)).toBe(0);
  });

  test("séance non terminée seule → 0 ; 1 séance terminée → 1", () => {
    expect(
      countRealActivityDays([{ ...completedSession("2026-08-12"), completed: false }], [])
    ).toBe(0);
    expect(countRealActivityDays([completedSession("2026-08-12")], [])).toBe(1);
  });

  test("charge externe manuelle → compte, même noyée dans des autos", () => {
    const externals = [autoLoad("2026-08-09"), manualLoad("2026-08-10"), autoLoad("2026-08-11")];
    expect(countRealActivityDays([], externals)).toBe(1);
  });

  test("dédup par jour : séance + externe manuelle le même jour → 1 seul jour", () => {
    const day = "2026-08-12";
    expect(countRealActivityDays([completedSession(day)], [manualLoad(day)])).toBe(1);
    // Deux jours distincts → 2
    expect(
      countRealActivityDays([completedSession("2026-08-11")], [manualLoad("2026-08-12")])
    ).toBe(2);
  });
});

describe("POINTS_MIN_POUR_COURBE — H2", () => {
  test("seuil d'affichage gelé à 3 (valeur validée du prototype VNext)", () => {
    expect(POINTS_MIN_POUR_COURBE).toBe(3);
  });
});
