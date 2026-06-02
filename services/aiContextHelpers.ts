// services/aiContextHelpers.ts
//
// Helpers purs (aucune dependance Firebase / Zustand / DOM) utilises pour construire
// le payload `recent_fks_sessions` envoye au backend. Sortis de aiContext.ts pour :
//  - faciliter les tests unitaires (jest n'a plus a parser firebase ESM)
//  - garantir qu'un changement ici n'impacte pas la lecture des stores
//
// Le fichier `aiContext.ts` reexporte tout ce dont les autres ecrans ont besoin.

import { toDateKey } from "../utils/dateHelpers";
import type { Session, Exercise, ClubTrainingIntensity, ClubWeekGoal, ClubTeamGender } from "../domain/types";
import { normalizeClubTrainingIntensity, normalizeClubWeekGoal } from "../domain/types";

// ---- Contexte club (semaine) ----------------------------------------------

export type ClubContextPayload = {
  training_intensity?: ClubTrainingIntensity;
  week_goal?: ClubWeekGoal;
  note?: string;
  week_key?: string;
  /** Genre d'équipe (attribut équipe, jamais individuel). Oriente le focus neuromusculaire. */
  team_gender?: ClubTeamGender;
};

/**
 * Construit le `club_context` envoyé au backend depuis le doc weekContext brut.
 * Pur (aucune dépendance Firebase). Retourne null si rien d'exploitable —
 * on n'invente jamais de valeur et on ne casse jamais la génération.
 */
export function buildClubContextPayload(
  raw: Record<string, unknown> | null | undefined,
  weekKey?: string | null,
): ClubContextPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const ti = normalizeClubTrainingIntensity((raw as any).trainingIntensity);
  const wg = normalizeClubWeekGoal((raw as any).weekGoal);
  if (!ti && !wg) return null;
  const noteRaw = typeof (raw as any).note === "string" ? (raw as any).note.trim() : "";
  return {
    ...(ti ? { training_intensity: ti } : {}),
    ...(wg ? { week_goal: wg } : {}),
    ...(noteRaw ? { note: noteRaw.slice(0, 200) } : {}),
    ...(weekKey ? { week_key: weekKey } : {}),
  };
}

// ---- Types publics ---------------------------------------------------------

export type FKS_PhaseId =
  | "playlist"
  | "construction"
  | "progression"
  | "performance"
  | "deload";

export type FKS_SessionFocus =
  | "run"
  | "strength"
  | "speed"
  | "circuit"
  | "plyo"
  | "mobility";

export type FKS_IntensityLevel = "easy" | "moderate" | "hard";

/**
 * Limite d'envoi des seances recentes au backend.
 * Aligne sur `computeFeedbackAdjustments` (../fks/src/fksOrchestrator.ts:329 → slice(0, 8))
 * et `detectFatigueTrend` qui exploite jusqu'a 7 points sur fenetre 14 jours.
 */
export const RECENT_FKS_SESSION_LIMIT = 8;

/**
 * Limite des sources cote frontend (badges, narratif).
 * Plus petite que la limite d'envoi : les badges et le summary text restent
 * sur 5 pour eviter de saturer la copy IA.
 */
export const RECENT_FKS_COPY_LIMIT = 5;

export interface FKS_RecentSessionSummary {
  date: string;
  date_relative: string;
  label: string;

  phase: FKS_PhaseId;
  focus_primary: FKS_SessionFocus;
  focus_secondary?: FKS_SessionFocus | null;
  strength_region?: "upper" | "lower" | "both" | string;

  intensity: FKS_IntensityLevel;
  rpe: number;
  duration_min: number;

  // Champs additionnels exploites cote backend pour les adaptations.
  pain_level_after?: number;
  soreness_zones_after?: string[];
  perceived_difficulty?: "trop_facile" | "ok" | "très_dur";
  completed_as_planned?: boolean;
  feedback?: {
    rpe?: number;
    pain?: number;
    pain_scale?: "0-10";
    fatigue?: number;
    recovery_perceived?: number;
    duration_min?: number;
    created_at?: string;
    comment?: string;
  };
  metrics?: {
    atl?: number;
    ctl?: number;
    tsb?: number;
  };
  ai?: {
    rpe_target?: number;
  };
}

