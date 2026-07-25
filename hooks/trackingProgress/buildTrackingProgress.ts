// hooks/trackingProgress/buildTrackingProgress.ts
// Logique PURE de la section "Ton suivi" (ProgressScreen, Lot 6). Aucune
// dépendance React / Zustand / Firebase / analytics ici -- uniquement
// domain/tracking/** (lecture seule) + utils purs, pour rester testable sans
// mock. Le hook (hooks/useTrackingProgress.ts) branche les stores et appelle
// buildTrackingProgress().
//
// AFFICHAGE UNIQUEMENT : ne touche a rien du moteur ni des stores. Voir
// docs/boucle-suivi-2026-07-25/{ARCHITECTURE_BOUCLE,MODELE_DONNEES,REGLES_AJUSTEMENT}.md.
import { computeTrackingSignals, type TrackingHistoryEntry } from "../../domain/tracking/signals";
import { detectTrainingGap, type ResumptionLevel, type ResumptionSource } from "../../domain/tracking/resumption";
import { TRACKING_CONFIG } from "../../domain/tracking/config";
import type { SessionExecution, TrackingDecision, TrackingDecisionKind } from "../../domain/tracking/types";
import type { Session, SessionFocus } from "../../domain/types";
import { getCycleTheme, type CycleTheme } from "../../constants/cycleTheme";
import { getMicrocyclePhase } from "../../utils/microcycleUtils";
import { canonicalizeMicrocycleGoal, MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../../domain/microcycles";
import { weekKeyOf } from "../../utils/dateHelpers";
import { prettifyName } from "../../screens/sessionPreview/sessionPreviewConfig";

const DAY_MS = 24 * 60 * 60 * 1000;

// ----------------------------------------------------------------------------
// Libelles FR (affichage uniquement, meme doctrine que utils/microcycleUtils.ts)
// ----------------------------------------------------------------------------

const KIND_LABELS_FR: Record<TrackingDecisionKind, string> = {
  continue_planned: "Programme maintenu",
  hold_dose: "Charge stable",
  reduce_volume_light: "Volume allégé",
  reduce_intensity_light: "Intensité surveillée",
  suggest_variant: "Variante proposée",
  prefer_replacement: "Alternative retenue",
  resume_mode: "Reprise en douceur",
  keep_despite_time: "Trajectoire conservée",
  block_increase_pain: "Prudence douleur",
  standard_insufficient_data: "Programme standard",
};

const FOCUS_LABELS_FR: Record<SessionFocus, string> = {
  endurance: "Endurance",
  threshold: "Seuil",
  speed: "Vitesse",
  strength: "Force",
  mixed: "Mixte",
};

// ----------------------------------------------------------------------------
// Types publics
// ----------------------------------------------------------------------------

export type ExerciseEvolution = {
  exerciseId: string;
  label: string;
  metric: "loadKg" | "reps";
  from: number;
  to: number;
};

export type FocusBadge = { focus: string; label: string; count: number };

export type LastDecisionView = {
  kind: TrackingDecisionKind;
  kindLabel: string;
  explanation: string;
  dateLabel: string;
};

export type TrackingProgressViewModel = {
  hasCycle: boolean;
  cycleTheme: CycleTheme;
  sessionLabel: string; // "Séance 4/12"
  phaseLabel: string; // "Montée en puissance"
  completion: { hasData: boolean; sessionsTracked: number; completionAvgPct: number | null };
  weekly: { completedThisWeek: number; target: number } | null;
  rpe: { hasSignal: boolean; deltaAvg: number | null };
  exerciseEvolutions: ExerciseEvolution[];
  focusBadges: FocusBadge[];
  lastDecisionView: LastDecisionView | null;
  nextStepLabel: string;
  resumption: { level: ResumptionLevel; source: ResumptionSource; message: string } | null;
};

export type TrackingProgressInput = {
  nowISO: string;
  executionHistory: SessionExecution[];
  sessions: Session[];
  lastDecision: TrackingDecision | null;
  microcycleGoal: string | null;
  microcycleSessionIndex: number;
  targetFksSessionsPerWeek: number | null;
  selfReportedGapDays: number | null;
};

// ----------------------------------------------------------------------------
// Helpers purs
// ----------------------------------------------------------------------------

/**
 * Construit l'historique attendu par domain/tracking/{signals,resumption}.ts
 * depuis les deux seules sources disponibles en lecture pour ce lot :
 * useExecutionStore().history (exécutions terminées, snapshot complet) et
 * useSessionsStore().sessions (feedback réel, via sessionId). Une exécution
 * sans session correspondante (course de sync) est quand même incluse : ses
 * champs feedback restent `null`, honnête plutôt qu'inventé.
 *
 * Simplification assumée (documentée au rapport de lot) : `injuryDeclared`
 * n'est pas câblé ici (nécessiterait de lire useFeedbackStore().dayStates,
 * hors périmètre lecture-seule strict de ce lot) -- le signal douleur reste
 * couvert par feedback.pain (>= seuil) et par les remplacements raison
 * "pain" déjà portés par l'exécution (cf. computePainSignal).
 */
function buildHistoryEntries(
  executionHistory: SessionExecution[],
  sessions: Session[]
): TrackingHistoryEntry[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
  return executionHistory
    .filter((exec): exec is SessionExecution => Boolean(exec?.finishedAtISO))
    .map((exec) => {
      const session = sessionById.get(exec.sessionId);
      const feedback = session?.feedback;
      return {
        dateISO: exec.finishedAtISO as string,
        completedAtISO: exec.finishedAtISO,
        feedback: feedback
          ? {
              rpe: typeof feedback.rpe === "number" ? feedback.rpe : null,
              pain: typeof feedback.pain === "number" ? feedback.pain : null,
              durationMin: typeof feedback.durationMin === "number" ? feedback.durationMin : null,
            }
          : null,
        rpeTarget: exec.snapshot.rpeTarget,
        plannedDurationMin: exec.snapshot.plannedDurationMin,
        execution: exec,
      };
    });
}

/**
 * Cast defensif de `Session.execution` (type `unknown`, cf. domain/types.ts)
 * vers `SessionExecution`, identique a state/orchestrators/trackingShadow.ts
 * (castSessionExecution) -- duplique ici (quelques lignes) plutot
 * qu'importe pour ne pas faire dependre ce module pur (AFFICHAGE UNIQUEMENT,
 * cf. en-tete de fichier) de state/orchestrators/**. Jamais de crash sur
 * donnees partielles/malformees : un champ absent ou a la forme incoherente
 * retourne simplement `null`.
 */
function castSessionExecutionForGap(raw: unknown): SessionExecution | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<SessionExecution>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.sessionId !== "string") return null;
  if (!Array.isArray(candidate.items)) return null;
  if (!candidate.completion || typeof candidate.completion.pct !== "number") return null;
  return candidate as SessionExecution;
}

