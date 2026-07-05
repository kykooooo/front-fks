import { z } from "zod";
import type {
  BankIntensity,
  BankModality,
  ExerciseDef,
  ExerciseTag,
} from "./exerciseBank";

const mediaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fks_hosted"),
    url: z.string().url(),
    thumbnailUrl: z.string().url().nullable().optional(),
    storagePath: z.string(),
    mediaVersion: z.string(),
    owner: z.literal("FKS"),
    validatedAt: z.string(),
  }),
  z.object({
    kind: z.literal("external_vetted"),
    url: z.string().url(),
    label: z.string(),
    validatedAt: z.string(),
  }),
]);

export const catalogExerciseSchema = z.object({
  id: z.string(),
  status: z.literal("published"),
  kind: z.enum(["movement", "drill", "protocol", "situation", "assessment"]),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  footballContext: z.string(),
  modality: z.enum([
    "strength",
    "speed",
    "run",
    "circuit",
    "conditioning",
    "plyo",
    "cod",
    "core",
    "mobility",
  ]),
  intensity: z.enum(["low", "moderate", "high"]),
  progressionFamily: z.string(),
  primaryQuality: z.string(),
  secondaryQualities: z.array(z.string()),
  movementPatterns: z.array(z.string()),
  setup: z.object({
    instructions: z.array(z.string()),
    dimensions: z.string().nullable().optional(),
    trajectory: z.string().nullable().optional(),
  }),
  execution: z.object({
    steps: z.array(z.string()),
    cues: z.array(z.string()).max(3),
    commonMistakes: z.array(z.string()),
  }),
  equipment: z.array(z.string()),
  environments: z.array(z.string()),
  participation: z.object({
    soloEligible: z.boolean(),
    minPlayers: z.number().int().min(1),
    requiresCoach: z.boolean(),
  }),
  complexity: z.number().int().min(1).max(5),
  audiences: z.array(z.enum(["U15", "U18", "Senior"])),
  dosage: z.object({
    mode: z.enum(["reps", "time", "distance", "contacts", "mixed"]),
    defaults: z.record(z.string(), z.number()),
    limits: z.record(
      z.string(),
      z.object({ min: z.number(), max: z.number() })
    ),
    presets: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          values: z.record(z.string(), z.number()),
        })
      )
      .optional(),
  }),
  load: z.object({
    impact: z.enum(["none", "low", "moderate", "high"]),
    braking: z.enum(["none", "low", "moderate", "high"]),
    speedExposure: z.enum(["none", "submax", "max"]),
  }),
  progression: z.object({
    regressions: z.array(z.string()),
    progressions: z.array(z.string()),
    alternatives: z.array(z.string()),
  }),
  safety: z.object({
    excludeWhenReported: z.array(z.string()),
    supervision: z.enum(["none", "recommended", "required"]),
    notes: z.array(z.string()),
  }),
  media: z.object({ video: mediaSchema.nullable() }),
  signal: z
    .object({
      supported: z.boolean(),
      modes: z.array(z.enum(["voice_direction", "color_gate"])),
      cues: z.array(z.string()),
      minDelayMs: z.number(),
      maxDelayMs: z.number(),
    })
    .nullable()
    .optional(),
  sources: z.array(z.string()),
  review: z.object({
    sportReviewedAt: z.string().nullable().optional(),
    fieldTestedAt: z.string().nullable().optional(),
    notes: z.array(z.string()),
  }),
  generation: z.object({
    enabled: z.boolean(),
    tokens: z.array(z.string()),
    priority: z.enum(["core", "variation", "specialist"]),
  }),
});

export const exerciseCatalogManifestSchema = z.object({
  schemaVersion: z.literal(2),
  catalogVersion: z.string(),
  publishedAt: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  exercises: z.array(catalogExerciseSchema),
  aliases: z.record(z.string(), z.string()),
  variants: z.record(
    z.string(),
    z.object({ exerciseId: z.string(), presetId: z.string().optional() })
  ),
});

export type CatalogExercise = z.infer<typeof catalogExerciseSchema>;
export type ExerciseCatalogManifest = z.infer<
  typeof exerciseCatalogManifestSchema
>;

const QUALITY_TO_TAG: Partial<Record<string, ExerciseTag>> = {
  accel: "sprint",
  max_speed: "sprint",
  speed: "sprint",
  cod: "cuts",
  reactive_agility: "cuts",
  plyo: "plyo",
  jump: "jump",
  mobility: "mobility",
};

export type CatalogExerciseView = ExerciseDef & {
  catalog: CatalogExercise;
};

