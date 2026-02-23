import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { frToKey } from "../../utils/dateHelpers";

export function useMatchSoon(matchDays: string[], devNowISO?: string) {
  return useMemo(() => {
    if (!matchDays.length) return false;
    const today = devNowISO ? new Date(devNowISO) : new Date();
    for (let i = 0; i <= 2; i += 1) {
      const d = addDays(today, i);
      const dow = format(d, "eee", { locale: fr }).toLowerCase().slice(0, 3);
      const key = frToKey[dow] ?? "";
      if (matchDays.includes(key)) return true;
    }
    return false;
  }, [matchDays, devNowISO]);
}
