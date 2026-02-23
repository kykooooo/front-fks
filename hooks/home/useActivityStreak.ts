import { useMemo } from "react";
import { subDays } from "date-fns";
import { toDateKey } from "../../utils/dateHelpers";

export function useActivityStreak(
  sessions: any[],
  externalLoads: any[],
  devNowISO?: string
) {
  return useMemo(() => {
    const activity = new Set<string>();
    sessions
      .filter((s: any) => s.completed)
      .forEach((s: any) => activity.add(toDateKey(s?.dateISO ?? s?.date)));
    externalLoads.forEach((e: any) => activity.add(toDateKey(e?.dateISO ?? e?.date)));

    const base = devNowISO ? new Date(devNowISO) : new Date();
    let count = 0;
    for (let i = 0; i < 10; i += 1) {
      const key = toDateKey(subDays(base, i));
      if (!activity.has(key)) break;
      count += 1;
    }
    return count;
  }, [sessions, externalLoads, devNowISO]);
}
