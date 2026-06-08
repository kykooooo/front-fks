// domain/coachLabels.ts
// Traduction des guardrails techniques (tokens backend + chaînes héritées du front)
// en langage COACH lisible. Pur (seule dépendance : helper de date pur).
//
// Règles de sécurité :
//  - JAMAIS exposer de détail médical (zone, sévérité) → "Adaptation sécurité appliquée".
//  - JAMAIS exposer TSB/ATL/CTL brut, selection_debug, volume/phase, seeds → masqué (null).
//  - Tout le reste est traduit en phrase coach ; l'inconnu est masqué par défaut.

import { toDateKey } from "../utils/dateHelpers";

/**
 * Convertit un guardrail unique en label coach.
 * Retourne null si le token doit rester invisible pour le coach.
 */
export function guardrailToCoachLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const low = t.toLowerCase();

  // 1) Sécurité blessure / douleur — jamais de détail médical brut.
  if (low.startsWith("injury:") || low.includes("pain") || low.includes("douleur") || low.includes("blessure")) {
    return "Adaptation sécurité appliquée";
  }

  // 2) Contexte club renseigné par le coach.
  //    - heavy/very_heavy + freshness : ADAPTATIONS réelles (le backend agit).
  //    - prevention/speed/strength/comeback : TRACE seule en v1 (pas d'adaptation
  //      sportive fine). On dit "renseigné" pour ne JAMAIS survendre.
  if (low === "club:heavy_week_adjustment") return "Semaine club intense : charge FKS réduite";
  if (low === "club:very_heavy_week_adjustment") return "Semaine club très intense : séance fortement allégée";
  if (low === "club:goal_freshness") return "Objectif coach : fraîcheur (séance allégée si besoin)";
  if (low === "club:goal_prevention") return "Objectif coach renseigné : appuis & freinage";
  if (low === "club:goal_speed") return "Objectif coach renseigné : vitesse";
  if (low === "club:goal_strength") return "Objectif coach renseigné : force";
  if (low === "club:goal_comeback") return "Objectif coach renseigné : reprise";

  // 2bis) Ajustements client stables (planification front) — tokens `client:*`.
  if (low === "client:club_proximity_reduction") return "Entraînement club proche : charge réduite";
  if (low === "client:load_high_forced_easy") return "Joueur chargé : séance allégée";
  if (low === "client:load_negative_intensity_reduced") return "Joueur chargé : intensité réduite";

  // 2ter) Focus équipe (neuromusculaire) — libellé NEUTRE, jamais "féminin"/médical.
  if (low === "team:female_neuromuscular_focus") return "Contrôle appuis et alignement";

  // 3) Catégorie d'âge.
  if (low.startsWith("age:")) {
    const catMatch = t.match(/age:(U13|U15|U17|U18)/i);
    const cat = catMatch ? catMatch[1].toUpperCase() : null;
    if (low.includes("youth_safety_recovery")) return "Récupération adaptée (sécurité jeune)";
    if (low.includes("youth_movement_substitute")) return "Séance jeune adaptée (école de mouvement)";
    if (low.includes("youth_speed_substitute")) return "Séance jeune adaptée (coordination / vitesse contrôlée)";
    if (low.includes("youth_bodyweight_substitute")) return "Séance jeune adaptée (renfo poids de corps)";
    if (low.includes("youth_deceleration_substitute")) return "Focus freinage / réception contrôlée";
    if (low.includes("youth_prevention_speed_substitute")) return "Séance jeune adaptée (prévention / appuis)";
    if (low.includes("youth_prevention_substitute")) return "Séance jeune adaptée (prévention / appuis)";
    if (low.includes("forbidden_family_filtered")) return "Exercices à risque retirés (catégorie d'âge)";
    if (low.includes("duration_cap")) return cat ? `Catégorie ${cat} : durée plafonnée` : "Catégorie d'âge : durée plafonnée";
    if (low.includes("intensity_cap")) return cat ? `Catégorie ${cat} : intensité plafonnée` : "Catégorie d'âge : intensité plafonnée";
    // age:young_safe_substitute → couvert par les libellés précis ci-dessus.
    return null;
  }

  // 4) Match proche (calendrier).
  if (low.includes("j_minus_1") || low.includes("j-1")) return "Veille de match : activation uniquement";
  if (low.includes("match_today")) return "Jour de match : séance très légère";
  if (low.includes("j_plus_1") || low.includes("j+1")) return "Lendemain de match : récupération";
  if (low.includes("j_minus_2") || low.includes("j-2")) return "Avant-match : charge réduite";
  if (low.includes("j_plus_2") || low.includes("j+2")) return "Après-match : charge contrôlée";

  // 5) Fatigue / allègement (paliers + downgrades).
  if (low === "tier:easy_plus") return "Séance allégée";
  if (low === "tier:moderate_light") return "Séance modérée";
  if (low.includes("cap_easy") || low.includes("intensity_downgraded") || low.includes("intensity_forced_easy")) {
    return "Joueur chargé : séance allégée";
  }
  if (low.includes("intensity_capped")) return "Intensité réduite (prudence)";
  if (low.includes("duration_capped") || low.includes("duration_reduced")) return "Durée réduite (prudence)";
  if (low.includes("rpe") && (low.includes("reduce") || low.includes("high"))) {
    return "Séances récentes dures : charge réduite";
  }

  // Chaînes FR héritées (planned guardrailsApplied) — elles fuitent le TSB : on traduit.
  if (low.includes("tsb")) return "Joueur chargé : séance allégée";
  if (low.includes("réduction club") || low.includes("reduction club")) return "Entraînement club proche : charge réduite";

  // 6) Bruit interne (volume, phases, seeds, scale, debug, inconnu) → masqué.
  return null;
}

