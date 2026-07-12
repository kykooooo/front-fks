// domain/weekPlanning.ts
//
// Étape É0 du design "Planning hebdo" (voir C:\Users\Gamer\fks,
// branche feat/catalog-v2-editorial, src/dev/PLANNING_HEBDO_DESIGN.md, §3).
//
// Module de RÈGLES PUR : à partir du profil (âge, jours club/match récurrents,
// cycle actif, souhait) et de la semaine visée, calcule quels jours portent
// une séance FKS pleine, lesquels sont interdits et pourquoi.
//
// Zéro I/O, zéro dépendance React/Navigation/Firestore. Déterministe.
//
// Principe d'or (design §2.2) : "le plan propose, les gates disposent" — ce
// module ne place JAMAIS une séance pleine un jour de match, J-1 ou jour de
// club (P1) : c'est un SOUS-ENSEMBLE strict des jours que le moteur sert déjà
// en "normal", jamais un élargissement des gates backend existants.

import { AgeCategory } from "./types";
import { MicrocycleId } from "./microcycles";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export const DOW_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DowKey = (typeof DOW_ORDER)[number];

export type WeekStartDay = "mon" | "sun";

/** Statut source d'un jour (design §2.3). MATCH prime sur CLUB si les deux. */
export type DayStatus = "match" | "club" | "libre";

/**
 * Fenêtre d'un jour LIBRE, calculée par rapport au(x) jour(s) de match
 * récurrent(s) le(s) plus proche(s) (avant ET après, la récurrence
 * hebdomadaire des jours de match fait qu'un jour peut être "après" le
 * match de la semaine précédente ET/OU "avant" celui de cette semaine).
 */
export type MatchWindow = "j-1" | "j-2" | "j+1" | "j+2" | "normal";

/** Ce que le plan place réellement un jour donné. */
export type SessionPlacement = "full" | "moderate" | null;

export interface PlannedDay {
  dow: DowKey;
  status: DayStatus;
  /** Fenêtre calculée (toujours renseignée, même hors "libre", pour debug). */
  window: MatchWindow;
  /** P7 : jour strictement compris entre deux matchs <5j d'écart cette semaine. */
  congestion: boolean;
  /** Le jour pouvait-il structurellement recevoir une séance (avant score/tri) ? */
  eligible: boolean;
  /** Séance effectivement placée par P6, ou null. */
  placement: SessionPlacement;
  /** Score P6 (uniquement pertinent si eligible). */
  score: number;
  /** Trace des règles ayant produit ce jour (préfixe "plan:"), même esprit que guardrails_applied. */
  reasons: string[];
}

export interface WeekPlanInputs {
  ageCategory: AgeCategory;
  /** Jours de semaine récurrents d'entraînement club (ex. ["tue","thu"]). */
  clubTrainingDays: DowKey[];
  /** Jours de semaine récurrents de match (ex. ["sun"]). */
  matchDays: DowKey[];
  /** Souhait joueur 1-4 (profil `targetFksSessionsPerWeek`). Défaut 2, clampé 1-4. */
  targetFksSessionsPerWeek?: number | null;
  /** Cycle actif. `null` = pas de cycle actif → aucune séance ne peut être prescrite (règle globale FKS #1). */
  microcycleGoal: MicrocycleId | null;
  /** Premier jour de la semaine affichée (settings `weekStart`). Défaut "mon". */
  weekStart?: WeekStartDay;
}

export interface WeekPlanResult {
  weekStart: WeekStartDay;
  /** 7 jours, en ordre chronologique depuis `weekStart`. */
  days: PlannedDay[];
  /** Cible finale de séances pleines pour la semaine (après P1-P7). */
  target: number;
  placedCount: number;
  placedDows: DowKey[];
  /** Avertissements/traces au niveau semaine (ex. "plan:zero_target_club_saturated"). */
  warnings: string[];
}

// ═══════════════════════════════════════════
// Constantes des règles (design §3)
// ═══════════════════════════════════════════