/**
 * Type guard fiable pour distinguer une vue issue du catalogue V2 d'une fiche
 * V1 legacy. On ne se repose PAS sur `"catalog" in item` (que TS n'arrive pas à
 * narrower correctement sur l'union `CatalogExerciseView | ExerciseDef`).
 */
export function isCatalogExerciseView(
  item: ExerciseDef
): item is CatalogExerciseView {
  const candidate = item as Partial<CatalogExerciseView>;
  return typeof candidate.catalog === "object" && candidate.catalog !== null;
}

/**
 * Renommages historiques décidés côté backend (migrateur V2). Le manifeste public
 * n'expose les aliases que lorsque leur cible est *published* ; tant qu'aucune fiche
 * n'est publiée, cette table de compat permet de résoudre les anciens IDs présents
 * dans l'historique local des séances. Le manifeste live (API) prime à la fusion.
 */
export const HISTORICAL_EXERCISE_ALIASES: Record<string, string> = {
  // Décision Laurent : 5-0-5 ≠ 5-10-5. cod_505 (test 5-0-5) pointe vers l'assessment
  // canonique dédié cod_5_0_5 ; cod_5_10_5 reste un test distinct (non aliasé).
  cod_505: "cod_5_0_5",
  cod_t_drill: "cod_t_test",
  spd_a_march: "speed_a_march",
  sprint_accel_5m: "sprint_acceleration",
  sprint_accel_10m: "sprint_acceleration",
  sprint_accel_15m: "sprint_acceleration",
  sprint_accel_20m: "sprint_acceleration",
  run_engine_intervals_30_30_2x10: "run_intervals",
  run_engine_intervals_15_15_2x12: "run_intervals",
  // Revue interne backend (04/07/2026) : le 200 m vit dans un seul canonique
  // (vma_short récupère le preset 8×200 m de run_intervals).
  run_intervals_8x200: "vma_short",
  // Revue interne backend (04/07/2026) — fusion : la récup (chrono vs marche
  // retour) est un paramètre ; walkback = preset du canonique 20 m.
  rsa_sprint_walkback_20m: "rsa_sprint_20m_repeat",
  // Lot 7 Protocoles/Tests (backend, 04/07/2026) : le nombre de répétitions
  // sort des IDs canoniques ; doublons machines fusionnés ; rsa_runs_* =
  // presets complets de run_intervals.
  bike_intervals: "bike_intervals_40_20",
  bike_engine_intervals_10x40_20: "bike_intervals_40_20",
  rower_intervals: "row_intervals_500m",
  row_engine_intervals_6x500: "row_intervals_500m",
  run_engine_intervals_4x1000: "run_intervals_1000m",
  vma_long_1000: "run_intervals_1000m",
  run_engine_intervals_6x400: "run_intervals_400m",
  run_engine_intervals_8x300: "run_intervals_300m",
  run_engine_tempo_cruise_3x8: "run_tempo_cruise_8min",
  run_engine_tempo_cruise_4x5: "run_tempo_cruise_5min",
  run_engine_threshold_2x10: "run_threshold_10min",
  treadmill_engine_intervals_12x60_60: "treadmill_intervals_60_60",
  rsa_runs_10_20_2x10: "run_intervals",
  rsa_runs_15_15_2x10: "run_intervals",
  rsa_runs_20_20_2x8: "run_intervals",
  rsa_runs_30_30_2x6: "run_intervals",
  str_jump_rope_easy: "plyo_jump_rope_easy",
  str_pogo_hops_low: "plyo_pogo_hops_low",
  // Décision plyo finale : box basse fusionnée dans le canonique à hauteur
  // paramétrable (plyo_box_jump). Anciens IDs (banque front + backend) conservés.
  plyo_box_low: "plyo_box_jump",
  plyo_box_jump_low: "plyo_box_jump",
  // Lot 3 Vitesse (backend) : fusions de doublons + paramétrisation par distance.
  sprint_flying_10m: "sprint_flying",
  sprint_flying_20m: "sprint_flying",
  sprint_flying_30m: "sprint_flying",
  spd_flying20: "sprint_flying",
  // Décision alias 04/07/2026 : run_build_up_20_30m / 30_40m / 40m RESTAURÉS en
  // fiches distinctes côté backend (le canonique fusionné run_build_up est retiré)
  // → plus d'alias front.
  spd_hill_sprints: "sprint_hill_8_10s",
  run_hills_10x10s: "sprint_hill_8_10s",
  spd_start_fall_forward: "sprint_falling_start_10m",
  run_strides_10_15s: "run_strides",
  // Décisions Laurent lot vitesse (03/07/2026) : ankling / wall drill A-skip /
  // exposition Vmax / poussée traîneau lourde canonisés (anciens IDs conservés).
  // Décision alias 04/07/2026 : la pyramide 10/20/30 vit dans son propre
  // protocole canonique (plus jamais présentée comme un simple sprint de 30 m).
  spd_accel_10_20_30: "protocol_acceleration_pyramid_10_20_30",
  plyo_ankling: "speed_ankling",
  cod_wall_drill_a_skip: "speed_wall_drill_a_skip",
  spd_maxv_30_60: "sprint_max_velocity_exposure",
  prowler_push: "sled_push_heavy",
  speed_sled_push_heavy_10_20m: "sled_push_heavy",
  // Lot 4 Force (backend) : pause = variante de tempo, charge = paramètre,
  // doublons stricts fusionnés. Anciens IDs conservés.
  // Audit intégrité V1/V2 (03/07/2026) : les variantes tempo/pause, charge-
  // intention, amplitude et mob_hips sont RESTAURÉES en fiches distinctes côté
  // backend — plus d'alias (voir alias-integrity-audit.json).
  str_bb_hip_thrust: "str_hip_thrust",
  str_hamstring_slider_curl: "str_slider_leg_curl",
  str_prone_t_raise_bw: "str_prone_t_raise",
  str_ytw_raise: "str_prone_ytw",
  str_copenhagen_adductor: "str_copenhagen",
  str_adductor_iso_squeeze_band: "str_adductor_squeeze_iso",
  cod_medball_rotational_throw: "mb_rotational_throw_wall",
  // Décisions Laurent force (03/07/2026) : pompes serrées/diamant unifiées,
  // balistique poids du corps → plyo, nordic scindé par installation réelle.
  str_diamond_pushup: "str_pushup_close_grip",
  str_jump_squat: "plyo_countermovement_jump",
  str_jump_lunge: "plyo_split_jump",
  str_nordic: "nordic_curl_partner",
  str_nordic_hamstring_eccentric: "nordic_curl_partner",
  // Décision alias 04/07/2026 : str_eccentric_nordic_3s RESTAURÉ en fiche
  // distincte côté backend (tempo 3 s non représentable) → plus d'alias front.
  // Lot 5 core/mobilité : doublons stricts + paramétrisations.
  core_copenhagen_side_plank: "str_copenhagen",
  core_stir_pot: "core_stir_the_pot_swissball",
  core_half_kneeling_pallof: "core_pallof",
  mob_walking_spiderman: "mob_spiderman_walk",
  mob_hip_airplane: "str_db_hip_airplane",
};

