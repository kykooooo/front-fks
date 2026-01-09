import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEV_FLAGS } from "../config/devFlags";
import { TRAINING_DEFAULTS } from "../config/trainingDefaults";
import { todayISO } from "../utils/virtualClock";
import { toDayKey } from "../engine/dailyAggregation";

import { auth } from "../services/firebase";

import type { TrainingState } from "./trainingStore/types";

import { createPlanningSlice } from "./trainingStore/slices/planningSlice";
import { createDebugSlice } from "./trainingStore/slices/debugSlice";
import { createSubjectiveSlice } from "./trainingStore/slices/subjectiveSlice";
import { createLoadSlice } from "./trainingStore/slices/loadSlice";
import { createFirestoreSlice } from "./trainingStore/slices/firestoreSlice";
import { computeResilience } from "./trainingStore/helpers";

// ---------------------------------------------------------------------------
// Base state = SEULE source de vérité des valeurs initiales
// ---------------------------------------------------------------------------
const baseTrainingState = () => ({
  phase: "Playlist" as const,
  phaseCount: 0,
  atl: TRAINING_DEFAULTS.ATL0,
  ctl: TRAINING_DEFAULTS.CTL0,
  tsb: TRAINING_DEFAULTS.CTL0 - TRAINING_DEFAULTS.ATL0,
  lastRpe: null as number | null,
  lastUpdateISO: null as string | null,
  lastLoadDayKey: null as string | null,
  tsbHistory: [] as number[],
  lastAiSessionV2: null as any,
  lastAiContext: null as any,
  devNowISO: DEV_FLAGS.ENABLED && DEV_FLAGS.VIRTUAL_CLOCK ? todayISO() : null,

  sessions: [],
  weekly: { hasRunStructured: false, hasCircuit: false },

  externalLoads: [],
  clubTrainingDays: [],
  matchDays: [],
  matchDay: null,
  autoExternalConfig: {},
  microcycleGoal: null as string | null,
  microcycleSessionIndex: 0,

  plannedFksDays: [],
  lastAppliedDate: null as string | null,
  dailyApplied: {} as Record<string, number>,
  nextAllowedDateISO: null as string | null,

  dayStates: {} as Record<string, any>,
  debugLog: [],

  storeHydrated: false,
  _rehydrating: false,
  _currentUid: auth.currentUser?.uid ?? null,
  _unsubSessions: undefined,
  _unsubAuth: undefined,
  _unsubProfile: undefined,
});

// --- Helpers snapshot par utilisateur (pour restaurer ATL/CTL/TSB après reconnexion) ---
const persistableKeys = [
  "atl",
  "ctl",
  "tsb",
  "lastLoadDayKey",
  "lastUpdateISO",
  "dailyApplied",
  "devNowISO",
  "phase",
  "phaseCount",
  "dayStates",
  "weekly",
  "externalLoads",
  "clubTrainingDays",
  "matchDay",
  "matchDays",
  "autoExternalConfig",
  "tsbHistory",
  "lastAiContext",
  "sessions",
  "lastAiSessionV2",
  "lastAppliedDate",
  "plannedFksDays",
  "debugLog",
] as const;

const persistKeyForUid = (uid: string) => `training-store-snapshot-${uid}`;

const extractPersistable = (s: TrainingState): Partial<TrainingState> => {
  const out: Partial<TrainingState> = {};
  persistableKeys.forEach((k) => {
    out[k] = s[k];
  });
  return out;
};

const loadSnapshotForUid = async (uid: string): Promise<Partial<TrainingState> | null> => {
  try {
    const raw = await AsyncStorage.getItem(persistKeyForUid(uid));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<TrainingState>;
  } catch {
    return null;
  }
};

const saveSnapshotForUid = async (uid: string, state: TrainingState) => {
  try {
    const data = extractPersistable(state);
    await AsyncStorage.setItem(persistKeyForUid(uid), JSON.stringify(data));
  } catch {
    // best effort
  }
};

let _rehydrateOnce = false;