/** P3 — table budget/cap par âge (design §3, table P3). */
const AGE_BUDGET: Record<AgeCategory, { budgetDays: number; offDaysMin: number; capFks: number }> = {
  U13: { budgetDays: 4, offDaysMin: 3, capFks: 1 },
  U15: { budgetDays: 5, offDaysMin: 2, capFks: 2 },
  U17: { budgetDays: 5, offDaysMin: 2, capFks: 2 },
  U18: { budgetDays: 6, offDaysMin: 1, capFks: 3 },
  Senior: { budgetDays: 6, offDaysMin: 1, capFks: 3 },
};

/** P3 — cible_cycle par cycle actif (design §3). */
const CYCLE_TARGET: Record<MicrocycleId, number> = {
  fondation: 2,
  force: 2,
  endurance: 2,
  explosivite: 2,
  saison: 1,
};

const YOUTH_AGE_CATEGORIES: ReadonlySet<AgeCategory> = new Set(["U13", "U15"]);

/**
 * Plafond FKS/semaine par âge (table P3, `AGE_BUDGET`) — exposé pour l'UI
 * (contrôle objectif hebdo, É1.5) qui doit pouvoir expliquer honnêtement un
 * plafond d'âge sans dupliquer la table de règles ici.
 */
export function capFksForAge(ageCategory: AgeCategory): number {
  return AGE_BUDGET[ageCategory].capFks;
}

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 4;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const dowIndex = (d: DowKey): number => DOW_ORDER.indexOf(d);

/** 7 clés de jour en ordre chronologique depuis `weekStart` (design §2.3). */
export function orderedWeek(weekStart: WeekStartDay): DowKey[] {
  const startIdx = weekStart === "sun" ? dowIndex("sun") : dowIndex("mon");
  return Array.from({ length: 7 }, (_, i) => DOW_ORDER[(startIdx + i) % 7]);
}

// ═══════════════════════════════════════════
// P1 — statut source d'un jour
// ═══════════════════════════════════════════

/**
 * P1 — Statut source. MATCH prime sur CLUB si le jour est les deux
 * (design §2.3 : "CLUB ... ; si les deux, MATCH prime").
 */
export function computeDayStatus(dow: DowKey, clubTrainingDays: DowKey[], matchDays: DowKey[]): DayStatus {
  if (matchDays.includes(dow)) return "match";
  if (clubTrainingDays.includes(dow)) return "club";
  return "libre";
}

// ═══════════════════════════════════════════
// Fenêtre J±X — nearest-match, récurrence hebdomadaire
// ═══════════════════════════════════════════

/**
 * Fenêtre d'un jour par rapport au(x) match(s) récurrent(s) le(s) plus
 * proche(s), toutes directions confondues (la récurrence hebdomadaire fait
 * qu'un jour peut être à la fois proche du match de la semaine précédente
 * ET de celui de cette semaine — design §2.3, exemple "lun = J+1" avec un
 * seul match le dimanche).
 *
 * Priorité en cas de candidats multiples : la distance la plus courte
 * gagne ; à distance égale, "avant un match" (J-X) l'emporte sur "après"
 * (J+X) — cohérent avec l'ordre backend match > j-1 > j-2 > j+1 > j+2
 * (fksOrchestrator.ts:1793-1798).
 */
export function computeMatchWindow(dow: DowKey, matchDays: DowKey[]): MatchWindow {
  const d = dowIndex(dow);
  type Candidate = { dist: number; before: boolean };
  const candidates: Candidate[] = [];

  for (const m of matchDays) {
    const mi = dowIndex(m);
    if (mi === d) continue; // jour de match lui-même : géré par le statut, pas la fenêtre
    const forward = (mi - d + 7) % 7; // jours jusqu'au match -> "avant" (J-X)
    const backward = (d - mi + 7) % 7; // jours depuis le match -> "après" (J+X)
    if (forward <= 2) candidates.push({ dist: forward, before: true });
    if (backward <= 2) candidates.push({ dist: backward, before: false });
  }

  if (candidates.length === 0) return "normal";

  candidates.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (a.before === b.before) return 0;
    return a.before ? -1 : 1; // "avant" gagne l'égalité
  });

  const winner = candidates[0];
  if (winner.before) return winner.dist === 1 ? "j-1" : "j-2";
  return winner.dist === 1 ? "j+1" : "j+2";
}

