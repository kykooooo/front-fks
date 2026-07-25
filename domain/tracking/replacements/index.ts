// domain/tracking/replacements/index.ts
// Point d'entree public du module de remplacement d'exercice (Lot 3).
export {
  MAX_PROPOSALS_PER_ITEM,
  PAIN_ZONE_TAGS,
  selectReplacement,
} from "./select";

export {
  FALLBACK_POOLS,
  FAMILY_BY_ID,
  IMPORTANT_EXERCISE_IDS,
  NEUTRAL_TAGS,
  REPLACEMENT_REGISTRY,
  STRESS_TAGS,
  buildCoverageReport,
} from "./registry";
export type { CoverageReport } from "./registry";

export {
  checkEquipmentConeNote,
  checkHeavyToLightDifficulty,
  validateFallbackPoolsIntegrity,
  validateProposalAgainstRequest,
  validateRegistryIntegrity,
} from "./contract";
