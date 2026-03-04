// utils/caseTransform.ts
// Recursive snake_case → camelCase key converter for API responses.

function snakeKeyToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Recursively converts all keys of an object (or array) from snake_case to camelCase.
 * Leaves primitive values unchanged. Safe to call on already-camelCase data (idempotent).
 */
export function snakeToCamel<T = unknown>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamel(item)) as T;
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeKeyToCamel(key)] = snakeToCamel(value);
    }
    return result as T;
  }
  return obj as T;
}