/**
 * Historique pour la DETECTION DE COUPURE UNIQUEMENT (P2-e, alignement avec
 * le moteur) -- reprend la meme construction que
 * state/orchestrators/trackingShadow.ts (sessionToTrackingHistoryEntry, sans
 * injuryDeclared/dayStates : non lus par detectTrainingGap/
 * findLastCompletedSessionDateMs). Avant ce fix, "Reprise détectée" ne
 * regardait que `historyEntries` (dérivé d'executionHistory, donc UNIQUEMENT
 * les séances jouées via le tracking live) alors que le moteur de décision
 * shadow (computeShadowDecision, appelé par applyFeedback) calcule son propre
 * gap depuis TOUTES les séances complétées (`sessions`, feedback classique
 * inclus). Un joueur régulier qui n'a jamais utilisé le tracking live
 * (executionHistory vide) déclenchait donc à tort le bandeau de reprise dès
 * qu'un `selfReportedGapDays` ancien/élevé traînait -- alors que le moteur,
 * lui, ne l'aurait jamais déclenché en voyant ses séances récentes.
 * `historyEntries` (execution-based) reste ajouté en complément : course de
 * synchronisation possible où une exécution vient de se finaliser avant que
 * la session correspondante ne soit marquée complétée en local.
 */
function buildSessionsHistoryForGap(sessions: Session[]): TrackingHistoryEntry[] {
  return sessions
    .filter((s) => s.completed)
    .map((s) => ({
      dateISO: typeof s.dateISO === "string" ? s.dateISO : typeof s.date === "string" ? s.date : "",
      completedAtISO: typeof s.completedAt === "string" ? s.completedAt : null,
      execution: castSessionExecutionForGap(s.execution),
    }));
}

function countCompletedThisWeek(sessions: Session[], nowISO: string): number {
  const currentWeekKey = weekKeyOf(nowISO);
  return sessions.filter((s) => {
    if (!s.completed) return false;
    const dateVal = s.dateISO ?? s.date;
    return dateVal ? weekKeyOf(dateVal) === currentWeekKey : false;
  }).length;
}

