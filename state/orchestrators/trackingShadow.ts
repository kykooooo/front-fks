// state/orchestrators/trackingShadow.ts
// Helpers PURS pour la decision shadow attachee au feedback (Lot 4/5) : cast
// defensif de l'execution stockee sur `Session.execution` (unknown, cf.
// domain/types.ts), construction de l'historique `TrackingHistoryEntry[]`
// depuis les sessions completees + les dayStates (injure declaree), calcul de
// la decision. Aucun acces Firestore/store ici -- testable sans mock reseau.
// Voir docs/boucle-suivi-2026-07-25/{ARCHITECTURE_BOUCLE,MODELE_DONNEES,REGLES_AJUSTEMENT}.md
import { toDateKey } from "../../utils/dateHelpers";
import { readSessionRpeTarget } from "../../services/aiContextHelpers";
import { TRACKING_CONFIG } from "../../domain/tracking/config";
import { computeTrackingSignals, type TrackingHistoryEntry } from "../../domain/tracking/signals";
import { decideAdjustment } from "../../domain/tracking/rulesEngine";
import { decorateDecision } from "../../domain/tracking/explain";
import type { SessionExecution, TrackingDecision, TrackingSignals } from "../../domain/tracking/types";
import type { DayState, Session } from "../../domain/types";

/**
 * Cast defensif de `Session.execution` (type `unknown`, cf. domain/types.ts)
 * vers `SessionExecution`. Jamais de crash sur donnees partielles/malformees :
 * un champ absent ou a la forme incoherente retourne simplement `null`.
 */
export function castSessionExecution(raw: unknown): SessionExecution | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<SessionExecution>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.sessionId !== "string") return null;
  if (!Array.isArray(candidate.items)) return null;
  if (!candidate.completion || typeof candidate.completion.pct !== "number") return null;
  return candidate as SessionExecution;
}

/**
 * Duree PLANIFIEE d'une seance completee. `session.durationMin` porte la duree
 * EFFECTIVE une fois le feedback applique (applyFeedback ecrase ce champ avec
 * la duree reelle -- cf. state/orchestrators/applyFeedback.ts) : le blueprint
 * IA (`aiV2.duration_min`) reste donc la seule source stable de la duree
 * PREVUE pour une seance deja completee. Fallback sur `session.durationMin`
 * uniquement si aucun blueprint n'est disponible (anciennes seances / donnees
 * partielles) -- dans ce cas le ratio duree reelle/prevue peut etre biaise,
 * signal non bloquant (durationRatioAvg n'est lu par aucune regle du moteur
 * a date, cf. REGLES_AJUSTEMENT.md).
 */
export function readPlannedDurationMin(s: Session): number | null {
  const aiV2 = (s.aiV2 ?? null) as Record<string, unknown> | null;
  const fromDurationMinSnake =
    typeof aiV2?.duration_min === "number" && Number.isFinite(aiV2.duration_min) ? aiV2.duration_min : null;
  const fromDurationMinCamel =
    typeof aiV2?.durationMin === "number" && Number.isFinite(aiV2.durationMin) ? aiV2.durationMin : null;
  const fromAi = fromDurationMinSnake ?? fromDurationMinCamel;
  if (fromAi !== null) return fromAi;
  return typeof s.durationMin === "number" && Number.isFinite(s.durationMin) ? s.durationMin : null;
}

/**
 * "Injure declaree" pour la journee d'une seance : feedback.pain >= seuil OU
 * blessure structuree declaree ce jour-la (severite > 0 -- 0 = levee explicite
 * de la contrainte, cf. services/aiContextHelpers.ts collectActivePainConstraints).
 *
 * Limite connue et assumee : pour la seance TOUT JUSTE completee dans le meme
 * appel applyFeedback, l'injury structuree (saisie via useFeedbackStore.setInjury)
 * n'est pas encore ecrite dans dayStates a ce stade (useFeedbackSave.ts l'ecrit
 * APRES avoir appele applyFeedback) -- seul le pain feedback direct est visible
 * immediatement. Une injury declaree SANS score de douleur eleve sur cette
 * seance precise ne sera donc visible qu'a la decision suivante. Acceptable :
 * decision shadow uniquement (n'influence rien), jamais de donnee fabriquee.
 */
function isInjuryDeclaredForSession(s: Session, dayStates: Record<string, DayState>): boolean {
  const painFromFeedback = typeof s.feedback?.pain === "number" ? s.feedback.pain : null;
  if (painFromFeedback !== null && painFromFeedback >= TRACKING_CONFIG.pain.feedbackThreshold) return true;

  const dateISO = typeof s.dateISO === "string" ? s.dateISO : typeof s.date === "string" ? s.date : null;
  if (!dateISO) return false;
  const dayInjury = dayStates[toDateKey(dateISO)]?.feedback?.injury ?? null;
  return Boolean(dayInjury && typeof dayInjury.severity === "number" && dayInjury.severity > 0);
}

/** Session -> TrackingHistoryEntry (contrat domain/tracking/signals.ts). */
export function sessionToTrackingHistoryEntry(
  s: Session,
  dayStates: Record<string, DayState>
): TrackingHistoryEntry {
  const dateISO = typeof s.dateISO === "string" ? s.dateISO : typeof s.date === "string" ? s.date : "";
  const painFromFeedback = typeof s.feedback?.pain === "number" ? s.feedback.pain : null;

  return {
    dateISO,
    completedAtISO: typeof s.completedAt === "string" ? s.completedAt : null,
    feedback: s.feedback
      ? {
          rpe: typeof s.feedback.rpe === "number" ? s.feedback.rpe : null,
          pain: painFromFeedback,
          durationMin: typeof s.feedback.durationMin === "number" ? s.feedback.durationMin : null,
        }
      : null,
    rpeTarget: readSessionRpeTarget(s),
    plannedDurationMin: readPlannedDurationMin(s),
    execution: castSessionExecution(s.execution),
    injuryDeclared: isInjuryDeclaredForSession(s, dayStates),
  };
}

/**
 * Construit l'historique COMPLET des seances completees (pas seulement la
 * fenetre d'analyse -- `gapDays` en a besoin sur tout l'historique, cf.
 * domain/tracking/signals.ts findLastCompletedSessionDateMs). La fenetre
 * (config.window) est appliquee en interne par computeTrackingSignals.
 */
export function buildTrackingHistory(
  sessions: Session[],
  dayStates: Record<string, DayState>
): TrackingHistoryEntry[] {
  return sessions.filter((s) => s.completed).map((s) => sessionToTrackingHistoryEntry(s, dayStates));
}

/** Signaux + decision decoree (explication FR), en un seul appel. */
export function computeShadowDecision(
  history: TrackingHistoryEntry[],
  nowISO: string
): { decision: TrackingDecision; signals: TrackingSignals } {
  const signals = computeTrackingSignals(history, nowISO);
  const decision = decorateDecision(decideAdjustment(signals, nowISO), signals);
  return { decision, signals };
}
