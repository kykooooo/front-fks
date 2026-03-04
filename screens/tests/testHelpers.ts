// screens/tests/testHelpers.ts
import { format } from "date-fns";
import { FIELD_BY_KEY, type FieldKey } from "./testConfig";

export const formatEntryTimestamp = (ts?: number, pattern: string = "dd/MM") => {
  const num = Number(ts);
  if (!Number.isFinite(num) || num <= 0) return "--";
  const date = new Date(num);
  if (Number.isNaN(date.getTime())) return "--";
  return format(date, pattern);
};

export const getUnitForField = (key: FieldKey): string =>
  FIELD_BY_KEY[key]?.unit ?? "";

export const formatStatValue = (value: number, unit: string) => {
  if (!Number.isFinite(value)) return "--";
  if (unit === "s") return value.toFixed(2);
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 0.01 ? String(rounded) : value.toFixed(1);
};

export const isBetterDelta = (key: FieldKey, delta: number): boolean => {
  const lowerIsBetter = FIELD_BY_KEY[key]?.lowerIsBetter ?? false;
  return lowerIsBetter ? delta < 0 : delta > 0;
};
