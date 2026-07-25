// state/stores/useExecutionStore.ts
// Store de la boucle de suivi (Lot 1) : execution en cours (une seule),
// historique local leger (cap 50, plus recent en tete), preferences de
// remplacement durables, derniere decision shadow. Meme philosophie de
// survie au crash que fks_live_session (SessionLiveScreen) : persiste via
// AsyncStorage, jamais uniquement dans les params de navigation.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionExecution, TrackingDecision } from "../../domain/tracking/types";
import { finalizeExecution } from "../../domain/tracking/execution";
import { createMigratedStorage } from "./storage";

const HISTORY_CAP = 50;

export type ReplacementPreference = {
  altExerciseId: string;
  reason: string;
  count: number;
  lastAtISO: string;
};

export type ExecutionState = {
  current: SessionExecution | null;
  history: SessionExecution[];
  replacementPreferences: Record<string, ReplacementPreference>;
  lastDecision: TrackingDecision | null;

  // actions
  startExecution: (exec: SessionExecution) => void;
  updateCurrent: (updater: (exec: SessionExecution) => SessionExecution) => void;
  finishCurrent: (finishedAtISO: string, actualDurationMin: number | null) => void;
  clearCurrent: () => void;
  recordReplacementPreference: (
    originalExerciseId: string,
    altExerciseId: string,
    reason: string
  ) => void;
  setLastDecision: (decision: TrackingDecision | null) => void;
  getExecutionForSession: (sessionId: string) => SessionExecution | undefined;
  resetAll: () => void;
};

const baseExecutionState = () => ({
  current: null as SessionExecution | null,
  history: [] as SessionExecution[],
  replacementPreferences: {} as Record<string, ReplacementPreference>,
  lastDecision: null as TrackingDecision | null,
});

export const useExecutionStore = create<ExecutionState>()(
  persist(
    (set, get) => ({
      ...baseExecutionState(),

      // Idempotence : demarrer une nouvelle execution remplace proprement
      // celle en cours, meme si un sessionId etait deja en vol (le joueur qui
      // relance une seance ecrase l'ancien brouillon, jamais d'accumulation).
      startExecution: (exec) => set({ current: exec }),

      updateCurrent: (updater) =>
        set((state) => (state.current ? { current: updater(state.current) } : {})),

      // Idempotence : une execution deja finalisee (finishedAtISO pose) ne
      // repart pas une seconde fois dans l'historique. finalizeExecution est
      // lui-meme idempotent ; la garde ici evite en plus de dupliquer l'entree
      // d'historique si finishCurrent est appele plusieurs fois par erreur.
      finishCurrent: (finishedAtISO, actualDurationMin) => {
        const current = get().current;
        if (!current || current.finishedAtISO) return;

        const finalized = finalizeExecution(current, finishedAtISO, actualDurationMin);
        set((state) => ({
          current: finalized,
          history: [finalized, ...state.history].slice(0, HISTORY_CAP),
        }));
      },

      clearCurrent: () => set({ current: null }),

      recordReplacementPreference: (originalExerciseId, altExerciseId, reason) =>
        set((state) => {
          const prev = state.replacementPreferences[originalExerciseId];
          return {
            replacementPreferences: {
              ...state.replacementPreferences,
              [originalExerciseId]: {
                altExerciseId,
                reason,
                count: (prev?.count ?? 0) + 1,
                lastAtISO: new Date().toISOString(),
              },
            },
          };
        }),

      setLastDecision: (decision) => set({ lastDecision: decision }),

      getExecutionForSession: (sessionId) => {
        const state = get();
        if (state.current?.sessionId === sessionId) return state.current;
        return state.history.find((exec) => exec.sessionId === sessionId);
      },

      resetAll: () => set({ ...baseExecutionState() }),
    }),
    {
      name: "fks-execution-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        current: s.current,
        history: s.history,
        replacementPreferences: s.replacementPreferences,
        lastDecision: s.lastDecision,
      }),
      // Decision d'implementation : on n'appelle PAS onStoreHydrated() ici.
      // state/orchestrators/rehydrate.ts compte un TOTAL_STORES=6 fige en dur,
      // correspondant exactement aux 6 stores existants avant ce lot ; ce
      // store est le 7e et ne joue aucun role dans le rebuild ATL/CTL/TSB
      // (rehydrateFromStorage). Le brancher sur ce compteur sans toucher a
      // rehydrate.ts (fichier existant, hors perimetre de ce lot) ferait soit
      // declencher le rehydrate avant que ce store ait fini de charger (si les
      // 6 autres hydratent en premier), soit exigerait de modifier la
      // constante ailleurs -- les deux sont hors du contrat de ce lot. Ce
      // store hydrate donc de maniere independante, sans coordination.
      migrate: (persisted) => persisted as ExecutionState,
    }
  )
);

export const getExecutionDefaults = baseExecutionState;
