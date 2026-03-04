// utils/streakStats.ts
// Streak calculation helpers (weekly consecutive + VMA count)
import { addDaysISO, todayISO } from "./virtualClock";
import { toDateKey } from "./dateHelpers";
import type { Session } from "../domain/types";

const toWeekKeyMonday = (dayKey: string): string => {
  const d = new Date(`${dayKey}T12:00:00`);
  const dow = d.getDay(); // 0 = dim ... 6 = sam
  const diffToMonday = (dow + 6) % 7; // 0 si lundi, 6 si dimanche
  d.setDate(d.getDate() - diffToMonday);
  return toDateKey(d);
};

const previousWeekKey = (weekKey: string): string => {
  return addDaysISO(`${weekKey}T00:00:00.000Z`, -7).slice(0, 10);
};

const computeWeekStreak = (weekSet: Set<string>, startWeekKey: string): number => {
  let streak = 0;
  let cursor = startWeekKey;
  while (weekSet.has(cursor)) {
    streak += 1;
    cursor = previousWeekKey(cursor);
  }
  return streak;
};

const isVmaLikeSession = (s: Session): boolean => {
  const hasRunExercise = Array.isArray(s.exercises) && s.exercises.some((e) => e?.modality === "run");
  const mentionsVma = Array.isArray(s.exercises) && s.exercises.some((e) => (e?.name ?? "").toLowerCase().includes("vma"));
  const intensity = (s.intensity ?? "").toString().toLowerCase();
  const isHighIntensity = intensity === "hard" || intensity === "max" || intensity === "moderate";
  const focusSpeed = (s.focus ?? "").toLowerCase() === "speed";
  return Boolean((hasRunExercise || focusSpeed || mentionsVma) && isHighIntensity);
};

export type StreakStats = {
  weeksFks: number;
  weeksClubMatch: number;
  monthlyVmaCount: number;
};

export function computeStreakStats(
  sessions: Session[],
  externalLoads: { source?: string; dateISO?: string | null }[],
  todayISO_: string = todayISO()
): StreakStats {
  const todayKey = toDateKey(todayISO_);
  const currentWeekKey = toWeekKeyMonday(todayKey);

  const fksWeeks = new Set<string>();
  (sessions ?? []).forEach((s) => {
    if (!s?.completed) return;
    const dayKey = toDateKey(s.dateISO ?? s.date ?? todayISO_);
    fksWeeks.add(toWeekKeyMonday(dayKey));
  });

  const clubWeeks = new Set<string>();
  (externalLoads ?? []).forEach((e) => {
    const src = (e?.source ?? "").toLowerCase();
    if (src !== "club" && src !== "match") return;
    const dayKey = toDateKey(e.dateISO ?? todayISO_);
    clubWeeks.add(toWeekKeyMonday(dayKey));
  });

  const weeksFks = computeWeekStreak(fksWeeks, currentWeekKey);
  const weeksClubMatch = computeWeekStreak(clubWeeks, currentWeekKey);

  const monthKey = todayKey.slice(0, 7);
  const monthlyVmaCount = (sessions ?? []).filter((s) => {
    if (!s?.completed) return false;
    const dayKey = toDateKey(s.dateISO ?? s.date ?? todayISO_);
    if (!dayKey.startsWith(monthKey)) return false;
    return isVmaLikeSession(s);
  }).length;

  return { weeksFks, weeksClubMatch, monthlyVmaCount };
}
