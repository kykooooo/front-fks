import type { Session, DayState, AdaptiveFactors } from "../../domain/types";
import { addDaysISO, todayISO } from "../../utils/virtualClock";
import { toDayKey } from "../../engine/dailyAggregation";

// Normalise les sessions venant de Firestore (date/dateISO, completed…)
export function normalizeSessionsFromFirestore(list: any[]): Session[] {
  return (list ?? []).map((it: any) => {
    const dateISO: string =
      typeof it.dateISO === "string"
        ? it.dateISO
        : typeof it.date === "string"
          ? it.date
          : todayISO();

    const completed =
      typeof it.completed === "boolean"
        ? it.completed
        : it.rpe != null || it.feedback != null;

    return {
      ...(it as object),
      id: it.id ?? it.sessionId ?? `${Math.random()}`,
      dateISO,
      completed,
    } as Session;
  });
}

// --- Résilience CTL (0..1) ---
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const computeResilience = (ctl: number) => clamp01(ctl / 100);

// --- Helpers jour club (UTC, stable) ---
export const dayKeyToDow = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0 = dim
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dow] ?? "sun";
};

export const isClubDay = (dayKey: string, clubDays: string[] = []) => {
  const dow = dayKeyToDow(dayKey);
  return clubDays.includes(dow);
};

// Helper: ajoute une clé seulement si la valeur est définie
export function withIfDefined<T extends object, K extends string, V>(
  obj: T,
  key: K,
  value: V | undefined
): T & (V extends undefined ? {} : { [P in K]: V }) {
  if (value !== undefined) {
    // @ts-expect-error écriture contrôlée
    obj[key] = value;
  }
  return obj as any;
}

// Facteur neutre pour DayState.adaptive
export const NEUTRAL_ADAPTIVE: AdaptiveFactors = {
  fatigueFactor: 1,
  painFactor: 1,
  combined: 1,
  fatigueSmoothed: 3,
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function hasStructuredRun(exercises: Session["exercises"]): boolean {
  return exercises.some(
    (e) => e.modality === "run" && ((e.durationSec ?? 0) > 0 || (e.sets ?? 0) > 0)
  );
}
export function hasCircuitOrCore(exercises: Session["exercises"]): boolean {
  return exercises.some((e) => e.modality === "circuit" || e.modality === "core");
}

// ----- Helpers historiques subjectifs (14 jours) -----
export function collectHistory(
  dayStates: Record<string, DayState>,
  datesISO: string[],
  n: number
) {
  const keys = [...datesISO].slice(0, n);
  const fatigue: number[] = [];
  const recovery: number[] = [];
  const pain: number[] = [];
  for (const k of keys) {
    const ds = dayStates[k];
    if (!ds?.feedback) continue;
    if (typeof ds.feedback.fatigue === "number") fatigue.push(ds.feedback.fatigue);
    if (typeof ds.feedback.recoveryPerceived === "number") recovery.push(ds.feedback.recoveryPerceived);
    if (typeof ds.feedback.pain === "number") pain.push(ds.feedback.pain);
  }
  return { fatigue, recovery, pain };
}

export function lastNDates(dayKey: string, n: number): string[] {
  const arr: string[] = [];
  let d = new Date(`${dayKey}T00:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    arr.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return arr;
}

// Helpers “séries récentes” pour phaseManager
export function recentFatigueArr(dayStates: Record<string, DayState>, todayISO_: string, n = 7) {
  const keys = lastNDates(toDayKey(todayISO_), n);
  return keys.map((k) => {
    const v = dayStates[k]?.feedback?.fatigue;
    return typeof v === "number" ? v : 3;
  });
}
export function recentPainArr(dayStates: Record<string, DayState>, todayISO_: string, n = 7) {
  const keys = lastNDates(toDayKey(todayISO_), n);
  return keys.map((k) => {
    const v = dayStates[k]?.feedback?.pain;
    return typeof v === "number" ? v : 0;
  });
}

// --- Résilience CTL (0..1) ---
export const capByContext = (total: number, rpe: number, pain: number = 0): number => {
  let cap =
    rpe <= 3 ? 90 :
    rpe <= 5 ? 120 :
    rpe <= 7 ? 150 :
    rpe <= 9 ? 180 : 200;

  cap = Math.max(60, cap - pain * 10);
  return Math.min(total, cap);
};

export const lastNDatesFromToday = (n: number) => lastNDates(addDaysISO(todayISO(), 0).slice(0, 10), n);

// -------------------------------------------
// Streaks (semaines consécutives + compte VMA)
// -------------------------------------------
const toWeekKeyMonday = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0 = dim ... 6 = sam
  const diffToMonday = (dow + 6) % 7; // 0 si lundi, 6 si dimanche
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
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
  const todayKey = toDayKey(todayISO_);
  const currentWeekKey = toWeekKeyMonday(todayKey);

  const fksWeeks = new Set<string>();
  (sessions ?? []).forEach((s) => {
    if (!s?.completed) return;
    const dayKey = toDayKey(s.dateISO ?? s.date ?? todayISO_);
    fksWeeks.add(toWeekKeyMonday(dayKey));
  });

  const clubWeeks = new Set<string>();
  (externalLoads ?? []).forEach((e) => {
    const src = (e?.source ?? "").toLowerCase();
    if (src !== "club" && src !== "match") return;
    const dayKey = toDayKey(e.dateISO ?? todayISO_);
    clubWeeks.add(toWeekKeyMonday(dayKey));
  });

  const weeksFks = computeWeekStreak(fksWeeks, currentWeekKey);
  const weeksClubMatch = computeWeekStreak(clubWeeks, currentWeekKey);

  const monthKey = todayKey.slice(0, 7);
  const monthlyVmaCount = (sessions ?? []).filter((s) => {
    if (!s?.completed) return false;
    const dayKey = toDayKey(s.dateISO ?? s.date ?? todayISO_);
    if (!dayKey.startsWith(monthKey)) return false;
    return isVmaLikeSession(s);
  }).length;

  return { weeksFks, weeksClubMatch, monthlyVmaCount };
}
