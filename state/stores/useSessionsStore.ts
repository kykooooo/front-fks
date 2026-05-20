// state/stores/useSessionsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO } from "../../utils/virtualClock";
import type { SessionsState } from "./types";
import type { Phase, Session } from "../../domain/types";
import { canonicalizeMicrocycleGoal } from "../../domain/microcycles";
import type { FKS_AiContext } from "../../services/aiContext";
import type { FKS_NextSessionV2 } from "../../screens/newSession/types";
import { useDebugStore } from "./useDebugStore";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";

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
            sessions: [{ ...s, dateISO: devNowISO ?? baseISO }, ...state.sessions].slice(0, 200),
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

      setMicrocycleGoal: (goal) =>
        set((state) => {
          // Forme canonique (5 cycles) : remap des anciens cycles + alias legacy
          // reactivite/explosif → explosivite, rsa → endurance, offseason → fondation
          const mapped = canonicalizeMicrocycleGoal(goal);
          const prev = canonicalizeMicrocycleGoal(state.microcycleGoal);
          const changed = (mapped ?? "") !== (prev ?? "");
          return {
            microcycleGoal: mapped,
            microcycleSessionIndex: changed ? 0 : state.microcycleSessionIndex,
            microcycleAppliedSessionIds: changed ? [] : state.microcycleAppliedSessionIds,
          };
        }),

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
      version: 2,
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
      migrate: (persisted: any) => {
        const state = (persisted ?? {}) as SessionsState;
        // v2 : migration des anciens cycles (explosif/rsa/offseason) vers les 5 cycles canoniques
        if (state && typeof state === "object") {
          state.microcycleGoal = canonicalizeMicrocycleGoal((state as any).microcycleGoal);
        }
        return state;
      },
    }
  )
);

export const getSessionsDefaults = baseSessionsState;
