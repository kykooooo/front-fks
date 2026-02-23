import { useMemo } from "react";
import { toDateKey } from "../../utils/dateHelpers";

type Params = {
  sessions: any[];
  externalLoads: any[];
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
    const fksCount = sessions.filter((s: any) => {
      const key = toDateKey(s?.dateISO ?? s?.date);
      return s.completed && weekKeySet.has(key);
    }).length;
    const extCount = externalLoads.filter((e: any) => {
      const key = toDateKey(e?.dateISO ?? e?.date);
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
