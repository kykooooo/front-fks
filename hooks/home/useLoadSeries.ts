import { useMemo } from "react";
import { subDays } from "date-fns";
import { TRAINING_DEFAULTS } from "../../config/trainingDefaults";
import { updateTrainingLoad } from "../../engine/loadModel";
import { toDateKey } from "../../utils/dateHelpers";

type DailyApplied = Record<string, number> | undefined | null;

export function useLoadSeries(dailyApplied: DailyApplied, devNowISO?: string) {
  return useMemo(() => {
    const today = devNowISO ? new Date(devNowISO) : new Date();
    const daysBack = 7;
    const warmup = 21;
    const totalDays = daysBack + warmup;
    const orderedDays = Array.from({ length: totalDays }).map((_, idx) =>
      subDays(today, totalDays - 1 - idx)
    );
    let atlSeed = TRAINING_DEFAULTS.ATL0;
    let ctlSeed = TRAINING_DEFAULTS.CTL0;
    const tsbArr: number[] = [];

    orderedDays.forEach((d, idx) => {
      const key = toDateKey(d);
      const load = Number(dailyApplied?.[key] ?? 0) || 0;
      const next = updateTrainingLoad(atlSeed, ctlSeed, load, { dtDays: 1 });
      atlSeed = next.atl;
      ctlSeed = next.ctl;
      if (idx >= warmup) {
        tsbArr.push(Number(next.tsb.toFixed(1)));
      }
    });

    return { tsbArr };
  }, [dailyApplied, devNowISO]);
}
