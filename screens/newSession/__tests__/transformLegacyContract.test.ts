// screens/newSession/__tests__/transformLegacyContract.test.ts
// Contrat V1/V2 : legacy_exercise_id survit à schema + snakeToCamel + transform,
// la résolution d'alias est gérée par le flag, et une ancienne séance V1 n'est
// jamais altérée ni plantée quand le flag est OFF (état prod).
import { sessionV2Schema } from "../../../schemas/sessionSchema";
import { snakeToCamel } from "../../../utils/caseTransform";
import { v2ToLocalSession } from "../transform";
import type { FKS_NextSessionV2 } from "../types";

const rawBackendSession = (items: Record<string, unknown>[]) => ({
  version: "fks.next_session.v2",
  catalog_version: "2.0.0-draft",
  title: "Séance test",
  intensity: "moderate",
  focus_primary: "strength",
  duration_min: 40,
  rpe_target: 6,
  blocks: [
    {
      id: "block_force",
      type: "strength",
      goal: "Force bas du corps",
      intensity: "moderate",
      duration_min: 20,
      items,
    },
  ],
});

const parseAndTransform = (items: Record<string, unknown>[]) => {
  const parsed = sessionV2Schema.safeParse(rawBackendSession(items));
  expect(parsed.success).toBe(true);
  const v2 = snakeToCamel<FKS_NextSessionV2>((parsed as { data: unknown }).data);
  return { v2, session: v2ToLocalSession(v2, "Construction", "2026-07-03") };
};

describe("contrat legacy_exercise_id — flag OFF (défaut prod)", () => {
  it("conserve un alias connu BRUT (aucune résolution) et n'invente pas de legacyId", () => {
    const { session } = parseAndTransform([
      { exercise_id: "str_pause_squat", name: "Pause squat", sets: 3, reps: 5, rest_s: 90 },
    ]);
    const exo = session.exercises[0];
    expect(exo.id).toBe("str_pause_squat");
    expect(exo.legacyId).toBeUndefined();
  });

  it("conserve un legacy_exercise_id explicite fourni par le backend", () => {
    const { v2, session } = parseAndTransform([
      {
        exercise_id: "str_back_squat",
        legacy_exercise_id: "str_pause_squat",
        name: "Back squat",
        sets: 3,
        reps: 5,
        rest_s: 90,
      },
    ]);
    // survit au schema + snakeToCamel…
    expect(v2.blocks[0].items?.[0]?.legacyExerciseId).toBe("str_pause_squat");
    // …et au transform, dans l'objet Session persistable.
    const exo = session.exercises[0];
    expect(exo.id).toBe("str_back_squat");
    expect(exo.legacyId).toBe("str_pause_squat");
  });

  it("n'altère pas une séance V1 : variantId/distance/contacts/rounds préservés, pas de doublon accidentel", () => {
    const { session } = parseAndTransform([
      { exercise_id: "sprint_accel_10m", variant_id: "10m", name: "Accel 10m", sets: 4, reps: 1, rest_s: 60, distance_m: 10 },
      { exercise_id: "sprint_accel_20m", variant_id: "20m", name: "Accel 20m", sets: 4, reps: 1, rest_s: 90, distance_m: 20 },
      { exercise_id: "plyo_pogos", name: "Pogos", sets: 3, reps: 10, contacts: 20, rest_s: 45, rounds: 2 },
    ]);
    const ids = session.exercises.map((e) => e.id);
    // Flag OFF : les deux variantes d'accélération restent distinctes (pas de
    // collision de dédoublonnage via le canonique sprint_acceleration).
    expect(ids).toContain("sprint_accel_10m");
    expect(ids).toContain("sprint_accel_20m");
    expect(new Set(ids).size).toBe(ids.length);
    const accel10 = session.exercises.find((e) => e.id === "sprint_accel_10m")!;
    expect(accel10.variantId).toBe("10m");
    expect(accel10.distanceM).toBe(10);
    const pogos = session.exercises.find((e) => e.id === "plyo_pogos")!;
    expect(pogos.contacts).toBe(20);
    expect(pogos.rounds).toBe(2);
  });

  it("conserve le nom backend pour un ID inconnu, sans crash", () => {
    const { session } = parseAndTransform([
      { exercise_id: "totally_unknown_exo", name: "Exo mystère", sets: 3, reps: 8, rest_s: 60 },
    ]);
    const exo = session.exercises.find((e) => e.id === "totally_unknown_exo")!;
    expect(exo).toBeDefined();
    // prettifyName force une majuscule initiale mais ne retouche pas la casse
    // interne (fix "casse FR exos" du 13/07 : "Squat Poids Du Corps" est faux
    // en français) — le nom backend "Exo mystère" est donc conservé tel quel.
    expect(exo.name).toBe("Exo mystère");
  });
});

