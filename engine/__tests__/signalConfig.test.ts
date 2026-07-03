// engine/__tests__/signalConfig.test.ts
import {
  isSignalCompatibleExercise,
  resolveSignalEngineConfig,
  validateSignalConfig,
} from "../signal/signalConfig";

describe("validateSignalConfig", () => {
  const valid = {
    mode: "voice_direction" as const,
    cues: ["gauche", "droite"],
    minDelayMs: 2000,
    maxDelayMs: 5000,
  };

  it("accepte un config voix valide", () => {
    const r = validateSignalConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cues).toEqual(["gauche", "droite"]);
  });

  it("rejette un signalConfig absent", () => {
    expect(validateSignalConfig(null)).toEqual({ ok: false, code: "missing_signal_config" });
    expect(validateSignalConfig(undefined)).toEqual({ ok: false, code: "missing_signal_config" });
  });

  it("rejette le mode color_gate (pas de couleurs en V1)", () => {
    expect(validateSignalConfig({ ...valid, mode: "color_gate" })).toEqual({
      ok: false,
      code: "unsupported_mode",
    });
  });

  it("rejette des consignes non supportées", () => {
    expect(validateSignalConfig({ ...valid, cues: ["haut", "bas"] })).toEqual({
      ok: false,
      code: "unsupported_cues",
    });
    expect(validateSignalConfig({ ...valid, cues: [] })).toEqual({
      ok: false,
      code: "unsupported_cues",
    });
  });

  it("rejette des délais incohérents ou sous le plancher", () => {
    expect(validateSignalConfig({ ...valid, minDelayMs: 100 }).ok).toBe(false);
    expect(validateSignalConfig({ ...valid, minDelayMs: 6000, maxDelayMs: 5000 }).ok).toBe(false);
  });
});

describe("isSignalCompatibleExercise", () => {
  it("reconnaît les 3 situations V1", () => {
    expect(isSignalCompatibleExercise("fks_backpedal_signal_sprint")).toBe(true);
    expect(isSignalCompatibleExercise("fks_late_gate_choice")).toBe(true);
    expect(isSignalCompatibleExercise("fks_jockey_turn_sprint")).toBe(true);
  });
  it("rejette un exercice non compatible ou vide", () => {
    expect(isSignalCompatibleExercise("str_back_squat")).toBe(false);
    expect(isSignalCompatibleExercise(null)).toBe(false);
    expect(isSignalCompatibleExercise(undefined)).toBe(false);
  });
});

describe("resolveSignalEngineConfig", () => {
  it("mappe les délais validés + défauts moteur", () => {
    const v = validateSignalConfig({
      mode: "voice_direction",
      cues: ["gauche", "droite"],
      minDelayMs: 2000,
      maxDelayMs: 5000,
    });
    if (!v.ok) throw new Error("expected valid");
    const cfg = resolveSignalEngineConfig(v, { repetitions: 5 });
    expect(cfg.repetitions).toBe(5);
    expect(cfg.minDelayMs).toBe(2000);
    expect(cfg.maxDelayMs).toBe(5000);
    expect(cfg.cues).toEqual(["gauche", "droite"]);
    expect(cfg.maxConsecutiveSame).toBe(2);
    expect(cfg.repetitions).toBeGreaterThanOrEqual(1);
  });
});