function computeFocusBadges(sessions: Session[], nowISO: string): FocusBadge[] {
  const nowMs = new Date(nowISO).getTime();
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.completed || !s.focus) continue;
    const dateVal = s.dateISO ?? s.date;
    if (!dateVal) continue;
    const t = new Date(dateVal).getTime();
    if (!Number.isFinite(t)) continue;
    if (Number.isFinite(nowMs) && ((nowMs - t) / DAY_MS > TRACKING_CONFIG.window.days || t > nowMs)) continue;
    counts.set(s.focus, (counts.get(s.focus) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([focus, count]) => ({
      focus,
      label: FOCUS_LABELS_FR[focus as SessionFocus] ?? focus,
      count,
    }));
}

function resolvePrescribedItem(exec: SessionExecution, item: SessionExecution["items"][number]) {
  return exec.snapshot.items.find((p) => p.key === item.key) ?? null;
}

/** Exercice réellement concerné par l'item : id d'origine si remplacé (aligné signals.ts). */
function resolveExerciseId(exec: SessionExecution, item: SessionExecution["items"][number]): string | null {
  if (item.status === "replaced" && item.replacement) return item.replacement.originalExerciseId;
  return resolvePrescribedItem(exec, item)?.exerciseId ?? null;
}

type ExercisePoint = { ts: number; name: string; loadKg?: number; reps?: number };

/**
 * Évolution charge/reps par exercice, MÊME exerciseId uniquement (jamais deux
 * exos comparés entre eux). Fenêtre alignée sur TRACKING_CONFIG.window (mêmes
 * bornes que les signaux, pour rester cohérent). >= 2 points requis sur le
 * MÊME champ (loadKg ou reps) pour publier une évolution ; loadKg est
 * préféré à reps quand les deux sont disponibles (exercices chargés).
 */
function computeExerciseEvolutions(
  executionHistory: SessionExecution[],
  nowISO: string
): ExerciseEvolution[] {
  const nowMs = new Date(nowISO).getTime();
  const finished = executionHistory
    .filter((e): e is SessionExecution => Boolean(e?.finishedAtISO))
    .map((exec) => ({ exec, ts: new Date(exec.finishedAtISO as string).getTime() }))
    .filter(
      ({ ts }) =>
        Number.isFinite(ts) &&
        (!Number.isFinite(nowMs) || (nowMs - ts) / DAY_MS <= TRACKING_CONFIG.window.days)
    )
    .sort((a, b) => a.ts - b.ts) // chronologique ascendant
    .slice(-TRACKING_CONFIG.window.sessions); // au plus N séances (les plus récentes), ordre conservé

  const pointsByExercise = new Map<string, ExercisePoint[]>();
  for (const { exec, ts } of finished) {
    for (const item of exec.items) {
      if (!item.actual) continue;
      const exerciseId = resolveExerciseId(exec, item);
      if (!exerciseId) continue;
      const point: ExercisePoint = { ts, name: resolvePrescribedItem(exec, item)?.name ?? exerciseId };
      if (typeof item.actual.loadKg === "number") point.loadKg = item.actual.loadKg;
      if (typeof item.actual.reps === "number") point.reps = item.actual.reps;
      if (point.loadKg === undefined && point.reps === undefined) continue;
      const list = pointsByExercise.get(exerciseId) ?? [];
      list.push(point);
      pointsByExercise.set(exerciseId, list);
    }
  }

  const evolutions: ExerciseEvolution[] = [];
  for (const [exerciseId, points] of pointsByExercise.entries()) {
    const loadPoints = points.filter((p) => typeof p.loadKg === "number");
    const repsPoints = points.filter((p) => typeof p.reps === "number");
    const metric: "loadKg" | "reps" | null =
      loadPoints.length >= 2 ? "loadKg" : repsPoints.length >= 2 ? "reps" : null;
    if (!metric) continue;
    const chosen = metric === "loadKg" ? loadPoints : repsPoints;
    const first = chosen[0];
    const last = chosen[chosen.length - 1];
    evolutions.push({
      exerciseId,
      label: prettifyName(last.name),
      metric,
      from: metric === "loadKg" ? (first.loadKg as number) : (first.reps as number),
      to: metric === "loadKg" ? (last.loadKg as number) : (last.reps as number),
    });
  }

  // Exercices les plus récemment travaillés en premier.
  evolutions.sort((a, b) => {
    const aPoints = pointsByExercise.get(a.exerciseId) as ExercisePoint[];
    const bPoints = pointsByExercise.get(b.exerciseId) as ExercisePoint[];
    return bPoints[bPoints.length - 1].ts - aPoints[aPoints.length - 1].ts;
  });

  return evolutions.slice(0, 3);
}

