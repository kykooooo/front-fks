const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toDateKey = (value?: string | Date | null) => {
  if (!value) return "";
  if (value instanceof Date) return toLocalDateKey(value);

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return toLocalDateKey(parsed);
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

export { toDateKey, isSameDay, frToKey };