/** Distance (jours, plafonnée à 3) au match récurrent le plus proche, sens indifférent — sert au score P6. */
export function nearestMatchDistance(dow: DowKey, matchDays: DowKey[]): number {
  if (matchDays.length === 0) return 3; // pas de match -> valeur neutre (plafond)
  const d = dowIndex(dow);
  let min = 3;
  for (const m of matchDays) {
    const mi = dowIndex(m);
    if (mi === d) return 0;
    const forward = (mi - d + 7) % 7;
    const backward = (d - mi + 7) % 7;
    min = Math.min(min, forward, backward);
  }
  return Math.min(3, min);
}

// ═══════════════════════════════════════════
// P7 — congestion entre deux matchs rapprochés (cette semaine)
// ═══════════════════════════════════════════

/**
 * P7 — jours strictement compris entre deux matchs de LA SEMAINE AFFICHÉE
 * dont l'écart calendaire est < 5 jours ("2 matchs espacés de <5 jours :
 * rien entre les deux", design §3 P7). Ne considère que les paires de
 * matchs qui tombent toutes les deux dans la semaine visée (le cas
 * "matchs lun+dim, écart 6j" ne déclenche rien : design §3 P7 test b).
 */
export function computeCongestionDays(week: DowKey[], matchDays: DowKey[]): Set<DowKey> {
  const matchSet = new Set(matchDays);
  const matchPositions = week.map((d, i) => (matchSet.has(d) ? i : -1)).filter((i) => i >= 0);
  const congested = new Set<DowKey>();
  for (let k = 0; k < matchPositions.length - 1; k++) {
    const a = matchPositions[k];
    const b = matchPositions[k + 1];
    if (b - a < 5) {
      for (let i = a + 1; i < b; i++) congested.add(week[i]);
    }
  }
  return congested;
}