export const useTrainingStore = create<TrainingState>()(
  devtools(
    persist(
      (set, get) => ({
        ...baseTrainingState(),

        // slices composées (plus de code mort)
        ...createPlanningSlice(set),
        ...createDebugSlice(set),
        ...createSubjectiveSlice(set, get),
        ...createLoadSlice(set, get),
        ...createFirestoreSlice(set, get),

        // petits setters simples (OK ici)
        setPhase: (p) => set({ phase: p }),
        setLastAiContext: (ctx) => set({ lastAiContext: ctx }),
        setClubTrainingDays: (days) => set({ clubTrainingDays: days }),
        setMatchDays: (days) => set({ matchDays: days }),
        setMicrocycleGoal: (goal) =>
          set((state) => ({
            microcycleGoal: goal,
            microcycleSessionIndex: goal && goal !== state.microcycleGoal ? 0 : state.microcycleSessionIndex,
          })),
        setMicrocycleSessionIndex: (idx) => set({ microcycleSessionIndex: Math.max(0, Math.trunc(idx)) }),
        bumpMicrocycleSessionIndex: () =>
          set((state) => ({ microcycleSessionIndex: Math.max(0, Math.trunc(state.microcycleSessionIndex ?? 0)) + 1 })),
        resetForUser: async (uid) => {
          const current = get()._currentUid ?? null;
          if (get()._rehydrating) return;
          if (current === uid) return;

          // sauvegarde snapshot du user courant
          if (current) {
            await saveSnapshotForUid(current, get());
          }

          const st = get();
          st._unsubSessions?.();
          st._unsubProfile?.();

          // charge snapshot du nouveau user
          let restored: Partial<TrainingState> | null = null;
          if (uid) {
            restored = await loadSnapshotForUid(uid);
          }

          set(() => ({
            ...baseTrainingState(),
            ...(restored ?? {}),
            _currentUid: uid ?? null,
            _unsubSessions: undefined,
            _unsubProfile: undefined,
            _unsubAuth: undefined,
            storeHydrated: true,
            _rehydrating: false,
          }));
        },

        pushSession: (s) =>
          set((state: TrainingState) => {
            const baseISO = (s as any).dateISO ?? (s as any).date ?? todayISO();
            return {
              sessions: [{ ...s, dateISO: state.devNowISO ?? baseISO }, ...state.sessions].slice(0, 50),
            };
          }),

        setManualLoad: (atl, ctl, tsb) =>
          set((state: TrainingState) => {
            const dayKey = toDayKey(state.devNowISO ?? todayISO());
            return {
              atl,
              ctl,
              tsb,
              lastUpdateISO: new Date().toISOString(),
              lastLoadDayKey: dayKey,
              tsbHistory: [tsb, ...(state.tsbHistory ?? [])].slice(0, 7),
            };
          }),

        getSessionById: (id) => get().sessions.find((s) => s.id === id),
        updateWeekly: (updater) => set((state) => ({ weekly: updater(state.weekly) })),
        getResilience: () => computeResilience(get().ctl),
        completeSession: (sessionId, rpe) =>
          get().addFeedback(sessionId, {
            rpe: Math.max(1, Math.min(10, Math.round(rpe))) as any,
            fatigue: 3,
            sleep: 3,
            pain: 2,
            createdAt: new Date().toISOString(),
          }),
        latestSessionId: () => {
          const list = get().sessions;
          if (!list.length) return undefined;
          const sorted = [...list].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
          return sorted[0]?.id;
        },

        // deprecated compat
        computeLoadDeltas: () => ({ atlDelta: 0, ctlDelta: 0 }),

        // setter
        setLastAiSessionV2: (v2: any) => set({ lastAiSessionV2: v2 }),
      }),
      {
        name: "training-store",
        version: 1,
        storage: createJSONStorage(() => AsyncStorage),

        partialize: (s) => ({
          atl: s.atl,
          ctl: s.ctl,
          tsb: s.tsb,
          lastLoadDayKey: s.lastLoadDayKey,
          lastUpdateISO: s.lastUpdateISO,
          dailyApplied: s.dailyApplied,
          devNowISO: s.devNowISO,
          phase: s.phase,
          phaseCount: s.phaseCount,
          dayStates: s.dayStates,
          weekly: s.weekly,
          externalLoads: s.externalLoads,
          clubTrainingDays: s.clubTrainingDays,
          matchDay: s.matchDay ?? null,
          matchDays: s.matchDays,
          autoExternalConfig: s.autoExternalConfig,
          tsbHistory: s.tsbHistory,
          lastAiContext: s.lastAiContext,
          sessions: s.sessions,
          lastAiSessionV2: s.lastAiSessionV2,
          lastAppliedDate: s.lastAppliedDate ?? null,
          plannedFksDays: s.plannedFksDays ?? [],
          debugLog: s.debugLog ?? [],
          microcycleGoal: s.microcycleGoal ?? null,
          microcycleSessionIndex: s.microcycleSessionIndex ?? 0,
        }),

        onRehydrateStorage: () => () => {
          setTimeout(() => {
            if (_rehydrateOnce) {
              useTrainingStore.setState({ storeHydrated: true, _rehydrating: false });
              return;
            }

            const st = useTrainingStore.getState();
            if (st._rehydrating) return;

            try {
              useTrainingStore.setState({ _rehydrating: true });

              if (!DEV_FLAGS.ENABLED || !DEV_FLAGS.VIRTUAL_CLOCK) {
                useTrainingStore.setState({ devNowISO: null });
              }

              useTrainingStore.getState()._rehydrateFromStorage?.();
              _rehydrateOnce = true;
            } finally {
              useTrainingStore.setState({ storeHydrated: true, _rehydrating: false });
            }
          }, 0);
        },

        migrate: (persisted) => persisted as any,
      }
    )
  )
);
