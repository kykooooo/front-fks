// domain/coachSummary.ts
//
// Contrat FRONTEND STRICT de la projection coach-safe
// (clubs/{clubId}/playerSummaries/{playerUid}, produite par la Cloud Function PR-2).
//
// Le coach ne lit QUE cette projection : jamais users/{uid}, jamais sessions/
// plannedSessions, jamais ai/aiV2/feedback/metrics. Les labels (focusLabel,
// intensityLabel, adaptation.labels) arrivent DÉJÀ traduits et allowlistés côté
// serveur → on ne re-traduit rien ici. On projette EXPLICITEMENT les champs
// autorisés, on borne, on ignore tout le reste (watermarks compris).
//
// Module PUR : aucune dépendance Firestore, aucune horloge implicite.

import { normalizeAgeCategory, type AgeCategory } from "./types";

// ─── Statut séance (allowlist) ──────────────────────────────────────────────
export const COACH_SESSION_STATUSES = ["planned", "done", "unknown"] as const;
export type CoachSessionStatus = (typeof COACH_SESSION_STATUSES)[number];

// ─── Contrat frontend (sous-ensemble strict de CoachPlayerSummary serveur) ───
export type CoachLatestSession = {
  dateKey: string | null; // "YYYY-MM-DD"
  title: string | null;
  focusLabel: string | null; // déjà traduit serveur
  intensityLabel: string | null; // déjà traduit serveur
  durationMin: number | null;
  blockCount: number | null;
  status: CoachSessionStatus;
};

export type CoachLastActivity = {
  dateKey: string | null;
  durationMin: number | null;
};

export type CoachAdaptation = {
  adapted: boolean;
  /** Labels d'une allowlist serveur (jamais de token brut, jamais de médical). */
  labels: string[];
};

export type CoachPlayerSummary = {
  playerUid: string;
  firstName: string | null;
  ageCategory: AgeCategory | null;
  position: string | null;
  level: string | null;
  profileComplete: boolean;
  latestSession: CoachLatestSession | null;
  lastActivity: CoachLastActivity | null;
  adaptation: CoachAdaptation;
};

// ─── Bornes défensives (ALIGNÉES sur le serveur functions/src/coachLabels.ts) ─
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_STR = 80; // titre / focus / intensité / poste / niveau
const MAX_NAME = 40; // = FIRST_NAME_MAX serveur
const MAX_LABEL_LEN = 160;
const MAX_LABELS = 12;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const bStr = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

// boundDurationMin serveur : durée séance 1..240 min, arrondie à l'entier, sinon null.
const bDurationMin = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 240 ? Math.round(v) : null;

// boundBlockCount serveur : ENTIER strict 1..20, sinon null (aucun arrondi).
const bBlockCount = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 20 ? v : null;

// dateKey : vraie date calendaire valide (rejette 2026-02-30 / 2026-13-01), pas
// seulement une forme regex. Plus strict que le serveur = défensif (garbage → null).
const bDateKey = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const m = DATE_KEY_RE.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  return valid ? v.trim() : null;
};

const bStatus = (v: unknown): CoachSessionStatus =>
  typeof v === "string" && (COACH_SESSION_STATUSES as readonly string[]).includes(v)
    ? (v as CoachSessionStatus)
    : "unknown";

function parseLatestSession(raw: unknown): CoachLatestSession | null {
  if (!isObj(raw)) return null;
  return {
    dateKey: bDateKey(raw.dateKey),
    title: bStr(raw.title, MAX_STR),
    focusLabel: bStr(raw.focusLabel, MAX_STR),
    intensityLabel: bStr(raw.intensityLabel, MAX_STR),
    durationMin: bDurationMin(raw.durationMin),
    blockCount: bBlockCount(raw.blockCount),
    status: bStatus(raw.status),
  };
}

function parseLastActivity(raw: unknown): CoachLastActivity | null {
  if (!isObj(raw)) return null;
  const dateKey = bDateKey(raw.dateKey);
  const durationMin = bDurationMin(raw.durationMin);
  if (!dateKey && durationMin == null) return null;
  return { dateKey, durationMin };
}

function parseAdaptation(raw: unknown): CoachAdaptation {
  if (!isObj(raw)) return { adapted: false, labels: [] };
  const labels: string[] = [];
  if (Array.isArray(raw.labels)) {
    for (const item of raw.labels) {
      if (labels.length >= MAX_LABELS) break;
      const s = bStr(item, MAX_LABEL_LEN);
      if (s && !labels.includes(s)) labels.push(s);
    }
  }
  // adapted = booléen serveur ET au moins un label valide (le serveur pose
  // adapted = labels.length > 0 ; on refuse un adapted=true sans label).
  return { adapted: raw.adapted === true && labels.length > 0, labels };
}