export function catalogExerciseToView(
  exercise: CatalogExercise
): CatalogExerciseView {
  const tags = new Set<ExerciseTag>();
  const qualities = [
    exercise.primaryQuality,
    ...exercise.secondaryQualities,
    ...exercise.movementPatterns,
  ];
  for (const quality of qualities) {
    const tag = QUALITY_TO_TAG[quality];
    if (tag) tags.add(tag);
  }
  if (exercise.modality === "plyo") {
    tags.add("plyo");
    tags.add("jump");
  }
  if (exercise.modality === "cod") tags.add("cuts");

  const modality: BankModality =
    exercise.modality === "speed"
      ? "run"
      : exercise.modality === "conditioning"
        ? "circuit"
        : exercise.modality;
  const intensity: BankIntensity = exercise.intensity;
  const defaultSets = exercise.dosage.defaults.sets;
  const defaultDurationMin =
    typeof exercise.dosage.defaults.durationMin === "number"
      ? exercise.dosage.defaults.durationMin
      : undefined;

  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    modality,
    intensity,
    tags: Array.from(tags),
    defaultSets,
    defaultDurationMin,
    variants: [
      ...exercise.progression.regressions,
      ...exercise.progression.progressions,
      ...exercise.progression.alternatives,
    ],
    catalog: exercise,
  };
}

/**
 * Choisit la banque visible pour la bibliothèque.
 * Invariant de sécurité : on ne bascule sur le catalogue V2 QUE si le flag est ON
 * ET qu'il contient au moins une fiche publiée. Sinon on garde strictement la V1
 * (jamais de bibliothèque vide, jamais de remplacement silencieux avant publication).
 */
export function selectVisibleBank(
  flagEnabled: boolean,
  catalogExercises: CatalogExercise[],
  legacyBank: ExerciseDef[]
): ExerciseDef[] {
  if (flagEnabled && catalogExercises.length > 0) {
    return catalogExercises
      .filter((entry) => entry.participation.soloEligible)
      .map(catalogExerciseToView);
  }
  return legacyBank;
}

export function resolveCatalogId(
  id: string,
  aliases: Record<string, string>
): string {
  let current = id;
  const seen = new Set<string>();
  while (aliases[current] && !seen.has(current)) {
    seen.add(current);
    current = aliases[current];
  }
  return current;
}
