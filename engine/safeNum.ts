// engine/safeNum.ts
// Guard against NaN/Infinity propagation in load calculations.
// If the value is not a finite number, returns `fallback` and logs a warning in dev.

/**
 * Returns `value` if it's a finite number, otherwise `fallback`.
 * Logs a dev warning with `label` so NaN sources can be traced.
 */
export function safeNum(value: unknown, fallback: number, label?: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (__DEV__ && label) {
    console.warn(`[safeNum] ${label}: received ${String(value)}, using fallback ${fallback}`);
  }
  return fallback;
}
