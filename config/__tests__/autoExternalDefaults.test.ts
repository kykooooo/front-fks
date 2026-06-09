// config/__tests__/autoExternalDefaults.test.ts
// P1 — Honnêteté charge calendrier U15 : l'auto-charge club/match doit utiliser
// un preset JEUNE (plus léger) pour U13/U15, et rester INCHANGÉE pour les autres.
// Pur (aucune dépendance store/firebase).

import {
  autoExternalDefaultsFor,
  AUTO_EXTERNAL_DEFAULTS,
} from "../trainingDefaults";

describe("autoExternalDefaultsFor — preset auto-charge par âge", () => {
  test("U15 → preset jeune (match plus léger que 90 min / RPE 8)", () => {
    const d = autoExternalDefaultsFor("U15");
    expect(d).toEqual(AUTO_EXTERNAL_DEFAULTS.youth);
    expect(d.match.durationMin).toBeLessThan(90);
    expect(d.match.rpe).toBeLessThan(8);
    // honnêteté : reste une vraie charge, pas zéro
    expect(d.match.durationMin).toBeGreaterThan(0);
    expect(d.match.rpe).toBeGreaterThan(0);
  });

  test("U13 → preset jeune", () => {
    expect(autoExternalDefaultsFor("U13")).toEqual(AUTO_EXTERNAL_DEFAULTS.youth);
  });

  test("Senior → preset adulte INCHANGÉ (90 min / RPE 8, club 75 / RPE 6)", () => {
    const d = autoExternalDefaultsFor("Senior");
    expect(d).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
    expect(d.match).toEqual({ rpe: 8, durationMin: 90 });
    expect(d.club).toEqual({ rpe: 6, durationMin: 75 });
  });

  test("U17 / U18 → proche senior (preset adulte)", () => {
    expect(autoExternalDefaultsFor("U17")).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
    expect(autoExternalDefaultsFor("U18")).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
  });

  test("âge absent / inconnu → fallback adulte stable", () => {
    expect(autoExternalDefaultsFor(null)).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
    expect(autoExternalDefaultsFor(undefined)).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
    expect(autoExternalDefaultsFor("")).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
    expect(autoExternalDefaultsFor("U99")).toEqual(AUTO_EXTERNAL_DEFAULTS.adult);
  });

  test("le preset jeune réduit nettement la charge match (≈ moitié)", () => {
    const adult = AUTO_EXTERNAL_DEFAULTS.adult.match;
    const youth = AUTO_EXTERNAL_DEFAULTS.youth.match;
    const adultLoad = adult.rpe * adult.durationMin; // 720
    const youthLoad = youth.rpe * youth.durationMin; // 360
    expect(youthLoad).toBeLessThan(adultLoad * 0.6);
    expect(youthLoad).toBeGreaterThan(0);
  });
});
