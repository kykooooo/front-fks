// hooks/routine/dayLabels.ts
//
// Couche copy FR pour Routine v2 (design §5.2 : "chaque pastille = un état
// exclusif + tap → explication, la trace plan:* de la règle qui a produit
// l'état"). `domain/weekPlanning.ts` reste zéro-I18N par construction (module
// pur, zéro UI) — toute la traduction des traces `plan:*` en phrases FR vit
// ici, jamais dans le domain.
import type { DowKey } from "../../domain/weekPlanning";
import type { WeekDay } from "./useWeekPlan";
import { theme } from "../../constants/theme";

export const DOW_LABEL_SHORT: Record<DowKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mer",
  thu: "Jeu",
  fri: "Ven",
  sat: "Sam",
  sun: "Dim",
};

export const DOW_LABEL_FULL: Record<DowKey, string> = {
  mon: "lundi",
  tue: "mardi",
  wed: "mercredi",
  thu: "jeudi",
  fri: "vendredi",
  sat: "samedi",
  sun: "dimanche",
};

// Jour interdit (P1/P2) — raison honnête, jamais "raté/échec" (principe 2.2.4).
const REST_REASON_LABEL: Partial<Record<string, string>> = {
  "plan:p1_match_day": "Jour de match — aucune séance, c'est la priorité de ta semaine.",
  "plan:p1_club_day": "Entraînement club — FKS s'efface aujourd'hui.",
  "plan:p7_congestion_between_matches": "Entre deux matchs rapprochés — pas de charge ajoutée.",
  "plan:p1_j_minus_1": "Match demain : une séance ici ne serait que 20 min d'activation, ça consommerait une séance de ton cycle pour rien.",
  "plan:p2_j_plus_1": "Lendemain de match — ton corps récupère, pas de séance complète.",
  "plan:p2_j_plus_2_youth_forbidden": "Encore trop proche du dernier match pour ton âge.",
  "plan:p2_j_minus_2_youth_excluded": "Un jour plus calme existe cette semaine — on le garde pour lui.",
  "plan:p5_force_match_distance": "Cycle Force : trop proche du prochain match pour une séance lourde, on garde ce jour au repos.",
};

const FULL_REASON_LABEL: Partial<Record<string, string>> = {
  "plan:p6_normal_eligible": "Jour calme, loin du match — le meilleur moment pour ta séance.",
  "plan:p2_j_minus_2_admis": "Encore quelques jours avant le match — séance possible.",
};

const MODERATE_REASON_LABEL = "À 2 jours du match — la séance sera volontairement modérée.";

export type DayVisualState =
  | "match"
  | "club"
  | "full"
  | "moderate"
  | "rest_forbidden"
  | "rest_available"
  | "moved_away"
  | "done";

export type DayExplanation = {
  title: string;
  detail: string;
  state: DayVisualState;
};

/** Couleur d'accent partagée par tout affichage du plan (Routine v2, carte "Ta semaine"). */
export const DAY_STATE_COLOR: Record<DayVisualState, string> = {
  match: theme.colors.danger,
  club: theme.colors.warn,
  full: theme.colors.success,
  moderate: theme.colors.success,
  rest_forbidden: theme.colors.borderSoft,
  rest_available: theme.colors.borderSoft,
  moved_away: theme.colors.borderSoft,
  done: theme.colors.success,
};

/**
 * Explication FR d'un jour affiché — utilisée au tap (design §5.2).
 *
 * Revue web post-É1.5 (point 2) : un jour PASSÉ ne doit plus jamais se
 * décrire comme une séance "à faire" (full/moderate) — soit elle a été
 * complétée (croisée avec l'historique sessions, `day.isDone`) et se lit
 * "Fait", soit elle est neutre/estompée, jamais un jugement ("raté").
 */
