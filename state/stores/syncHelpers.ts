// state/stores/syncHelpers.ts
import type { Session } from "../../domain/types";
import { todayISO } from "../../utils/virtualClock";

/** Normalise les sessions venant de Firestore (date/dateISO, completed...) */
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