/**
 * Parseur DÉFENSIF PUR : document brut Firestore → contrat frontend borné, ou
 * null si le document est inutilisable (pas d'objet / pas de playerUid).
 *
 *  - construction EXPLICITE (aucun spread) ;
 *  - types invalides → null / défaut sûr ;
 *  - chaînes/tableaux bornés ; status allowlisté ;
 *  - watermarks (sourceEventAt/Time/Id) et updatedAt IGNORÉS ;
 *  - toute clé sensible additionnelle (pain/rpe/tsb/aiV2/feedback/metrics…) est
 *    simplement non lue : rien n'est recopié qui ne soit explicitement projeté.
 */
export function parseCoachPlayerSummary(raw: unknown): CoachPlayerSummary | null {
  if (!isObj(raw)) return null;
  const playerUid = bStr(raw.playerUid, MAX_STR);
  if (!playerUid) return null;

  return {
    playerUid,
    firstName: bStr(raw.firstName, MAX_NAME),
    ageCategory: normalizeAgeCategory(raw.ageCategory),
    position: bStr(raw.position, MAX_STR),
    level: bStr(raw.level, MAX_STR),
    profileComplete: raw.profileComplete === true,
    latestSession: parseLatestSession(raw.latestSession),
    lastActivity: parseLastActivity(raw.lastActivity),
    adaptation: parseAdaptation(raw.adaptation),
  };
}

/** Statut séance (enum) → mot coach, pour la fiche joueuse. */
export function coachSessionStatusLabel(status: CoachSessionStatus): string {
  return status === "planned" ? "Prête" : status === "done" ? "Faite" : "Inconnue";
}

// ─── Fiche joueuse : réduction d'état d'affichage (PUR, testable) ────────────
// Décide de la vue à afficher après une lecture de la projection coach-safe.
// Objectif : un pull-to-refresh RATÉ (permissions/réseau → `unavailable`) ne doit
// PAS faire disparaître le dernier résumé valide déjà affiché — à condition qu'il
// corresponde ENCORE à la route (clubId/playerUid) demandée. Aucun fallback : on
// ne raisonne QUE sur des résultats de la projection.
export type CoachDetailView = {
  summary: CoachPlayerSummary | null;
  unavailable: boolean;
};

export const EMPTY_COACH_DETAIL_VIEW: CoachDetailView = { summary: null, unavailable: false };

/**
 * @param prev  vue actuellement affichée (dernier résultat commit).
 * @param incoming résultat de la nouvelle lecture (summary/unavailable).
 * @param opts.isRefresh  true = pull-to-refresh (vs premier chargement).
 * @param opts.prevMatchesRoute  true si `prev` reflète ENCORE la route demandée
 *        (même clubId/playerUid) — calculé par l'écran, garde le helper pur.
 * @returns la vue à afficher + `keptStale` (true = on a conservé l'ancien contenu
 *          malgré un refresh indisponible → l'écran doit afficher un toast).
 */
export function nextCoachDetailView(
  prev: CoachDetailView,
  incoming: CoachDetailView,
  opts: { isRefresh: boolean; prevMatchesRoute: boolean },
): { view: CoachDetailView; keptStale: boolean } {
  // Refresh indisponible + un summary valide encore aligné sur la route →
  // on GARDE l'ancien contenu (pas de perte), signalé pour un toast non bloquant.
  if (opts.isRefresh && incoming.unavailable && prev.summary !== null && opts.prevMatchesRoute) {
    return { view: prev, keptStale: true };
  }
  // Premier chargement, succès, doc absent, ou refresh raté sans contenu
  // conservable → on applique le résultat entrant tel quel (y compris indisponible).
  return { view: { summary: incoming.summary, unavailable: incoming.unavailable }, keptStale: false };
}

// ─── Garde anti réponse tardive / concurrente (PUR, testable) ────────────────
// Décide si la réponse d'un fetch de fiche joueuse est encore acceptable. Un
// `requestId` monotone est capturé au lancement de CHAQUE fetch : la réponse
// n'est appliquée que si elle est ENCORE la dernière émise (distingue deux
// requêtes concurrentes sur la MÊME route), si le composant est monté, et si la
// route (clubId/playerUid) demandée n'a pas changé. Une réponse rejetée ne doit
// modifier AUCUN état (loading / refreshing / view / toast).
export function shouldApplyCoachDetailResponse(args: {
  mounted: boolean;
  requestId: number;
  latestRequestId: number;
  requestKey: string;
  currentKey: string | null;
}): boolean {
  return (
    args.mounted &&
    args.requestId === args.latestRequestId &&
    args.currentKey !== null &&
    args.currentKey === args.requestKey
  );
}

// ─── Statut compact d'un joueur pour le dashboard coach ─────────────────────
// 3 voyants scannables. Aucune donnée médicale / RPE / TSB. L'adaptation vient
// du booléen serveur `adaptation.adapted` (labels déjà traduits).
export type CoachRowStatus = {
  sessionStatusLabel: "Prête" | "Faite" | "À relancer" | "Sans séance";
  activityLabel: string; // "Aujourd'hui" | "Hier" | "Il y a X jours" | "Jamais"
  adaptationLabel: "" | "Adaptée" | "Standard";
  tone: "default" | "ok" | "warn";
};

