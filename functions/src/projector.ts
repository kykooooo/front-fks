// functions/src/projector.ts
//
// Projecteur PUR (aucun accès Firestore, aucune horloge implicite). Reçoit les
// sources brutes + une date contrôlable, renvoie le cœur métier coach-safe
// (`CoachPlayerSummaryCore`) ou `null`. Construit chaque champ EXPLICITEMENT :
// aucun spread de source, aucune clé inconnue recopiée.

import {
  boundBlockCount,
  boundDurationMin,
  collectAdaptationTokens,
  focusTitle,
  normalizeAgeCategory,
  normalizeLevel,
  normalizePosition,
  pickCoachSessionToDisplay,
  readableFocus,
  readableIntensity,
  sanitizeFirstName,
  toCoachAdaptationLabels,
  toDateKey,
  type DisplayableSession,
} from "./coachLabels";
import type { CoachLatestSession, CoachPlayerSummaryCore, SessionStatus } from "./dto";

export type RawDoc = Record<string, unknown>;
/** Doc brut + son id Firestore (posé sous `__id`). */
export type RawSessionDoc = RawDoc & { __id?: string };

export interface ProjectorInput {
  playerUid: string;
  clubId: string;
  /** clubs/{clubId}/members/{playerUid} — null si absent. */
  membership: RawDoc | null;
  /** users/{playerUid} — null si absent. */
  profile: RawDoc | null;
  /** Séances FAITES récentes (users/{uid}/sessions). */
  sessions: RawSessionDoc[];
  /** Séances PLANIFIÉES récentes (users/{uid}/plannedSessions). */
  plannedSessions: RawSessionDoc[];
  /** Horloge injectable (réservée : la logique planned/completed est purement dateKey). */
  now: Date;
}

// ─── Petits accès sûrs ──────────────────────────────────────────────────────
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): RawDoc => (v && typeof v === "object" && !Array.isArray(v) ? (v as RawDoc) : {});
const idOf = (d: RawSessionDoc): string | null => str(d.id) ?? str(d.__id);
const dateOf = (d: RawDoc): string => str(d.dateISO) ?? str(d.date) ?? "";
const dateKeyOf = (d: RawDoc): string | null => {
  const raw = dateOf(d);
  return raw ? toDateKey(raw) || null : null;
};

/** Dernier doc par date décroissante (tri stable, tolère l'absence de date). */
function pickLatest(docs: RawSessionDoc[]): RawSessionDoc | null {
  if (!docs.length) return null;
  return [...docs].sort((a, b) => {
    const da = dateOf(a);
    const dbb = dateOf(b);
    return da < dbb ? 1 : da > dbb ? -1 : 0;
  })[0];
}

/** Candidat interne : DTO d'affichage + tokens d'adaptation associés. */
type SessionCandidate = DisplayableSession & CoachLatestSession & { __tokens: string[] };

function projectPlanned(doc: RawSessionDoc): SessionCandidate {
  const ai = obj(doc.ai);
  // Focus = SEULE source du titre/label (allowlist). Jamais doc.title/ai.title.
  const focusSrc = str(doc.focus) ?? str(ai.focusPrimary) ?? str(ai.focus_primary);
  const blocks = Array.isArray(ai.blocks) ? ai.blocks.length : null;
  return {
    id: idOf(doc),
    dateKey: dateKeyOf(doc),
    title: focusTitle(focusSrc),
    focusLabel: readableFocus(focusSrc),
    intensityLabel: readableIntensity(str(doc.intensity) ?? str(ai.intensity)),
    durationMin: boundDurationMin(num(ai.durationMin) ?? num(ai.duration_min) ?? num(doc.durationMin)),
    blockCount: boundBlockCount(blocks),
    status: "planned" as SessionStatus,
    __tokens: collectAdaptationTokens(
      ai.guardrailsApplied,
      ai.guardrails_applied,
      doc.clientGuardrailsApplied,
      doc.guardrailsApplied,
    ),
  };
}

function projectCompleted(doc: RawSessionDoc): SessionCandidate {
  const v2 = obj(doc.aiV2);
  const fb = obj(doc.feedback);
  const focusSrc = str(doc.focus) ?? str(v2.focusPrimary) ?? str(v2.focus_primary);
  const blocks = Array.isArray(v2.blocks) ? v2.blocks.length : null;
  return {
    id: idOf(doc),
    dateKey: dateKeyOf(doc),
    title: focusTitle(focusSrc),
    focusLabel: readableFocus(focusSrc),
    intensityLabel: readableIntensity(str(doc.intensity) ?? str(v2.intensity)),
    durationMin: boundDurationMin(num(fb.durationMin) ?? num(v2.durationMin) ?? num(v2.duration_min)),
    blockCount: boundBlockCount(blocks),
    status: "done" as SessionStatus,
    // RPE volontairement ABSENT. Tokens = guardrails backend uniquement.
    __tokens: collectAdaptationTokens(v2.guardrailsApplied, v2.guardrails_applied),
  };
}

/** Retire les champs internes (dont `id`, non exposé) → CoachLatestSession propre. */
function toLatestSession(c: SessionCandidate): CoachLatestSession {
  return {
    dateKey: c.dateKey,
    title: c.title,
    focusLabel: c.focusLabel,
    intensityLabel: c.intensityLabel,
    durationMin: c.durationMin,
    blockCount: c.blockCount,
    status: c.status,
  };
}

/**
 * Projette un joueur en `CoachPlayerSummaryCore`, ou `null` si le membre ne doit
 * pas apparaître (non-player, club incohérent, membership absent).
 */
export function projectPlayerSummary(input: ProjectorInput): CoachPlayerSummaryCore | null {
  const { playerUid, clubId, membership, profile, sessions, plannedSessions } = input;

  // 1) Membership requis + role player strict.
  if (!membership || membership.role !== "player") return null;

  // 2) Cohérence membership/profil (P0.3) : le profil DOIT exister, pointer vers
  //    CE club, et ne pas être coach. Sinon aucune projection (l'appelant supprime).
  if (!profile) return null;
  if (str(profile.clubId) !== clubId) return null;
  if (profile.role === "coach") return null;

  // 3) Identité sportive — allowlists serveur strictes (jamais de texte client brut).
  const firstName = sanitizeFirstName(profile.firstName);
  const ageCategory = normalizeAgeCategory(profile.ageCategory);
  const position = normalizePosition(profile.position);
  const level = normalizeLevel(profile.level);
  const profileComplete = !!(profile.profileCompleted === true && firstName);

  // 4) Sélection séance à afficher (mêmes règles que le front).
  const latestPlannedDoc = pickLatest(plannedSessions);
  const latestCompletedDoc = pickLatest(sessions);
  const plannedCand = latestPlannedDoc ? projectPlanned(latestPlannedDoc) : null;
  const completedCand = latestCompletedDoc ? projectCompleted(latestCompletedDoc) : null;

  const chosen = pickCoachSessionToDisplay<SessionCandidate>(plannedCand, completedCand);

  const latestSession = chosen ? toLatestSession(chosen) : null;
  const adaptationLabels = chosen ? toCoachAdaptationLabels(chosen.__tokens) : [];

  // 5) Dernière activité = dernière séance RÉELLEMENT faite (jamais de RPE).
  const lastActivity = completedCand
    ? { dateKey: completedCand.dateKey, durationMin: completedCand.durationMin }
    : null;

  return {
    playerUid,
    firstName,
    ageCategory,
    position,
    level,
    profileComplete,
    latestSession,
    lastActivity,
    adaptation: { adapted: adaptationLabels.length > 0, labels: adaptationLabels },
  };
}
