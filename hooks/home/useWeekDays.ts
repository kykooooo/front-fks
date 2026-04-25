import { useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { frToKey, isSameDay, toDateKey } from "../../utils/dateHelpers";
import type { Session } from "../../domain/types";
import type { ExternalLoad } from "../../state/stores/types";
import { isSessionCompleted } from "../../utils/sessionStatus";

type Params = {
  devNowISO?: string;
  weekStart: "mon" | "sun";
  sessions: Session[];
  externalLoads: ExternalLoad[];
  clubTrainingDays: string[];
  matchDays: string[];
  plannedFksDays: string[];
};

export type WeekDayItem = {
  key: string;
  label: string;
  isToday: boolean;
  hasFks: boolean;
  hasExt: boolean;
  hasClub: boolean;
  hasMatch: boolean;
  hasPlanned: boolean;
};

export function useWeekDays({
  devNowISO,
  weekStart,
  sessions,
  externalLoads,
  clubTrainingDays,
  matchDays,
  plannedFksDays,
}: Params): WeekDayItem[] {
  const weekStartIndex = weekStart === "sun" ? 0 : 1;
  return useMemo(() => {
    const todayReal = devNowISO ? new Date(devNowISO) : new Date();
    const start = startOfWeek(todayReal, { weekStartsOn: weekStartIndex });
    const days: WeekDayItem[] = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = toDateKey(d);
      const label = format(d, "EEEEE", { locale: fr }).toUpperCase();

      const hasFks = sessions.some((s) => {
        const dateStr = toDateKey(s.dateISO ?? s.date);
        return dateStr === key && isSessionCompleted(s);
      });

      const hasExt = externalLoads.some((e) => {
        const dateStr = toDateKey(e.dateISO);
        return dateStr === key;
      });

      const dow = format(d, "eee", { locale: fr }).toLowerCase().slice(0, 3);
      const keyDay = frToKey[dow] ?? "";
      const hasClub = clubTrainingDays.includes(keyDay);
      const hasMatch = matchDays.includes(keyDay);
      const hasPlanned = plannedFksDays.includes(key);

      days.push({
        key,
        label,
        isToday: isSameDay(d, todayReal),
        hasFks,
        hasExt,
        hasClub,
        hasMatch,
        hasPlanned,
      });
    }

    return days;
  }, [
    devNowISO,
    weekStartIndex,
    sessions,
    externalLoads,
    clubTrainingDays,
    matchDays,
    plannedFksDays,
  ]);
}
