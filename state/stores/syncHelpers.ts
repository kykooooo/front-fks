// state/stores/syncHelpers.ts
import type { Session } from "../../domain/types";
import { todayISO } from "../../utils/virtualClock";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";

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

/**
 * AUDIT P1-4 — réconciliation de l'index de progression du cycle (séance N/12).
 *
 * Avant : microcycleSessionIndex était écrit vers le doc profil Firestore
 * (persistCompletedSession) mais JAMAIS relu par le watcher profil →
 * réinstallation / nouveau device = progression retombée à 0/12.
 *
 * Choix documenté : max(local, distant).
 * Le doc profil n'est écrit qu'au feedback et peut RETARDER (écriture échouée
 * hors-ligne, snapshot pas encore à jour) : une valeur distante périmée ne
 * doit JAMAIS rétrograder une progression locale plus avancée. Le retour à 0
 * légitime (changement/démarrage de cycle) passe par microcycleGoal : le
 * watcher synchronise le goal AVANT cette réconciliation, et setMicrocycleGoal
 * remet l'index local à 0 quand le cycle change — le max s'applique donc
 * toujours à deux index du MÊME cycle.
 *
 * Validation distant : entier entre 0 et total (12) inclus, sinon `null`
 * (valeur ignorée, on garde le local).
 */
export function reconcileMicrocycleSessionIndex(
  localIdx: unknown,
  remoteIdx: unknown,
  total: number = MICROCYCLE_TOTAL_SESSIONS_DEFAULT
): number | null {
  const remote =
    typeof remoteIdx === "number" &&
    Number.isInteger(remoteIdx) &&
    remoteIdx >= 0 &&
    remoteIdx <= total
      ? remoteIdx
      : null;
  if (remote == null) return null;

  const local =
    typeof localIdx === "number" && Number.isFinite(localIdx)
      ? Math.max(0, Math.trunc(localIdx))
      : 0;

  return Math.max(local, remote);
}
