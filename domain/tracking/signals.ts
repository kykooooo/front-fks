// domain/tracking/signals.ts
// Calcul des signaux de suivi a partir de l'historique des seances. Module
// PUR (aucune dependance UI/Firebase), tolerant aux donnees absentes ou mal
// formees : une entree malformee (date invalide) est simplement ignoree,
// une execution absente est une donnee partielle, jamais une erreur. Voir
// docs/boucle-suivi-2026-07-25/REGLES_AJUSTEMENT.md pour la doctrine des
// seuils (tous lus depuis TRACKING_CONFIG, aucune valeur magique ici).
import { TRACKING_CONFIG } from "./config";
import type { TrackingConfig } from "./config";
import type {
  DeviationReason,
  ItemExecution,
  SessionExecution,
  TrackingSignals,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Entree d'historique minimale exploitee par le moteur de signaux/reprise. */
export type TrackingHistoryEntry = {
  dateISO: string;
  completedAtISO?: string | null;
  feedback?: { rpe?: number | null; pain?: number | null; durationMin?: number | null } | null;
  rpeTarget?: number | null;
  plannedDurationMin?: number | null;
  execution?: SessionExecution | null;
  injuryDeclared?: boolean;
};

type ParsedEntry = {
  raw: TrackingHistoryEntry;
  dateMs: number;
};

// ----------------------------------------------------------------------------
// Helpers generiques
// ----------------------------------------------------------------------------

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function averageOrNull(values: number[]): number | null {
  return values.length > 0 ? average(values) : null;
}

/** Parse + rejette les entrees dont la date est invalide (tolerance). */
function parseValidEntries(history: TrackingHistoryEntry[]): ParsedEntry[] {
  if (!Array.isArray(history)) return [];
  const out: ParsedEntry[] = [];
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const dateMs = parseDateMs(raw.dateISO);
    if (dateMs === null) continue;
    out.push({ raw, dateMs });
  }
  return out;
}

function sortDesc(entries: ParsedEntry[]): ParsedEntry[] {
  return [...entries].sort((a, b) => b.dateMs - a.dateMs);
}

/** Fenetre d'analyse : au plus config.window.sessions ET au plus config.window.days. */
function windowEntries(sortedDesc: ParsedEntry[], nowMs: number, config: TrackingConfig): ParsedEntry[] {
  const withinDays = sortedDesc.filter((e) =>
    Number.isFinite(nowMs) ? (nowMs - e.dateMs) / DAY_MS <= config.window.days : true
  );
  return withinDays.slice(0, config.window.sessions);
}

/** Exercice original concerne par un item (remplacement -> id d'origine, sinon lu dans le snapshot prescrit). */
function resolveExerciseId(exec: SessionExecution, item: ItemExecution): string | null {
  if (item.status === "replaced" && item.replacement) return item.replacement.originalExerciseId;
  const prescribed = exec.snapshot.items.find((p) => p.key === item.key);
  return prescribed?.exerciseId ?? null;
}

/** Prefixe de famille = tout ce qui precede le premier "_" (str/run/plyo/cod/core/mob...). */
function familyOf(exerciseId: string): string {
  const idx = exerciseId.indexOf("_");
  return idx === -1 ? exerciseId : exerciseId.slice(0, idx);
}

/** Seance comptant comme "terminee" pour le calcul de gapDays (compat historique incluse). */
function isCompletedSession(e: ParsedEntry, config: TrackingConfig): boolean {
  const exec = e.raw.execution;
  if (exec) {
    return isFiniteNumber(exec.completion?.pct) && exec.completion.pct >= config.resumption.minCompletionForLastSession;
  }
  // Pas d'execution enregistree (anciennes seances) : une seance marquee
  // "completee" au feedback compte quand meme comme terminee.
  return Boolean(e.raw.completedAtISO);
}

/**
 * Date (ms) de la derniere seance TERMINEE dans TOUT l'historique valide
 * (pas seulement la fenetre d'analyse -- une coupure peut depasser la
 * fenetre, c'est justement ce qu'on veut detecter). Exporte pour reemploi
 * par resumption.ts (evite de dupliquer la logique de "seance terminee").
 */
export function findLastCompletedSessionDateMs(
  history: TrackingHistoryEntry[],
  config: TrackingConfig = TRACKING_CONFIG
): number | null {
  const sorted = sortDesc(parseValidEntries(history));
  const found = sorted.find((e) => isCompletedSession(e, config));
  return found ? found.dateMs : null;
}

// ----------------------------------------------------------------------------
// Sous-calculs (un par signal)
// ----------------------------------------------------------------------------

