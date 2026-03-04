// state/stores/types.ts
// Per-store type definitions for the 6 split stores.
import type {
  Phase,
  Session,
  WeeklyIndicators,
  TrainingLogItem,
  SessionFeedback,
  DayState,
  DailyFeedback,
  AdaptiveFactors,
  InjuryRecord,
} from "../../domain/types";
import type { FKS_NextSessionV2 } from "../../screens/newSession/types";
import type { FKS_AiContext } from "../../services/aiContext";

// Shared helper types (previously in trainingStore/types.ts)
export type CompletedRoutine = {
  id: string;
  dateISO: string;
  category: string;
  title: string;
  durationMin?: number;
};

export type ExternalLoad = {
  id: string;
  source: "club" | "match" | "other";
  dateISO: string;
  rpe: number;
  durationMin: number;
  notes?: string;
};

export type PersistPlannedPayload = {
  id: string;
  dateISO: string;
  phase: Phase;
  focus: "run" | "strength" | "plyo" | "speed" | "circuit" | "mobility";
  intensity: "easy" | "moderate" | "hard";
  plannedLoad: number;
  exercises: Session["exercises"];
  ai?: import("../../repositories/sessionsRepo").AiNextSession;
};

export type DebugEvent = {
  kind: "feedback_applied" | "external_applied";
  whenISO: string;
  sessionId?: string;
  rpe: number;
  fatigue?: number;
  recoveryPerceived?: number;
  pain?: number;
  totalToday: number;
  deltaLoad: number;
  atl: number;
  ctl: number;
  tsb: number;
  phase: Phase;
  phaseCount: number;
  source?: string;
};

export type Unsub = () => void;

// ---------------------------------------------------------------------------
// Store 1: Load metrics (ATL / CTL / TSB)
// ---------------------------------------------------------------------------
export type LoadState = {
  atl: number;
  ctl: number;
  tsb: number;
  tsbHistory: number[];
  lastRpe: number | null;
  lastUpdateISO: string | null;
  lastLoadDayKey: string | null;
  dailyApplied: Record<string, number>;
  ignoreFatigueCap: boolean;
  lastAppliedDate: string | null;
  nextAllowedDateISO: string | null;

  // actions
  setManualLoad: (atl: number, ctl: number, tsb: number) => void;
  resetLoadMetrics: () => void;
  setIgnoreFatigueCap: (enabled: boolean) => void;
  getResilience: () => number;
  computeLoadDeltas: (session: Session, rpe: number) => { atlDelta: number; ctlDelta: number };
  advanceDays: (n: number) => void;
  restUntil: (days: number) => void;
};

// ---------------------------------------------------------------------------
// Store 2: Sessions + microcycles + pathway
// ---------------------------------------------------------------------------
export type SessionsState = {
  sessions: Session[];
  phase: Phase;
  phaseCount: number;
  weekly: WeeklyIndicators;
  microcycleGoal: string | null;
  microcycleSessionIndex: number;
  microcycleAppliedSessionIds: string[];
  activePathwayId: string | null;
  activePathwayIndex: number;
  lastAiSessionV2: { v2: FKS_NextSessionV2; date: string; sessionId: string } | null;
  lastAiContext: FKS_AiContext | null;

  // actions
  pushSession: (s: Session) => void;
  setPhase: (p: Phase) => void;
  updateWeekly: (updater: (w: WeeklyIndicators) => WeeklyIndicators) => void;
  getSessionById: (id: string) => Session | undefined;
  latestSessionId: () => string | undefined;
  setMicrocycleGoal: (goal: string | null) => void;
  setMicrocycleSessionIndex: (idx: number) => void;
  setActivePathway: (pathwayId: string | null, index?: number) => void;
  setLastAiContext: (ctx: FKS_AiContext | null) => void;
  setLastAiSessionV2: (v2: { v2: FKS_NextSessionV2; date: string; sessionId: string } | null) => void;
  completeSession: (sessionId: string, rpe: number) => TrainingLogItem | null;
};

// ---------------------------------------------------------------------------
// Store 3: Daily feedback / injuries (subjective)
// ---------------------------------------------------------------------------
export type FeedbackState = {
  dayStates: Record<string, DayState>;

  // actions
  getPrevFatigueSmoothed: (dateISO: string) => number | null;
  setDailyFeedback: (dateISO: string, payload: Omit<DailyFeedback, "timestamp">) => void;
  setInjury: (dateISO: string, injury: InjuryRecord | null) => void;
  getAdaptiveFactorsForDate: (dateISO: string) => AdaptiveFactors | null;
};

// ---------------------------------------------------------------------------
// Store 4: External loads + club/match + routines + favorites
// ---------------------------------------------------------------------------
export type ExternalState = {
  externalLoads: ExternalLoad[];
  completedRoutines: CompletedRoutine[];
  favoriteExerciseIds: string[];
  recentExerciseIds: string[];
  clubTrainingDays: string[];
  matchDays: string[];
  matchDay: string | null;
  autoExternalEnabled: boolean;
  autoExternalConfig: {
    club?: { rpe: number; durationMin: number };
    match?: { rpe: number; durationMin: number };
  };

  // actions
  addCompletedRoutine: (routine: Omit<CompletedRoutine, "id" | "dateISO">) => void;
  toggleFavoriteExercise: (exerciseId: string) => void;
  addRecentExercise: (exerciseId: string) => void;
  setClubTrainingDays: (days: string[]) => void;
  setMatchDays: (days: string[]) => void;
  setAutoExternalEnabled: (enabled: boolean) => void;
};

// ---------------------------------------------------------------------------
// Store 5: Sync / Firestore / hydration / planning
// ---------------------------------------------------------------------------
export type SyncState = {
  storeHydrated: boolean;
  _rehydrating: boolean;
  _currentUid: string | null;
  _unsubSessions?: Unsub;
  _unsubPlanned?: Unsub;
  _unsubAuth?: Unsub;
  _unsubProfile?: Unsub;
  plannedFksDays: string[];

  // actions
  startFirestoreWatch: () => void;
  persistCompletedSession: (s: Session) => Promise<void>;
  persistPlannedSession: (payload: PersistPlannedPayload) => Promise<void>;
  resetForUser: (uid: string | null) => Promise<void> | void;
  togglePlannedFksDay: (dayKey: string) => void;
  clearPlannedFksDays: () => void;
  setPlannedFksDays: (days: string[]) => void;
};

// ---------------------------------------------------------------------------
// Store 6: Debug / dev
// ---------------------------------------------------------------------------
export type DebugState = {
  debugLog: DebugEvent[];
  devNowISO: string | null;

  // actions
  clearDebugLog: () => void;
  pushDebugEvent: (evt: DebugEvent) => void;
  setDevNowISO: (iso: string | null) => void;
  runTestHarness: (days?: number) => void;
};