function hasCongestionPair(week: DowKey[], matchDays: DowKey[]): boolean {
  const matchSet = new Set(matchDays);
  const matchPositions = week.map((d, i) => (matchSet.has(d) ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < matchPositions.length - 1; k++) {
    if (matchPositions[k + 1] - matchPositions[k] < 5) return true;
  }
  return false;
}

// ═══════════════════════════════════════════
// P3 — cible de séances FKS pleines
// ═══════════════════════════════════════════

/**
 * P3/P7 — cible_fks de la semaine.
 *
 * ```
 * cible_fks = min( cap_fks(âge),
 *                  budget(âge) − jours_occupés,
 *                  souhait,
 *                  cible_cycle (+1 si semaine sans match) )
 * ```
 *
 * P7 "trêve" (0 club, 0 match) : cible = min(cap_âge, souhait, 3) — override
 * dédié (design §3 P7), indépendant du cycle actif.
 * P7 "2 matchs <5j d'écart" : cap supplémentaire à 1.
 */
export function computeTargetFks(inputs: WeekPlanInputs, week: DowKey[]): { target: number; warnings: string[] } {
  const { ageCategory, clubTrainingDays, matchDays, targetFksSessionsPerWeek, microcycleGoal } = inputs;
  const warnings: string[] = [];
  const budget = AGE_BUDGET[ageCategory];
  const souhait = clamp(targetFksSessionsPerWeek ?? 2, WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX);

  if (!microcycleGoal) {
    warnings.push("plan:no_active_cycle");
    return { target: 0, warnings };
  }

  const isTreve = clubTrainingDays.length === 0 && matchDays.length === 0;
  let target: number;

  if (isTreve) {
    target = Math.min(budget.capFks, souhait, 3);
    warnings.push("plan:p7_treve");
  } else {
    const occupiedDows = new Set<DowKey>([...clubTrainingDays, ...matchDays]);
    const joursOccupes = occupiedDows.size;
    const noMatch = matchDays.length === 0;
    const cibleCycle = CYCLE_TARGET[microcycleGoal] + (noMatch ? 1 : 0);
    if (noMatch) warnings.push("plan:p7_no_match_bonus_session");

    target = Math.min(budget.capFks, budget.budgetDays - joursOccupes, souhait, cibleCycle);
    target = Math.max(0, target);

    if (hasCongestionPair(week, matchDays)) {
      target = Math.min(target, 1);
      warnings.push("plan:p7_congestion_target_capped_1");
    }
  }

  if (target === 0) warnings.push("plan:zero_target");
  return { target, warnings };
}

// ═══════════════════════════════════════════
// Orchestrateur — P1/P2/P4/P5/P6/P7
// ═══════════════════════════════════════════

interface DayCandidate {
  dow: DowKey;
  window: MatchWindow;
  score: number;
  placement: SessionPlacement;
}

function computeScore(dow: DowKey, week: DowKey[], window: MatchWindow, clubTrainingDays: DowKey[], matchDays: DowKey[]): number {
  // P6 — score entier déterministe (design §3 P6).
  const yesterday = DOW_ORDER[(dowIndex(dow) - 1 + 7) % 7];
  const tomorrow = DOW_ORDER[(dowIndex(dow) + 1) % 7];
  const yesterdayStatus = computeDayStatus(yesterday, clubTrainingDays, matchDays);
  const tomorrowStatus = computeDayStatus(tomorrow, clubTrainingDays, matchDays);

  let score = 0;
  if (window === "normal") score += 3; // +3 fenêtre NORMAL (vs J+2/J-2 admis)
  score += nearestMatchDistance(dow, matchDays); // +min(3, distance)
  if (yesterdayStatus === "libre") score += 1; // +1 veille jour OFF complet
  if (yesterdayStatus === "club") score -= 2; // -2 lendemain d'un jour club
  if (tomorrowStatus === "club") score -= 1; // -1 veille d'un jour club
  return score;
}

/**
 * Calcule le plan complet de la semaine (P1 → P7).
 */
export function computeWeekPlan(inputs: WeekPlanInputs): WeekPlanResult {
  const weekStart: WeekStartDay = inputs.weekStart ?? "mon";
  const week = orderedWeek(weekStart);
  const { ageCategory, clubTrainingDays, matchDays, microcycleGoal } = inputs;

  const congestionDays = computeCongestionDays(week, matchDays);
  const { target, warnings } = computeTargetFks(inputs, week);

  // --- Pass 1 : statut + fenêtre + éligibilité structurelle (P1/P2/P5) ---
  const base = week.map((dow) => {
    const status = computeDayStatus(dow, clubTrainingDays, matchDays);
    const window: MatchWindow = status === "libre" ? computeMatchWindow(dow, matchDays) : "normal";
    const congestion = congestionDays.has(dow);
    return { dow, status, window, congestion };
  });

  const hasNormalDay = base.some((d) => d.status === "libre" && d.window === "normal" && !d.congestion);
  const isYouth = YOUTH_AGE_CATEGORIES.has(ageCategory);
  const isForceCycle = microcycleGoal === "force";

  // Un J+2 est "admissible pour l'âge" s'il n'est pas interdit jeune (P2).
  const j2AdmissibleForAge = !isYouth;
  const hasNormalOrAdmissibleJ2 = base.some(
    (d) => d.status === "libre" && !d.congestion && (d.window === "normal" || (d.window === "j+2" && j2AdmissibleForAge))
  );

  const days: PlannedDay[] = base.map(({ dow, status, window, congestion }) => {
    const reasons: string[] = [];
    let eligible = true;

    if (status === "match") {
      eligible = false;
      reasons.push("plan:p1_match_day");
    } else if (status === "club") {
      eligible = false;
      reasons.push("plan:p1_club_day");
    } else if (congestion) {
      eligible = false;
      reasons.push("plan:p7_congestion_between_matches");
    } else {
      switch (window) {
        case "j-1":
          eligible = false;
          reasons.push("plan:p1_j_minus_1");
          break;
        case "j+1":
          eligible = false;
          reasons.push("plan:p2_j_plus_1");
          break;
        case "j+2":
          if (isYouth) {
            eligible = false;
            reasons.push("plan:p2_j_plus_2_youth_forbidden");
          } else {
            reasons.push("plan:p2_j_plus_2_moderate");
          }
          break;
        case "j-2": {
          let excludedByYouth = isYouth;
          let excludedByForce = isForceCycle;
          if (excludedByYouth && !hasNormalDay) {
            excludedByYouth = false;
            reasons.push("plan:p2_j_minus_2_youth_fallback");
          }
          if (excludedByForce && !hasNormalOrAdmissibleJ2) {
            excludedByForce = false;
            reasons.push("plan:p5_force_match_distance_fallback");
          }
          if (excludedByYouth) {
            eligible = false;
            reasons.push("plan:p2_j_minus_2_youth_excluded");
          } else if (excludedByForce) {
            eligible = false;
            reasons.push("plan:p5_force_match_distance");
          } else {
            reasons.push("plan:p2_j_minus_2_admis");
          }
          break;
        }
        case "normal":
          reasons.push("plan:p6_normal_eligible");
          break;
      }
    }

    const score = eligible ? computeScore(dow, week, window, clubTrainingDays, matchDays) : 0;

    return {
      dow,
      status,
      window,
      congestion,
      eligible,
      placement: null,
      score,
      reasons,
    };
  });

  // --- Pass 2 : sélection gloutonne (P4 espacement + P2 J+2 max 1/semaine) ---
  const candidates: DayCandidate[] = days
    .filter((d) => d.eligible)
    .map((d) => ({ dow: d.dow, window: d.window, score: d.score, placement: d.window === "j+2" ? "moderate" : "full" }));

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return week.indexOf(a.dow) - week.indexOf(b.dow); // ordre chronologique, départage stable
  });

  const blocked = new Set<DowKey>();
  const selected = new Set<DowKey>();
  let j2Count = 0;

  for (const c of candidates) {
    if (selected.size >= target) break;
    if (blocked.has(c.dow)) continue;
    if (c.window === "j+2" && j2Count >= 1) continue; // P2 : max 1 séance J+2/semaine

    selected.add(c.dow);
    if (c.window === "j+2") j2Count++;

    const idx = week.indexOf(c.dow);
    if (idx > 0) blocked.add(week[idx - 1]); // P4 : jamais 2 séances calendaires consécutives
    if (idx < week.length - 1) blocked.add(week[idx + 1]);
  }

  const finalDays = days.map((d) => {
    if (!selected.has(d.dow)) return d;
    const placement: SessionPlacement = d.window === "j+2" ? "moderate" : "full";
    return { ...d, placement, reasons: [...d.reasons, "plan:p6_selected"] };
  });

  const placedDows = finalDays.filter((d) => d.placement !== null).map((d) => d.dow);
  if (placedDows.length < target) warnings.push("plan:target_not_fully_reached");

  return {
    weekStart,
    days: finalDays,
    target,
    placedCount: placedDows.length,
    placedDows,
    warnings,
  };
}