/**
 * Fusionne plusieurs sources de tokens d'adaptation en une liste dédupliquée.
 * Tolère camelCase (`guardrailsApplied`) et snake_case (`guardrails_applied`),
 * tokens client (`clientGuardrailsApplied`) et chaînes FR héritées (vieux docs).
 */
export function collectAdaptationTokens(...sources: unknown[]): string[] {
  const out: string[] = [];
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const x of src) {
      if (typeof x === "string" && x.trim() && !out.includes(x)) out.push(x);
    }
  }
  return out;
}

/** Traduit une liste de guardrails en labels coach (filtrés + dédupliqués). */
export function toCoachAdaptationLabels(tokens: unknown): string[] {
  if (!Array.isArray(tokens)) return [];
  const out: string[] = [];
  for (const tk of tokens) {
    const label = guardrailToCoachLabel(tk);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Intensité technique → mot coach. */
export function readableIntensity(intensity: unknown): string {
  switch (String(intensity ?? "").toLowerCase()) {
    case "easy":
      return "Légère";
    case "moderate":
      return "Modérée";
    case "hard":
      return "Intense";
    case "max":
      return "Très intense";
    default:
      return "—";
  }
}

/** Focus/cycle technique → mot coach. */
export function readableFocus(focus: unknown): string {
  switch (String(focus ?? "").toLowerCase()) {
    case "strength":
      return "Renfo / Force";
    case "run":
    case "endurance":
      return "Course / Endurance";
    case "speed":
      return "Vitesse";
    case "plyo":
      return "Pliométrie";
    case "circuit":
      return "Circuit";
    case "mobility":
      return "Mobilité";
    case "core":
      return "Gainage";
    default:
      return focus ? String(focus) : "—";
  }
}

/**
 * Libellé du groupe selon le type d'équipe (pour titres / résumés coach).
 * female → "Joueuses", male → "Joueurs", mixed/absent/inconnu → "Effectif".
 */
export function getTeamPlayerLabel(teamGender: unknown): "Joueuses" | "Joueurs" | "Effectif" {
  switch (teamGender) {
    case "female":
      return "Joueuses";
    case "male":
      return "Joueurs";
    default:
      return "Effectif";
  }
}

// ─── Libellé de la semaine active (cadre coach) ─────────────────────────────
// Prend une weekKey (date du LUNDI "YYYY-MM-DD", cf. weekKeyOf) et renvoie
// "Semaine du 8 au 14 juin 2026" (ou "du 29 juin au 5 juillet 2026" à cheval).
const COACH_MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function formatCoachWeekLabel(weekKey: unknown): string {
  if (typeof weekKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return "Semaine en cours";
  const start = new Date(`${weekKey}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "Semaine en cours";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const d1 = start.getDate();
  const m1 = start.getMonth();
  const d2 = end.getDate();
  const m2 = end.getMonth();
  const y2 = end.getFullYear();
  if (m1 === m2) return `Semaine du ${d1} au ${d2} ${COACH_MONTHS_FR[m2]} ${y2}`;
  return `Semaine du ${d1} ${COACH_MONTHS_FR[m1]} au ${d2} ${COACH_MONTHS_FR[m2]} ${y2}`;
}

/** Statut séance → mot coach. */
export function readableSessionStatus(status: unknown): string {
  switch (status) {
    case "planned":
      return "Prête";
    case "done":
      return "Faite";
    default:
      return "Inconnue";
  }
}

// ─── Choix planned vs completed à afficher au coach ─────────────────────────
// Les plannedSessions ne sont pas supprimées quand une séance est faite : une
// vieille planifiée pourrait masquer une séance terminée plus récente. On choisit
// avec une vraie logique temporelle (granularité jour via dateKey "YYYY-MM-DD").
export type DisplayableSession = {
  id?: string | null;
  dateKey?: string | null; // "YYYY-MM-DD"
};

// ─── Statut compact d'un joueur pour le dashboard coach ─────────────────────
// 3 voyants max, scannables. Aucune donnée médicale / RPE / TSB.
export type CoachRowStatus = {
  sessionStatusLabel: "Prête" | "Faite" | "À relancer" | "Aucune donnée";
  activityLabel: string; // "Aujourd'hui" | "Hier" | "Il y a X jours" | "Jamais" | "—"
  adaptationLabel: "" | "Adaptée" | "Standard" | "Détails indispo";
  tone: "default" | "ok" | "warn" | "danger";
};

export type RowOverviewLike = {
  session?: { status?: string | null; dateKey?: string | null; adaptationTokens?: string[] } | null;
  lastActivity?: { dateISO?: string | null } | null;
  detailsUnavailable?: boolean;
};

const RELANCE_DAYS = 7;
const keyToUTC = (key: string): number => Date.parse(`${key}T00:00:00.000Z`);

export function buildCoachPlayerRowStatus(
  overview: RowOverviewLike | null | undefined,
  todayKey: string,
): CoachRowStatus {
  if (!overview || overview.detailsUnavailable) {
    return { sessionStatusLabel: "Aucune donnée", activityLabel: "—", adaptationLabel: "Détails indispo", tone: "default" };
  }

  const session = overview.session ?? null;
  const lastActivity = overview.lastActivity ?? null;

  // Date de la dernière séance FAITE (lastActivity, sinon la séance affichée si "done").
  let completedKey: string | null = null;
  if (lastActivity?.dateISO) completedKey = toDateKey(lastActivity.dateISO) || null;
  else if (session?.status === "done" && session.dateKey) completedKey = session.dateKey;

  // Date d'une séance PLANIFIÉE (si la séance affichée est une planifiée).
  const plannedKey = session?.status === "planned" ? session.dateKey ?? null : null;

  let daysSince = Infinity;
  if (completedKey) {
    const diff = Math.round((keyToUTC(todayKey) - keyToUTC(completedKey)) / 86400000);
    if (Number.isFinite(diff)) daysSince = diff;
  }
  const hasFuturePlanned = !!(plannedKey && keyToUTC(plannedKey) >= keyToUTC(todayKey));

  // ── Statut séance ──
  let sessionStatusLabel: CoachRowStatus["sessionStatusLabel"];
  let tone: CoachRowStatus["tone"];
  if (!session && !completedKey) {
    sessionStatusLabel = "Aucune donnée";
    tone = "default";
  } else if (hasFuturePlanned) {
    sessionStatusLabel = "Prête";
    tone = "default";
  } else if (completedKey && daysSince <= RELANCE_DAYS) {
    sessionStatusLabel = "Faite";
    tone = "ok";
  } else {
    sessionStatusLabel = "À relancer"; // pas de planifiée future + rien fait depuis >7j
    tone = "warn";
  }

  // ── Dernière activité ──
  let activityLabel: string;
  if (!completedKey) activityLabel = "Jamais";
  else if (daysSince <= 0) activityLabel = "Aujourd'hui";
  else if (daysSince === 1) activityLabel = "Hier";
  else activityLabel = `Il y a ${daysSince} jours`;

  // ── Adaptation ──
  const adaptationLabel: CoachRowStatus["adaptationLabel"] = !session
    ? ""
    : toCoachAdaptationLabels(session.adaptationTokens).length > 0
      ? "Adaptée"
      : "Standard";

  return { sessionStatusLabel, activityLabel, adaptationLabel, tone };
}

// ─── Tri par priorité pour le dashboard coach ───────────────────────────────
// Haute : À relancer > Aucune donnée > Détails indispo.
// Moyenne : Prête > Adaptée.  Basse : Faite/Standard.
// Overview non chargé → rang bas (jamais de faux "Aucune donnée").
// Égalité → prénom (fr), puis uid stable.
function dashboardRank(status: CoachRowStatus | null): number {
  if (!status) return 5; // pas encore chargé → pas de faux statut
  if (status.adaptationLabel === "Détails indispo") return 2;
  if (status.sessionStatusLabel === "À relancer") return 0;
  if (status.sessionStatusLabel === "Aucune donnée") return 1;
  if (status.sessionStatusLabel === "Prête") return 3;
  if (status.adaptationLabel === "Adaptée") return 4;
  return 5; // Faite + Standard
}

export type CoachDashboardRow<P> = { player: P; status: CoachRowStatus | null };

export function sortCoachPlayersForDashboard<P extends { uid: string; firstName?: string | null }>(
  players: P[],
  overviews: Record<string, RowOverviewLike | undefined>,
  todayKey: string,
): CoachDashboardRow<P>[] {
  const rows: CoachDashboardRow<P>[] = players.map((player) => {
    const ov = overviews[player.uid];
    return { player, status: ov ? buildCoachPlayerRowStatus(ov, todayKey) : null };
  });

  return rows.sort((a, b) => {
    const ra = dashboardRank(a.status);
    const rb = dashboardRank(b.status);
    if (ra !== rb) return ra - rb;
    const nameCmp = (a.player.firstName ?? "").localeCompare(b.player.firstName ?? "", "fr");
    if (nameCmp !== 0) return nameCmp;
    return a.player.uid < b.player.uid ? -1 : a.player.uid > b.player.uid ? 1 : 0;
  });
}

/**
 * Première phrase d'adaptation lisible d'un joueur (pour la ligne du dashboard).
 * Null si la séance est standard ou non traduisible. Mêmes garde-fous que
 * toCoachAdaptationLabels (jamais de détail médical / TSB).
 */
export function topCoachAdaptationLabel(tokens: unknown): string | null {
  const labels = toCoachAdaptationLabels(tokens);
  return labels.length > 0 ? labels[0] : null;
}

// ─── Résumé du groupe pour le coach (compteurs scannables) ──────────────────
// "Voir la situation du groupe en 30 secondes." Pas de graph : 3-4 compteurs.
// Les joueurs dont l'overview n'est pas encore chargé (status null) ne sont
// jamais comptés → pas de faux "À relancer" pendant le fetch.
export type CoachGroupSummary = {
  loaded: number; // joueurs avec un statut réellement chargé
  planned: number; // séance prévue
  done: number; // séance faite
  toRelance: number; // à relancer
  adapted: number; // séances adaptées par FKS
  noData: number; // chargé mais aucune donnée séance (angle mort)
};

export function summarizeCoachGroup<P>(rows: CoachDashboardRow<P>[]): CoachGroupSummary {
  const summary: CoachGroupSummary = { loaded: 0, planned: 0, done: 0, toRelance: 0, adapted: 0, noData: 0 };
  for (const { status } of rows) {
    if (!status) continue;
    summary.loaded += 1;
    if (status.sessionStatusLabel === "Prête") summary.planned += 1;
    else if (status.sessionStatusLabel === "Faite") summary.done += 1;
    else if (status.sessionStatusLabel === "À relancer") summary.toRelance += 1;
    else if (status.sessionStatusLabel === "Aucune donnée") summary.noData += 1;
    if (status.adaptationLabel === "Adaptée") summary.adapted += 1;
  }
  return summary;
}

// ─── Trust Layer : raisons "pourquoi cette séance" (fiche joueur) ────────────
// Réutilise toCoachAdaptationLabels (mêmes garde-fous : jamais médical / TSB /
// token brut) puis plafonne à `max` raisons pour rester scannable.
export function getCoachTrustReasons(tokens: unknown, max = 4): string[] {
  return toCoachAdaptationLabels(tokens).slice(0, Math.max(0, max));
}

// ─── Trust Layer : garde-fous FKS (zone de confiance, lecture seule) ─────────
// Phrases statiques, courtes, non médicales. La ligne "jeunes" n'apparaît que
// pour une catégorie d'âge jeune (U13/U15/U17/U18). Aucune promesse médicale.
const YOUTH_AGE_CATEGORIES = ["U13", "U15", "U17", "U18"];
const KNOWN_AGE_CATEGORIES = [...YOUTH_AGE_CATEGORIES, "SENIOR"];

export function getCoachGuardrailNotes(ageCategory?: unknown): string[] {
  const cat = typeof ageCategory === "string" ? ageCategory.trim().toUpperCase() : "";
  // Catégorie connue → on affirme l'adaptation catégorie ; sinon on reste neutre
  // (ne jamais survendre une adaptation catégorie quand l'âge est inconnu).
  const categoryNote = KNOWN_AGE_CATEGORIES.includes(cat)
    ? "Durée et intensité adaptées à la catégorie."
    : "Durée et intensité cadrées par FKS.";
  const notes = [
    "Lecture seule : le coach observe, FKS construit la séance.",
    "Pas de données médicales détaillées affichées.",
    categoryNote,
  ];
  if (YOUTH_AGE_CATEGORIES.includes(cat)) {
    notes.push("Les séances jeunes privilégient contrôle, appuis et renfo.");
  }
  return notes;
}

export function pickCoachSessionToDisplay<T extends DisplayableSession>(
  planned: T | null | undefined,
  completed: T | null | undefined,
): T | null {
  const p = planned ?? null;
  const c = completed ?? null;
  if (!p && !c) return null;
  if (!p) return c;
  if (!c) return p;

  // Même séance (même id) → elle a été faite : on montre la version "Faite".
  if (p.id && c.id && p.id === c.id) return c;

  const pd = p.dateKey ?? null;
  const cd = c.dateKey ?? null;

  if (pd && cd) {
    if (pd === cd) return c;        // même jour → on privilégie la séance faite
    return pd > cd ? p : c;          // planned plus récente/future → planned ; sinon completed
  }

  // Une date manque → fallback prudent : la séance FAITE est la vérité terrain.
  return c;
}
