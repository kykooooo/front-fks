// hooks/routine/useWeekPlan.ts
//
// É1 (voir C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md, §3/§7.3) :
// assemble le plan hebdo affiché par Routine v2 — profil (stores) →
// `domain/weekPlanning.computeWeekPlan` (règles pures, non modifiées) →
// fusion des déplacements manuels locaux (`useWeekPlanStore`). Garde
// RoutineScreen léger, même convention que hooks/home/*.
import { useCallback, useMemo } from "react";
import { useExternalStore } from "../../state/stores/useExternalStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { useWeekPlanStore } from "../../state/stores/useWeekPlanStore";
import { canonicalizeMicrocycleGoal } from "../../domain/microcycles";
import {
  computeWeekPlan,
  evaluateManualMove,
  orderedWeek,
  DOW_ORDER,
  type DowKey,
  type ManualMoveResult,
  type WeekPlanInputs,
} from "../../domain/weekPlanning";
import { applyWeekPlanMoves, type DisplayDay } from "./weekPlanOverrides";
import { toDateKey, dayKeyToDow, weekKeyOf } from "../../utils/dateHelpers";

export type MoveTarget = ManualMoveResult & { dow: DowKey; occupied: boolean };

export function useWeekPlan() {
  const ageCategory = useExternalStore((s) => s.ageCategory);
  const clubTrainingDaysRaw = useExternalStore((s) => s.clubTrainingDays);
  const matchDaysRaw = useExternalStore((s) => s.matchDays);
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  const microcycleGoalRaw = useSessionsStore((s) => s.microcycleGoal);
  const weekStart = useSettingsStore((s) => s.weekStart);
  const devNowISO = useDebugStore((s) => s.devNowISO);

  const storedWeekKey = useWeekPlanStore((s) => s.weekKey);
  const storedMoves = useWeekPlanStore((s) => s.moves);
  const moveSessionAction = useWeekPlanStore((s) => s.moveSession);
  const cancelMoveAction = useWeekPlanStore((s) => s.cancelMove);

  const clubTrainingDays = useMemo(() => (clubTrainingDaysRaw ?? []) as DowKey[], [clubTrainingDaysRaw]);
  const matchDays = useMemo(() => (matchDaysRaw ?? []) as DowKey[], [matchDaysRaw]);

  const now = devNowISO ? new Date(devNowISO) : new Date();
  const todayKey = toDateKey(now);
  const weekKey = weekKeyOf(now);
  const todayDow = dayKeyToDow(todayKey) as DowKey;

  const inputs: WeekPlanInputs = useMemo(
    () => ({
      // Convention app existante (state/stores/types.ts) : null = adulte/inconnu.
      ageCategory: ageCategory ?? "Senior",
      clubTrainingDays,
      matchDays,
      targetFksSessionsPerWeek,
      microcycleGoal: canonicalizeMicrocycleGoal(microcycleGoalRaw),
      weekStart: weekStart ?? "mon",
    }),
    [ageCategory, clubTrainingDays, matchDays, targetFksSessionsPerWeek, microcycleGoalRaw, weekStart]
  );

  const plan = useMemo(() => computeWeekPlan(inputs), [inputs]);
  const week = useMemo(() => orderedWeek(inputs.weekStart ?? "mon"), [inputs.weekStart]);

  const activeMoves = useMemo(
    () => (storedWeekKey === weekKey ? storedMoves : []),
    [storedWeekKey, weekKey, storedMoves]
  );
  const days: DisplayDay[] = useMemo(() => applyWeekPlanMoves(plan, activeMoves), [plan, activeMoves]);

  const mondayDate = useMemo(() => new Date(`${weekKey}T12:00:00`), [weekKey]);
  const dateForDow = useCallback(
    (dow: DowKey) => {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + DOW_ORDER.indexOf(dow));
      return d;
    },
    [mondayDate]
  );

  const hasActiveCycle = inputs.microcycleGoal !== null;

  const evaluateMove = useCallback(
    (from: DowKey, to: DowKey): ManualMoveResult => {
      if (from === to) {
        return { allowed: false, label: "", reason: "C'est déjà le jour de cette séance." };
      }
      const targetDay = days.find((d) => d.dow === to);
      if (targetDay && targetDay.placement !== null) {
        return { allowed: false, label: "", reason: "Ce jour porte déjà une séance." };
      }
      const otherPlacedDows = days
        .filter((d) => d.placement !== null && d.dow !== from)
        .map((d) => d.dow);
      return evaluateManualMove(to, { clubTrainingDays, matchDays }, week, otherPlacedDows);
    },
    [days, clubTrainingDays, matchDays, week]
  );

  /** Options de déplacement pour la séance du jour `from`, un jour à la fois (pas de chaînage — voir weekPlanOverrides.ts). */
  const getMoveTargets = useCallback(
    (from: DowKey): MoveTarget[] =>
      week
        .filter((dow) => dow !== from)
        .map((dow) => {
          const occupied = days.find((d) => d.dow === dow)?.placement !== null;
          return { dow, occupied, ...evaluateMove(from, dow) };
        }),
    [week, days, evaluateMove]
  );

  /** P8 — tente le déplacement ; refus dur = message honnête retourné, jamais silencieux (le composant l'affiche via toast). */
  const requestMove = useCallback(
    (from: DowKey, to: DowKey): ManualMoveResult => {
      const result = evaluateMove(from, to);
      if (result.allowed) {
        moveSessionAction(weekKey, from, to);
      }
      return result;
    },
    [evaluateMove, moveSessionAction, weekKey]
  );

  const cancelMove = useCallback((from: DowKey) => cancelMoveAction(weekKey, from), [cancelMoveAction, weekKey]);

  return {
    days,
    target: plan.target,
    placedCount: plan.placedCount,
    placedDows: plan.placedDows,
    warnings: plan.warnings,
    weekKey,
    todayDow,
    hasActiveCycle,
    dateForDow,
    requestMove,
    cancelMove,
    getMoveTargets,
  };
}
