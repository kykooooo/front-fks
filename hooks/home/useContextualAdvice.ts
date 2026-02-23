// hooks/home/useContextualAdvice.ts
// Hook qui évalue les règles de conseils et retourne le conseil prioritaire

import { useMemo } from "react";
import { addDays, subDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTrainingStore } from "../../state/trainingStore";
import { useRoutineBadges } from "../useRoutineBadges";
import { ADVICE_RULES, type Advice, type AdviceContext } from "../../domain/adviceRules";
import { frToKey, toDateKey } from "../../utils/dateHelpers";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";

// Catégories de routines mobilité (pour détecter dernière mobilité)
const MOBILITY_CATEGORIES = ["MOBILITÉ EXPRESS", "PACK 7 JOURS"];

export function useContextualAdvice(): Advice | null {
  // Données du store
  const tsb = useTrainingStore((s) => s.tsb);
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const clubTrainingDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex ?? 0);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const dayStates = useTrainingStore((s) => s.dayStates ?? {});
  const completedRoutines = useTrainingStore((s) => s.completedRoutines ?? []);

  // Badges routines (pour streak)
  const routineBadges = useRoutineBadges();

  return useMemo(() => {
    const now = devNowISO ? new Date(devNowISO) : new Date();
    const nowISO = toDateKey(now);

    // Helper pour convertir jour français en clé
    const getDowKey = (date: Date): string => {
      const dow = format(date, "eee", { locale: fr }).toLowerCase().slice(0, 3);
      return frToKey[dow] ?? "";
    };

    // === Calcul daysUntilMatch ===
    let daysUntilMatch: number | null = null;
    for (let i = 0; i <= 3; i++) {
      const d = addDays(now, i);
      const key = getDowKey(d);
      if (matchDays.includes(key)) {
        daysUntilMatch = i;
        break;
      }
    }

    const isMatchToday = daysUntilMatch === 0;

    // === Calcul isPostMatch (J+1 après match) ===
    const yesterday = subDays(now, 1);
    const yesterdayKey = getDowKey(yesterday);
    const isPostMatch = matchDays.includes(yesterdayKey);

    // === Calcul isClubToday ===
    const todayKey = getDowKey(now);
    const isClubToday = clubTrainingDays.includes(todayKey);

    // === Calcul daysSinceLastMobility ===
    let daysSinceLastMobility: number | null = null;
    const mobilityRoutines = completedRoutines.filter((r) =>
      MOBILITY_CATEGORIES.some(
        (cat) => r.category.toUpperCase().includes(cat) || cat.includes(r.category.toUpperCase())
      )
    );
    if (mobilityRoutines.length > 0) {
      const sorted = [...mobilityRoutines].sort(
        (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
      );
      const lastMobilityDate = new Date(sorted[0].dateISO);
      daysSinceLastMobility = differenceInDays(now, lastMobilityDate);
    }

    // === Blessure active ===
    const todayDayState = dayStates[nowISO];
    const injury = todayDayState?.feedback?.injury;
    const hasActiveInjury = Boolean(injury && injury.severity > 0);
    const injuryArea = injury?.area;

    // === Cycle remaining ===
    const cycleRemaining = MICROCYCLE_TOTAL_SESSIONS_DEFAULT - microcycleSessionIndex;

    // === Construction du contexte ===
    const ctx: AdviceContext = {
      tsb,
      atl,
      ctl,
      matchDays,
      clubTrainingDays,
      daysUntilMatch,
      isMatchToday,
      isPostMatch,
      isClubToday,
      microcycleGoal,
      microcycleSessionIndex,
      cycleRemaining,
      daysSinceLastMobility,
      routineStreak: routineBadges.streak,
      hasActiveInjury,
      injuryArea,
      nowISO,
    };

    // === Évaluation des règles par priorité ===
    const sortedRules = [...ADVICE_RULES].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (rule.condition(ctx)) {
        return rule.build(ctx);
      }
    }

    return null;
  }, [
    tsb,
    atl,
    ctl,
    matchDays,
    clubTrainingDays,
    microcycleGoal,
    microcycleSessionIndex,
    devNowISO,
    dayStates,
    completedRoutines,
    routineBadges.streak,
  ]);
}
