// domain/tracking/execution.ts
// Helpers PURS (aucune dependance UI/Firebase) : init d'une execution depuis
// un snapshot fige, transitions immuables de statut d'item, calcul unique du
// pct de completion + compteurs, resume pour le feedback enrichi.
// Robustesse : cle inconnue -> no-op (retourne l'execution inchangee),
// jamais d'exception sur donnees partielles/absentes.
import { TRACKING_CONFIG } from "./config";
import type {
  ActualValues,
  DeviationReason,
  ItemExecution,
  ItemStatus,
  PrescribedSnapshot,
  SessionExecution,
} from "./types";

/** Nombre de series prescrites pour un item, jamais < 1. */
function resolveSetsTotal(sets: number | null): number {
  const raw = typeof sets === "number" && Number.isFinite(sets) ? sets : 1;
  return Math.max(1, Math.round(raw));
}

/**
 * Initialise une execution depuis un snapshot fige : tous les items partent
 * "unknown", 0 serie cochee, setsTotal derive de la prescription (min 1).
 */
export function initExecution(snapshot: PrescribedSnapshot, startedAtISO: string): SessionExecution {
  const items: ItemExecution[] = (snapshot.items ?? []).map((item) => ({
    key: item.key,
    status: "unknown",
    reason: null,
    comment: null,
    actual: null,
    replacement: null,
    setsChecked: 0,
    setsTotal: resolveSetsTotal(item.sets),
  }));

  return {
    version: 1,
    sessionId: snapshot.sessionId,
    fingerprint: snapshot.fingerprint,
    snapshot,
    items,
    startedAtISO,
    finishedAtISO: null,
    actualDurationMin: null,
    allAsPlanned: false,
    completion: {
      pct: 0,
      done: 0,
      adapted: 0,
      skipped: 0,
      replacedEquivalent: 0,
      replacedPartial: 0,
      status: "abandoned",
      mainReasons: [],
    },
  };
}

function findItemIndex(exec: SessionExecution, key: string): number {
  return exec.items.findIndex((item) => item.key === key);
}

/**
 * Transition generique de statut d'un item (done/adapted/skipped/unknown ;
 * "replaced" passe normalement par applyReplacement qui porte le detail du
 * remplacement). No-op si la cle est inconnue.
 */
export function setItemStatus(
  exec: SessionExecution,
  key: string,
  status: ItemStatus,
  reason?: DeviationReason | null,
  comment?: string | null
): SessionExecution {
  const idx = findItemIndex(exec, key);
  if (idx === -1) return exec;

  const items = exec.items.slice();
  const prev = items[idx];
  items[idx] = {
    ...prev,
    status,
    reason: reason ?? null,
    comment: comment ?? null,
    // Un changement de statut explicite qui n'est pas "replaced" efface un
    // eventuel remplacement precedent (evite une incoherence statut/detail).
    replacement: status === "replaced" ? prev.replacement : null,
  };

  return { ...exec, items };
}

/** Renseigne les valeurs reellement realisees (charge/reps/distance/duree). No-op si cle inconnue. */
export function setItemActual(exec: SessionExecution, key: string, actual: ActualValues): SessionExecution {
  const idx = findItemIndex(exec, key);
  if (idx === -1) return exec;

  const items = exec.items.slice();
  items[idx] = { ...items[idx], actual };
  return { ...exec, items };
}

/** Applique un remplacement d'exercice : statut -> "replaced", raison = celle du remplacement. No-op si cle inconnue. */
export function applyReplacement(
  exec: SessionExecution,
  key: string,
  replacement: NonNullable<ItemExecution["replacement"]>
): SessionExecution {
  const idx = findItemIndex(exec, key);
  if (idx === -1) return exec;

  const items = exec.items.slice();
  const prev = items[idx];
  items[idx] = {
    ...prev,
    status: "replaced",
    reason: replacement.reason,
    replacement,
  };

  return { ...exec, items };
}

/**
 * Reporte les series cochees depuis l'ecran live (checkedSets par cle
 * d'item). Un item dont toutes les series sont cochees ET qui est encore
 * "unknown" bascule "done" (fait implicite via series, cf. SessionLive).
 * Tolerant : entrees absentes/mal formees -> ignorees pour l'item concerne.
 */
