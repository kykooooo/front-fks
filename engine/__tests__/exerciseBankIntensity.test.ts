// A2 (audit bibliothèque §E2) : l'intensité se déduit de segments d'id entiers,
// plus jamais de sous-chaînes (« hi » matchait « hip » et « machine ») ; le travail
// à vitesse maximale (maxv) est haute intensité avec une description honnête.
import { EXERCISE_BY_ID } from "../exerciseBank";

const ex = (id: string) => {
  const e = EXERCISE_BY_ID[id];
  expect(e).toBeDefined();
  return e;
};

// NB : depuis le branchement du catalogue V2 (B2), les noms/descriptions de ces ids
// viennent des fiches V2 — les assertions portent sur la PROPRIÉTÉ (« plus jamais
// présenté comme une course modérée »), pas sur une chaîne exacte.
describe("vitesse maximale : haute intensité + description honnête", () => {
  it("spd_maxv_30_60 n'est plus une « course modérée »", () => {
    const e = ex("spd_maxv_30_60");
    expect(e.intensity).toBe("high");
    expect(e.description).toMatch(/sprint|vitesse max/i);
    expect(e.description).not.toMatch(/modérée/i);
    expect(e.name).not.toBe("Maxv 30 60");
  });

  it("treadmill_maxv_10_15s n'est plus une « course modérée »", () => {
    const e = ex("treadmill_maxv_10_15s");
    expect(e.intensity).toBe("high");
    expect(e.description).toMatch(/vitesse (max|élevée)/i);
    expect(e.description).not.toMatch(/modérée/i);
    expect(e.name).not.toBe("Tapis Maxv 10 15s");
  });

  it("spd_a_run est décrit comme un drill technique, pas comme une course modérée", () => {
    const e = ex("spd_a_run");
    expect(e.description).toMatch(/technique/i);
    expect(e.description).not.toMatch(/modérée/i);
    expect(e.name).not.toBe("A Run");
  });
});

describe("« hi » ne matche plus hip/machine : fin des « Intense » à tort", () => {
  it.each(["str_hip_thrust", "str_leg_extension_machine", "str_hip_abductor_machine", "str_hip_adductor_machine"])(
    "%s est modéré",
    (id) => {
      expect(ex(id).intensity).toBe("moderate");
    }
  );

  it("str_leg_extension_machine n'a plus la description « Renforcement intense »", () => {
    expect(ex("str_leg_extension_machine").description).not.toMatch(/intense/i);
  });
});

describe("bonus découverts en corrigeant (cités au rapport)", () => {
  it("« hold » ne matche plus « threshold » : le seuil n'est plus étiqueté faible", () => {
    expect(ex("run_engine_threshold_2x10").intensity).toBe("moderate");
  });
  it("la VMA longue est haute intensité, comme sa propre description l'affirme", () => {
    expect(ex("vma_long").intensity).toBe("high");
    expect(ex("vma_long_1000").intensity).toBe("high");
  });
});

describe("non-régression sur les inférences correctes", () => {
  it.each([
    ["rsa_sprint_10m_repeat", "high"],
    ["treadmill_accel_8_12s", "high"],
    ["spd_flying20", "high"],
    ["core_deadbug_iso_hold", "low"],
    ["str_calf_raise_iso_hold", "low"],
    ["generic_breathing_nasal", "low"],
    ["run_engine_tempo_cruise_3x8", "moderate"],
  ])("%s reste %s", (id, intensity) => {
    expect(ex(id).intensity).toBe(intensity);
  });

  it("speed_high_knees est un drill : modéré (plus « Intense » via la sous-chaîne hi)", () => {
    expect(ex("speed_high_knees").intensity).toBe("moderate");
  });
});
