// src/engine/computeDailyApplied.ts
// ===========================================================================
// Daily Load Aggregation & Guards
// ===========================================================================
// Calcule la charge journalière totale en combinant :
// - Séances FKS (avec caps par modalité, RPE, douleur)
// - Charges externes (club, match, autre)
// - Guards protecteurs (réduction avant match/club)
// ===========================================================================

import type { Session } from "../domain/types";
import { EXTERNAL_WEIGHTS, GUARD_FACTORS } from "../config/trainingDefaults";
import { addDaysISO } from "../utils/virtualClock";
import {
  diffDays,
  sumDailyWeightedLoad,
  clampDailyLoad,
} from "../engine/dailyAggregation";
import { safeNum } from "../engine/safeNum";
import { toDateKey } from "../utils/dateHelpers";
import { isSessionCompleted } from "../utils/sessionStatus";

/**
 * External load minimal shape (store can keep extra fields: id, notes, etc.)
 */
export type ExternalLoadLike = {
  source: "club" | "match" | "other";
  dateISO: string;
  rpe: number;
  durationMin: number;
};

/**
 * Load caps (you already have LOAD_CAPS in config)
 */
export type LoadCaps = {
  sessionsDay: number;
  externDay: number;
  totalDay: number;
};

export type DailyTotals = {
  dayKey: string;

  sessionsRaw: number;
  sessionsClamped: number;
  sessionsCappedByContext: number;

  externRaw: number;
  externClamped: number;

  totalPreGuard: number;
  guardFactor: number;       // Facteur combiné (club + match)
  totalToday: number;

  guardrailsApplied: string[];
};

