// domain/tracking/replacements/contract.ts
// Controles de qualite EXECUTABLES sur le registre de remplacement et sur
// une proposition donnee. Reutilisables tels quels en CI (aucune dependance
// UI/Firebase). validateRegistryIntegrity() DOIT retourner [] pour le
// registre livre -- verifie par domain/tracking/__tests__/replacements.test.ts.
import { EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { AGE_ORDER, ageRank, forbiddenTagsFromPains } from "./select";
import { FALLBACK_POOLS, FAMILY_BY_ID, IMPORTANT_EXERCISE_IDS, REPLACEMENT_REGISTRY, STRESS_TAGS } from "./registry";
import type { DeviationReason, ReplacementEntry, ReplacementProposal, ReplacementRequest } from "../types";

const VALID_REASONS: ReadonlySet<DeviationReason> = new Set([
  "time",
  "equipment",
  "too_difficult",
  "fatigue",
  "pain",
  "technical",
  "space",
  "no_partner",
  "other",
]);

const VALID_DIFFICULTIES: ReadonlySet<string> = new Set(["easier", "similar"]);
const VALID_AGES: ReadonlySet<string> = new Set(AGE_ORDER);

/**
 * Originaux consideres "charges" (materiel de salle/barres/machines) par
 * connaissance directe du registre (nom d'id insuffisant a lui seul --
 * ex. "str_back_squat" vs "str_air_squat" partagent le mot "squat" sans que
 * l'un soit charge -- donc liste explicite plutot qu'une regex sur le nom).
 * Sert uniquement a verifier qu'une alternative "equipment" n'exige pas le
 * MEME type d'equipement lourd que l'original (heuristique documentee, pas
 * une preuve absolue de "plus leger").
 */
const KNOWN_LOADED_ORIGINALS: ReadonlySet<string> = new Set([
  "str_back_squat",
  "str_front_squat",
  "str_leg_press",
  "str_deadlift_heavy",
  "str_trapbar_deadlift",
  "str_bench_press",
  "str_db_press",
  "str_oh_press",
  "str_landmine_press",
  "str_machine_chest_press",
  "str_row",
  "str_pullup",
  "str_lat_pulldown",
  "str_bb_hip_thrust",
]);

/** Equipement de meme tier "lourd" que celui d'un original charge (vocabulaire de screens/newSession/ui/EquipmentSelector.tsx). */
const HEAVY_EQUIPMENT_TOKENS: ReadonlySet<string> = new Set(["gym_full", "cable_machine", "trap_bar", "power_sled"]);

/** Equipement considere "leger" (charge improvisee, jamais un vrai remplacement de charge lourde). */
const LIGHT_EQUIPMENT_TOKENS: ReadonlySet<string> = new Set(["water_bottles", "backpack"]);

function isLightweightOrBodyweight(equipmentRequired: string[]): boolean {
  return equipmentRequired.every((eq) => LIGHT_EQUIPMENT_TOKENS.has(eq));
}

/** Reconnait un altExerciseId de type "drill a plots" (cf. cod_cone_drills_low). */
const CONE_OR_PEG_PATTERN = /cone|plot/i;

/**
 * P1 : une alternative "equipment" charge (heavy_lower/heavy_upper sur
 * l'original) vers du poids du corps pur ou une charge legere improvisee
 * (equipmentRequired [] ou uniquement water_bottles/backpack) n'est JAMAIS
 * une equivalence sportive complete -- relativeDifficulty DOIT etre "easier"
 * (jamais "similar", qui produirait equivalent=true a tort). Retourne un
 * message d'erreur si viole, null sinon. Exporte pour tests directs
 * (synthetiques) en plus de la verification sur le registre livre.
 */
export function checkHeavyToLightDifficulty(key: string, entry: ReplacementEntry): string | null {
  const originalDef = EXERCISE_BY_ID[key];
  if (!originalDef) return null;
  const originalIsHeavy = originalDef.tags.includes("heavy_lower") || originalDef.tags.includes("heavy_upper");
  if (!originalIsHeavy) return null;
  if (!isLightweightOrBodyweight(entry.equipmentRequired)) return null;
  if (entry.relativeDifficulty !== "easier") {
    return `${key} -> ${entry.altExerciseId} : original charge (heavy_lower/heavy_upper) vers alternative poids du corps/charge legere (${entry.equipmentRequired.length === 0 ? "aucun materiel" : entry.equipmentRequired.join(", ")}) -- relativeDifficulty doit etre "easier" (actuel : "${entry.relativeDifficulty}")`;
  }
  return null;
}

/**
 * P1 : toute entree dont reasonsAllowed contient "equipment" et dont
 * l'altExerciseId est un drill a plots (cone/plot dans l'id) DOIT porter une
 * note d'improvisation (reperes improvises) dans prescriptionAdapter.note --
 * sinon la reponse au manque de materiel resterait un drill a plots, ce qui
 * ne resout rien. Retourne un message d'erreur si viole, null sinon.
 */
export function checkEquipmentConeNote(key: string, entry: ReplacementEntry): string | null {
  if (!entry.reasonsAllowed.includes("equipment")) return null;
  if (!CONE_OR_PEG_PATTERN.test(entry.altExerciseId)) return null;
  const note = entry.prescriptionAdapter.note ?? "";
  if (!/improvis/i.test(note)) {
    return `${key} -> ${entry.altExerciseId} : reason "equipment" vers un drill a plots sans note d'improvisation (reperes improvises attendus dans prescriptionAdapter.note)`;
  }
  return null;
}

/**
 * Verifie l'integrite des maps de fallback (P0) : chaque famille referencee
 * par FAMILY_BY_ID a un pool non vide dans FALLBACK_POOLS, et chaque id de
 * pool existe reellement dans EXERCISE_BY_ID. Une famille orpheline ou un id
 * fantome dans un pool romprait silencieusement le fallback (retour null
 * inattendu) -- mieux vaut le detecter ici. Retourne un tableau d'erreurs
 * (vide = maps saines).
 */
export function validateFallbackPoolsIntegrity(): string[] {
  const errors: string[] = [];
  const referencedFamilies = new Set(Object.values(FAMILY_BY_ID));

  for (const family of referencedFamilies) {
    const pool = FALLBACK_POOLS[family];
    if (!pool || pool.length === 0) {
      errors.push(`FAMILY_BY_ID reference la famille "${family}" mais FALLBACK_POOLS n'a aucun pool pour elle`);
    }
  }

  for (const [family, ids] of Object.entries(FALLBACK_POOLS)) {
    for (const id of ids) {
      if (!EXERCISE_BY_ID[id]) {
        errors.push(`FALLBACK_POOLS["${family}"] : "${id}" introuvable dans EXERCISE_BY_ID`);
      }
    }
  }

  return errors;
}

/**
 * Verifie l'integrite du registre : cles/altExerciseId reels, pas
 * d'auto-reference, pas de doublon, champs obligatoires renseignes,
 * relativeDifficulty/minAge valides, painSafe=true jamais accompagne d'un tag
 * de stress articulaire, alternative "equipment" jamais du meme tier
 * materiel qu'un original connu comme charge, degradation obligatoire
 * heavy->leger (checkHeavyToLightDifficulty) et note d'improvisation
 * obligatoire pour un drill a plots propose sur manque de materiel
 * (checkEquipmentConeNote). Retourne un tableau d'erreurs (vide = registre sain).
 */
export function validateRegistryIntegrity(): string[] {
  const errors: string[] = [];

  for (const importantId of IMPORTANT_EXERCISE_IDS) {
    if (!EXERCISE_BY_ID[importantId]) {
      errors.push(`IMPORTANT_EXERCISE_IDS : "${importantId}" introuvable dans EXERCISE_BY_ID`);
    }
  }

  for (const [key, entries] of Object.entries(REPLACEMENT_REGISTRY)) {
    if (!EXERCISE_BY_ID[key]) {
      errors.push(`registre : cle "${key}" introuvable dans EXERCISE_BY_ID`);
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`registre : "${key}" n'a aucune alternative (tableau vide)`);
      continue;
    }

    const seenAlt = new Set<string>();
    for (const entry of entries) {
      const label = `${key} -> ${entry.altExerciseId}`;
      const altDef = EXERCISE_BY_ID[entry.altExerciseId];

      if (!altDef) {
        errors.push(`${label} : altExerciseId introuvable dans EXERCISE_BY_ID`);
      }
      if (entry.altExerciseId === key) {
        errors.push(`${label} : auto-reference (l'alternative est l'original)`);
      }
      if (seenAlt.has(entry.altExerciseId)) {
        errors.push(`${label} : doublon d'alternative pour la meme cle`);
      }
      seenAlt.add(entry.altExerciseId);

      if (!entry.reasonsAllowed || entry.reasonsAllowed.length === 0) {
        errors.push(`${label} : reasonsAllowed vide`);
      } else {
        for (const r of entry.reasonsAllowed) {
          if (!VALID_REASONS.has(r)) errors.push(`${label} : reason invalide "${r}"`);
        }
      }

      if (!entry.preservedQuality || entry.preservedQuality.trim().length === 0) {
        errors.push(`${label} : preservedQuality vide`);
      }

      if (!VALID_DIFFICULTIES.has(entry.relativeDifficulty)) {
        errors.push(`${label} : relativeDifficulty invalide "${entry.relativeDifficulty}" (attendu easier|similar)`);
      }

      if (entry.minAge !== null && !VALID_AGES.has(entry.minAge)) {
        errors.push(`${label} : minAge invalide "${entry.minAge}"`);
      }

      if (entry.painSafe && altDef) {
        const stressHit = altDef.tags.find((t) => (STRESS_TAGS as string[]).includes(t));
        if (stressHit) {
          errors.push(`${label} : painSafe=true mais porte le tag de stress "${stressHit}"`);
        }
      }

      if (entry.reasonsAllowed?.includes("equipment") && KNOWN_LOADED_ORIGINALS.has(key)) {
        const overlap = entry.equipmentRequired.filter((eq) => HEAVY_EQUIPMENT_TOKENS.has(eq));
        if (overlap.length > 0) {
          errors.push(
            `${label} : reason "equipment" sur un original charge mais equipmentRequired (${entry.equipmentRequired.join(", ")}) reste du meme tier materiel`
          );
        }
      }

      const heavyToLightError = checkHeavyToLightDifficulty(key, entry);
      if (heavyToLightError) errors.push(heavyToLightError);

      const coneNoteError = checkEquipmentConeNote(key, entry);
      if (coneNoteError) errors.push(coneNoteError);
    }
  }

  return errors;
}

