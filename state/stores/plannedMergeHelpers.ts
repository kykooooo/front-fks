// state/stores/plannedMergeHelpers.ts
//
// Logique PURE du watcher plannedSessions (useSyncStore) — extraite pour être
// testable sans mocker firebase (même pattern que screens/tests/testTiming.ts).
//
// AUDIT P0-1 : l'ancienne version inline du watcher pouvait EFFACER du store
// une séance locale complétée (donc son feedback, la charge, le streak) :
// `incomingIds` était calculé AVANT les filtres, et une séance complétée dont
// l'id figurait dans les docs planifiés entrants était exclue de `planned`
// (filtre completedLocalIds) ET de `nonPlanned` (`!incomingIds.has(s.id)`).
// Règle d'or ici : une séance locale COMPLÉTÉE n'est JAMAIS écartée.

import type { Session } from "../../domain/types";
import { toDateKey } from "../../utils/dateHelpers";

/** Doc Firestore `users/{uid}/plannedSessions/{id}` (post-parse Zod, passthrough). */
export type IncomingPlannedDoc = {
  id: string;
  date?: string;
  /** Marqueur d'état écrit au feedback (P0-1b). Absent = planned (docs historiques). */
  status?: unknown;
  phase?: unknown;
  focus?: unknown;
  intensity?: unknown;
  plannedLoad?: number | null;
  exercises?: unknown;
  ai?: unknown;
};

/**
 * Filtre + mappe les docs planifiés entrants vers des Sessions locales.
 *  - status : seuls les docs encore `planned` redescendent. Un doc marqué
 *    `completed` au feedback (P0-1b) ne doit plus jamais réapparaître comme
 *    "à faire". Défensif : status absent/null = planned (compat docs écrits
 *    avant l'introduction du marqueur).
 *  - date : on ne garde que aujourd'hui et le futur (les docs passés sont
 *    hors fenêtre, gérés par la logique zombie de feedbackWindow).
 */
export function mapIncomingPlannedSessions(
  list: IncomingPlannedDoc[] | null | undefined,
  todayKey: string
): Session[] {
  return (list ?? [])
    .filter((p) => {
      const status = p.status;
      if (status != null && status !== "planned") return false;
      const dayKey = toDateKey((p.date ?? "").toString());
      return !!dayKey && dayKey >= todayKey;
    })
    .map(
      (p): Session => ({
        id: p.id,
        date: p.date ?? "",
        dateISO: p.date ?? "",
        focus: p.focus as Session["focus"],
        phase: p.phase as Session["phase"],
        intensity: p.intensity as Session["intensity"],
        volumeScore: p.plannedLoad ?? 0,
        exercises: (p.exercises ?? []) as Session["exercises"],
        completed: false,
        aiV2: p.ai as Record<string, unknown> | undefined,
      })
    );
}

/**
 * Fusionne les séances planifiées entrantes (Firestore) avec le store local.
 *
 * Invariants (P0-1) :
 *  1. Une séance locale COMPLÉTÉE n'est JAMAIS écartée — c'est le feedback du
 *     joueur (charge, streak, historique) ; hors-ligne + kill app, l'écarter
 *     serait une perte définitive.
 *  2. Une séance locale non complétée n'est remplacée QUE si sa version
 *     entrante figure réellement dans `planned` (remplacement 1-pour-1).
 *     Un doc entrant filtré (jour déjà complété) ne doit pas "avaler" la
 *     copie locale : cas de la régénération le même jour qu'une séance faite.
 *  3. Un doc planifié pour un jour où une séance est déjà complétée ne
 *     redevient pas une carte "à faire" (filtre completedDayKeys conservé).
 */
export function mergePlannedIntoLocalSessions(
  local: Session[],
  incoming: Session[]
): Session[] {
  const completedLocal = local.filter((s) => s.completed);
  const completedLocalIds = new Set(completedLocal.map((s) => s.id));
  const completedDayKeys = new Set(
    completedLocal
      .map((s) => toDateKey((s.dateISO ?? s.date ?? "").toString()))
      .filter(Boolean)
  );

  const planned = incoming
    .filter((p) => !completedLocalIds.has(p.id))
    .filter((p) => {
      const dayKey = toDateKey((p.dateISO ?? "").toString());
      return !completedDayKeys.has(dayKey);
    });

  const plannedIds = new Set(planned.map((p) => p.id));

  // Invariants 1 & 2 : les complétées restent toujours ; les non complétées ne
  // cèdent leur place qu'à leur remplaçante effectivement retenue dans `planned`.
  const nonPlanned = local.filter((s) => s.completed || !plannedIds.has(s.id));

  return [...planned, ...nonPlanned];
}
