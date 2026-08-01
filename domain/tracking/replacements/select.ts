// domain/tracking/replacements/select.ts
// selectReplacement(request) -- DETERMINISTE, aucun random/LLM. Registre
// d'abord (ordre du tableau = ordre de preference), sinon fallback par pool
// cure (famille fine -- voir FAMILY_BY_ID/FALLBACK_POOLS dans registry.ts).
// Jamais plus d'une proposition par appel : l'appelant relance avec
// excludeIds pour "voir une autre option" (au plus MAX_PROPOSALS_PER_ITEM au
// total, voir constante exportee ci-dessous).
//
// Historique (P0 corrige) : l'ancien fallback filtrait par "meme modality +
// meme focus". Or `focus` n'est renseigne QUE pour les stubs generes depuis
// BACKEND_EXERCISE_IDS -- aucune entree de BASE_EXERCISE_BANK n'en porte. Le
// filtre se reduisait donc a "meme modality", et un tri alphabetique
// choisissait toujours le meme perdant (ex. "easy_jog_20_30" pour n'importe
// quel run, "str_air_squat" pour n'importe quelle force) : un sprint pouvait
// devenir un footing, un souleve/tirage/pousse pouvait devenir un squat.
// Remplace par un fallback par FAMILLE FINE (voir registry.ts) : null
// honnete si l'id n'a pas de famille curee, jamais de regression qui trahit
// la qualite centrale.
import { EXERCISE_BY_ID, type BankIntensity, type BankModality, type ExerciseDef, type ExerciseTag } from "../../../engine/exerciseBank";
import { FALLBACK_POOLS, FAMILY_BY_ID, NEUTRAL_TAGS, REPLACEMENT_REGISTRY } from "./registry";
import type { DeviationReason, ReplacementEntry, ReplacementProposal, ReplacementRequest } from "../types";

/** Au plus 2 propositions par item sur l'ensemble d'une session (gere par l'appelant, qui relance avec excludeIds). */
export const MAX_PROPOSALS_PER_ITEM = 2;

// ----------------------------------------------------------------------------
// Age
// ----------------------------------------------------------------------------

export const AGE_ORDER = ["U13", "U15", "U17", "U18", "Senior"] as const;
type AgeCategory = (typeof AGE_ORDER)[number];

export function ageRank(age: string | null | undefined): number | null {
  if (!age) return null;
  const idx = AGE_ORDER.indexOf(age as AgeCategory);
  return idx === -1 ? null : idx;
}

/**
 * minAge=null -> toujours compatible. Age de contexte inconnu/non reconnu ->
 * INCOMPATIBLE des qu'un minAge est exige (securite d'abord : on ne peut pas
 * garantir qu'un joueur d'age inconnu satisfait un seuil).
 */
function isAgeCompatible(minAge: ReplacementEntry["minAge"], contextAge: string | null): boolean {
  if (minAge === null) return true;
  const requiredRank = ageRank(minAge);
  if (requiredRank === null) return true;
  const contextRank = ageRank(contextAge);
  if (contextRank === null) return false;
  return contextRank >= requiredRank;
}

// ----------------------------------------------------------------------------
// Douleur : mapping token backend (shared/injuryMapping.ts) -> tags de zone
// ----------------------------------------------------------------------------

export const PAIN_ZONE_TAGS: Record<string, ExerciseTag[]> = {
  knee_pain: ["knee_stress", "quad_load"],
  ankle_pain: ["ankle_stress", "calf_load", "jump"],
  hamstring_acute: ["hamstring_load", "sprint"],
  back_pain: ["spine_load", "heavy_lower", "heavy_upper"],
  shoulder_pain: ["shoulder_load", "overhead"],
  hip_pain: ["hip_load"],
  groin_pain: ["hip_load", "cuts"],
  calf_pain: ["calf_load", "jump"],
  quad_pain: ["quad_load"],
  wrist_pain: ["overhead"],
};

export function forbiddenTagsFromPains(activePains: string[]): Set<ExerciseTag> {
  const set = new Set<ExerciseTag>();
  for (const token of activePains) {
    const tags = PAIN_ZONE_TAGS[token];
    if (tags) tags.forEach((t) => set.add(t));
  }
  return set;
}