/**
 * Une entree porte une "execution exploitable" si elle a une execution avec
 * un pourcentage de completion CALCULE (meme si sa valeur est hors bornes --
 * l'aberration elle-meme est deja signalee via dataQuality "inconsistent" un
 * peu plus loin). Le feedback seul (historique ancien sans execution
 * enregistree) NE compte PAS comme exploitable : regle 4 de
 * REGLES_AJUSTEMENT.md ("insufficient" = 0 execution exploitable dans la
 * fenetre). Exporte pour reemploi par le comptage de sessionsAnalyzed.
 */
function hasExploitableExecution(e: ParsedEntry): boolean {
  const exec = e.raw.execution;
  return Boolean(exec) && isFiniteNumber(exec?.completion?.pct);
}

function countExploitableExecutions(windowed: ParsedEntry[]): number {
  return windowed.filter(hasExploitableExecution).length;
}

function computeDataQuality(windowed: ParsedEntry[], config: TrackingConfig): TrackingSignals["dataQuality"] {
  if (windowed.length === 0) return "insufficient";

  const seenSessionIds = new Set<string>();
  for (const e of windowed) {
    const exec = e.raw.execution;
    if (exec) {
      const pct = exec.completion?.pct;
      if (isFiniteNumber(pct) && (pct < 0 || pct > 100)) return "inconsistent";
      if (exec.sessionId) {
        if (seenSessionIds.has(exec.sessionId)) return "inconsistent";
        seenSessionIds.add(exec.sessionId);
      }
    }

    const durationMin = e.raw.feedback?.durationMin;
    if (isFiniteNumber(durationMin) && (durationMin <= 0 || durationMin > config.consistency.maxPlausibleDurationMin)) {
      return "inconsistent";
    }

    const rpe = e.raw.feedback?.rpe;
    if (isFiniteNumber(rpe) && (rpe < 1 || rpe > 10)) return "inconsistent";
  }

  // Regle 4 (REGLES_AJUSTEMENT.md) : "insufficient" = 0 execution exploitable
  // dans la fenetre. Un historique 100% feedback-only (aucune execution
  // enregistree) ne passe jamais "ok", meme si les feedbacks eux-memes sont
  // coherents -- on ne sait rien de la completion reelle des seances.
  if (countExploitableExecutions(windowed) === 0) return "insufficient";

  return "ok";
}

function computeCompletionRateAvg(windowed: ParsedEntry[]): number | null {
  const values = windowed
    .map((e) => e.raw.execution?.completion?.pct)
    .filter(isFiniteNumber);
  return averageOrNull(values);
}

function computeRpeDelta(
  windowed: ParsedEntry[],
  config: TrackingConfig
): { avg: number | null; count: number } {
  const deltas: number[] = [];
  for (const e of windowed) {
    const rpe = e.raw.feedback?.rpe;
    const target = e.raw.rpeTarget;
    if (isFiniteNumber(rpe) && isFiniteNumber(target)) deltas.push(rpe - target);
  }
  const count = deltas.length;
  const avg = count >= config.rpe.minSessionsForSignal ? average(deltas) : null;
  return { avg, count };
}

function computeDurationRatioAvg(windowed: ParsedEntry[], config: TrackingConfig): number | null {
  const ratios: number[] = [];
  for (const e of windowed) {
    const dur = e.raw.feedback?.durationMin;
    const planned = e.raw.plannedDurationMin;
    if (!isFiniteNumber(dur) || !isFiniteNumber(planned) || planned <= 0) continue;
    // "bornee saine" : on ecrete les ratios extremes avant moyenne pour
    // qu'une saisie aberrante ne pollue pas le signal (l'aberration brute
    // est deja tracee via dataQuality inconsistent le cas echeant).
    ratios.push(Math.max(0, Math.min(config.consistency.maxDurationRatio, dur / planned)));
  }
  return averageOrNull(ratios);
}

function computeTimeConstrainedIncomplete(windowed: ParsedEntry[]): boolean {
  const last = windowed[0];
  if (!last) return false;
  const exec = last.raw.execution;
  if (!exec) return false;
  if (exec.completion.status === "full") return false;
  return exec.completion.mainReasons[0] === "time";
}

function computePainSignal(
  sortedDescAll: ParsedEntry[],
  nowMs: number,
  config: TrackingConfig
): TrackingSignals["painSignal"] {
  const withinPainWindow = sortedDescAll.filter((e) =>
    Number.isFinite(nowMs) ? (nowMs - e.dateMs) / DAY_MS <= config.pain.windowDays : true
  );

  type Source = "feedback" | "injury" | "replacement";
  const hits: Source[] = [];

  for (const e of withinPainWindow) {
    const pain = e.raw.feedback?.pain;
    if (isFiniteNumber(pain) && pain >= config.pain.feedbackThreshold) {
      hits.push("feedback");
      continue;
    }
    if (e.raw.injuryDeclared) {
      hits.push("injury");
      continue;
    }
    const exec = e.raw.execution;
    if (exec && exec.items.some((item) => item.reason === "pain")) {
      hits.push("replacement");
    }
  }

  if (hits.length === 0) return { active: false, source: null, occurrences: 0 };
  // withinPainWindow reste trie desc (derive de sortedDescAll) : hits[0] = la plus recente.
  return { active: true, source: hits[0], occurrences: hits.length };
}