// ---- Helpers internes -------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readPath(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function firstNumberFromPaths(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    const n = finiteNumber(readPath(root, path));
    if (n !== null) return n;
  }
  return null;
}

function firstStringArrayFromPaths(
  root: unknown,
  paths: string[][]
): string[] | undefined {
  for (const path of paths) {
    const raw = readPath(root, path);
    if (!Array.isArray(raw)) continue;
    const values = raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    if (values.length > 0) return Array.from(new Set(values));
  }
  return undefined;
}

// ---- Normalisations / extractions exposees ---------------------------------

export function toFksIntensity(x: string | null | undefined): FKS_IntensityLevel {
  const k = String(x || "").toLowerCase();
  if (k.includes("hard") || k.includes("max")) return "hard";
  if (k.includes("mod")) return "moderate";
  return "easy";
}

export function toFksFocus(modality: string | null | undefined): FKS_SessionFocus {
  const k = String(modality || "").toLowerCase();
  if (["strength", "force", "muscu"].some((t) => k.includes(t))) return "strength";
  if (["speed", "vma", "sprint"].some((t) => k.includes(t))) return "speed";
  if (["circuit", "core", "wod"].some((t) => k.includes(t))) return "circuit";
  if (["plyo"].some((t) => k.includes(t))) return "plyo";
  if (["mobility", "mobilite", "stretch"].some((t) => k.includes(t))) return "mobility";
  return "run";
}

export function focusFromExercises(
  session: Pick<Session, "exercises" | "focus" | "modality">
): { primary: FKS_SessionFocus; secondary: FKS_SessionFocus | null } {
  const exos: Exercise[] = Array.isArray(session?.exercises) ? session.exercises : [];
  if (!exos.length) {
    const f = toFksFocus(session?.focus ?? session?.modality);
    return { primary: f, secondary: null };
  }

  const tally = new Map<FKS_SessionFocus, number>();
  exos.forEach((e) => {
    const mod = toFksFocus(e?.modality);
    const weight =
      typeof e?.durationSec === "number" && Number.isFinite(e.durationSec)
        ? e.durationSec / 60
        : typeof e?.sets === "number" && Number.isFinite(e.sets)
          ? e.sets
          : 1;
    tally.set(mod, (tally.get(mod) ?? 0) + weight);
  });

  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0]?.[0] ?? toFksFocus(session?.focus ?? session?.modality);
  const secondary = sorted[1]?.[0] ?? null;
  return { primary, secondary };
}

export function inferStrengthRegion(
  exercises: Pick<Exercise, "name" | "id">[]
): "upper" | "lower" | "both" | null {
  const lowerKeys = [
    "squat", "hinge", "deadlift", "rdl", "split", "lunge",
    "hip", "glute", "ham", "posterior", "quad", "calf", "copenhagen",
  ];
  const upperKeys = [
    "press", "row", "pull", "push", "bench", "shoulder",
    "overhead", "landmine", "curl", "triceps", "biceps",
  ];
  let hasLower = false;
  let hasUpper = false;
  exercises.forEach((e) => {
    const name = `${e?.name ?? e?.id ?? ""}`.toLowerCase();
    if (lowerKeys.some((k) => name.includes(k))) hasLower = true;
    if (upperKeys.some((k) => name.includes(k))) hasUpper = true;
  });
  if (hasLower && hasUpper) return "both";
  if (hasLower) return "lower";
  if (hasUpper) return "upper";
  return null;
}

/**
 * Normalise la douleur per ue cote app (echelle 0-5) vers l'echelle backend (0-10).
 *
 * Pourquoi : le frontend stocke `SessionFeedback.pain` en `Rating0to5` (cf. domain/types.ts),
 * tandis que le backend `computeFeedbackAdjustments` (../fks/src/fksOrchestrator.ts:339) lit
 * `s.feedback.pain` et applique le seuil `pain >= 6` pour considerer une douleur haute.
 * Sans normalisation, une gene 3/5 (marquee) cote app reste a 3 cote backend et n'est jamais
 * comptee comme douleur haute → la regle "pain_high >= 3" ne se declenche jamais.
 *
 * Regle : `pain_app * 2`, clampe a 10. Une valeur deja sur 6-10 (saisie debug, payload
 * legacy) est conservee telle quelle pour ne pas la diviser deux fois.
 */
