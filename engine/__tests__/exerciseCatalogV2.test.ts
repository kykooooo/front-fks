// engine/__tests__/exerciseCatalogV2.test.ts
// Plomberie catalogue V2 côté front (logique pure, sans rendu) :
// - type guard CatalogExerciseView
// - sélection banque visible (flag OFF / catalogue vide → V1 conservée)
// - filtre solo par défaut
// - résolution des aliases historiques + ID inconnu
import {
  HISTORICAL_EXERCISE_ALIASES,
  isCatalogExerciseView,
  resolveCatalogId,
  selectVisibleBank,
  type CatalogExercise,
} from "../exerciseCatalogV2";
import type { ExerciseDef } from "../exerciseBank";

const legacy: ExerciseDef = {
  id: "str_back_squat",
  name: "Back squat",
  description: "desc",
  modality: "strength",
  intensity: "moderate",
  tags: [],
};

const mkCatalog = (id: string, soloEligible: boolean): CatalogExercise =>
  ({
    id,
    name: id,
    description: "d",
    modality: "strength",
    intensity: "moderate",
    primaryQuality: "lower",
    secondaryQualities: [],
    movementPatterns: [],
    dosage: { mode: "reps", defaults: {}, limits: {} },
    progression: { regressions: [], progressions: [], alternatives: [] },
    participation: { soloEligible, minPlayers: soloEligible ? 1 : 4, requiresCoach: !soloEligible },
  } as unknown as CatalogExercise);

describe("isCatalogExerciseView", () => {
  it("distingue une fiche V1 legacy d'une vue catalogue V2", () => {
    expect(isCatalogExerciseView(legacy)).toBe(false);
    const view = { ...legacy, catalog: mkCatalog("x", true) };
    expect(isCatalogExerciseView(view)).toBe(true);
  });
});

describe("selectVisibleBank — V1 préservée", () => {
  it("garde la banque V1 (même référence) quand le flag est OFF", () => {
    const bank = [legacy];
    const result = selectVisibleBank(false, [mkCatalog("a", true)], bank);
    expect(result).toBe(bank);
  });

  it("garde la banque V1 quand le catalogue est vide (jamais de biblio vide)", () => {
    const result = selectVisibleBank(true, [], [legacy]);
    expect(result).toEqual([legacy]);
  });

  it("bascule sur le catalogue V2 et exclut le non-solo par défaut", () => {
    const result = selectVisibleBank(
      true,
      [mkCatalog("solo", true), mkCatalog("group", false)],
      [legacy]
    );
    expect(result.map((e) => e.id)).toEqual(["solo"]);
  });
});

