// domain/coachView/index.ts
//
// API PUBLIQUE de la couche de lecture coach.
// Les écrans importent d'ici et de nulle part ailleurs : c'est ce qui garantit
// qu'aucune UI ne lit un champ brut de la projection serveur.

export * from "./types";
export { toCoachPlayerView, toCoachPlayerViews, ASSIDUITE_JOURS, ASSIDUITE_JOURS_COURTS } from "./fromSummary";
export {
  COACH_FOCUS_PAIRS,
  COACH_TITLE_COHERENCES,
  checkSessionTitleCoherence,
  expectedTitleForFocusLabel,
  reconcileSessionTitle,
  type CoachFocusPair,
  type CoachTitleCoherence,
} from "./sessionTitle";
export {
  COACH_EXECUTION_CATEGORIES,
  COACH_EXECUTION_CATEGORIE_LABEL,
  COACH_EXECUTION_OPAQUE_MOTIFS,
  COACH_EXECUTION_OPAQUE_TEXTE,
  COACH_EXECUTION_POIDS,
  COACH_EXECUTION_REGLE,
  buildExecutionBreakdown,
  type CoachExecutionBreakdown,
  type CoachExecutionCategorie,
  type CoachExecutionLigne,
  type CoachExecutionOpaqueMotif,
} from "./execution";
export {
  coachDonneesPartiellesNote,
  coachStatusLabel,
  coachStatusPrecision,
} from "./statusLabel";
export {
  COACH_AGE_CATEGORY_DISPLAY,
  COACH_LEVEL_DISPLAY,
  COACH_POSITION_DISPLAY,
  coachAgeCategoryLabel,
  coachIdentityLine,
  coachLevelLabel,
  coachPositionLabel,
} from "./identityLabels";
export {
  aDesDonneesManquantes,
  buildAttentionSignals,
  INACTIVITE_WATCH_JOURS,
  INACTIVITE_CHECK_JOURS,
  SAUTS_CHECK,
  ADAPTATIONS_WATCH,
  COUPURE_JOURS,
  RETOUR_RECENT_JOURS,
  type CoachAttentionOutcome,
} from "./attention";
export {
  COACH_ROSTER_FILTERS,
  COACH_ROSTER_FILTER_LABEL,
  COACH_ROSTER_SORTS,
  COACH_ROSTER_SORT_LABEL,
  aDevieDeSaSeance,
  aUneSeanceNonFaite,
  buildCoachRoster,
  countCoachRosterFilters,
  matchesCoachFilter,
  matchesCoachSearch,
  normalizeSearchText,
  sansDonneeRecente,
  sortCoachViews,
  type CoachRosterFilter,
  type CoachRosterOptions,
  type CoachRosterSort,
} from "./roster";
export { buildPlayerTimeline, timelineEventDateLabel } from "./timeline";
export { buildWeekDigest, weekDayKeys, type CoachWeekDigestOptions } from "./week";
export { buildFreshness, buildFreshnessLabel, FRAICHEUR_PERIMEE_MIN } from "./freshness";
export {
  addDaysToKey,
  diffDaysBetweenKeys,
  elapsedLabel,
  isValidDateKey,
  keyToUtcMs,
} from "./dates";
