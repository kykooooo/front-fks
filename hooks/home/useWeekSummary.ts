import { useMemo } from "react";
import { toDateKey } from "../../utils/dateHelpers";
import type { Session } from "../../domain/types";
import type { ExternalLoad } from "../../state/stores/types";
import { isSessionCompleted } from "../../utils/sessionStatus";

type Params = {
  sessions: Session[];
  externalLoads: ExternalLoad[];
  weekDays: { key: string }[];
  weeklyGoal: number;
};

export function useWeekSummary({
  sessions,
  externalLoads,
  weekDays,
  weeklyGoal,
}: Params) {
  return useMemo(() => {
    const weekKeySet = new Set(weekDays.map((d) => d.key));
    const fksCount = sessions.filter((s) => {
      const key = toDateKey(s.dateISO ?? s.date);
      return isSessionCompleted(s) && weekKeySet.has(key);
    }).length;
    const extCount = externalLoads.filter((e) => {
      const key = toDateKey(e.dateISO);
      return weekKeySet.has(key);
    }).length;
    const remaining = Math.max(0, weeklyGoal - fksCount);
    const message =
      fksCount >= weeklyGoal
        ? "Bonne semaine !"
        : remaining <= 1
          ? "Plus qu'une séance pour atteindre ton objectif."
          : `Encore ${remaining} séances pour atteindre ton objectif.`;
    return { fksCount, extCount, message };
  }, [sessions, externalLoads, weekDays, weeklyGoal]);
}
