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
import { useActiveInjuries } from "../useActiveInjuries";
import { ADVICE_RULES, type Advice, type AdviceContext } from "../../domain/adviceRules";
import { frToKey, toDateKey } from "../../utils/dateHelpers";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";

// MVP blessures Jour 4 — fenêtres temporelles pour les règles.
const MS_PER_DAY = 86_400_000;
const INJURY_STALE_DAYS = 7;        // règle `injury_stale` : carte Home "Toujours sensible ?"
const INJURY_AUTO_DISABLE_DAYS = 14; // règle D : au-delà, injury filtrée en lecture
const PAIN_WINDOW_DAYS = 14;        // règle 4 charte : fenêtre glissante scores pain

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
  // MVP blessures Jour 3 : fallback injuryMaxSeverity depuis lastAiContext.
  // Utilisé uniquement si `useActiveInjuries` est encore en loading (premier
  // render après mount). La source primaire (Firestore temps réel via
  // useActiveInjuries) prend le relais dès qu'elle est prête.
  const injuryMaxSeverityFromAiContext = useSessionsStore(
    (s) => s.lastAiContext?.constraints?.injury_max_severity ?? 0,
  );
  const sessionsList = useSessionsStore((s) => s.sessions ?? []);

  // MVP blessures Jour 4 : source Firestore temps réel des zones sensibles.
  // Alimente les règles `injury_stale` + filtrage auto-désactivation 14j +
  // `injuryMaxSeverity` à jour sans attendre une nouvelle génération.
  const { activeInjuries, lastSeenPainSpike, loading: injuriesLoading } = useActiveInjuries();

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

    // === Blessures — source Firestore (Jour 4) ===
    // Auto-désactivation en lecture : les injuries sans lastConfirm récent
    // (> 14 jours) sont filtrées avant d'atteindre les règles. On ne modifie
    // PAS activeInjuries côté Firestore (respect charte règle 3).
    const nowMs = now.getTime();
    const filteredActiveInjuries = activeInjuries.filter((i) => {
      const ref = i.lastConfirm || i.startDate;
      const refMs = new Date(ref).getTime();
      if (!Number.isFinite(refMs)) return true; // date corrompue : on garde par prudence
      const days = (nowMs - refMs) / MS_PER_DAY;
      return days <= INJURY_AUTO_DISABLE_DAYS;
    });

    // Injury "stale" (entre 7 et 14 jours sans confirmation) → règle injury_stale.
    let staleInjury: { area: string; daysSince: number } | null = null;
    for (const i of filteredActiveInjuries) {
      const ref = i.lastConfirm || i.startDate;
      const refMs = new Date(ref).getTime();
      if (!Number.isFinite(refMs)) continue;
      const days = Math.floor((nowMs - refMs) / MS_PER_DAY);
      if (days > INJURY_STALE_DAYS && days <= INJURY_AUTO_DISABLE_DAYS) {
        staleInjury = { area: i.area, daysSince: days };
        break;
      }
    }

    // injuryMaxSeverity — source primaire : filteredActiveInjuries.
    // Fallback : lastAiContext (en cas de loading du hook Firestore).
    const maxFromFiltered = filteredActiveInjuries.reduce(
      (max, i) => Math.max(max, Number(i.severity ?? 0)),
      0,
    );
    const injuryMaxSeverity = injuriesLoading
      ? injuryMaxSeverityFromAiContext
      : Math.max(maxFromFiltered, 0);

    // Compat legacy `hasActiveInjury` / `injuryArea` — priorité au profil,
    // fallback sur le feedback du jour (pour les joueurs pré-MVP).
    const todayDayState = dayStates[nowISO];
    const injuryFallback = todayDayState?.feedback?.injury;
    const hasActiveInjury =
      filteredActiveInjuries.length > 0 ||
      Boolean(injuryFallback && injuryFallback.severity > 0);
    const injuryArea = filteredActiveInjuries[0]?.area ?? injuryFallback?.area;

    // === MVP Jour 4 : pain scores fenêtre 14j (règle 4 charte rescalée) ===
    const windowStartMs = nowMs - PAIN_WINDOW_DAYS * MS_PER_DAY;
    const sortedSessions = [...sessionsList]
      .filter((s) => typeof s?.feedback?.pain === "number")
      .sort((a, b) => new Date(b?.dateISO ?? b?.date ?? 0).getTime() - new Date(a?.dateISO ?? a?.date ?? 0).getTime());

    const recentInjuryPainScoresLast14Days = sortedSessions
      .filter((s) => {
        const t = new Date(s?.dateISO ?? s?.date ?? 0).getTime();
        return Number.isFinite(t) && t >= windowStartMs;
      })
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
      recentInjuryPainScoresLast14Days,
      lastPainSpike,
      lastSeenPainSpikeISO: lastSeenPainSpike,
      staleInjury,
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
    injuryMaxSeverityFromAiContext,
    sessionsList,
    activeInjuries,
    lastSeenPainSpike,
    injuriesLoading,
  ]);
}
