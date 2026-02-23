// hooks/useRoutineBadges.ts
// Calcul des badges pour les routines complétées (sans impact sur ATL/CTL/TSB)

import { useMemo } from "react";
import { useTrainingStore } from "../state/trainingStore";
import { startOfMonth, isSameMonth, isSameDay, subDays, parseISO } from "date-fns";

export type RoutineBadges = {
  thisMonth: number;
  total: number;
  streak: number;
  favoriteCategory: string | null;
  categoryBreakdown: Record<string, number>;
};

export function useRoutineBadges(): RoutineBadges {
  const completedRoutines = useTrainingStore((s) => s.completedRoutines ?? []);
  const devNowISO = useTrainingStore((s) => s.devNowISO);

  return useMemo(() => {
    const now = devNowISO ? parseISO(devNowISO) : new Date();
    const total = completedRoutines.length;

    // Ce mois
    const thisMonth = completedRoutines.filter((r) => {
      const date = parseISO(r.dateISO);
      return isSameMonth(date, now);
    }).length;

    // Breakdown par catégorie
    const categoryBreakdown: Record<string, number> = {};
    for (const r of completedRoutines) {
      categoryBreakdown[r.category] = (categoryBreakdown[r.category] ?? 0) + 1;
    }

    // Catégorie préférée
    let favoriteCategory: string | null = null;
    let maxCount = 0;
    for (const [cat, count] of Object.entries(categoryBreakdown)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = cat;
      }
    }

    // Streak : jours consécutifs avec au moins 1 routine (en partant d'aujourd'hui)
    let streak = 0;
    let checkDate = now;

    // Créer un Set des jours avec routines pour lookup rapide
    const daysWithRoutines = new Set<string>();
    for (const r of completedRoutines) {
      const date = parseISO(r.dateISO);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      daysWithRoutines.add(dayKey);
    }

    // Vérifier les jours consécutifs en remontant
    for (let i = 0; i < 365; i++) {
      const dayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (daysWithRoutines.has(dayKey)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        // Si on n'a pas de routine aujourd'hui mais hier oui, on commence le streak hier
        if (i === 0) {
          checkDate = subDays(checkDate, 1);
          continue;
        }
        break;
      }
    }

    return {
      thisMonth,
      total,
      streak,
      favoriteCategory,
      categoryBreakdown,
    };
  }, [completedRoutines, devNowISO]);
}