const RELANCE_DAYS = 7;
const keyToUTC = (key: string): number => Date.parse(`${key}T00:00:00.000Z`);

export function buildCoachRowStatus(summary: CoachPlayerSummary, todayKey: string): CoachRowStatus {
  const session = summary.latestSession;
  const lastActivity = summary.lastActivity;

  // Date de la dernière séance FAITE (lastActivity, sinon la séance affichée si "done").
  let completedKey: string | null = null;
  if (lastActivity?.dateKey) completedKey = lastActivity.dateKey;
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
    sessionStatusLabel = "Sans séance";
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

  // ── Adaptation (booléen serveur, jamais recalculé depuis des tokens) ──
  const adaptationLabel: CoachRowStatus["adaptationLabel"] = !session
    ? ""
    : summary.adaptation.adapted
      ? "Adaptée"
      : "Standard";

  return { sessionStatusLabel, activityLabel, adaptationLabel, tone };
}

// ─── Tri par priorité pour le dashboard coach ───────────────────────────────
// Haute : À relancer > Sans séance.  Moyenne : Prête > Adaptée.  Basse : Faite.
// Égalité → prénom (fr), puis playerUid stable.
function dashboardRank(status: CoachRowStatus): number {
  if (status.sessionStatusLabel === "À relancer") return 0;
  if (status.sessionStatusLabel === "Sans séance") return 1;
  if (status.sessionStatusLabel === "Prête") return 2;
  if (status.adaptationLabel === "Adaptée") return 3;
  return 4; // Faite + Standard
}

export type CoachDashboardRow = { summary: CoachPlayerSummary; status: CoachRowStatus };

export function sortCoachSummaries(
  summaries: CoachPlayerSummary[],
  todayKey: string,
): CoachDashboardRow[] {
  const rows: CoachDashboardRow[] = summaries.map((summary) => ({
    summary,
    status: buildCoachRowStatus(summary, todayKey),
  }));

  return rows.sort((a, b) => {
    const ra = dashboardRank(a.status);
    const rb = dashboardRank(b.status);
    if (ra !== rb) return ra - rb;
    const nameCmp = (a.summary.firstName ?? "").localeCompare(b.summary.firstName ?? "", "fr");
    if (nameCmp !== 0) return nameCmp;
    return a.summary.playerUid < b.summary.playerUid
      ? -1
      : a.summary.playerUid > b.summary.playerUid
        ? 1
        : 0;
  });
}

// ─── Résumé du groupe (compteurs scannables) ────────────────────────────────
export type CoachGroupSummary = {
  total: number;
  planned: number; // séance prête
  done: number; // séance faite
  toRelance: number; // à relancer
  adapted: number; // séances adaptées par FKS
  noSession: number; // summary présent mais sans latestSession
};

export function summarizeCoachGroup(rows: CoachDashboardRow[]): CoachGroupSummary {
  const summary: CoachGroupSummary = {
    total: 0,
    planned: 0,
    done: 0,
    toRelance: 0,
    adapted: 0,
    noSession: 0,
  };
  for (const { status } of rows) {
    summary.total += 1;
    if (status.sessionStatusLabel === "Prête") summary.planned += 1;
    else if (status.sessionStatusLabel === "Faite") summary.done += 1;
    else if (status.sessionStatusLabel === "À relancer") summary.toRelance += 1;
    else if (status.sessionStatusLabel === "Sans séance") summary.noSession += 1;
    if (status.adaptationLabel === "Adaptée") summary.adapted += 1;
  }
  return summary;
}

// ─── Décision d'affichage du roster coach (PUR, testable) ───────────────────
// Trois états mutuellement exclusifs pour l'effectif / la liste séances :
//  - "unavailable" : lecture globale refusée (permissions/réseau) → état honnête,
//    prioritaire (on ne devine RIEN, même si des compteurs traînent) ;
//  - "empty"       : aucune projection prête ET aucune en préparation → vrai vide
//    ("Aucun membre") ;
//  - "list"        : au moins une projection prête OU en préparation → on affiche
//    la liste et/ou le bandeau "en cours de synchronisation".
// RÈGLE : ne JAMAIS afficher "Aucun membre" tant que des projections sont en
// préparation (pendingCount > 0). Le compteur d'effectif = ready + pending.
export type CoachRosterDisplay = "unavailable" | "empty" | "list";

export function coachRosterDisplay(args: {
  readyCount: number; // projections prêtes (summaries.length)
  pendingCount: number; // projections en cours de synchronisation
  unavailable: boolean;
}): CoachRosterDisplay {
  if (args.unavailable) return "unavailable";
  if (args.readyCount <= 0 && args.pendingCount <= 0) return "empty";
  return "list";
}