// ═══════════════════════════════════════════
// P8 — adaptation en cours de semaine
// ═══════════════════════════════════════════

/**
 * P8 — séance manquée : recalcule le plan sur les jours RESTANTS de la
 * semaine (aujourd'hui inclus) avec `cible' = cible − séances_faites`. Ne
 * recrée jamais de dette : si aucun jour valide ne reste, la séance
 * disparaît sans report (design §2.2.4).
 */
export function replanRemainingWeek(
  inputs: WeekPlanInputs,
  priorPlan: WeekPlanResult,
  opts: { todayDow: DowKey; completedDows: DowKey[] }
): WeekPlanResult {
  const week = orderedWeek(priorPlan.weekStart);
  const todayIdx = week.indexOf(opts.todayDow);
  const remaining = new Set(week.slice(todayIdx)); // aujourd'hui inclus

  const remainingTarget = Math.max(0, priorPlan.target - opts.completedDows.length);

  // Recalcule un plan complet (mêmes règles P1-P7), puis restreint la
  // sélection aux jours restants uniquement.
  const fullRecompute = computeWeekPlan({ ...inputs, weekStart: priorPlan.weekStart });

  const eligibleRemaining: DayCandidate[] = fullRecompute.days
    .filter((d) => d.eligible && remaining.has(d.dow))
    .map((d) => ({ dow: d.dow, window: d.window, score: d.score, placement: d.window === "j+2" ? "moderate" : "full" }));

  eligibleRemaining.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return week.indexOf(a.dow) - week.indexOf(b.dow);
  });

  const blocked = new Set<DowKey>();
  const selected = new Set<DowKey>();
  let j2Count = 0;
  for (const c of eligibleRemaining) {
    if (selected.size >= remainingTarget) break;
    if (blocked.has(c.dow)) continue;
    if (c.window === "j+2" && j2Count >= 1) continue;
    selected.add(c.dow);
    if (c.window === "j+2") j2Count++;
    const idx = week.indexOf(c.dow);
    if (idx > 0) blocked.add(week[idx - 1]);
    if (idx < week.length - 1) blocked.add(week[idx + 1]);
  }

  const days = fullRecompute.days.map((d) => {
    if (!remaining.has(d.dow)) {
      // Jour déjà passé : reflète ce qui a été fait, ne devient jamais "dette".
      const wasCompleted = opts.completedDows.includes(d.dow);
      return { ...d, placement: wasCompleted ? d.placement : null };
    }
    if (!selected.has(d.dow)) return { ...d, placement: null };
    const placement: SessionPlacement = d.window === "j+2" ? "moderate" : "full";
    return { ...d, placement, reasons: [...d.reasons, "plan:missed_replanned"] };
  });

  const placedDows = days.filter((d) => d.placement !== null).map((d) => d.dow);

  return {
    weekStart: priorPlan.weekStart,
    days,
    target: remainingTarget,
    placedCount: placedDows.length,
    placedDows,
    warnings: [...fullRecompute.warnings, "plan:missed_replanned"],
  };
}

