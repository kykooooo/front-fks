// src/engine/computeDailyApplied.ts
import type { Session } from "../domain/types";
import { addDaysISO } from "../utils/virtualClock";
import {
  toDayKey,
  diffDays,
  sumDailyWeightedLoad,
  clampDailyLoad,
} from "../engine/dailyAggregation";

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

  totalPreClubGuard: number;
  clubGuardFactor: number;
  totalToday: number;

  guardrailsApplied: string[];
};

// --- Helpers jour club (UTC, stable) ---
export const dayKeyToDowUTC = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=dim
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dow] ?? "sun";
};

export const isClubDayUTC = (dayKey: string, clubDays: string[] = []) => {
  const dow = dayKeyToDowUTC(dayKey);
  return clubDays.includes(dow);
};

// --- Charge externe pondérée (match/club/other) ---
export function externalLoadForDay(
  externals: ExternalLoadLike[],
  dayKey: string
): number {
  return (externals ?? [])
    .filter((x) => toDayKey(x.dateISO) === dayKey)
    .reduce((sum, x) => {
      const w = x.source === "match" ? 1.0 : x.source === "club" ? 0.9 : 0.75;
      return sum + w * x.rpe * x.durationMin;
    }, 0);
}

// --- Cap comportemental sessions-only (RPE ajusté + douleur) ---
export function capByContextSessionsOnly(
  totalSessionsClamped: number,
  adjustedRpe: number,
  pain: number = 0
): number {
  let cap =
    adjustedRpe <= 3 ? 90 :
    adjustedRpe <= 5 ? 120 :
    adjustedRpe <= 7 ? 150 :
    adjustedRpe <= 9 ? 180 : 200;

  cap = Math.max(60, cap - pain * 10);
  return Math.min(totalSessionsClamped, cap);
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
 * Main: compute daily totals consistently (sessions completed only + externals + caps + club guard).
 */
export function computeDailyTotals(params: {
  sessions: Session[];
  externalLoads: ExternalLoadLike[];
  dayKey: string;
  loadCaps: LoadCaps;

  // for sessions-only cap
  adjustedRpeForCap: number; // typically norm.adjustedRPE
  painForCap?: number; // today pain (0..)
  clubTrainingDays?: string[];

  // tweakable
  clubGuardFactor?: number; // default 0.75 when club today/tomorrow
}): DailyTotals {
  const {
    sessions,
    externalLoads,
    dayKey,
    loadCaps,
    adjustedRpeForCap,
    painForCap = 0,
    clubTrainingDays = [],
    clubGuardFactor = 0.75,
  } = params;

  const guardrailsApplied: string[] = [];

  // ✅ Sessions: completed-only, dayKey match
  const completedToday = (sessions ?? []).filter(
    (s) => s.completed && toDayKey(s.dateISO) === dayKey
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

  // Total pre club guard
  const totalPreClubGuard = sessionsCappedByContext + externClamped;

  // Club day / eve guard
  const tomorrowKey = addDaysISO(`${dayKey}T00:00:00.000Z`, 1).slice(0, 10);
  const clubToday = isClubDayUTC(dayKey, clubTrainingDays);
  const clubTomorrow = isClubDayUTC(tomorrowKey, clubTrainingDays);

  const appliedClubGuard = clubToday || clubTomorrow;
  const clubFactor = appliedClubGuard ? clubGuardFactor : 1;

  if (appliedClubGuard) {
    guardrailsApplied.push("club_guard:day_or_eve");
  }

  // Final total day cap
  const totalToday = clampDailyLoad(totalPreClubGuard * clubFactor, loadCaps.totalDay);

  return {
    dayKey,
    sessionsRaw,
    sessionsClamped,
    sessionsCappedByContext,
    externRaw,
    externClamped,
    totalPreClubGuard,
    clubGuardFactor: clubFactor,
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
