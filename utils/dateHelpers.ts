const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * Converts any date representation to a LOCAL "YYYY-MM-DD" key.
 *
 * Accepts: Date object, ISO string, "YYYY-MM-DD" string, or any parseable date string.
 * Always returns the date in the user's LOCAL timezone — so a workout at 23:30 local
 * counts for "today", not "tomorrow" (which would happen with UTC .slice(0,10)).
 *
 * For bare "YYYY-MM-DD" strings (no time component), returns as-is (no timezone shift).
 */
const toDateKey = (value?: string | Date | null): string => {
  if (!value) return "";
  if (value instanceof Date) return toLocalDateKey(value);

  const raw = String(value).trim();
  if (!raw) return "";

  // Bare date "YYYY-MM-DD" (no time component) — return as-is, no TZ ambiguity
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Has time component (e.g. "2025-02-26T23:30:00.000Z") — parse and use LOCAL time
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toLocalDateKey(parsed);

  // Last resort: extract leading YYYY-MM-DD if present
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const frToKey: Record<string, string> = {
  lun: "mon",
  mar: "tue",
  mer: "wed",
  jeu: "thu",
  ven: "fri",
  sam: "sat",
  dim: "sun",
};

/** UTC day-of-week from a "YYYY-MM-DD" key (stable, no timezone shift). */
const dayKeyToDow = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0 = dim
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[dow] ?? "sun";
};

/** Returns true if `dayKey` matches one of the club training day-of-week strings. */
const isClubDay = (dayKey: string, clubDays: string[] = []) => {
  const dow = dayKeyToDow(dayKey);
  return clubDays.includes(dow);
};

/** Returns an array of N date keys going backwards from `dayKey`. */
const lastNDates = (dayKey: string, n: number): string[] => {
  const arr: string[] = [];
  const d = new Date(`${dayKey}T12:00:00`);
  for (let i = 0; i < n; i++) {
    arr.push(toDateKey(d));
    d.setDate(d.getDate() - 1);
  }
  return arr;
};

export { toDateKey, isSameDay, frToKey, dayKeyToDow, isClubDay, lastNDates };