export function explainDay(day: WeekDay): DayExplanation {
  if (day.isDone) {
    return { title: "Fait", detail: "Séance FKS complétée ce jour-là.", state: "done" };
  }
  if (day.status === "match") {
    return { title: "Match", detail: REST_REASON_LABEL["plan:p1_match_day"]!, state: "match" };
  }
  if (day.status === "club") {
    return { title: "Club", detail: REST_REASON_LABEL["plan:p1_club_day"]!, state: "club" };
  }
  if (day.movedTo) {
    return {
      title: "Repos",
      detail: `Séance déplacée vers ${DOW_LABEL_FULL[day.movedTo]}.`,
      state: "moved_away",
    };
  }

  const movedNote = day.movedFrom ? ` (déplacée depuis ${DOW_LABEL_FULL[day.movedFrom]})` : "";

  if (day.isPast && day.placement !== null) {
    return { title: "Repos", detail: "Ce jour est passé.", state: "rest_available" };
  }

  if (day.placement === "full") {
    const reasonKey = day.reasons.find((r) => FULL_REASON_LABEL[r]);
    const base = (reasonKey && FULL_REASON_LABEL[reasonKey]) || "Séance complète prévue ce jour.";
    return { title: "Séance", detail: `${base}${movedNote}`, state: "full" };
  }
  if (day.placement === "moderate") {
    return { title: "Séance modérée", detail: `${MODERATE_REASON_LABEL}${movedNote}`, state: "moderate" };
  }
  if (!day.eligible) {
    const reasonKey = [...day.reasons].reverse().find((r) => REST_REASON_LABEL[r]);
    const detail = (reasonKey && REST_REASON_LABEL[reasonKey]) || "Repos — ce jour ne convient pas cette semaine.";
    return { title: "Repos", detail, state: "rest_forbidden" };
  }
  return { title: "Repos", detail: "Jour libre — pas besoin de plus cette semaine.", state: "rest_available" };
}

const SHORT_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** "14 juil." — libellé compact pour une pastille jour. */
export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

/**
 * Phrase de synthèse en tête d'écran / carte "Ta semaine" (design §5.1).
 *
 * `scope` (revue web post-É1.5, point 1) : "current" décrit le reste
 * ACTIONNABLE de la semaine en cours (jamais les jours déjà passés — voir
 * `useWeekPlan().remainingPlan`) ; "next" décrit un aperçu de la semaine
 * suivante (`useWeekPlan().rawPlan`, appelé quand `isWeekOver` est vrai).
 * Home et l'écran combiné appellent cette MÊME fonction avec les MÊMES
 * données du hook partagé — plus de texte contradictoire entre les deux.
 */
export function buildWeekSummary(
  plan: {
    target: number;
    placedCount: number;
    placedDows: DowKey[];
    warnings: string[];
  },
  scope: "current" | "next" = "current"
): string {
  if (plan.warnings.includes("plan:no_active_cycle")) {
    return "Choisis ton cycle pour activer le planning.";
  }
  if (plan.target === 0) {
    return scope === "next"
      ? "Semaine prochaine chargée avec le club — ta prépa FKS revient sur une semaine plus calme."
      : "Semaine chargée avec le club — ta prépa FKS revient sur une semaine plus calme.";
  }
  if (plan.placedCount === 0) {
    return scope === "next"
      ? "Pas de créneau qui convient la semaine prochaine non plus."
      : "Pas de créneau qui convient cette semaine — on se retrouve la semaine prochaine.";
  }
  const days = plan.placedDows.map((d) => DOW_LABEL_FULL[d]);
  const joined =
    days.length === 1 ? days[0] : `${days.slice(0, -1).join(", ")} et ${days[days.length - 1]}`;
  const suffix = plan.warnings.includes("plan:target_not_fully_reached")
    ? " (la semaine ne permet pas plus)"
    : "";
  if (scope === "next") {
    const countLabel = `${plan.placedCount} séance${plan.placedCount > 1 ? "s" : ""}`;
    const verb = plan.placedCount > 1 ? "prévues" : "prévue";
    return `Semaine prochaine : ${countLabel} ${verb} ${joined}${suffix}.`;
  }
  const countLabel = `${plan.placedCount} séance${plan.placedCount > 1 ? "s" : ""}`;
  return `${countLabel} cette semaine : ${joined}${suffix}.`;
}