// ----------------------------------------------------------------------------
// Filtre de contexte commun (registre ET fallback passent par la meme porte)
// ----------------------------------------------------------------------------

function entryPassesContext(
  originalExerciseId: string,
  entry: ReplacementEntry,
  request: ReplacementRequest
): boolean {
  const { reason, context } = request;

  if (entry.altExerciseId === originalExerciseId) return false; // pas d'auto-reference
  if (!entry.reasonsAllowed.includes(reason)) return false;
  if (context.excludeIds.includes(entry.altExerciseId)) return false;

  const altDef = EXERCISE_BY_ID[entry.altExerciseId];
  if (!altDef) return false; // defensif : id fantome, jamais propose

  // Materiel : l'alternative ne doit jamais exiger un materiel absent du contexte.
  const hasAllEquipment = entry.equipmentRequired.every((eq) => context.equipmentAvailable.includes(eq));
  if (!hasAllEquipment) return false;

  // Age
  if (!isAgeCompatible(entry.minAge, context.ageCategory)) return false;

  // Douleur : reason=pain exige painSafe=true. activePains non vide exige en
  // plus qu'aucun tag de la zone concernee ne soit porte par l'alternative
  // (independamment de la raison invoquee).
  if (reason === "pain" && !entry.painSafe) return false;
  if (context.activePains.length > 0) {
    const forbidden = forbiddenTagsFromPains(context.activePains);
    if (forbidden.size > 0 && altDef.tags.some((t) => forbidden.has(t))) return false;
  }

  // Solo / espace reduit
  if (context.solo && !entry.soloOk) return false;
  if (reason === "space" && !entry.compactSpaceOk) return false;

  // Match proche ou fatigue haute : jamais d'augmentation -- une alternative
  // "similar" ET intensite haute est refusee (pas de hausse sous contrainte).
  if ((context.matchSoon || context.highFatigue) && entry.relativeDifficulty === "similar" && altDef.intensity === "high") {
    return false;
  }

  return true;
}

