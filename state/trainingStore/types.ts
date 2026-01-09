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
import { AiNextSession } from "../../repositories/sessionsRepo";

// Charges externes (club / match)
export type ExternalLoad = {
  id: string;
  source: "club" | "match" | "other";
  dateISO: string;
  rpe: number;
  durationMin: number;
  notes?: string;
};

export type PersistPlannedPayload = {
  id: string; // pour l’UI
  dateISO: string;
  phase: Phase;
  focus: "run" | "strength" | "plyo" | "speed" | "circuit" | "mobility";
  intensity: "easy" | "moderate" | "hard";
  plannedLoad: number;
  exercises: Session["exercises"];
  ai?: AiNextSession;
};

// Types debug (console)
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

export type TrainingState = {
  [x: string]: any;
  resetForUser: (uid: string | null) => Promise<void> | void;

  // état courant
  phase: Phase;
  phaseCount: number;
  atl: number;
  ctl: number;
  tsb: number;
  lastRpe: number | null;
  lastUpdateISO: string | null;
  lastLoadDayKey: string | null;

  // historique court TSB (0 = aujourd'hui)
  tsbHistory: number[];

  // horloge virtuelle (DEV)
  devNowISO: string | null;

  // debug IA
  lastAiContext?: any;

  // suivi
  sessions: Session[];
  weekly: WeeklyIndicators;
  externalLoads: ExternalLoad[];
  clubTrainingDays?: string[];
  matchDays?: string[];
  matchDay?: string | null;
  autoExternalConfig?: {
    club?: { rpe: number; durationMin: number };
    match?: { rpe: number; durationMin: number };
  };
  microcycleGoal: string | null;
  microcycleSessionIndex: number;
  setClubTrainingDays: (days: string[]) => void;
  setMatchDays: (days: string[]) => void;
  setMicrocycleGoal: (goal: string | null) => void;
  setMicrocycleSessionIndex: (idx: number) => void;
  bumpMicrocycleSessionIndex: () => void;
  runTestHarness?: (days?: number) => void;
  lastAppliedDate?: string | null;

  // anti double-compte: charge totale appliquée par dayKey
  dailyApplied: Record<string, number>;

  // repos planifié
  nextAllowedDateISO: string | null;

  // feedback/jour + facteurs adaptatifs (M3)
  dayStates: Record<string, DayState>;
  getPrevFatigueSmoothed: (dateISO: string) => number | null;
  setDailyFeedback: (dateISO: string, payload: Omit<DailyFeedback, "timestamp">) => void;
  setInjury: (dateISO: string, injury: InjuryRecord | null) => void;
  getAdaptiveFactorsForDate: (dateISO: string) => AdaptiveFactors | null;

  // debug log
  debugLog: DebugEvent[];
  clearDebugLog: () => void;

  // actions “métier”
  setPhase: (p: Phase) => void;
  pushSession: (s: Session) => void;
  setLastAiContext: (ctx: any) => void;
  setManualLoad: (atl: number, ctl: number, tsb: number) => void;

  // feedback (chemin officiel de complétion)
  addFeedback: (sessionId: string, feedback: SessionFeedback) => TrainingLogItem | null;

  // charges externes
  addExternalLoad: (load: ExternalLoad) => void;

  // legacy (debug uniquement)
  completeSession: (sessionId: string, rpe: number) => TrainingLogItem | null;

  // weekly
  updateWeekly: (updater: (w: WeeklyIndicators) => WeeklyIndicators) => void;

  // Planning simple des jours FKS (flag local/Firestore)
  plannedFksDays: string[];
  togglePlannedFksDay: (dayKey: string) => void;
  clearPlannedFksDays: () => void;

  // helpers
  getSessionById: (id: string) => Session | undefined;
  latestSessionId: () => string | undefined;

  // jours off / repos
  advanceDays: (n: number) => void;
  restUntil: (days: number) => void;

  // getter résilience
  getResilience: () => number;

  // compat
  computeLoadDeltas: (session: Session, rpe: number) => { atlDelta: number; ctlDelta: number };

  // Firestore
  startFirestoreWatch: () => void;
  persistCompletedSession: (s: Session) => Promise<void>;
  persistPlannedSession: (payload: PersistPlannedPayload) => Promise<void>;
  _applyAutoExternalLoads?: (dayKeys: string[]) => void;

  // interne
  _currentUid?: string | null;
  _unsubSessions?: Unsub;
  _unsubPlanned?: Unsub;
  _unsubAuth?: Unsub;
  _unsubProfile?: Unsub;

  // hydratation persist (AsyncStorage)
  storeHydrated: boolean;
  _rehydrating?: boolean;

  // dernière séance IA (blueprint) pour affichage après relance
  lastAiSessionV2?: any;

  // interne (rehydrate)
  _rehydrateFromStorage?: () => void;
  _rebuildLoadFromHistory?: (opts?: { decayToNow?: boolean }) => void;

  // setter
  setLastAiSessionV2?: (v2: any) => void;
};