function formatRelativeDaysFR(decidedAtISO: string, nowISO: string): string {
  const decidedMs = new Date(decidedAtISO).getTime();
  const nowMs = new Date(nowISO).getTime();
  if (!Number.isFinite(decidedMs) || !Number.isFinite(nowMs)) return "";
  const days = Math.round((nowMs - decidedMs) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

// ----------------------------------------------------------------------------
// Fonction pure principale
// ----------------------------------------------------------------------------

export function buildTrackingProgress(input: TrackingProgressInput): TrackingProgressViewModel {
  const {
    nowISO,
    executionHistory,
    sessions,
    lastDecision,
    microcycleGoal,
    microcycleSessionIndex,
    targetFksSessionsPerWeek,
    selfReportedGapDays,
  } = input;

  const total = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const hasCycle = canonicalizeMicrocycleGoal(microcycleGoal) != null;
  const cycleTheme = getCycleTheme(microcycleGoal);
  const currentPhase = getMicrocyclePhase(microcycleSessionIndex, total);
  const sessionLabel = `Séance ${currentPhase.sessionNumber}/${currentPhase.total}`;

  const historyEntries = buildHistoryEntries(executionHistory, sessions);
  const signals = computeTrackingSignals(historyEntries, nowISO, TRACKING_CONFIG);

  const completion = {
    hasData: signals.sessionsAnalyzed > 0,
    sessionsTracked: signals.sessionsAnalyzed,
    completionAvgPct:
      signals.completionRateAvg != null ? Math.round(signals.completionRateAvg) : null,
  };

  const weekly =
    typeof targetFksSessionsPerWeek === "number" && Number.isFinite(targetFksSessionsPerWeek)
      ? { completedThisWeek: countCompletedThisWeek(sessions, nowISO), target: targetFksSessionsPerWeek }
      : null;

  const rpe = {
    hasSignal: signals.rpeDeltaCount >= TRACKING_CONFIG.rpe.minSessionsForSignal,
    deltaAvg: signals.rpeDeltaAvg != null ? Math.round(signals.rpeDeltaAvg * 10) / 10 : null,
  };

  const exerciseEvolutions = computeExerciseEvolutions(executionHistory, nowISO);
  const focusBadges = computeFocusBadges(sessions, nowISO);

  const lastDecisionView: LastDecisionView | null = lastDecision
    ? {
        kind: lastDecision.kind,
        kindLabel: KIND_LABELS_FR[lastDecision.kind] ?? lastDecision.kind,
        explanation: lastDecision.explanation,
        dateLabel: formatRelativeDaysFR(lastDecision.decidedAtISO, nowISO),
      }
    : null;

  // Cas limite : sur la dernière séance du cycle (deload), il n'y a pas de
  // "N+1/12" pertinent -- le cycle se termine, le joueur en choisit un nouveau
  // (règle #3 : 12 séances = cycle complet). getMicrocyclePhase clampe déjà
  // sessionNumber à `total`, donc sans ce garde-fou la phrase répéterait à
  // tort "12/12" comme si une prochaine séance restait dans CE cycle.
  const nextInfo = getMicrocyclePhase(microcycleSessionIndex + 1, total);
  const nextStepLabel = !hasCycle
    ? "Choisis un cycle actif pour démarrer ta progression."
    : currentPhase.sessionNumber >= total
      ? "Cycle terminé : choisis ta prochaine étape."
      : `Prochaine séance : ${nextInfo.sessionNumber}/${nextInfo.total} — ${nextInfo.label}`;

  // Fix P2-e : le gap se calcule depuis les séances complétées (sessions) en
  // PRIORITÉ -- même source que le moteur (state/orchestrators/trackingShadow.ts)
  // -- executionHistory (historyEntries) en complément, selfReportedGapDays en
  // dernier recours (géré par detectTrainingGap lui-même). Voir
  // buildSessionsHistoryForGap ci-dessus pour le détail du problème corrigé.
  const gapHistoryEntries = [...buildSessionsHistoryForGap(sessions), ...historyEntries];
  const gap = detectTrainingGap(gapHistoryEntries, nowISO, TRACKING_CONFIG, selfReportedGapDays);
  const resumption =
    gap.level !== "none"
      ? { level: gap.level, source: gap.source, message: "Reprise détectée : on y va progressivement." }
      : null;

  return {
    hasCycle,
    cycleTheme,
    sessionLabel,
    phaseLabel: currentPhase.label,
    completion,
    weekly,
    rpe,
    exerciseEvolutions,
    focusBadges,
    lastDecisionView,
    nextStepLabel,
    resumption,
  };
}