export function syncSetsFromLive(
  exec: SessionExecution,
  checkedSets: Record<string, boolean[]>
): SessionExecution {
  if (!checkedSets || typeof checkedSets !== "object") return exec;

  let changed = false;
  const items = exec.items.map((item) => {
    const sets = checkedSets[item.key];
    if (!Array.isArray(sets)) return item;

    const setsChecked = sets.filter(Boolean).length;
    const isComplete = setsChecked >= item.setsTotal;
    const nextStatus: ItemStatus = isComplete && item.status === "unknown" ? "done" : item.status;

    if (setsChecked === item.setsChecked && nextStatus === item.status) return item;
    changed = true;
    return { ...item, setsChecked, status: nextStatus };
  });

  return changed ? { ...exec, items } : exec;
}

/** Action rapide "tout s'est passe comme prevu" : tous les items "unknown" -> "done". */
export function markAllAsPlanned(exec: SessionExecution): SessionExecution {
  const items = exec.items.map((item) =>
    item.status === "unknown" ? { ...item, status: "done" as ItemStatus } : item
  );
  return { ...exec, items, allAsPlanned: true };
}

function computeCompletion(items: ItemExecution[]): SessionExecution["completion"] {
  const total = items.length;
  let done = 0;
  let adapted = 0;
  let skipped = 0;
  let replacedEquivalent = 0;
  let replacedPartial = 0;
  let weightedSum = 0;
  const reasonCounts = new Map<DeviationReason, number>();

  const bumpReason = (reason: DeviationReason | null) => {
    if (!reason) return;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  };

  for (const item of items) {
    switch (item.status) {
      case "done":
        done += 1;
        weightedSum += TRACKING_CONFIG.completion.doneWeight;
        break;
      case "adapted":
        adapted += 1;
        weightedSum += TRACKING_CONFIG.completion.adaptedWeight;
        bumpReason(item.reason);
        break;
      case "skipped":
        skipped += 1;
        weightedSum += TRACKING_CONFIG.completion.skippedWeight;
        bumpReason(item.reason);
        break;
      case "replaced": {
        const equivalent = item.replacement?.equivalent === true;
        if (equivalent) {
          replacedEquivalent += 1;
          weightedSum += TRACKING_CONFIG.completion.replacedEquivalentWeight;
        } else {
          replacedPartial += 1;
          weightedSum += TRACKING_CONFIG.completion.replacedPartialWeight;
        }
        bumpReason(item.reason);
        break;
      }
      case "unknown":
      default:
        // Poids 0, ne contribue a aucun compteur specifique (donnee manquante).
        break;
    }
  }

  const pct = total > 0 ? Math.round((weightedSum / total) * 100) : 0;
  const status: SessionExecution["completion"]["status"] =
    pct >= TRACKING_CONFIG.completion.fullPct
      ? "full"
      : pct >= TRACKING_CONFIG.completion.partialPct
      ? "partial"
      : "abandoned";

  const mainReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  return { pct, done, adapted, skipped, replacedEquivalent, replacedPartial, status, mainReasons };
}

/**
 * Cloture l'execution : calcule completion (pct/compteurs/statut/raisons),
 * fige finishedAtISO + actualDurationMin. Idempotent : une execution deja
 * finalisee (finishedAtISO pose) est retournee inchangee -- le snapshot et
 * la completion ne sont jamais retransformes apres coup.
 */
export function finalizeExecution(
  exec: SessionExecution,
  finishedAtISO: string,
  actualDurationMin: number | null
): SessionExecution {
  if (exec.finishedAtISO) return exec;

  const completion = computeCompletion(exec.items);
  return {
    ...exec,
    finishedAtISO,
    actualDurationMin,
    completion,
  };
}

/** Resume compact pour le feedback enrichi (domain/types.ts SessionFeedback.executionSummary). */
export function summarizeExecution(exec: SessionExecution): {
  completionPct: number;
  completionStatus: SessionExecution["completion"]["status"];
  done: number;
  adapted: number;
  skipped: number;
  replaced: number;
  mainReasons: DeviationReason[];
  fingerprint: string;
} {
  const { completion } = exec;
  return {
    completionPct: completion.pct,
    completionStatus: completion.status,
    done: completion.done,
    adapted: completion.adapted,
    skipped: completion.skipped,
    replaced: completion.replacedEquivalent + completion.replacedPartial,
    mainReasons: completion.mainReasons,
    fingerprint: exec.fingerprint,
  };
}