/**
 * Verifie qu'UNE proposition reste coherente avec SA requete d'origine :
 * pas d'auto-reference, respect d'excludeIds, compatibilite douleur/age, et
 * verification precise du materiel quand l'entree de registre d'origine est
 * retrouvable (les propositions "rule" sont par construction bodyweight,
 * voir select.ts buildFallbackEntry -- rien a verifier cote materiel pour
 * elles). Retourne un tableau d'erreurs (vide = proposition valide).
 */
export function validateProposalAgainstRequest(proposal: ReplacementProposal, request: ReplacementRequest): string[] {
  const errors: string[] = [];
  if (!proposal || !request || !request.context) {
    errors.push("proposal ou request manquant/mal forme");
    return errors;
  }

  if (proposal.exerciseId === request.exerciseId) {
    errors.push(`auto-reference : la proposition "${proposal.exerciseId}" est identique a l'original`);
  }
  if (request.context.excludeIds.includes(proposal.exerciseId)) {
    errors.push(`"${proposal.exerciseId}" figure dans excludeIds (anti-boucle viole)`);
  }

  const altDef = EXERCISE_BY_ID[proposal.exerciseId];
  if (!altDef) {
    errors.push(`"${proposal.exerciseId}" introuvable dans EXERCISE_BY_ID`);
    return errors;
  }

  if (request.reason === "pain" || request.context.activePains.length > 0) {
    const forbidden = forbiddenTagsFromPains(request.context.activePains);
    const hit = altDef.tags.find((t) => forbidden.has(t));
    if (hit) {
      errors.push(`"${proposal.exerciseId}" porte le tag a risque "${hit}", incompatible avec la douleur active`);
    }
  }

  const risky = altDef.tags.some((t) => t === "heavy_lower" || t === "heavy_upper" || t === "impact");
  if (risky) {
    const requiredRank = ageRank("U15");
    const contextRank = ageRank(request.context.ageCategory);
    if (requiredRank !== null && (contextRank === null || contextRank < requiredRank)) {
      errors.push(`"${proposal.exerciseId}" porte un tag charge/impact incompatible avec l'age fourni (${request.context.ageCategory ?? "inconnu"})`);
    }
  }

  if (proposal.source === "registry") {
    const entries = REPLACEMENT_REGISTRY[request.exerciseId] ?? [];
    const entry = entries.find((e) => e.altExerciseId === proposal.exerciseId);
    if (entry) {
      const missing = entry.equipmentRequired.filter((eq) => !request.context.equipmentAvailable.includes(eq));
      if (missing.length > 0) {
        errors.push(`"${proposal.exerciseId}" exige du materiel absent du contexte : ${missing.join(", ")}`);
      }
    }
  }

  return errors;
}
