// services/aiContextHelpers.ts
//
// Helpers purs (aucune dependance Firebase / Zustand / DOM) utilises pour construire
// le payload `recent_fks_sessions` envoye au backend. Sortis de aiContext.ts pour :
//  - faciliter les tests unitaires (jest n'a plus a parser firebase ESM)
//  - garantir qu'un changement ici n'impacte pas la lecture des stores
//
// Le fichier `aiContext.ts` reexporte tout ce dont les autres ecrans ont besoin.

import { toDateKey, lastNDates } from "../utils/dateHelpers";
import { estSeanceArtificielle } from "../utils/sessionHelpers";
import type { Session, Exercise, ClubTrainingIntensity, ClubWeekGoal, ClubTeamGender, DailyFeedback, InjuryRecord } from "../domain/types";
import { normalizeClubTrainingIntensity, normalizeClubWeekGoal } from "../domain/types";
import { INJURY_AREA_TO_BACKEND_PAIN, mapAreaToPain, type BackendPainToken } from "../shared/injuryMapping";
// Import type-only : aucun cout runtime (erase par tsc/babel), evite un import
// reel de services/ vers screens/ (testConfig.ts importe @expo/vector-icons
// pour le typage des icones de groupe, inutile ici).
import type { TestEntry, FieldKey } from "../screens/tests/testConfig";

// ---- Contexte club (semaine) ----------------------------------------------