function countReasonOccurrences(windowed: ParsedEntry[], reason: DeviationReason): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of windowed) {
    const exec = e.raw.execution;
    if (!exec) continue;
    for (const item of exec.items) {
      if (item.reason !== reason) continue;
      if (item.status !== "adapted" && item.status !== "skipped" && item.status !== "replaced") continue;
      const exerciseId = resolveExerciseId(exec, item);
      if (!exerciseId) continue;
      counts.set(exerciseId, (counts.get(exerciseId) ?? 0) + 1);
    }
  }
  return counts;
}

function computeRepeatedDifficulty(
  windowed: ParsedEntry[],
  config: TrackingConfig
): TrackingSignals["repeatedDifficulty"] {
  const counts = countReasonOccurrences(windowed, "too_difficult");
  const exerciseIds = Array.from(counts.entries())
    .filter(([, count]) => count >= config.difficulty.repeatThreshold)
    .map(([id]) => id);
  const families = Array.from(new Set(exerciseIds.map(familyOf)));
  return { exerciseIds, families };
}

function computeDurableEquipmentIssues(windowed: ParsedEntry[], config: TrackingConfig): string[] {
  const counts = countReasonOccurrences(windowed, "equipment");
  return Array.from(counts.entries())
    .filter(([, count]) => count >= config.equipment.durableThreshold)
    .map(([id]) => id);
}

function computeGapDays(sortedDescAll: ParsedEntry[], nowMs: number, config: TrackingConfig): number | null {
  const found = sortedDescAll.find((e) => isCompletedSession(e, config));
  if (!found || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - found.dateMs) / DAY_MS));
}

function isEntryOk(e: ParsedEntry, config: TrackingConfig): boolean {
  const exec = e.raw.execution;
  const completionOk = exec ? exec.completion.status === "full" : Boolean(e.raw.feedback);
  if (!completionOk) return false;

  const rpe = e.raw.feedback?.rpe;
  const target = e.raw.rpeTarget;
  if (isFiniteNumber(rpe) && isFiniteNumber(target) && Math.abs(rpe - target) > config.rpe.streakTolerance) return false;

  const pain = e.raw.feedback?.pain;
  if (isFiniteNumber(pain) && pain >= config.pain.feedbackThreshold) return false;

  return true;
}

function computeStreakOkSessions(windowed: ParsedEntry[], config: TrackingConfig): number {
  let streak = 0;
  for (const e of windowed) {
    if (!isEntryOk(e, config)) break;
    streak += 1;
  }
  return streak;
}

// ----------------------------------------------------------------------------
// API publique
// ----------------------------------------------------------------------------

/**
 * Calcule les signaux de suivi depuis l'historique. PUR : ne modifie jamais
 * `history`. Tolerant : entrees malformees (date invalide) ignorees ;
 * execution absente = donnee partielle, pas une erreur.
 */
export function computeTrackingSignals(
  history: TrackingHistoryEntry[],
  nowISO: string,
  config: TrackingConfig = TRACKING_CONFIG
): TrackingSignals {
  const nowMs = parseDateMs(nowISO) ?? NaN;
  const sortedDescAll = sortDesc(parseValidEntries(history));
  const windowed = windowEntries(sortedDescAll, nowMs, config);

  const { avg: rpeDeltaAvg, count: rpeDeltaCount } = computeRpeDelta(windowed, config);
  const { exerciseIds: difficultyIds, families } = computeRepeatedDifficulty(windowed, config);

  return {
    dataQuality: computeDataQuality(windowed, config),
    sessionsAnalyzed: countExploitableExecutions(windowed),
    completionRateAvg: computeCompletionRateAvg(windowed),
    rpeDeltaAvg,
    rpeDeltaCount,
    durationRatioAvg: computeDurationRatioAvg(windowed, config),
    timeConstrainedIncomplete: computeTimeConstrainedIncomplete(windowed),
    painSignal: computePainSignal(sortedDescAll, nowMs, config),
    repeatedDifficulty: { exerciseIds: difficultyIds, families },
    durableEquipmentIssues: computeDurableEquipmentIssues(windowed, config),
    gapDays: computeGapDays(sortedDescAll, nowMs, config),
    streakOkSessions: computeStreakOkSessions(windowed, config),
  };
}
