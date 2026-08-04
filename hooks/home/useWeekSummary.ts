import { useMemo } from "react";
import { toDateKey } from "../../utils/dateHelpers";
import { compterSeancesFksSurJours } from "../../domain/resumeCanonique";
import type { Session } from "../../domain/types";
import type { ExternalLoad } from "../../state/stores/types";

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
    // Le comptage des seances FKS de la semaine est DELEGUE au resume canonique
    // (domain/resumeCanonique.ts) : c'est la meme fonction qui sert la boucle de
    // suivi et le Home vNext. Resultat rigoureusement identique a l'ancienne
    // ligne — seule l'implementation est mise en commun, pour que les deux
    // ecrans ne puissent plus diverger d'une seance.
    const fksCount = compterSeancesFksSurJours(sessions, weekKeySet);
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