function selectFromRegistry(request: ReplacementRequest): { entry: ReplacementEntry; altDef: ExerciseDef } | null {
  const entries = REPLACEMENT_REGISTRY[request.exerciseId];
  if (!entries || entries.length === 0) return null;

  for (const entry of entries) {
    if (entryPassesContext(request.exerciseId, entry, request)) {
      const altDef = EXERCISE_BY_ID[entry.altExerciseId];
      if (altDef) return { entry, altDef };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Fallback par pool cure (P0) : famille fine (FAMILY_BY_ID) -> pool
// d'alternatives poids du corps (FALLBACK_POOLS), filtre par excludeIds +
// intensite <= original + contexte (materiel/age/douleur/solo/espace via
// entryPassesContext, la meme porte que le registre). Jamais utilise si
// reason="pain" (le registre est alors la SEULE source valable ; sinon ->
// null honnete). Voir registry.ts pour le detail des familles/pools et la
// justification du changement (bug ex-fallback "meme modality").
// ----------------------------------------------------------------------------

const INTENSITY_RANK: Record<BankIntensity, number> = { low: 0, moderate: 1, high: 2 };

function computeFallbackMinAge(def: ExerciseDef): ReplacementEntry["minAge"] {
  const risky = def.tags.some((t) => t === "heavy_lower" || t === "heavy_upper" || t === "impact");
  return risky ? "U15" : null;
}

function computeFallbackPainSafe(def: ExerciseDef): boolean {
  const neutral = NEUTRAL_TAGS as ExerciseTag[];
  return def.tags.every((t) => neutral.includes(t));
}

function computeFallbackCompactSpaceOk(def: ExerciseDef): boolean {
  // Les drills de sprint/course sur distance demandent un couloir degage :
  // pas "compact" au sens de la contrainte espace, meme s'ils sont bodyweight.
  if (def.modality === "run" && def.tags.includes("sprint")) return false;
  return true;
}

function buildFallbackEntry(def: ExerciseDef, reason: DeviationReason, family: string): ReplacementEntry {
  return {
    altExerciseId: def.id,
    reasonsAllowed: [reason],
    // Nomme la famille curee (voir registry.ts) plutot que modality/focus --
    // c'est desormais une garantie de qualite reelle, pas une approximation.
    preservedQuality: family,
    equipmentRequired: [],
    relativeDifficulty: "easier",
    prescriptionAdapter: {},
    minAge: computeFallbackMinAge(def),
    painSafe: computeFallbackPainSafe(def),
    soloOk: true,
    compactSpaceOk: computeFallbackCompactSpaceOk(def),
  };
}

function selectFromFallback(request: ReplacementRequest): { entry: ReplacementEntry; altDef: ExerciseDef } | null {
  // Jamais de fallback sur douleur -- ni si reason="pain", ni des qu'une
  // douleur active est declaree (meme pour une autre raison de remplacement).
  // Renforcement volontaire au-dela du brief litteral ("SEULEMENT si reason
  // != pain") : les tags de la banque sont connus incomplets pour certains
  // mouvements bodyweight (ex. str_air_squat n'a AUCUN tag alors qu'il
  // sollicite le genou) -- seul le registre, revu a la main via painSafe, a
  // une garantie sportive suffisante en presence de douleur. Coherent avec la
  // doctrine "securite d'abord" de REGLES_AJUSTEMENT.md.
  if (request.reason === "pain" || request.context.activePains.length > 0) return null;

  const original = EXERCISE_BY_ID[request.exerciseId];
  if (!original) return null;

  // Pas de famille curee pour cet id -> honnete : rien a proposer plutot que
  // de deviner une regression qui pourrait trahir la qualite centrale.
  const family = FAMILY_BY_ID[request.exerciseId];
  if (!family) return null;

  const poolIds = FALLBACK_POOLS[family];
  if (!poolIds || poolIds.length === 0) return null;

  const candidates = poolIds
    .filter((id) => id !== request.exerciseId)
    .map((id) => EXERCISE_BY_ID[id])
    .filter((def): def is ExerciseDef => Boolean(def))
    .filter((def) => INTENSITY_RANK[def.intensity] <= INTENSITY_RANK[original.intensity]);

  const passing = candidates
    .map((def) => ({ def, entry: buildFallbackEntry(def, request.reason, family) }))
    .filter(({ entry }) => entryPassesContext(request.exerciseId, entry, request))
    .sort((a, b) => a.def.id.localeCompare(b.def.id)); // egalite -> id alphabetique

  if (passing.length === 0) return null;
  const [{ def, entry }] = passing;
  return { entry, altDef: def };
}

// ----------------------------------------------------------------------------
// Prescription adaptee
// ----------------------------------------------------------------------------

type Baseline = { sets: number | null; reps: number | string | null; durationS: number | null; restS: number | null };

/**
 * Baseline generique par modalite, point de depart transforme par
 * prescriptionAdapter. Utilisee quand l'appelant ne transmet PAS la
 * prescription reelle de l'item live via `request.prescribed` (P1 : champ
 * optionnel ajoute a ReplacementRequest -- voir types.ts). Quand
 * `prescribed` est fourni, il prime entierement sur cette baseline
 * generique (donnee reelle > approximation par modalite).
 */
const BASELINE_BY_MODALITY: Record<BankModality, Baseline> = {
  strength: { sets: 3, reps: 10, durationS: null, restS: 60 },
  run: { sets: null, reps: null, durationS: null, restS: null },
  plyo: { sets: 3, reps: 6, durationS: null, restS: 90 },
  cod: { sets: 3, reps: 4, durationS: null, restS: 60 },
  core: { sets: 3, reps: null, durationS: 30, restS: 30 },
  circuit: { sets: 3, reps: null, durationS: null, restS: 30 },
  mobility: { sets: null, reps: null, durationS: 60, restS: null },
};

/** Duree de tenue par defaut (par serie) quand aucune duree connue n'est disponible pour une alternative isometrique/chronometree (ex. 3×30s). */
const ISO_HOLD_DEFAULT_DURATION_S = 30;
/** Recuperation par defaut entre series pour une tenue isometrique quand aucune n'est connue. */
const ISO_HOLD_DEFAULT_REST_S = 45;

function baselineFor(def: ExerciseDef | undefined): Baseline {
  if (!def) return { sets: null, reps: null, durationS: null, restS: null };
  const base = BASELINE_BY_MODALITY[def.modality];
  if (def.modality === "run" && typeof def.defaultDurationMin === "number") {
    return { ...base, durationS: Math.round(def.defaultDurationMin * 60) };
  }
  return base;
}

/**
 * Detecte honnetement une alternative isometrique/chronometree (tenue) :
 * id/nom contenant hold/plank/iso (str_split_squat_iso_hold, core_hollow_hold,
 * core_side_plank...), OU un prescriptionAdapter.durationFactor sur une
 * alternative dont la modalite n'est PAS "run". Le garde modality!=="run" est
 * necessaire : durationFactor est AUSSI utilise par des swaps cardio a duree
 * continue (ex. run_easy_20 -> bike_easy_25_35, run_intervals_8x200 ->
 * tempo_20_30) qui ne sont pas des isometries -- les confondre romprait leur
 * prescription en minutes.
 */
function isIsometricAlternative(entry: ReplacementEntry, altDef: ExerciseDef): boolean {
  const nameMatch = /hold|plank|iso/i.test(`${altDef.id} ${altDef.name}`);
  if (nameMatch) return true;
  if (altDef.modality !== "run" && typeof entry.prescriptionAdapter.durationFactor === "number") return true;
  return false;
}

/** Convertit `request.prescribed` (donnee reelle de l'item live) en Baseline exploitable telle quelle. */
function baselineFromPrescribed(prescribed: NonNullable<ReplacementRequest["prescribed"]>): Baseline {
  return {
    sets: prescribed.sets ?? null,
    reps: prescribed.reps ?? null,
    durationS: prescribed.durationS ?? null,
    restS: prescribed.restS ?? null,
  };
}

/**
 * Baseline effective pour une proposition : `request.prescribed` prime sur
 * BASELINE_BY_MODALITY quand fourni (P1). Si l'alternative est isometrique,
 * force reps=null et garantit une durationS exploitable (baseline saine par
 * defaut si aucune duree connue) -- jamais "3x10 reps" pour un gainage/hold.
 */
function resolveBaseline(
  request: ReplacementRequest,
  originalDef: ExerciseDef | undefined,
  isIso: boolean
): Baseline {
  const base = request.prescribed ? baselineFromPrescribed(request.prescribed) : baselineFor(originalDef);
  if (!isIso) return base;
  return {
    sets: base.sets ?? 3,
    reps: null,
    durationS: base.durationS ?? ISO_HOLD_DEFAULT_DURATION_S,
    restS: base.restS ?? ISO_HOLD_DEFAULT_REST_S,
  };
}

function applyAdapter(baseline: Baseline, adapter: ReplacementEntry["prescriptionAdapter"]): ReplacementProposal["prescription"] {
  let sets = baseline.sets;
  if (sets !== null && typeof adapter.setsDelta === "number") {
    sets = Math.max(1, Math.round(sets + adapter.setsDelta));
  }

  let reps: number | string | null = baseline.reps;
  if (typeof reps === "number" && typeof adapter.repsFactor === "number") {
    reps = Math.max(1, Math.round(reps * adapter.repsFactor));
  }

  let durationS = baseline.durationS;
  if (durationS !== null && typeof adapter.durationFactor === "number") {
    durationS = Math.max(5, Math.round(durationS * adapter.durationFactor));
  }

  let restS = baseline.restS;
  if (restS !== null && typeof adapter.restDelta === "number") {
    restS = Math.max(0, Math.round(restS + adapter.restDelta));
  }

  return { sets, reps, durationS, restS, note: adapter.note ?? null };
}

// ----------------------------------------------------------------------------
// shortWhy honnete
// ----------------------------------------------------------------------------

const HUMAN_QUALITY_LABEL: Record<string, string> = {
  bilateral_lower_strength: "travail des jambes en bilateral",
  bilateral_lower_strength_quad_bias: "travail des jambes (quadriceps)",
  unilateral_lower_strength: "travail unilateral des jambes",
  hip_hinge_posterior_chain: "travail de charniere de hanche",
  hip_extension_strength: "travail d'extension de hanche",
  eccentric_hamstring_strength: "travail excentrique des ischios",
  horizontal_upper_push: "travail de poussee horizontale",
  upper_push_strength: "travail de poussee du haut du corps",
  horizontal_upper_pull: "travail de tirage horizontal",
  vertical_upper_pull: "travail de tirage vertical",
  vertical_to_horizontal_upper_pull: "travail de tirage (version horizontale)",
  upper_pull_strength: "travail de tirage",
  acceleration_technique: "travail d'acceleration",
  acceleration_power: "travail d'acceleration",
  max_velocity_technique: "travail de vitesse",
  high_intensity_running_capacity: "travail cardio intense",
  aerobic_base_low_impact: "travail cardio",
  running_technique_speed: "travail de technique de course",
  vertical_plyo_power: "travail de detente verticale",
  plyo_power: "travail de puissance",
  lateral_plyo_power: "travail de puissance laterale",
  unilateral_plyo_power: "travail de puissance unilaterale",
  change_of_direction_technique: "travail de changement de direction",
  deceleration_control: "travail de decelaration",
  anti_extension_core: "travail de gainage anti-extension",
  lateral_core_stability: "travail de gainage lateral",
  anti_rotation_core: "travail de gainage anti-rotation",
};

function buildShortWhy(entry: ReplacementEntry, source: "registry" | "rule"): string {
  const equip = entry.equipmentRequired.length === 0 ? "sans materiel" : `avec ${entry.equipmentRequired.join(", ")}`;

  if (source === "rule") {
    return `Meme famille d'exercice, niveau adapte, ${equip}. Equivalence non garantie par le registre, a valider a l'usage.`;
  }

  const label = HUMAN_QUALITY_LABEL[entry.preservedQuality] ?? "le meme type d'effort";
  return `Meme ${label}, ${equip}.`;
}

// ----------------------------------------------------------------------------
// Point d'entree
// ----------------------------------------------------------------------------

function buildProposal(
  request: ReplacementRequest,
  entry: ReplacementEntry,
  altDef: ExerciseDef,
  source: "registry" | "rule"
): ReplacementProposal {
  const originalDef = EXERCISE_BY_ID[request.exerciseId];
  const isIso = isIsometricAlternative(entry, altDef);
  const baseline = resolveBaseline(request, originalDef, isIso);
  const prescription = applyAdapter(baseline, entry.prescriptionAdapter);
  // Equivalence sportive : uniquement pour une entree de registre marquee
  // "similar" (equivalence validee a la main) -- jamais pour le fallback
  // algorithmique, qui n'a d'autre garantie que "meme famille curee/intensite".
  const equivalent = source === "registry" && entry.relativeDifficulty === "similar";

  return {
    exerciseId: entry.altExerciseId,
    name: altDef.name,
    shortWhy: buildShortWhy(entry, source),
    prescription,
    equivalent,
    source,
  };
}

/**
 * Selectionne UNE alternative d'exercice, deterministe (registre d'abord,
 * fallback par pool cure ensuite -- jamais sur reason="pain"). Retourne null
 * si rien de valable : c'est une reponse honnete, pas une erreur -- l'appelant
 * proposera alors de passer l'exercice.
 */
export function selectReplacement(request: ReplacementRequest): ReplacementProposal | null {
  if (!request || typeof request.exerciseId !== "string" || !request.context) return null;

  const fromRegistry = selectFromRegistry(request);
  if (fromRegistry) return buildProposal(request, fromRegistry.entry, fromRegistry.altDef, "registry");

  const fromFallback = selectFromFallback(request);
  if (fromFallback) return buildProposal(request, fromFallback.entry, fromFallback.altDef, "rule");

  return null;
}
