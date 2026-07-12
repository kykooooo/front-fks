// hooks/routine/weekPlanOverrides.ts
//
// Fusionne le plan auto (`domain/weekPlanning.computeWeekPlan`) avec les
// déplacements manuels de la joueuse (P8, useWeekPlanStore). Logique de
// FUSION uniquement — le refus/l'étiquette d'un déplacement restent
// entièrement décidés par `evaluateManualMove` (domain/weekPlanning.ts),
// jamais réimplémentés ici. Module pur, zéro I/O, testable en table comme
// le module domain qu'il complète.
//
// Un override ne s'applique que si son jour d'origine porte une prescription
// dans le plan AUTO (pas le plan déjà fusionné) : les déplacements ne
// s'enchaînent pas (une séance déplacée une fois ne peut pas l'être une
// seconde fois dans la même semaine) — restriction volontaire qui garde le
// modèle simple pour É1.
import type { DowKey, PlannedDay, WeekPlanResult } from "../../domain/weekPlanning";
import type { WeekPlanMove } from "../../state/stores/useWeekPlanStore";

export type DisplayDay = PlannedDay & {
  /** Renseigné si la séance affichée ici vient d'un déplacement depuis un autre jour. */
  movedFrom: DowKey | null;
  /** Renseigné si la séance originale de ce jour a été déplacée ailleurs (ce jour redevient repos). */
  movedTo: DowKey | null;
};

export function applyWeekPlanMoves(plan: WeekPlanResult, moves: WeekPlanMove[]): DisplayDay[] {
  const byDow = new Map<DowKey, PlannedDay>(plan.days.map((d) => [d.dow, d] as const));

  // N'accepte que les déplacements dont l'origine a réellement une prescription
  // dans le plan AUTO, et dont la cible existe (les 7 jours existent toujours,
  // mais un profil peut changer entre l'enregistrement de l'override et son
  // application — défensif).
  const validMoves = moves.filter((m) => {
    const origin = byDow.get(m.from);
    return !!origin && origin.placement !== null && byDow.has(m.to);
  });

  const movedAwayFrom = new Map<DowKey, DowKey>(validMoves.map((m) => [m.from, m.to] as const));
  const incomingTo = new Map<DowKey, { from: DowKey; placement: PlannedDay["placement"] }>(
    validMoves.map((m) => [m.to, { from: m.from, placement: byDow.get(m.from)!.placement }] as const)
  );

  return plan.days.map((day) => {
    const movedTo = movedAwayFrom.get(day.dow) ?? null;
    const incoming = incomingTo.get(day.dow) ?? null;

    if (movedTo) {
      return {
        ...day,
        placement: null,
        movedFrom: null,
        movedTo,
        reasons: [...day.reasons, "plan:p8_moved_away"],
      };
    }
    if (incoming) {
      return {
        ...day,
        placement: incoming.placement,
        movedFrom: incoming.from,
        movedTo: null,
        reasons: [...day.reasons, "plan:p8_moved_here"],
      };
    }
    return { ...day, movedFrom: null, movedTo: null };
  });
}
