// domain/tracking/__tests__/modes.test.ts
import { DEFAULT_TRACKING_MODES, resolveTrackingModes } from "../modes";

describe("resolveTrackingModes", () => {
  it("retourne les defauts quand aucun userDoc n'est fourni", () => {
    expect(resolveTrackingModes()).toEqual(DEFAULT_TRACKING_MODES);
    expect(resolveTrackingModes(undefined)).toEqual(DEFAULT_TRACKING_MODES);
    expect(resolveTrackingModes(null)).toEqual(DEFAULT_TRACKING_MODES);
  });

  it("retourne les defauts quand trackingConfig est absent", () => {
    expect(resolveTrackingModes({})).toEqual(DEFAULT_TRACKING_MODES);
  });

  it("retourne les defauts quand trackingConfig est mal type (pas un objet)", () => {
    expect(resolveTrackingModes({ trackingConfig: "oops" })).toEqual(DEFAULT_TRACKING_MODES);
    expect(resolveTrackingModes({ trackingConfig: 42 })).toEqual(DEFAULT_TRACKING_MODES);
    expect(resolveTrackingModes({ trackingConfig: null })).toEqual(DEFAULT_TRACKING_MODES);
  });

  it("retourne les defauts quand les champs internes sont mal types (non booleens)", () => {
    const result = resolveTrackingModes({
      trackingConfig: { collect: "yes", shadow: 1, apply: "true" },
    });
    expect(result).toEqual(DEFAULT_TRACKING_MODES);
  });

  it("applique les overrides booleens fournis", () => {
    const result = resolveTrackingModes({ trackingConfig: { collect: false } });
    expect(result).toEqual({ collect: false, shadow: true, apply: false });
  });

  it("garde-fou : apply=true est refuse si collect=false", () => {
    const result = resolveTrackingModes({
      trackingConfig: { collect: false, shadow: true, apply: true },
    });
    expect(result.apply).toBe(false);
  });

  it("garde-fou : apply=true est refuse si shadow=false", () => {
    const result = resolveTrackingModes({
      trackingConfig: { collect: true, shadow: false, apply: true },
    });
    expect(result.apply).toBe(false);
  });

  it("autorise apply=true seulement si collect ET shadow sont true", () => {
    const result = resolveTrackingModes({
      trackingConfig: { collect: true, shadow: true, apply: true },
    });
    expect(result).toEqual({ collect: true, shadow: true, apply: true });
  });
});