describe("resolveCatalogId — aliases historiques & ID inconnu", () => {
  it("résout les renommages historiques décidés", () => {
    // Décision Laurent : cod_505 (5-0-5) → cod_5_0_5 ; cod_5_10_5 reste distinct.
    expect(resolveCatalogId("cod_505", HISTORICAL_EXERCISE_ALIASES)).toBe("cod_5_0_5");
    expect(resolveCatalogId("cod_t_drill", HISTORICAL_EXERCISE_ALIASES)).toBe("cod_t_test");
    expect(resolveCatalogId("spd_a_march", HISTORICAL_EXERCISE_ALIASES)).toBe("speed_a_march");
    expect(resolveCatalogId("sprint_accel_20m", HISTORICAL_EXERCISE_ALIASES)).toBe(
      "sprint_acceleration"
    );
    expect(resolveCatalogId("run_intervals_8x200", HISTORICAL_EXERCISE_ALIASES)).toBe(
      "run_intervals"
    );
  });

  it("migre les décisions du lot 7 protocoles/tests (04/07/2026)", () => {
    // Le nombre de répétitions sort des IDs canoniques.
    expect(resolveCatalogId("bike_intervals", HISTORICAL_EXERCISE_ALIASES)).toBe("bike_intervals_40_20");
    expect(resolveCatalogId("bike_engine_intervals_10x40_20", HISTORICAL_EXERCISE_ALIASES)).toBe("bike_intervals_40_20");
    expect(resolveCatalogId("rower_intervals", HISTORICAL_EXERCISE_ALIASES)).toBe("row_intervals_500m");
    expect(resolveCatalogId("row_engine_intervals_6x500", HISTORICAL_EXERCISE_ALIASES)).toBe("row_intervals_500m");
    // Doublon 1000 m fusionné.
    expect(resolveCatalogId("vma_long_1000", HISTORICAL_EXERCISE_ALIASES)).toBe("run_intervals_1000m");
    expect(resolveCatalogId("run_engine_intervals_4x1000", HISTORICAL_EXERCISE_ALIASES)).toBe("run_intervals_1000m");
    expect(resolveCatalogId("run_engine_intervals_6x400", HISTORICAL_EXERCISE_ALIASES)).toBe("run_intervals_400m");
    expect(resolveCatalogId("run_engine_intervals_8x300", HISTORICAL_EXERCISE_ALIASES)).toBe("run_intervals_300m");
    expect(resolveCatalogId("run_engine_tempo_cruise_3x8", HISTORICAL_EXERCISE_ALIASES)).toBe("run_tempo_cruise_8min");
    expect(resolveCatalogId("run_engine_tempo_cruise_4x5", HISTORICAL_EXERCISE_ALIASES)).toBe("run_tempo_cruise_5min");
    expect(resolveCatalogId("run_engine_threshold_2x10", HISTORICAL_EXERCISE_ALIASES)).toBe("run_threshold_10min");
    expect(resolveCatalogId("treadmill_engine_intervals_12x60_60", HISTORICAL_EXERCISE_ALIASES)).toBe("treadmill_intervals_60_60");
    // rsa_runs_* → presets complets de run_intervals.
    for (const legacy of ["rsa_runs_10_20_2x10", "rsa_runs_15_15_2x10", "rsa_runs_20_20_2x8", "rsa_runs_30_30_2x6"]) {
      expect(resolveCatalogId(legacy, HISTORICAL_EXERCISE_ALIASES)).toBe("run_intervals");
    }
    // Distinctions préservées : IDs sans reps qui restent canoniques.
    for (const id of ["vma_long", "vma_short", "rsa_bike_sprints_15_45", "rsa_row_sprints_20_40", "rsa_sprint_20m_repeat", "rsa_sprint_walkback_20m", "tempo_20_30", "run_engine_tempo_continuous_18_25"]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
  });

  it("résout la fusion plyo finale (box jump à hauteur paramétrable)", () => {
    // Décision finale : box basse fusionnée dans le canonique plyo_box_jump.
    expect(resolveCatalogId("plyo_box_jump_low", HISTORICAL_EXERCISE_ALIASES)).toBe("plyo_box_jump");
    expect(resolveCatalogId("plyo_box_low", HISTORICAL_EXERCISE_ALIASES)).toBe("plyo_box_jump");
  });

  it("résout les fusions/paramétrisations du lot 3 vitesse", () => {
    // Flying sprints → canonique unique paramétré par distance.
    expect(resolveCatalogId("sprint_flying_10m", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_flying");
    expect(resolveCatalogId("sprint_flying_20m", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_flying");
    expect(resolveCatalogId("sprint_flying_30m", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_flying");
    expect(resolveCatalogId("spd_flying20", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_flying");
    // Build-ups : RESTAURÉS en fiches distinctes (décision alias 04/07/2026) —
    // plus d'alias, chaque ID legacy résout vers lui-même.
    for (const id of ["run_build_up_20_30m", "run_build_up_30_40m", "run_build_up_40m"]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
    // Doublons réels fusionnés.
    expect(resolveCatalogId("spd_hill_sprints", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_hill_8_10s");
    expect(resolveCatalogId("run_hills_10x10s", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_hill_8_10s");
    expect(resolveCatalogId("spd_start_fall_forward", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_falling_start_10m");
    expect(resolveCatalogId("run_strides_10_15s", HISTORICAL_EXERCISE_ALIASES)).toBe("run_strides");
  });

  it("migre les décisions Laurent du lot vitesse (03/07/2026)", () => {
    // Décision alias 04/07/2026 : la pyramide 10/20/30 = protocole canonique
    // dédié (plus jamais un simple sprint de 30 m).
    expect(resolveCatalogId("spd_accel_10_20_30", HISTORICAL_EXERCISE_ALIASES)).toBe(
      "protocol_acceleration_pyramid_10_20_30"
    );
    // Ankling = mécanique de course, canonique unique côté speed.
    expect(resolveCatalogId("plyo_ankling", HISTORICAL_EXERCISE_ALIASES)).toBe("speed_ankling");
    // Wall drill A-skip re-préfixé speed (ancien ID conservé).
    expect(resolveCatalogId("cod_wall_drill_a_skip", HISTORICAL_EXERCISE_ALIASES)).toBe("speed_wall_drill_a_skip");
    // Exposition Vmax = course complète, distinct du flying (pas fusionnés).
    expect(resolveCatalogId("spd_maxv_30_60", HISTORICAL_EXERCISE_ALIASES)).toBe("sprint_max_velocity_exposure");
    expect(HISTORICAL_EXERCISE_ALIASES.sprint_flying_20m).toBe("sprint_flying");
    // Poussée traîneau lourde : prowler et sled push fusionnés.
    expect(resolveCatalogId("prowler_push", HISTORICAL_EXERCISE_ALIASES)).toBe("sled_push_heavy");
    expect(resolveCatalogId("speed_sled_push_heavy_10_20m", HISTORICAL_EXERCISE_ALIASES)).toBe("sled_push_heavy");
    // Une ancienne séance contenant ces IDs résout sans jeter ni boucler.
    for (const legacy of ["spd_accel_10_20_30", "plyo_ankling", "prowler_push"]) {
      expect(() => resolveCatalogId(legacy, HISTORICAL_EXERCISE_ALIASES)).not.toThrow();
    }
  });

  it("préserve les distinctions décidées du lot 3 (aucune fusion automatique)", () => {
    // A-march ≠ A-skip ; wall drills distincts ; accel ≠ vitesse max.
    for (const id of [
      "speed_a_skip",
      "speed_b_skip",
      "speed_wall_drill_hold",
      "speed_wall_drill_knee_drive",
      "speed_wall_drill_switches",
      "spd_a_run",
      "speed_fast_leg_cycles",
      "speed_wicket_run",
    ]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
  });

  it("migre les fusions du lot 4 force (tempo/charge/doublons)", () => {
    const cases: Array<[string, string]> = [
      ["str_bb_hip_thrust", "str_hip_thrust"],
      ["str_hamstring_slider_curl", "str_slider_leg_curl"],
      ["str_prone_t_raise_bw", "str_prone_t_raise"],
      ["str_ytw_raise", "str_prone_ytw"],
      ["str_copenhagen_adductor", "str_copenhagen"],
      ["str_adductor_iso_squeeze_band", "str_adductor_squeeze_iso"],
      ["cod_medball_rotational_throw", "mb_rotational_throw_wall"],
    ];
    for (const [legacy, canonical] of cases) {
      expect(resolveCatalogId(legacy, HISTORICAL_EXERCISE_ALIASES)).toBe(canonical);
    }
    // Distinctions force préservées (aucune fusion automatique).
    for (const id of ["str_glute_bridge", "str_bulgarian_split", "str_step_up", "str_hamstring_curl_machine"]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
  });

  it("migre les décisions Laurent force + lot 5 core/mobilité (03/07/2026)", () => {
    // Pompes serrées/diamant = un canonique (placement des mains documenté).
    expect(resolveCatalogId("str_diamond_pushup", HISTORICAL_EXERCISE_ALIASES)).toBe("str_pushup_close_grip");
    // Balistique poids du corps → plyo ; les versions chargées restent en force.
    expect(resolveCatalogId("str_jump_squat", HISTORICAL_EXERCISE_ALIASES)).toBe("plyo_countermovement_jump");
    expect(resolveCatalogId("str_jump_lunge", HISTORICAL_EXERCISE_ALIASES)).toBe("plyo_split_jump");
    expect(HISTORICAL_EXERCISE_ALIASES.str_jump_squat_light).toBeUndefined();
    expect(HISTORICAL_EXERCISE_ALIASES.str_trapbar_jump).toBeUndefined();
    // Nordic scindé par installation : anciens IDs → version partenaire
    // (leur contenu réel listait un partenaire) ; la version ancrée est nouvelle.
    for (const legacy of ["str_nordic", "str_nordic_hamstring_eccentric"]) {
      expect(resolveCatalogId(legacy, HISTORICAL_EXERCISE_ALIASES)).toBe("nordic_curl_partner");
    }
    // Décision alias 04/07/2026 : nordic 3 s restauré en fiche distincte (tempo
    // non représentable) — plus d'alias.
    expect(HISTORICAL_EXERCISE_ALIASES.str_eccentric_nordic_3s).toBeUndefined();
    expect(resolveCatalogId("str_eccentric_nordic_3s", HISTORICAL_EXERCISE_ALIASES)).toBe(
      "str_eccentric_nordic_3s"
    );
    expect(HISTORICAL_EXERCISE_ALIASES.str_nordic_assisted_band).toBeUndefined();
    // Lot 5 core/mobilité.
    expect(resolveCatalogId("core_copenhagen_side_plank", HISTORICAL_EXERCISE_ALIASES)).toBe("str_copenhagen");
    expect(resolveCatalogId("core_stir_pot", HISTORICAL_EXERCISE_ALIASES)).toBe("core_stir_the_pot_swissball");
    expect(resolveCatalogId("core_half_kneeling_pallof", HISTORICAL_EXERCISE_ALIASES)).toBe("core_pallof");
    expect(resolveCatalogId("mob_walking_spiderman", HISTORICAL_EXERCISE_ALIASES)).toBe("mob_spiderman_walk");
    expect(resolveCatalogId("mob_hip_airplane", HISTORICAL_EXERCISE_ALIASES)).toBe("str_db_hip_airplane");
    // Distinctions core/mobilité préservées.
    for (const id of ["core_side_plank", "core_deadbug", "core_bird_dog", "core_pallof_iso_march", "mob_couch_stretch", "mob_thoracic"]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
  });

  it("laisse intactes les fiches restaurées par l'audit d'intégrité (aucun alias lossy silencieux)", () => {
    // Ces variantes (tempo/pause, charge-intention, amplitude, contenu pigeon)
    // sont des fiches distinctes côté backend — un alias simple perdait leur
    // sémantique. Elles ne doivent JAMAIS être remappées.
    for (const id of [
      "str_air_squat_pause_2s",
      "str_pause_squat",
      "str_pushup_pause_2s",
      "str_trapbar_deadlift_light",
      "str_split_squat_jump_low",
      "mob_hips",
    ]) {
      expect(HISTORICAL_EXERCISE_ALIASES[id]).toBeUndefined();
      expect(resolveCatalogId(id, HISTORICAL_EXERCISE_ALIASES)).toBe(id);
    }
  });

  it("garde 5-0-5 et 5-10-5 comme deux tests distincts", () => {
    // cod_505 → cod_5_0_5 (aliasé) ; cod_5_10_5 n'est PAS aliasé (test distinct).
    expect(resolveCatalogId("cod_505", HISTORICAL_EXERCISE_ALIASES)).toBe("cod_5_0_5");
    expect(HISTORICAL_EXERCISE_ALIASES.cod_5_10_5).toBeUndefined();
    expect(resolveCatalogId("cod_5_10_5", HISTORICAL_EXERCISE_ALIASES)).toBe("cod_5_10_5");
  });

  it("laisse un ID inconnu inchangé, sans boucler", () => {
    expect(resolveCatalogId("totally_unknown_id", HISTORICAL_EXERCISE_ALIASES)).toBe(
      "totally_unknown_id"
    );
  });

  it("ne boucle pas sur un alias cyclique", () => {
    const cyclic = { a: "b", b: "a" };
    expect(resolveCatalogId("a", cyclic)).toBeDefined();
  });
});