// --- Helpers jour club (UTC, stable) ---
export const dayKeyToDowLocal = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000`);
  const dow = d.getDay(); // 0=dim (local)
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dow] ?? "sun";
};

export const isClubDayLocal = (dayKey: string, clubDays: string[] = []) => {
  const dow = dayKeyToDowLocal(dayKey);
  return clubDays.includes(dow);
};

// --- Charge externe pondérée (match/club/other) ---
export function externalLoadForDay(
  externals: ExternalLoadLike[],
  dayKey: string
): number {
  return (externals ?? [])
    .filter((x) => toDateKey(x.dateISO) === dayKey)
    .reduce((sum, x) => {
      const w =
        x.source === "match"
          ? EXTERNAL_WEIGHTS.match
          : x.source === "club"
            ? EXTERNAL_WEIGHTS.club
            : EXTERNAL_WEIGHTS.other;
      return sum + safeNum(w, 1, "externalLoad.weight") * safeNum(x.rpe, 5, "externalLoad.rpe") * safeNum(x.durationMin, 0, "externalLoad.durationMin");
    }, 0);
}

// --- Cap comportemental sessions-only (RPE ajusté + douleur) ---
// Ajusté pour permettre une charge minimale même à faible RPE (séances longues légères)
export function capByContextSessionsOnly(
  totalSessionsClamped: number,
  adjustedRpe: number,
  pain: number = 0
): number {
  const rpe = safeNum(adjustedRpe, 6, "capByContext.adjustedRpe");
  const safePain = safeNum(pain, 0, "capByContext.pain");
  const safeClamped = safeNum(totalSessionsClamped, 0, "capByContext.totalSessionsClamped");

  // Caps progressifs : permet une charge minimale viable même à faible intensité
  let cap =
    rpe <= 3 ? 110 :   // Séance récup/mobilité (était 90)
    rpe <= 5 ? 140 :   // Séance légère (était 120)
    rpe <= 7 ? 170 :   // Séance modérée (était 150)
    rpe <= 9 ? 200 :   // Séance intense (était 180)
    220;                       // Séance très intense (était 200)

  // Réduction pour douleur : -8 par point (était -10)
  cap = Math.max(70, cap - safePain * 8);
  return Math.min(safeClamped, cap);
}

/**
 * Off-days count between lastLoadDayKey and current dayKey, excluding the current day.
 * Example: last=2025-12-01, current=2025-12-03 => 1 off-day (2025-12-02).
 */
export function computeInterveningOffDays(
  lastLoadDayKey: string | null | undefined,
  currentDayKey: string
): number {
  if (!lastLoadDayKey) return 0;
  return Math.max(0, diffDays(lastLoadDayKey, currentDayKey) - 1);
}

/**
 * Main: compute daily totals consistently.
 * Combines FKS sessions + externals + contextual caps + protection guards.
 */
export function computeDailyTotals(params: {
  sessions: Session[];
  externalLoads: ExternalLoadLike[];
  dayKey: string;
  loadCaps: LoadCaps;

  // for sessions-only cap
  adjustedRpeForCap: number;
  painForCap?: number;

  // Calendar context
  clubTrainingDays?: string[];
  matchDays?: string[];          // e.g. ["sat", "sun"]

  // tweakable (uses GUARD_FACTORS defaults if not provided)
  clubGuardFactor?: number;
  matchGuardFactor?: number;
}): DailyTotals {
  const {
    sessions,
    externalLoads,
    dayKey,
    loadCaps,
    adjustedRpeForCap,
    painForCap = 0,
    clubTrainingDays = [],
    matchDays = [],
    clubGuardFactor = GUARD_FACTORS.clubDay,
    matchGuardFactor = GUARD_FACTORS.matchDay,
  } = params;

  const guardrailsApplied: string[] = [];

  // ✅ Sessions: completed-only, dayKey match
  const completedToday = (sessions ?? []).filter(
    (s) => isSessionCompleted(s) && toDateKey(s.dateISO) === dayKey
  );

  const sessionMap = sumDailyWeightedLoad(completedToday);
  const sessionsRaw = sessionMap[dayKey] ?? 0;
  const sessionsClamped = clampDailyLoad(sessionsRaw, loadCaps.sessionsDay);

  // sessions-only contextual cap (RPE + pain)
  const sessionsCappedByContext = capByContextSessionsOnly(
    sessionsClamped,
    adjustedRpeForCap,
    painForCap
  );

  // Externals
  const externRaw = externalLoadForDay(externalLoads ?? [], dayKey);
  const externClamped = clampDailyLoad(externRaw, loadCaps.externDay);

  // Total pre guard
  const totalPreGuard = sessionsCappedByContext + externClamped;

  // --- GUARD SYSTEM ---
  // Priority: match > club (match is more important to protect)
  const tomorrowKey = toDateKey(addDaysISO(`${dayKey}T00:00:00.000Z`, 1));
  const todayDow = dayKeyToDowLocal(dayKey);
  const tomorrowDow = dayKeyToDowLocal(tomorrowKey);

  // Match detection
  const matchToday = matchDays.includes(todayDow);
  const matchTomorrow = matchDays.includes(tomorrowDow);

  // Club detection
  const clubToday = isClubDayLocal(dayKey, clubTrainingDays);
  const clubTomorrow = isClubDayLocal(tomorrowKey, clubTrainingDays);

  // Calculate guard factor (match takes priority over club)
  let guardFactor = 1;
  if (matchToday) {
    // Jour de match : forte réduction (pas d'entraînement FKS recommandé)
    guardFactor = matchGuardFactor;
    guardrailsApplied.push("match_guard:same_day");
  } else if (matchTomorrow) {
    // Veille de match : réduction modérée
    guardFactor = GUARD_FACTORS.matchEve;
    guardrailsApplied.push("match_guard:eve");
  } else if (clubToday) {
    // Jour de club
    guardFactor = clubGuardFactor;
    guardrailsApplied.push("club_guard:same_day");
  } else if (clubTomorrow) {
    // Veille de club : réduction légère
    guardFactor = GUARD_FACTORS.clubEve;
    guardrailsApplied.push("club_guard:eve");
  }

  // Final total day cap
  const totalToday = clampDailyLoad(totalPreGuard * guardFactor, loadCaps.totalDay);

  return {
    dayKey,
    sessionsRaw,
    sessionsClamped,
    sessionsCappedByContext,
    externRaw,
    externClamped,
    totalPreGuard,
    guardFactor,
    totalToday,
    guardrailsApplied,
  };
}

/**
 * Keep only the last N days of dailyApplied (prevents AsyncStorage bloat + ghost blocking).
 */
export function pruneDailyAppliedWindow(
  dailyApplied: Record<string, number>,
  keepDays: number,
  referenceDayKey: string
): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = Object.keys(dailyApplied ?? {});
  for (const k of keys) {
    const age = diffDays(k, referenceDayKey); // k -> reference
    if (age >= 0 && age <= keepDays) out[k] = dailyApplied[k];
  }
  return out;
}
