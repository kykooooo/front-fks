// state/stores/useSessionsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO } from "../../utils/virtualClock";
import type { SessionsState } from "./types";
import type { Phase, Session, SessionStatus } from "../../domain/types";
import type { FKS_AiContext } from "../../services/aiContext";
import type { FKS_NextSessionV2 } from "../../screens/newSession/types";
import { useDebugStore } from "./useDebugStore";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

export const MAX_STORED_SESSIONS = 200;

const baseSessionsState = () => ({
  sessions: [] as Session[],
  phase: "Playlist" as Phase,
  phaseCount: 0,
  weekly: { hasRunStructured: false, hasCircuit: false },
  microcycleGoal: null as string | null,
  microcycleSessionIndex: 0,
  microcycleAppliedSessionIds: [] as string[],
  activePathwayId: null as string | null,
  activePathwayIndex: 0,
  lastAiSessionV2: null as SessionsState["lastAiSessionV2"],
  lastAiContext: null as FKS_AiContext | null,
  playerLevel: null as string | null,
});

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      ...baseSessionsState(),

      pushSession: (s) =>
        set((state) => {
          const devNowISO = useDebugStore.getState().devNowISO;
          const baseISO = s.dateISO ?? s.date ?? todayISO();
          return {
            sessions: [{ ...s, dateISO: devNowISO ?? baseISO }, ...state.sessions].slice(0, MAX_STORED_SESSIONS),
          };
        }),

      setPhase: (p) => set({ phase: p }),

      updateWeekly: (updater) => set((state) => ({ weekly: updater(state.weekly) })),

      getSessionById: (id) => get().sessions.find((s) => s.id === id),

      latestSessionId: () => {
        const list = get().sessions;
        if (!list.length) return undefined;
        const sorted = [...list].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
        return sorted[0]?.id;
      },

      setSessionStatus: (sessionId, status, meta) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const nextStatus = status as SessionStatus;
            const startedAt =
              meta && "startedAt" in meta
                ? meta.startedAt ?? undefined
                : session.startedAt;
            const completedAt =
              meta && "completedAt" in meta
                ? meta.completedAt ?? undefined
                : session.completedAt;

            return {
              ...session,
              status: nextStatus,
              completed: nextStatus === "completed",
              startedAt,
              completedAt,
              ...(nextStatus === "completed" && !completedAt
                ? { completedAt: new Date().toISOString() }
                : {}),
            };
          }),
        })),

      setMicrocycleGoal: (goal) =>
        set((state) => {
          const normalize = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();
          const normalized = normalize(goal);
          // Canonical form: always lowercase, remap legacy "reactivite" → "explosif"
          const mapped = normalized === "reactivite" ? "explosif" : normalized || null;
          const prevNorm = normalize(state.microcycleGoal);
          const changed = (mapped ?? "") !== prevNorm;
          return {
            microcycleGoal: mapped,
            microcycleSessionIndex: changed ? 0 : state.microcycleSessionIndex,
            microcycleAppliedSessionIds: changed ? [] : state.microcycleAppliedSessionIds,
          };
        }),

      setPlayerLevel: (level: string | null) => set({ playerLevel: level }),

      setMicrocycleSessionIndex: (idx) =>
        set({ microcycleSessionIndex: Math.max(0, Math.trunc(idx)) }),

      setActivePathway: (pathwayId, index = 0) =>
        set({ activePathwayId: pathwayId, activePathwayIndex: index }),

      setLastAiContext: (ctx) => set({ lastAiContext: ctx }),

      setLastAiSessionV2: (v2) => set({ lastAiSessionV2: v2 }),

      completeSession: (sessionId, rpe) => {
        // Delegates to applyFeedback orchestrator.
        // This is a compat shim — the real logic is in orchestrators/applyFeedback.ts
        // Importing here would create circular deps, so callers should use the orchestrator directly.
        return null;
      },
    }),
    {
      name: "fks-sessions-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        sessions: s.sessions,
        phase: s.phase,
        phaseCount: s.phaseCount,
        weekly: s.weekly,
        microcycleGoal: s.microcycleGoal ?? null,
        microcycleSessionIndex: s.microcycleSessionIndex ?? 0,
        microcycleAppliedSessionIds: s.microcycleAppliedSessionIds ?? [],
        activePathwayId: s.activePathwayId ?? null,
        activePathwayIndex: s.activePathwayIndex ?? 0,
        lastAiSessionV2: s.lastAiSessionV2,
        lastAiContext: s.lastAiContext,
      }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as SessionsState,
    }
  )
);

export const getSessionsDefaults = baseSessionsState;
