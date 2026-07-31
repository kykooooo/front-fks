// screens/tests/testHelpers.ts
import { format } from "date-fns";
import { FIELD_BY_KEY, FIELD_DEFS, type FieldKey, type TestEntry } from "./testConfig";

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

// ─────────────────────── Conversion min:sec (1 km) ───────────────────────
// Le 1 km reste stocké en secondes (compat historique + FIELD_DEFS min/max),
// mais l'utilisateur saisit et lit un temps en minutes/secondes.

export const secondsToMinSec = (totalSeconds: number): { minutes: number; seconds: number } => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.round(totalSeconds) : 0;
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
};

export const minSecToSeconds = (minutes: number, seconds: number): number => {
  const m = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return m * 60 + s;
};

/** Formate un nombre de secondes en "m:ss" (ex: 992 -> "16:32"). "--" si invalide. */
export const formatMinSec = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--";
  const { minutes, seconds } = secondsToMinSec(totalSeconds);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** Valeur d'une entrée telle qu'affichée à l'utilisateur (mm:ss pour le 1 km, brute sinon). */
export const formatEntryValue = (key: FieldKey, value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === "") return "";
  if (key === "run1km_s") return formatMinSec(Number(value));
  return String(value);
};

/** Moyenne/meilleur d'un champ pour les stats (mm:ss pour le 1 km, sinon formatStatValue). */
export const formatStatValueForField = (key: FieldKey, value: number): string => {
  if (key === "run1km_s") return formatMinSec(value);
  return formatStatValue(value, getUnitForField(key));
};

/** true si l'unité ne doit PAS être affichée en suffixe (mm:ss est déjà auto-descriptif). */
export const shouldHideUnitSuffix = (key: FieldKey): boolean => key === "run1km_s";

// ─────────────────────── Historique unifié (Phase C) ───────────────────────
// Avant : les stats/l'aperçu/l'historique filtraient par `playlist`, ce qui
// "cachait" les valeurs dès que le cycle actif changeait (comparaison cassée).
// Maintenant : une seule timeline, toutes entrées confondues — ces helpers
// retrouvent la/les valeur(s) la/les plus récente(s) PAR CHAMP, indépendamment
// de quelle entrée (donc quel cycle) les portait.

export type FieldSample = { value: number; ts: number };

const readFieldValue = (entry: TestEntry, key: FieldKey): number | null => {
  const raw = (entry as any)[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

/**
 * Pour chaque clé demandée, retourne jusqu'à `limit` valeurs les plus
 * récentes (triées desc par `ts`), tous cycles/entrées confondus. `entries`
 * n'a pas besoin d'être pré-triée : on trie nous-mêmes en interne.
 */
export function pickFieldSamples(
  entries: TestEntry[],
  keys: FieldKey[],
  limit: number = 2
): Partial<Record<FieldKey, FieldSample[]>> {
  const sorted = [...entries].sort((a, b) => (Number(b?.ts) || 0) - (Number(a?.ts) || 0));
  const result: Partial<Record<FieldKey, FieldSample[]>> = {};
  for (const key of keys) {
    const samples: FieldSample[] = [];
    for (const entry of sorted) {
      const value = readFieldValue(entry, key);
      if (value === null) continue;
      samples.push({ value, ts: Number(entry.ts) || 0 });
      if (samples.length >= limit) break;
    }
    if (samples.length > 0) result[key] = samples;
  }
  return result;
}

/** Clés (dans l'ordre de FIELD_DEFS) ayant au moins une valeur dans `entries`. */
export function fieldKeysWithData(entries: TestEntry[]): FieldKey[] {
  const set = new Set<FieldKey>();
  for (const entry of entries) {
    for (const def of FIELD_DEFS) {
      if (readFieldValue(entry, def.key) !== null) set.add(def.key);
    }
  }
  return FIELD_DEFS.map((def) => def.key).filter((key) => set.has(key));
}
