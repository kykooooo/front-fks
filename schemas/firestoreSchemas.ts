// schemas/firestoreSchemas.ts
// Zod schemas for Firestore documents — used to validate snap.data() before consumption.
// Each schema uses .catch() liberally so safeParse never crashes: invalid fields
// fall back to safe defaults, and the caller logs which fields failed.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOW_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const dowString = z.string().refine((v) => (DOW_VALUES as readonly string[]).includes(v));

/** Log validation issues at __DEV__ level, never crash. */
export function logValidationIssues(
  label: string,
  docId: string | undefined,
  issues: z.core.$ZodIssue[],
) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const summary = issues
      .slice(0, 5)
      .map((i) => `  ${(i.path ?? []).join(".")}: ${i.message}`)
      .join("\n");
    console.warn(
      `[Zod] ${label} (doc: ${docId ?? "?"}): ${issues.length} issue(s)\n${summary}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Injury base schemas (déclarés avant userProfile pour la référence)
// ---------------------------------------------------------------------------

const INJURY_AREAS = [
  "cheville", "genou", "ischio", "quadriceps", "mollet",
  "hanche", "dos", "épaule", "poignet", "autre",
] as const;

// Schéma de base (non-null) réutilisable :
//   - `dailyFeedback.injury` l'enveloppe en `.nullable().optional().catch(null)`
//     (la blessure peut être absente d'un feedback quotidien).
//   - `userProfile.activeInjuries[]` utilise la version non-null directement
//     (chaque entrée du tableau est garantie non-null, la liste vide sert
//     de défaut via `.catch([])` au niveau du profil).
const injuryRecordBaseSchema = z.object({
  area: z.string().catch("autre"),
  severity: z.number().min(0).max(3).catch(0),
  type: z.enum(["aigu", "chronique"]).catch("aigu"),
  restrictions: z.object({
    avoidSprint: z.boolean().optional().catch(false),
    avoidPlyo: z.boolean().optional().catch(false),
    avoidHeavyLower: z.boolean().optional().catch(false),
    avoidHeavyUpper: z.boolean().optional().catch(false),
    avoidCutsImpacts: z.boolean().optional().catch(false),
    avoidOverhead: z.boolean().optional().catch(false),
  }).catch({}),
  startDate: z.string().catch(""),
  lastConfirm: z.string().catch(""),
  note: z.string().nullable().optional().catch(null),
});

// Version pour `userProfile.activeInjuries[]` : exportée pour réutilisation.
export const activeInjurySchema = injuryRecordBaseSchema;
export type ActiveInjuryParsed = z.infer<typeof activeInjurySchema>;

// ---------------------------------------------------------------------------
// 1. User Profile  — users/{uid}
// ---------------------------------------------------------------------------

const autoExternalEntrySchema = z.object({
  rpe: z.number().min(1).max(10).catch(5),
  durationMin: z.number().min(0).catch(60),
});

export const userProfileSchema = z.object({
  // Identity
  firstName: z.string().nullable().optional().catch(null),
  level: z.string().nullable().optional().catch(null),
  position: z.string().nullable().optional().catch(null),
  dominantFoot: z.string().nullable().optional().catch(null),
  mainObjective: z.string().nullable().optional().catch(null),

  // Training schedule
  clubTrainingDays: z.array(dowString).catch([]),
  matchDay: z.string().nullable().optional().catch(null),
  matchDays: z.array(z.string()).catch([]),
  clubTrainingsPerWeek: z.number().min(0).catch(0),
  matchesPerWeek: z.number().min(0).catch(0),
  targetFksSessionsPerWeek: z.number().min(0).nullable().optional().catch(null),

  // Time & equipment
  available_time_min: z.number().min(0).nullable().optional().catch(null),
  availableTimeMin: z.number().min(0).nullable().optional().catch(null),
  hasGymAccess: z.string().nullable().optional().catch(null),
  gymEquipment: z.array(z.string()).catch([]),
  homeEquipment: z.array(z.string()).catch([]),

  // Microcycle
  microcycleGoal: z.string().nullable().optional().catch(null),
  microcycleSessionIndex: z.number().min(0).catch(0),
  explosivite_playlist_len: z.number().nullable().optional().catch(null),
  explosivitePlaylistLen: z.number().nullable().optional().catch(null),

  // Pathway
  activePathwayId: z.string().nullable().optional().catch(null),
  activePathwayIndex: z.number().min(0).catch(0),

  // Auto-external config
  clubTypicalRPE: z.number().min(1).max(10).nullable().optional().catch(null),
  clubTypicalDurationMin: z.number().min(0).nullable().optional().catch(null),
  matchTypicalRPE: z.number().min(1).max(10).nullable().optional().catch(null),
  matchTypicalDurationMin: z.number().min(0).nullable().optional().catch(null),

  // Zones sensibles actives (MVP blessures Jour 2).
  // Sérialisé par aiContext vers constraints.pains[] via shared/injuryMapping.
  // `.catch([])` neutralise les profils legacy (pas de migration active requise).
  activeInjuries: z.array(activeInjurySchema).catch([]),

  // Consentement RGPD art. 9 (données de santé) — MVP blessures Jour 3.
  // Donné à l'inscription via les 2 checkboxes de l'étape 4 (médical + RGPD).
  // `version` permet de forcer un re-consentement si la politique change.
  // Absent tant que le joueur n'a pas déclaré de zone sensible.
  healthConsent: z
    .object({
      givenAt: z.string().catch(""),
      version: z.string().catch("1.0"),
    })
    .nullable()
    .optional()
    .catch(null),

  // MVP blessures Jour 4 — timestamp ISO du dernier acquittement manuel
  // d'un pic de douleur via PainSpikeModal (bouton "J'ai consulté, la
  // déclaration reste active"). Empêche la carte injury_pain_spike de
  // re-déclencher sur le même feedback quand l'utilisateur a déjà répondu.
  lastSeenPainSpike: z.string().nullable().optional().catch(null),
}).passthrough(); // allow extra Firestore fields we don't care about

export type UserProfileParsed = z.infer<typeof userProfileSchema>;

// ---------------------------------------------------------------------------
// 2. Completed Session  — users/{uid}/sessions/{id}
// ---------------------------------------------------------------------------

const sessionFeedbackSchema = z.object({
  fatigue: z.number().min(1).max(5).catch(3),
  sleep: z.number().min(1).max(5).catch(3),
  pain: z.number().min(0).max(10).catch(0),
  notes: z.string().nullable().optional().catch(null),
}).nullable().optional().catch(null);

const PHASE_VALUES = ["Playlist", "Construction", "Progression", "Performance", "Deload"] as const;
const FOCUS_VALUES = ["run", "strength", "speed", "circuit", "plyo", "mobility", "endurance", "threshold", "mixed"] as const;
const INTENSITY_VALUES = ["easy", "moderate", "hard", "max"] as const;
const SESSION_STATUS_VALUES = ["planned", "in_progress", "completed"] as const;

const exerciseSchema = z.object({
  id: z.string().catch("unknown"),
  name: z.string().catch("Exercice"),
  modality: z.string().catch("run"),
  sets: z.number().nullable().optional().catch(null),
  reps: z.number().nullable().optional().catch(null),
  durationSec: z.number().nullable().optional().catch(null),
  restSec: z.number().nullable().optional().catch(null),
  intensity: z.string().nullable().optional().catch(null),
  notes: z.string().nullable().optional().catch(null),
}).passthrough();

export const completedSessionSchema = z.object({
  id: z.string().optional().catch(undefined),
  date: z.string().catch(""),
  dateISO: z.string().optional().catch(undefined),
  phase: z.string().catch("Playlist"),
  focus: z.string().catch("run"),
  intensity: z.string().catch("moderate"),
  plannedLoad: z.number().min(0).optional().catch(undefined),
  exercises: z.array(exerciseSchema).catch([]),
  status: z.enum(SESSION_STATUS_VALUES).optional().catch(undefined),
  startedAt: z.union([z.string(), z.null()]).optional().catch(undefined),
  completedAt: z.union([z.string(), z.null()]).optional().catch(undefined),
  rpe: z.number().min(1).max(10).nullable().optional().catch(null),
  feedback: sessionFeedbackSchema,
  ai: z.record(z.string(), z.unknown()).nullable().optional().catch(null),
  completed: z.boolean().optional().catch(undefined),
}).passthrough();

export type CompletedSessionParsed = z.infer<typeof completedSessionSchema>;

// ---------------------------------------------------------------------------
// 3. Planned Session  — users/{uid}/plannedSessions/{id}
// ---------------------------------------------------------------------------

export const plannedSessionSchema = z.object({
  id: z.string().optional().catch(undefined),
  date: z.string().catch(""),
  phase: z.string().catch("Playlist"),
  focus: z.string().catch("run"),
  intensity: z.string().catch("moderate"),
  plannedLoad: z.number().min(0).catch(0),
  exercises: z.array(exerciseSchema).catch([]),
  status: z.enum(SESSION_STATUS_VALUES).optional().catch(undefined),
  startedAt: z.union([z.string(), z.null()]).optional().catch(undefined),
  completedAt: z.union([z.string(), z.null()]).optional().catch(undefined),
  ai: z.record(z.string(), z.unknown()).nullable().optional().catch(null),
}).passthrough();

export type PlannedSessionParsed = z.infer<typeof plannedSessionSchema>;

// ---------------------------------------------------------------------------
// 4. Daily Feedback / Injury (embedded in dayStates)
// ---------------------------------------------------------------------------
// NOTE : `injuryRecordBaseSchema` + `activeInjurySchema` sont déclarés plus
// haut dans ce fichier (avant `userProfileSchema`) pour permettre la
// référence depuis `userProfile.activeInjuries[]`.

// Version pour `dailyFeedback.injury` : peut être null/absente.
const injuryRecordSchema = injuryRecordBaseSchema.nullable().optional().catch(null);

export const dailyFeedbackSchema = z.object({
  fatigue: z.number().min(1).max(5).catch(3),
  // Pain sur échelle EVA 0-10 (unification — était 0-5 en daily mais
  // sessionFeedback acceptait déjà 0-10 depuis longtemps, d'où le conflit).
  // Voir INJURY_IA_CHARTER.md règle 5.
  pain: z.number().min(0).max(10).catch(0),
  recoveryPerceived: z.number().min(1).max(5).optional().catch(undefined),
  injury: injuryRecordSchema,
  timestamp: z.string().catch(""),
});

export type DailyFeedbackParsed = z.infer<typeof dailyFeedbackSchema>;