export function normalizeFeedbackPainForBackend(rawPain: number): number {
  const pain = Math.max(0, rawPain);
  return Math.min(10, Math.round(pain <= 5 ? pain * 2 : pain));
}

export function readSessionMetrics(
  session: Session
): FKS_RecentSessionSummary["metrics"] | undefined {
  const atl = firstNumberFromPaths(session, [
    ["metrics", "atl"],
    ["load", "atl"],
    ["aiV2", "metrics", "atl"],
    ["aiV2", "load_metrics", "atl"],
    ["aiV2", "selection_debug", "metrics", "atl"],
    ["ai", "metrics", "atl"],
    ["ai", "load_metrics", "atl"],
  ]);
  const ctl = firstNumberFromPaths(session, [
    ["metrics", "ctl"],
    ["load", "ctl"],
    ["aiV2", "metrics", "ctl"],
    ["aiV2", "load_metrics", "ctl"],
    ["aiV2", "selection_debug", "metrics", "ctl"],
    ["ai", "metrics", "ctl"],
    ["ai", "load_metrics", "ctl"],
  ]);
  const tsb = firstNumberFromPaths(session, [
    ["metrics", "tsb"],
    ["load", "tsb"],
    ["aiV2", "metrics", "tsb"],
    ["aiV2", "load_metrics", "tsb"],
    ["aiV2", "selection_debug", "metrics", "tsb"],
    ["ai", "metrics", "tsb"],
    ["ai", "load_metrics", "tsb"],
  ]);

  const metrics: NonNullable<FKS_RecentSessionSummary["metrics"]> = {};
  if (atl !== null) metrics.atl = atl;
  if (ctl !== null) metrics.ctl = ctl;
  if (tsb !== null) metrics.tsb = tsb;
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

export function readSessionRpeTarget(session: Session): number | null {
  return firstNumberFromPaths(session, [
    ["ai", "rpe_target"],
    ["ai", "rpeTarget"],
    ["aiV2", "rpe_target"],
    ["aiV2", "rpeTarget"],
    ["rpe_target"],
    ["rpeTarget"],
  ]);
}

function readSessionSorenessZones(session: Session): string[] | undefined {
  return firstStringArrayFromPaths(session, [
    ["feedback", "soreness_zones_after"],
    ["feedback", "sorenessZones"],
    ["feedback", "painZones"],
    ["feedback", "pains"],
    ["soreness_zones_after"],
    ["sorenessZones"],
    ["painZones"],
    ["pains"],
  ]);
}

export function buildRecentFeedbackPayload(
  session: Session,
  rpeVal: number
): FKS_RecentSessionSummary["feedback"] | undefined {
  const rawPain = firstNumberFromPaths(session, [["feedback", "pain"], ["pain_level_after"]]);
  const fatigue = firstNumberFromPaths(session, [["feedback", "fatigue"], ["fatigue"]]);
  const recovery = firstNumberFromPaths(session, [
    ["feedback", "recoveryPerceived"],
    ["feedback", "recovery_perceived"],
    ["recoveryPerceived"],
  ]);
  const durationMin = finiteNumber(readPath(session, ["feedback", "durationMin"]));
  const createdAt = readPath(session, ["feedback", "createdAt"]);
  const comment = readPath(session, ["feedback", "comment"]);

  const feedback: NonNullable<FKS_RecentSessionSummary["feedback"]> = {};
  if (Number.isFinite(rpeVal) && rpeVal > 0) feedback.rpe = rpeVal;
  if (rawPain !== null) {
    feedback.pain = normalizeFeedbackPainForBackend(rawPain);
    feedback.pain_scale = "0-10";
  }
  if (fatigue !== null) feedback.fatigue = fatigue;
  if (recovery !== null) feedback.recovery_perceived = recovery;
  if (durationMin !== null) feedback.duration_min = durationMin;
  if (typeof createdAt === "string" && createdAt.trim()) feedback.created_at = createdAt;
  if (typeof comment === "string" && comment.trim()) feedback.comment = comment.trim();

  return Object.keys(feedback).length > 0 ? feedback : undefined;
}

/**
 * Construit la representation d'une seance recente pour le payload backend.
 * Pure : ne lit aucun store. Passe en parametre la `Session` du domaine et la
 * phase a utiliser quand la seance n'en porte pas.
 */
export function buildRecentFksSessionSummary(
  s: Session,
  fallbackPhase: FKS_PhaseId
): FKS_RecentSessionSummary {
  const dateISO: string =
    typeof s?.dateISO === "string"
      ? toDateKey(s.dateISO)
      : typeof s?.date === "string"
        ? toDateKey(s.date)
        : "";

  const intensity = toFksIntensity(s?.intensity);
  const exos: Exercise[] = Array.isArray(s?.exercises) ? s.exercises : [];
  const { primary: focus, secondary } = focusFromExercises(s);
  const strengthRegion = focus === "strength" ? inferStrengthRegion(exos) : null;
  const phaseRecent: FKS_PhaseId =
    typeof s?.phase === "string"
      ? ((s.phase.toLowerCase() as FKS_PhaseId) ?? fallbackPhase)
      : fallbackPhase;

  const rpeVal =
    typeof s?.feedback?.rpe === "number"
      ? s.feedback.rpe
      : typeof s?.rpe === "number"
        ? s.rpe
        : 0;

  const duration =
    typeof s?.durationMin === "number"
      ? s.durationMin
      : Number.isFinite(s?.volumeScore)
        ? Math.max(15, Math.round(Number(s.volumeScore)))
        : 45;

  const rawPain = firstNumberFromPaths(s, [["feedback", "pain"], ["pain_level_after"]]);
  const painLevelAfter =
    rawPain !== null
      ? Math.max(0, Math.min(5, rawPain > 5 ? rawPain / 2 : rawPain))
      : null;
  const sorenessZones = readSessionSorenessZones(s);
  const feedbackPayload = buildRecentFeedbackPayload(s, rpeVal);
  const metricsPayload = readSessionMetrics(s);
  const rpeTarget = readSessionRpeTarget(s);

  const label = s?.title ? String(s.title) : `Séance ${focus}`;

  return {
    date: dateISO,
    date_relative: "",
    label,
    phase: phaseRecent,
    focus_primary: focus,
    focus_secondary: secondary,
    ...(strengthRegion ? { strength_region: strengthRegion } : {}),
    intensity,
    rpe: rpeVal,
    duration_min: duration,
    ...(painLevelAfter !== null ? { pain_level_after: painLevelAfter } : {}),
    ...(sorenessZones ? { soreness_zones_after: sorenessZones } : {}),
    ...(feedbackPayload ? { feedback: feedbackPayload } : {}),
    ...(metricsPayload ? { metrics: metricsPayload } : {}),
    ...(rpeTarget !== null ? { ai: { rpe_target: rpeTarget } } : {}),
  };
}

/**
 * Construit le tableau `recent_fks_sessions` pour le payload backend.
 * Limite par defaut alignee sur ce que le backend exploite (slice(0, 8)).
 */
export function buildRecentFksSessionsPayload(
  sessions: Session[],
  fallbackPhase: FKS_PhaseId,
  limit: number = RECENT_FKS_SESSION_LIMIT
): FKS_RecentSessionSummary[] {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  return sessions
    .slice(0, Math.max(0, limit))
    .map((s) => buildRecentFksSessionSummary(s, fallbackPhase));
}

export function buildRecentByFocus(
  sessions: Session[],
  limit = 3
): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b?.dateISO ?? b?.date ?? 0).getTime() -
      new Date(a?.dateISO ?? a?.date ?? 0).getTime()
  );
  sorted.forEach((s) => {
    const exos: Exercise[] = Array.isArray(s?.exercises) ? s.exercises : [];
    const focus = toFksFocus(s?.focus ?? s?.modality);
    if (!exos.length) return;
    res[focus] = res[focus] ?? [];
    for (const e of exos) {
      const name = (e?.name ?? e?.id ?? "").toString().trim();
      if (!name || res[focus].includes(name)) continue;
      res[focus].push(name);
      if (res[focus].length >= limit) break;
    }
  });
  return res;
}
