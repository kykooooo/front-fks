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

/** Jour affiché, enrichi des infos "passé/fait" — calculées UNE FOIS ici pour
 * que le Home et l'écran combiné ne puissent plus diverger (revue web
 * post-É1.5 : un jour déjà passé décrit différemment d'un écran à l'autre). */
export type WeekDay = DisplayDay & { isPast: boolean; isDone: boolean };

export function useWeekPlan() {
  const ageCategory = useExternalStore((s) => s.ageCategory);
  const clubTrainingDaysRaw = useExternalStore((s) => s.clubTrainingDays);
  const matchDaysRaw = useExternalStore((s) => s.matchDays);
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  const microcycleGoalRaw = useSessionsStore((s) => s.microcycleGoal);
  const sessions = useSessionsStore((s) => s.sessions);
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
  const todayIdx = week.indexOf(todayDow);

  const activeMoves = useMemo(
    () => (storedWeekKey === weekKey ? storedMoves : []),
    [storedWeekKey, weekKey, storedMoves]
  );

  const mondayDate = useMemo(() => new Date(`${weekKey}T12:00:00`), [weekKey]);
  const dateForDow = useCallback(
    (dow: DowKey) => {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + DOW_ORDER.indexOf(dow));
      return d;
    },
    [mondayDate]
  );

  // Croise avec l'historique sessions pour distinguer "fait" (✓) de "passé,
  // neutre" (P8 : jamais de culpabilisation) — un seul calcul, partagé par
  // le Home et l'écran combiné (hooks/dayLabels.explainDay).
  const completedDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.completed) set.add(toDateKey(s.dateISO ?? s.date));
    }
    return set;
  }, [sessions]);

  const days: WeekDay[] = useMemo(() => {
    const merged = applyWeekPlanMoves(plan, activeMoves);
    return merged.map((day, idx) => ({
      ...day,
      isPast: idx < todayIdx,
      isDone: completedDateKeys.has(toDateKey(dateForDow(day.dow))),
    }));
  }, [plan, activeMoves, todayIdx, completedDateKeys, dateForDow]);

  const hasActiveCycle = inputs.microcycleGoal !== null;

  // Un jour passé n'est plus déplaçable (ni origine, ni cible) — voir P8 §2.2.4.
  const isPastDow = useCallback((dow: DowKey) => week.indexOf(dow) < todayIdx, [week, todayIdx]);

  const evaluateMove = useCallback(
    (from: DowKey, to: DowKey): ManualMoveResult => {
      if (from === to) {
        return { allowed: false, label: "", reason: "C'est déjà le jour de cette séance." };
      }
      if (isPastDow(from) || isPastDow(to)) {
        return { allowed: false, label: "", reason: "Ce jour est déjà passé." };
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
    [days, clubTrainingDays, matchDays, week, isPastDow]
  );

  /** Options de déplacement pour la séance du jour `from`, un jour à la fois (pas de chaînage — voir weekPlanOverrides.ts). Exclut les jours déjà passés (ni origine, ni cible). */
  const getMoveTargets = useCallback(
    (from: DowKey): MoveTarget[] =>
      week
        .filter((dow) => dow !== from && !isPastDow(dow))
        .map((dow) => {
          const occupied = days.find((d) => d.dow === dow)?.placement !== null;
          return { dow, occupied, ...evaluateMove(from, dow) };
        }),
    [week, days, evaluateMove, isPastDow]
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

  // ─── Cohérence Home ↔ écran combiné (revue web post-É1.5) ───
  // Tant qu'il reste un jour actionnable (aujourd'hui inclus) avec une séance
  // placée, "current" décrit CE reste (jamais les jours déjà passés — c'était
  // la source du "Aucune séance" / "1 séance : jeudi" contradictoire). Quand
  // plus rien ne reste ET qu'on est sur le DERNIER jour de la semaine
  // affichée (ex. dimanche soir jour de match — l'exemple exact de la revue),
  // on bascule TOUS les affichages (même fonction, mêmes données) sur un
  // aperçu de la semaine prochaine : le modèle de règles est indépendant des
  // dates calendaires (jours récurrents club/match), donc `plan` (avant
  // fusion des déplacements de CETTE semaine) sert tel quel de gabarit pour
  // la semaine suivante. Restreint au dernier jour (pas "dès que le reste de
  // la semaine est vide") pour ne jamais annoncer "semaine prochaine" un
  // lundi dont toute la semaine est simplement chargée avec le club — dans
  // ce cas "current" avec placedCount=0 dit déjà honnêtement "on se retrouve
  // la semaine prochaine" (hooks/routine/dayLabels.buildWeekSummary).
  const remainingPlacedDows = days.slice(todayIdx).filter((d) => d.placement !== null).map((d) => d.dow);
  const isLastDayOfWeek = todayIdx === week.length - 1;
  const isWeekOver = isLastDayOfWeek && remainingPlacedDows.length === 0;
  const remainingPlan = {
    target: plan.target,
    placedCount: remainingPlacedDows.length,
    placedDows: remainingPlacedDows,
    warnings: plan.warnings,
  };

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
    isWeekOver,
    remainingPlan,
    rawPlan: plan,
  };
}