// ═══════════════════════════════════════════
// P8 — déplacement manuel
// ═══════════════════════════════════════════

export interface ManualMoveResult {
  allowed: boolean;
  /** Étiquette véridique citant ce que les gates serviront réellement (design §3 P8). */
  label: string;
  reason: string;
}

/**
 * P8 — déplacement manuel d'une séance prescrite vers `targetDow`.
 * Refus dur (2 cas seulement) : jour de match, J-1. Sinon accepté avec une
 * étiquette qui cite ce que le backend servira réellement (jamais une
 * promesse au-delà des gates — design §3 P8, principe "le plan ne promet
 * jamais mieux que ce que les gates serviront").
 */
export function evaluateManualMove(
  targetDow: DowKey,
  inputs: Pick<WeekPlanInputs, "clubTrainingDays" | "matchDays">,
  week: DowKey[],
  /** Autres jours déjà prescrits cette semaine (hors séance déplacée), pour l'avertissement P4. */
  otherPlacedDows: DowKey[] = []
): ManualMoveResult {
  const status = computeDayStatus(targetDow, inputs.clubTrainingDays, inputs.matchDays);
  const window: MatchWindow = status === "libre" ? computeMatchWindow(targetDow, inputs.matchDays) : "normal";

  if (status === "match") {
    return {
      allowed: false,
      label: "",
      reason: "Jour de match : l'app ne servirait que 20 min d'activation, et ça consommerait une séance de ton cycle.",
    };
  }
  if (status === "libre" && window === "j-1") {
    return {
      allowed: false,
      label: "",
      reason: "Match demain : ce jour-là l'app ne servirait que 20 min d'activation, et ça consommerait une séance de ton cycle.",
    };
  }
  if (status === "club") {
    return { allowed: true, label: "Micro-dose ≤ 30 min ce jour-là", reason: "plan:p8_move_club" };
  }
  if (window === "j+1") {
    return { allowed: true, label: "Récup uniquement", reason: "plan:p8_move_j_plus_1" };
  }
  if (window === "j+2" || window === "j-2") {
    return { allowed: true, label: "Séance modérée", reason: "plan:p8_move_moderate_window" };
  }

  // P4 : jamais 2 séances calendaires consécutives -> accepté + avertissement (jamais refusé).
  const idx = week.indexOf(targetDow);
  const neighborBefore = idx > 0 ? week[idx - 1] : null;
  const neighborAfter = idx < week.length - 1 ? week[idx + 1] : null;
  const violatesSpacing = otherPlacedDows.some((d) => d === neighborBefore || d === neighborAfter);
  if (violatesSpacing) {
    return { allowed: true, label: "Moins de 48h avec une autre séance", reason: "plan:p8_move_spacing_warning" };
  }

  return { allowed: true, label: "", reason: "plan:p8_move_normal" };
}