export type ClubContextPayload = {
  training_intensity?: ClubTrainingIntensity;
  week_goal?: ClubWeekGoal;
  note?: string;
  week_key?: string;
  /** Genre d'équipe (attribut équipe, jamais individuel). Oriente le focus neuromusculaire. */
  team_gender?: ClubTeamGender;
  /** Match prévu ce week-end (trace coach). Le backend peut l'ignorer sans risque. */
  match_this_weekend?: boolean;
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
  const matchThisWeekend = (raw as any).matchThisWeekend;
  return {
    ...(ti ? { training_intensity: ti } : {}),
    ...(wg ? { week_goal: wg } : {}),
    ...(noteRaw ? { note: noteRaw.slice(0, 200) } : {}),
    ...(weekKey ? { week_key: weekKey } : {}),
    ...(typeof matchThisWeekend === "boolean" ? { match_this_weekend: matchThisWeekend } : {}),
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

  // Historique enrichi (repare la memoire anti-repetition backend, cf.
  // INDIVIDUALISATION_FINE_DESIGN.md §7.1 : "cycle"/"archetype_id" absents
  // aujourd'hui). Omis si non disponible sur la session locale — jamais invente.
  /** Goal canonique (fondation/force/endurance/explosivite/saison) du cycle actif au moment de la seance. */
  cycle?: string;
  /** Identifiant d'archetype backend ayant genere la seance. */
  archetype_id?: string;
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

function firstStringFromPaths(root: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const raw = readPath(root, path);
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
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

/**
 * Lit l'archetype_id ayant genere la seance (aiV2.archetypeId, deja stocke
 * localement depuis `snakeToCamel(parsed.data)` dans screens/newSession/api.ts
 * -> orchestrator.ts attache tout `v2` sur `session.aiV2`). Absent = null,
 * jamais invente.
 */
export function readSessionArchetypeId(session: Session): string | null {
  return firstStringFromPaths(session, [
    ["aiV2", "archetypeId"],
    ["aiV2", "archetype_id"],
    ["archetypeId"],
    ["archetype_id"],
  ]);
}

/**
 * Lit le cycle canonique actif au moment de la seance. Source : le
 * `player_context.cycle_key` deterministe renvoye par le backend a chaque
 * generation, deja present dans `session.aiV2.playerContext.cycleKey` (camelCase
 * via snakeToCamel) meme si rien ne l'affiche encore cote UI. Absent = null.
 */
export function readSessionCycle(session: Session): string | null {
  return firstStringFromPaths(session, [
    ["aiV2", "playerContext", "cycleKey"],
    ["aiV2", "playerContext", "cycle_key"],
    ["aiV2", "cycleKey"],
    ["aiV2", "cycle_key"],
    ["cycle"],
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
  const archetypeId = readSessionArchetypeId(s);
  const cycle = readSessionCycle(s);

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
    ...(cycle ? { cycle } : {}),
    ...(archetypeId ? { archetype_id: archetypeId } : {}),
  };
}

/**
 * Construit le tableau `recent_fks_sessions` pour le payload backend.
 * Limite par defaut alignee sur ce que le backend exploite (slice(0, 8)).
 *
 * Les séances artificielles (ancienne "séance de secours" fabriquée par l'app)
 * ne partent JAMAIS au moteur : ce serait lui présenter comme du vécu une
 * séance que personne n'a prescrite, et polluer sa mémoire anti-répétition
 * avec un footing qui n'a jamais été programmé.
 */
export function buildRecentFksSessionsPayload(
  sessions: Session[],
  fallbackPhase: FKS_PhaseId,
  limit: number = RECENT_FKS_SESSION_LIMIT
): FKS_RecentSessionSummary[] {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  return sessions
    .filter((s) => !estSeanceArtificielle(s))
    .slice(0, Math.max(0, limit))
    .map((s) => buildRecentFksSessionSummary(s, fallbackPhase));
}

export function buildRecentByFocus(
  sessions: Session[],
  limit = 3
): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  // Même règle que buildRecentFksSessionsPayload : rien d'artificiel ne sort.
  const sorted = [...sessions]
    .filter((s) => !estSeanceArtificielle(s))
    .sort(
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

// ---- Douleurs / blessures -> constraints.pains ------------------------------
//
// Le backend attend `constraints.pains: string[]` (tokens `ankle_pain`, ...)
// et `constraints.injury_max_severity: 0..3` (fksOrchestrator.ts:1879).
// Source front : l'InjuryRecord declare au feedback post-seance
// (FeedbackScreen -> useFeedbackStore.setInjury -> dayStates[day].feedback.injury).
//
// FENETRE D'ACTIVITE (choix conservateur, documente) :
// InjuryRecord n'a pas de statut actif/resolu explicite. Une blessure declaree
// hier soir doit encore contraindre la seance d'aujourd'hui et des jours
// suivants — on ne lit donc PAS que le dayState du jour. Regle retenue :
//   - une declaration avec severity >= 1 reste ACTIVE pendant
//     INJURY_ACTIVE_WINDOW_DAYS jours (jour de declaration inclus) ;
//   - par zone, la declaration LA PLUS RECENTE fait foi : re-declarer
//     renouvelle la fenetre, declarer severity 0 ("OK" dans InjuryForm)
//     leve explicitement la contrainte pour cette zone ;
//   - un feedback ulterieur SANS blessure (injury: null, toggle "Aucune"
//     par defaut) ne leve RIEN : dans le doute on TRANSMET la douleur,
//     c'est le backend qui decide quoi en faire.
// 7 jours : couvre l'ecart max realiste entre deux feedbacks (2-3 seances
// FKS/semaine) sans qu'une gene oubliee d'il y a un mois bride le joueur
// pour toujours. Levee anticipee possible via severity 0.
export const INJURY_ACTIVE_WINDOW_DAYS = 7;
export const INJURY_ACTIVE_MIN_SEVERITY = 1;

/** Tokens backend connus (valeurs du mapping + groin_pain, non emis en MVP). */
const KNOWN_PAIN_TOKENS: ReadonlySet<string> = new Set<string>([
  ...Object.values(INJURY_AREA_TO_BACKEND_PAIN),
  "groin_pain",
]);

/**
 * Normalise une entree douleur brute (legacy `feedback.pains` / `painZones`)
 * vers un token backend : token deja valide -> passe tel quel, zone fr -> mappee,
 * inconnu -> null (jamais d'invention).
 */
export function normalizePainEntry(raw: unknown): BackendPainToken | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (KNOWN_PAIN_TOKENS.has(s)) return s as BackendPainToken;
  return mapAreaToPain(s);
}

export type ActivePainConstraints = {
  /** Tokens backend a envoyer dans `constraints.pains` (tries, dedupliques). */
  pains: BackendPainToken[];
  /** Severite max des blessures actives (0 = aucune) -> `constraints.injury_max_severity`. */
  injuryMaxSeverity: number;
};

type DayStateLike = { feedback?: DailyFeedback | null } | null | undefined;

/**
 * Collecte les douleurs actives sur la fenetre glissante et les traduit en
 * contraintes backend. Pur (aucune dependance store) : recoit `dayStates` et
 * la cle du jour, pour rester testable avec une horloge virtuelle.
 */
export function collectActivePainConstraints(
  dayStates: Record<string, DayStateLike> | null | undefined,
  todayKey: string
): ActivePainConstraints {
  const tokens = new Set<BackendPainToken>();
  let injuryMaxSeverity = 0;
  if (!dayStates || !todayKey) return { pains: [], injuryMaxSeverity };

  // lastNDates renvoie du plus recent au plus ancien -> la premiere
  // declaration rencontree pour une zone est la plus recente (elle fait foi).
  const windowKeys = lastNDates(todayKey, INJURY_ACTIVE_WINDOW_DAYS);
  const latestByArea = new Map<string, InjuryRecord>();

  for (const key of windowKeys) {
    const fb = dayStates[key]?.feedback;
    if (!fb) continue;

    const injury = fb.injury;
    if (injury && typeof injury.area === "string") {
      const areaKey = injury.area.trim().toLowerCase();
      if (areaKey && !latestByArea.has(areaKey)) latestByArea.set(areaKey, injury);
    }

    // Champs legacy jamais ecrits par l'UI actuelle mais lus historiquement
    // par aiContext : on les conserve en source additionnelle (tokens only,
    // pas de severite connue).
    const legacy = fb as unknown as Record<string, unknown>;
    for (const list of [legacy.pains, legacy.painZones]) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const token = normalizePainEntry(raw);
        if (token) tokens.add(token);
      }
    }
  }

  for (const injury of latestByArea.values()) {
    const severity = Number(injury.severity);
    // severity 0 explicite ("OK") = levee de la contrainte pour cette zone.
    if (!Number.isFinite(severity) || severity < INJURY_ACTIVE_MIN_SEVERITY) continue;
    // "autre" (ou zone non mappable) : pas de token, mais la severite alimente
    // quand meme injury_max_severity — le cap backend (>=3 force easy,
    // >=2 plafonne moderate_light) protege sans zone precise.
    injuryMaxSeverity = Math.max(injuryMaxSeverity, Math.min(3, Math.trunc(severity)));
    const token = mapAreaToPain(injury.area);
    if (token) tokens.add(token);
  }

  return { pains: [...tokens].sort(), injuryMaxSeverity };
}

// ---- Tests terrain -> constraints.field_tests -------------------------------
//
// Cf. INDIVIDUALISATION_FINE_DESIGN.md §7.1 : `field_tests[] = [{key, value, unit, ts}]`,
// max 6, "dernier de chaque type <= 90 j". Source front : AsyncStorage
// `fks_tests_v1_{uid}` (screens/tests/hooks/useTestsStorage.ts), lu hors-hook via
// `readTestsRaw()` (deja utilise par ProfileScreen.tsx pour le meme besoin).
// Regle : on n'envoie que ce qui existe, aucune invention, aucun clamp de valeur
// (le backend borne deja la calibration cote moteur, cf. §4.1 C1).

export type FKS_FieldTestEntry = {
  key: string;
  value: number;
  unit: string;
  /** Date du test (ISO 8601). Le backend gere l'expiration (90 j, cf. design doc). */
  ts: string;
};

/** Fenetre de fraicheur alignee sur la calibration backend (§4.1 : expiration 90 j). */
export const FIELD_TESTS_MAX_AGE_DAYS = 90;
/** Cap taille payload (design doc §7.1 : "max 6"). */
export const FIELD_TESTS_MAX_ENTRIES = 6;

const MS_PER_DAY = 86_400_000;

/** Cles de test mesurables (toutes les cles de TestEntry sauf `notes`, texte libre). */
type MeasurableFieldKey = Exclude<FieldKey, "notes">;

// Source de verite des unites : screens/tests/testConfig.ts (FIELD_DEFS[].unit).
// Duplique ici (valeurs, pas de type) pour eviter un import runtime services -> screens ;
// TestEntry/FieldKey ci-dessus restent en `import type` (cout zero, verifie a la compilation
// que les cles suivent bien le meme contrat).
const FIELD_TEST_UNITS: Record<MeasurableFieldKey, string> = {
  broadJumpCm: "cm",
  tripleJumpCm: "cm",
  cmjCm: "cm",
  lateralBoundCm: "cm",
  sprint10s: "s",
  sprint20s: "s",
  sprint30s: "s",
  tTest_s: "s",
  test505_s: "s",
  endurance6min_m: "m",
  yoYoIR1_m: "m",
  run1km_s: "s",
  gobletKg: "kg",
  gobletReps: "",
  splitKg: "kg",
  splitReps: "",
  trapbar3rmKg: "kg",
};

const FIELD_TEST_KEYS = Object.keys(FIELD_TEST_UNITS) as MeasurableFieldKey[];

/**
 * Construit `field_tests[]` depuis les entrees brutes AsyncStorage (`TestEntry[]`,
 * non triees, potentiellement legacy/corrompues — lecture 100% defensive).
 *
 * Regles :
 *  - une entree sans `ts` fini > 0 est ignoree ;
 *  - une entree plus vieille que `FIELD_TESTS_MAX_AGE_DAYS` est ignoree ;
 *  - pour chaque cle de test, seule la valeur la PLUS RECENTE (parmi les entrees
 *    valides) est retenue ;
 *  - le tableau final est trie par date desc et cape a `FIELD_TESTS_MAX_ENTRIES`
 *    (si plus de cles ont une valeur fraiche que la limite, les plus recentes
 *    gagnent — c'est le signal le plus pertinent).
 *
 * Pure : aucune dependance store/AsyncStorage (le call site lit `readTestsRaw()`
 * et passe le JSON parse ici).
 */
export function buildFieldTestsPayload(
  entries: unknown,
  nowMs: number = Date.now()
): FKS_FieldTestEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  type ValidEntry = { ts: number; record: UnknownRecord };
  const valid: ValidEntry[] = [];
  for (const raw of entries as unknown[]) {
    const record = asRecord(raw);
    if (!record) continue;
    const ts = finiteNumber(record.ts);
    if (ts === null || ts <= 0) continue;
    const ageDays = (nowMs - ts) / MS_PER_DAY;
    if (ageDays < 0 || ageDays > FIELD_TESTS_MAX_AGE_DAYS) continue;
    valid.push({ ts, record });
  }
  valid.sort((a, b) => b.ts - a.ts); // plus recent d'abord

  const byKey = new Map<MeasurableFieldKey, FKS_FieldTestEntry>();
  for (const { ts, record } of valid) {
    for (const key of FIELD_TEST_KEYS) {
      if (byKey.has(key)) continue; // deja la valeur la + recente pour cette cle
      const value = finiteNumber(record[key]);
      if (value === null || value <= 0) continue;
      byKey.set(key, {
        key,
        value,
        unit: FIELD_TEST_UNITS[key],
        ts: new Date(ts).toISOString(),
      });
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, FIELD_TESTS_MAX_ENTRIES);
}

// Reexport type pour les call sites qui veulent typer le JSON.parse(readTestsRaw()).
export type { TestEntry };
