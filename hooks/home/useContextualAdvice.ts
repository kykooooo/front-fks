// hooks/home/useContextualAdvice.ts
// Hook qui évalue les règles de conseils et retourne le conseil prioritaire

import { useMemo } from "react";
import { addDays, subDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useExternalStore } from "../../state/stores/useExternalStore";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { useBlessures, geneLaPlusMarquante } from "../../state/selectors/blessures";
import { LIBELLE_ZONE } from "../../domain/monCorps/zones";
import { useRoutineBadges } from "../useRoutineBadges";
import { ADVICE_RULES, type Advice, type AdviceContext, type AdviceId } from "../../domain/adviceRules";
import { frToKey, toDateKey } from "../../utils/dateHelpers";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";
import { countRealActivityDays } from "./useRealLoadData";

// Catégories de routines mobilité (pour détecter dernière mobilité)
const MOBILITY_CATEGORIES = ["MOBILITÉ EXPRESS", "PACK 7 JOURS"];

// Règles qui affirment un ÉTAT MESURÉ (TSB fabriqué par les constantes
// d'amorçage) ou reprochent l'ABSENCE de données (no_mobility sur un compte
// neuf) : sautées tant qu'aucune donnée réelle de charge n'existe (H1).
// Les règles calendrier/signaux réels (match, club, gêne, cycle, streak)
// continuent de se déclencher : elles affirment des faits déclarés, pas un
// état mesuré. Le gating vit ICI (domain/adviceRules.ts n'est pas modifié).
export const REGLES_EXIGEANT_DONNEES_REELLES: AdviceId[] = [
  "tsb_extreme_fatigue",
  "tsb_fatigue",
  "recovery_needed",
  "no_mobility",
  "good_shape",
  "ready_default",
];

/**
 * Évaluation pure des règles (exportée pour les tests — pas de renderer dans
 * le dépôt) : filtre les règles exigeant des données réelles quand il n'y en a
 * pas, puis retourne le premier conseil dont la condition passe.
 */
export function evaluateAdviceRules(
  ctx: AdviceContext,
  hasRealLoadData: boolean
): Advice | null {
  const rules = hasRealLoadData
    ? ADVICE_RULES
    : ADVICE_RULES.filter((r) => !REGLES_EXIGEANT_DONNEES_REELLES.includes(r.id));
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (rule.condition(ctx)) {
      return rule.build(ctx);
    }
  }

  return null;
}

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
  // Gênes : MÊME source que la génération (« Mon corps »), via l'unique
  // sélecteur. Avant, ce hook lisait `dayStates[aujourd'hui].feedback.injury` et
  // ne voyait donc une gêne QUE le jour de sa déclaration, pendant que le
  // moteur la comptait 7 jours — deux fenêtres pour la même donnée (§1.4).
  const blessures = useBlessures();
  const completedRoutines = useExternalStore((s) => s.completedRoutines ?? []);
  const sessions = useSessionsStore((s) => s.sessions);
  const externalLoads = useExternalStore((s) => s.externalLoads);

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

    // === Gêne signalée ===
    // Tant que le joueur n'a pas dit qu'elle était passée, elle compte. Une
    // gêne « en reprise » compte aussi : le conseil doit continuer d'en parler.
    const gene = geneLaPlusMarquante(blessures);
    const hasActiveInjury = gene !== null;
    const injuryArea = gene ? LIBELLE_ZONE[gene.zone].toLowerCase() : undefined;

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

    // === Évaluation des règles par priorité (gating données réelles, H1) ===
    const hasRealLoadData = countRealActivityDays(sessions, externalLoads) > 0;
    return evaluateAdviceRules(ctx, hasRealLoadData);
  }, [
    tsb,
    atl,
    ctl,
    matchDays,
    clubTrainingDays,
    microcycleGoal,
    microcycleSessionIndex,
    devNowISO,
    blessures,
    completedRoutines,
    routineBadges.streak,
    sessions,
    externalLoads,
  ]);
}
