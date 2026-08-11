// A1 (audit bibliothèque §E1) : plus jamais de minutes déduites d'un id métrique.
// Les nombres des ids sprints/navettes/rafales sont des mètres, des secondes ou des
// angles — la fiche ne doit afficher AUCUNE durée pour eux.
import { EXERCISE_BY_ID } from "../exerciseBank";

const duration = (id: string) => {
  const ex = EXERCISE_BY_ID[id];
  expect(ex).toBeDefined();
  return ex.defaultDurationMin;
};

describe("inferDefaultDurationMin — les 11 fiches fausses de l'audit n'affichent plus de durée", () => {
  const idsSansDuree = [
    "core_leg_lowering_90_90", // 90/90 = angles hanche/genou (affichait « 90 min »)
    "spd_maxv_30_60", // 30-60 mètres (affichait « 45 min »)
    "run_build_up_30_40m", // 30-40 mètres
    "spd_accel_10_20_30", // 10-20-30 mètres
    "speed_sled_push_light_fast_10_20m", // 10-20 mètres
    "speed_sled_push_heavy_10_20m", // 10-20 mètres
    "speed_sled_backward_drag_15_30m", // 15-30 mètres
    "cod_shuttle_10_20", // navettes 10-20 mètres
    "treadmill_maxv_10_15s", // rafales 10-15 secondes
    "rsa_row_sprints_20_40", // format travail/repos en secondes
    "rsa_bike_sprints_15_45", // format travail/repos en secondes
  ];
  it.each(idsSansDuree)("%s → pas de durée", (id) => {
    expect(duration(id)).toBeUndefined();
  });

  it("les formats séries NxYY ne produisent pas de durée non plus", () => {
    expect(duration("treadmill_engine_intervals_12x60_60")).toBeUndefined();
    expect(duration("bike_engine_intervals_10x40_20")).toBeUndefined();
  });
});

describe("inferDefaultDurationMin — le cardio continu garde ses vraies minutes", () => {
  it.each([
    ["run_engine_z2_30_40", 35],
    ["run_engine_z2_40_55", 48],
    ["run_engine_z2_progressive_30", 30],
    ["row_engine_tempo_12_20", 16],
    ["treadmill_engine_tempo_20_30", 25],
    ["bike_engine_tempo_20_30", 25],
    ["run_engine_tempo_continuous_18_25", 22],
  ])("%s → %i min", (id, minutes) => {
    expect(duration(id)).toBe(minutes);
  });

  it("les durées écrites à la main dans la banque de base restent inchangées", () => {
    expect(duration("easy_jog_20_30")).toBe(25);
    expect(duration("run_easy_20")).toBe(20);
    expect(duration("mob_hips")).toBe(10);
  });
});
