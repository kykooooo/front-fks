// hooks/home/useContextualAdvice.ts
// Hook qui évalue les règles de conseils et retourne le conseil prioritaire

import { useMemo } from "react";
import { addDays, subDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useExternalStore } from "../../state/stores/useExternalStore";
import { useFeedbackStore } from "../../state/stores/useFeedbackStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { useRoutineBadges } from "../useRoutineBadges";
import { ADVICE_RULES, type Advice, type AdviceContext } from "../../domain/adviceRules";
import { frToKey, toDateKey } from "../../utils/dateHelpers";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";

// Catégories de routines mobilité (pour détecter dernière mobilité)
const MOBILITY_CATEGORIES = ["MOBILITÉ EXPRESS", "PACK 7 JOURS"];

export function useContextualAdvice(): Advice | null {
  // Données du store
  const tsb = useLoadStore((s) => s.tsb);
  const atl = useLoadStore((s) => s.atl);
  const ctl = useLoadStore((s) => s.ctl);
  const matchDays = useExternalStore((s) => s.matchDays ?? []);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex ?? 0);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const dayStates = useFeedbackStore((s) => s.dayStates ?? {});
  const completedRoutines = useExternalStore((s) => s.completedRoutines ?? []);
  // MVP blessures Jour 3 : alimente les règles injury_progress_detected
  // (règle 4 charte) + injury_pain_spike (règle 5 charte).
  // Source `injuryMaxSeverity` : `lastAiContext.constraints.injury_max_severity`
  // rempli par aiContext.ts depuis `profile.activeInjuries`.
  const injuryMaxSeverity = useSessionsStore(
    (s) => s.lastAiContext?.constraints?.injury_max_severity ?? 0,
  );
  const sessionsList = useSessionsStore((s) => s.sessions ?? []);

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

    // === MVP Jour 3 : données pour injury_progress_detected + injury_pain_spike ===
    // Trié desc : session la plus récente en premier.
    const sortedSessions = [...sessionsList]
      .filter((s) => typeof s?.feedback?.pain === "number")
      .sort((a, b) => new Date(b?.dateISO ?? b?.date ?? 0).getTime() - new Date(a?.dateISO ?? a?.date ?? 0).getTime());
    // 3 derniers scores de pain (ordre décroissant — plus récent d'abord).
    const recentInjuryPainScores = sortedSessions
      .slice(0, 3)
      .map((s) => Number(s.feedback?.pain ?? 0))
      .filter((n) => Number.isFinite(n));
    // Dernier pic de douleur (pain >= 7 sur échelle EVA 0-10 unifiée).
    // Règle 5 de INJURY_IA_CHARTER.md.
    const spikeCandidate = sortedSessions.find((s) => Number(s.feedback?.pain ?? 0) >= 7);
    const lastPainSpike = spikeCandidate
      ? {
          pain: Number(spikeCandidate.feedback?.pain ?? 0),
          dateISO: String(spikeCandidate.dateISO ?? spikeCandidate.date ?? nowISO),
        }
      : null;

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
      injuryMaxSeverity,
      recentInjuryPainScores,
      lastPainSpike,
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
    injuryMaxSeverity,
    sessionsList,
  ]);
}
