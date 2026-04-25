function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeFirestorePayload<T>(value: T): T {
  if (value === undefined) {
    return undefined as T;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestorePayload(item))
      .filter((item) => item !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).flatMap(([key, entryValue]) => {
      const sanitized = sanitizeFirestorePayload(entryValue);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    });

    return Object.fromEntries(entries) as T;
  }

  return value;
}