describe("contrat legacy_exercise_id — flag ON", () => {
  // Recharge transform avec le flag V2 actif (même mécanique que les tests du
  // resolver : jest.isolateModules + doMock de config/features).
  const loadTransformWithFlagOn = () => {
    let fn: typeof v2ToLocalSession;
    jest.isolateModules(() => {
      jest.doMock("../../../config/features", () => ({
        FKS_CATALOG_V2_ENABLED: true,
        FKS_SIGNAL_V1_ENABLED: false,
      }));
      fn = require("../transform").v2ToLocalSession;
    });
    jest.dontMock("../../../config/features");
    return fn!;
  };

  const transformOn = (items: Record<string, unknown>[]) => {
    const parsed = sessionV2Schema.safeParse(rawBackendSession(items));
    expect(parsed.success).toBe(true);
    const v2 = snakeToCamel<FKS_NextSessionV2>((parsed as { data: unknown }).data);
    return loadTransformWithFlagOn()(v2, "Construction", "2026-07-03");
  };

  it("résout un ancien ID vers le canonique ET conserve l'ID brut en legacyId", () => {
    const session = transformOn([
      { exercise_id: "cod_505", name: "Test 5-0-5", sets: 4, reps: 1, rest_s: 120 },
    ]);
    const exo = session.exercises[0];
    expect(exo.id).toBe("cod_5_0_5");
    expect(exo.legacyId).toBe("cod_505");
  });

  it("un legacy_exercise_id explicite n'est JAMAIS écrasé par la valeur déduite", () => {
    const session = transformOn([
      {
        exercise_id: "cod_505",
        legacy_exercise_id: "mon_id_historique_v1",
        name: "Test 5-0-5",
        sets: 4,
        reps: 1,
        rest_s: 120,
      },
    ]);
    const exo = session.exercises[0];
    expect(exo.id).toBe("cod_5_0_5");
    expect(exo.legacyId).toBe("mon_id_historique_v1");
  });

  it("canonique reçu + legacy explicite : conserve les deux", () => {
    const session = transformOn([
      {
        exercise_id: "cod_5_0_5",
        legacy_exercise_id: "cod_505",
        name: "Test 5-0-5",
        sets: 4,
        reps: 1,
        rest_s: 120,
      },
    ]);
    const exo = session.exercises[0];
    expect(exo.id).toBe("cod_5_0_5");
    expect(exo.legacyId).toBe("cod_505");
  });

  it("le dédoublonnage utilise l'ID résolu (deux alias du même canonique ne créent pas de doublon)", () => {
    const session = transformOn([
      { exercise_id: "sprint_flying_10m", name: "Flying 10", sets: 3, reps: 1, rest_s: 120, distance_m: 10 },
      { exercise_id: "spd_flying20", name: "Flying 20", sets: 3, reps: 1, rest_s: 120, distance_m: 20 },
    ]);
    const ids = session.exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Le premier garde le canonique + son legacyId ; le second est dédoublonné
    // via un fallback (comportement existant), sans crash.
    const flying = session.exercises.find((e) => e.id === "sprint_flying")!;
    expect(flying.legacyId).toBe("sprint_flying_10m");
  });

  it("ID inconnu conservé sans crash, nom backend conservé", () => {
    const session = transformOn([
      { exercise_id: "totally_unknown_exo", name: "Exo mystère", sets: 3, reps: 8, rest_s: 60 },
    ]);
    const exo = session.exercises.find((e) => e.id === "totally_unknown_exo")!;
    // prettifyName force une majuscule initiale mais ne retouche pas la casse
    // interne (fix "casse FR exos" du 13/07) — le nom backend est conservé tel quel.
    expect(exo.name).toBe("Exo mystère");
    expect(exo.legacyId).toBeUndefined();
  });
});
