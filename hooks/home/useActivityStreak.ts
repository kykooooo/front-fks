import { useMemo } from "react";
import { subDays } from "date-fns";
import { toDateKey } from "../../utils/dateHelpers";
import type { Session } from "../../domain/types";
import type { ExternalLoad } from "../../state/stores/types";

/**
 * Revue web post-É1.5 (point 3) : "Lance ta première séance" n'a de sens que
 * si l'historique est réellement vide — pas quand la série retombe juste à 0
 * après une pause (auquel cas "Relance ta série" est le bon message, jamais
 * "première" pour quelqu'un qui a déjà une historique).
 */
export function hasAnyCompletedSession(sessions: Session[]): boolean {
  return sessions.some((s) => s.completed);
}

/** Copy partagé (Home carte semaine, écran combiné, carte Progression flag OFF). */
export function streakCopy(streak: number, hasEverCompleted: boolean): string {
  if (streak === 0) {
    return hasEverCompleted ? "Relance ta série" : "Lance ta première séance";
  }
  return streak === 1 ? "1 jour d’affilée" : `${streak} jours d’affilée`;
}

export function useActivityStreak(
  sessions: Session[],
  externalLoads: ExternalLoad[],
  devNowISO?: string
) {
  return useMemo(() => {
    const activity = new Set<string>();
    sessions
      .filter((s) => s.completed)
      .forEach((s) => activity.add(toDateKey(s.dateISO ?? s.date)));
    externalLoads.forEach((e) => activity.add(toDateKey(e.dateISO)));

    const base = devNowISO ? new Date(devNowISO) : new Date();
    let count = 0;
    for (let i = 0; i < 365; i += 1) {
      const key = toDateKey(subDays(base, i));
      if (activity.has(key)) {
        count += 1;
        continue;
      }
      // Jour de grâce : pas encore d'activité aujourd'hui, la série d'hier tient toujours
      // (même logique que useRoutineBadges).
      if (i === 0) continue;
      break;
    }
    return count;
  }, [sessions, externalLoads, devNowISO]);
}
