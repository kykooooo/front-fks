// state/stores/useSyncStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../../services/firebase";
import { todayISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import {
  saveSession,
  watchSessions as watchSessionsRepo,
  watchPlannedSessions,
} from "../../repositories/sessionsRepo";
import type { CompletedSession } from "../../repositories/sessionsRepo";
import { savePlannedSessionToFirestore } from "../../services/plannedSessionsRepo";
import { isClubDay } from "../../utils/dateHelpers";
import { normalizeSessionsFromFirestore } from "./syncHelpers";
import { addDaysISO } from "../../utils/virtualClock";

import { useSessionsStore } from "./useSessionsStore";
import { useExternalStore } from "./useExternalStore";
import { useLoadStore } from "./useLoadStore";
import { useDebugStore } from "./useDebugStore";
import { useFeedbackStore } from "./useFeedbackStore";
import type { SyncState, ExternalState } from "./types";
import type { PersistPlannedPayload } from "./types";
import type { Session } from "../../domain/types";
import { createMigratedStorage } from "./storage";
import { onStoreHydrated } from "../orchestrators/rehydrate";
import { userProfileSchema, logValidationIssues } from "../../schemas/firestoreSchemas";

let _watchGuard = false;
let _active = true;
export const resetWatchGuard = () => { _watchGuard = false; };
export const deactivateListeners = () => { _active = false; };
export const reactivateListeners = () => { _active = true; };

/* ─── Module-level listener tracking (race-proof) ─── */
const _unsubs = new Map<string, () => void>();

function _trackUnsub(key: string, unsub: () => void) {
  // Unsubscribe previous listener for this key if it exists
  const prev = _unsubs.get(key);
  if (prev) prev();
  _unsubs.set(key, unsub);
}

export function cleanupAllListeners() {
  for (const unsub of _unsubs.values()) {
    try { unsub(); } catch { /* ignore */ }
  }
  _unsubs.clear();
}

function _cleanupDataListeners() {
  for (const key of ["sessions", "planned", "profile"]) {
    const unsub = _unsubs.get(key);
    if (unsub) {
      try { unsub(); } catch { /* ignore */ }
      _unsubs.delete(key);
    }
  }
}

const baseSyncState = () => ({
  storeHydrated: false,
  _rehydrating: false,
  _currentUid: (auth.currentUser?.uid ?? null) as string | null,
  _unsubSessions: undefined as SyncState["_unsubSessions"],
  _unsubPlanned: undefined as SyncState["_unsubPlanned"],
  _unsubAuth: undefined as SyncState["_unsubAuth"],
  _unsubProfile: undefined as SyncState["_unsubProfile"],
  plannedFksDays: [] as string[],
});

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      ...baseSyncState(),

      togglePlannedFksDay: (dayKey) =>
        set((s) => {
          const list = s.plannedFksDays ?? [];
          const exists = list.includes(dayKey);
          const next = exists ? list.filter((d) => d !== dayKey) : [...list, dayKey];
          return { plannedFksDays: next };
        }),
      clearPlannedFksDays: () => set({ plannedFksDays: [] }),
      setPlannedFksDays: (days) => set({ plannedFksDays: [...days] }),

      persistPlannedSession: async (payload) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const rest: PersistPlannedPayload = { ...payload };
        const sessionId = rest.id ?? null;
        const aiPayload = rest.ai;

        const tsb = useLoadStore.getState().tsb ?? 0;
        const clubDays = useExternalStore.getState().clubTrainingDays ?? [];

        const plannedDateKey = rest.dateISO ? toDateKey(rest.dateISO) : todayISO();
        const tomorrowKey = addDaysISO(`${plannedDateKey}T00:00:00.000Z`, 1).slice(0, 10);
        const clubToday = isClubDay(plannedDateKey, clubDays);
        const clubTomorrow = isClubDay(tomorrowKey, clubDays);

        let intensityPlanned = rest.intensity;
        let plannedLoadSafe = rest.plannedLoad;
        let guardFactor = 1;
        const guardrailsApplied: string[] = [];

        if (clubToday || clubTomorrow) {
          guardFactor *= 0.75;
          guardrailsApplied.push("Réduction club (jour/veille)");
          if (intensityPlanned === "hard") intensityPlanned = "moderate";
        }

        if (typeof tsb === "number" && tsb < -10) {
          guardFactor *= 0.8;
          guardrailsApplied.push("TSB < -10 → easy/modéré et volume -20%");
          intensityPlanned = "easy";
        } else if (typeof tsb === "number" && tsb < 0 && intensityPlanned === "hard") {
          intensityPlanned = "moderate";
          guardrailsApplied.push("TSB négatif → hard abaissé en moderate");
        }

        plannedLoadSafe = Math.max(1, Math.round(plannedLoadSafe * guardFactor));

        const firestorePlanned: Record<string, unknown> = {
          ...(sessionId ? { id: sessionId } : {}),
          date: rest.dateISO,
          phase: rest.phase,
          focus: rest.focus,
          intensity: intensityPlanned,
          plannedLoad: plannedLoadSafe,
          exercises: rest.exercises,
        };

        if (aiPayload != null) firestorePlanned.ai = aiPayload;
        if (guardrailsApplied.length > 0) firestorePlanned.guardrailsApplied = guardrailsApplied;

        if (!sessionId) return;
        await savePlannedSessionToFirestore({ ...firestorePlanned, userId: uid });
      },

      persistCompletedSession: async (s) => {
        const uid = auth.currentUser?.uid;
        if (!uid || !s.id) return;

        const completedPayload: Record<string, unknown> = {
          date: s.dateISO,
          phase: s.phase,
          focus: s.focus,
          intensity: s.intensity,
          exercises: s.exercises,
          rpe: s.rpe,
        };

        if (s.feedback) {
          const fb: Record<string, unknown> = {
            fatigue: s.feedback.fatigue,
            sleep: s.feedback.sleep,
            pain: s.feedback.pain,
          };
          if (s.ai != null) fb.ai = s.ai;
          completedPayload.feedback = fb;
        }

        await saveSession(uid, s.id, completedPayload as Omit<CompletedSession, "userId" | "id" | "createdAt">);

        const sessionsState = useSessionsStore.getState();
        const microcycleGoal = typeof sessionsState.microcycleGoal === "string"
          ? sessionsState.microcycleGoal?.trim() : null;
        const microcycleSessionIndex =
          typeof sessionsState.microcycleSessionIndex === "number" && Number.isFinite(sessionsState.microcycleSessionIndex)
            ? Math.max(0, Math.trunc(sessionsState.microcycleSessionIndex))
            : 0;
        const lastSessionDate =
          typeof s.dateISO === "string"
            ? s.dateISO
            : typeof s.date === "string"
              ? s.date
              : null;

        const userPatch: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
          lastSessionDate: lastSessionDate ?? null,
          lastSessionAt: serverTimestamp(),
        };
        if (microcycleGoal) userPatch.microcycleGoal = microcycleGoal;
        userPatch.microcycleSessionIndex = microcycleSessionIndex;

        const activePathwayId = sessionsState.activePathwayId;
        if (activePathwayId) {
          userPatch.activePathwayId = activePathwayId;
          userPatch.activePathwayIndex = sessionsState.activePathwayIndex ?? 0;
        }

        await setDoc(doc(db, "users", uid), userPatch, { merge: true });
      },

      startFirestoreWatch: () => {
        const st = get();
        if (st._unsubAuth || _watchGuard) return;
        _watchGuard = true;

        const unsubAuth = onAuthStateChanged(auth, (user) => {
          // Nettoyage déterministe via module-level tracking (pas de race avec Zustand state)
          _cleanupDataListeners();
          set({ _unsubSessions: undefined, _unsubPlanned: undefined, _unsubProfile: undefined });

          if (!user) return;

          const userRef = doc(db, "users", user.uid);
          const unsubProfile = onSnapshot(
            userRef,
            (snap) => {
              if (!_active) return;
              const raw = snap.data() ?? {};
              const parsed = userProfileSchema.safeParse(raw);
              if (!parsed.success) {
                logValidationIssues("userProfile", user.uid, parsed.error.issues);
              }
              const data = parsed.success ? parsed.data : userProfileSchema.parse({});

              const days = data.clubTrainingDays;
              const matchDay = data.matchDay ?? null;
              const matchDays = data.matchDays.length > 0 ? data.matchDays : matchDay ? [matchDay] : [];

              const firestoreGoal =
                typeof data.microcycleGoal === "string"
                  ? data.microcycleGoal.trim()
                  : null;

              if (firestoreGoal) {
                const localGoal = (useSessionsStore.getState().microcycleGoal ?? "").trim().toLowerCase();
                const remoteGoal = firestoreGoal.toLowerCase();
                if (localGoal !== remoteGoal) {
                  useSessionsStore.getState().setMicrocycleGoal(firestoreGoal);
                }
              }

              const pathwayId = data.activePathwayId ?? null;
              const pathwayIndex = data.activePathwayIndex;
              if (pathwayId !== useSessionsStore.getState().activePathwayId) {
                useSessionsStore.getState().setActivePathway(pathwayId, pathwayIndex);
              }

              const autoExternalConfig: ExternalState["autoExternalConfig"] = {
                club:
                  typeof data.clubTypicalRPE === "number" && typeof data.clubTypicalDurationMin === "number"
                    ? { rpe: data.clubTypicalRPE, durationMin: data.clubTypicalDurationMin }
                    : undefined,
                match:
                  typeof data.matchTypicalRPE === "number" && typeof data.matchTypicalDurationMin === "number"
                    ? { rpe: data.matchTypicalRPE, durationMin: data.matchTypicalDurationMin }
                    : undefined,
              };

              useExternalStore.setState({ clubTrainingDays: days, matchDays, matchDay, autoExternalConfig });
            },
            (err: unknown) => {
              const code = err != null && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
              if (code === "permission-denied" && !auth.currentUser) return;
              if (code === "permission-denied") return;
              if (__DEV__) console.warn("users/{uid} profile onSnapshot error:", err);
            }
          );

          const unsub = watchSessionsRepo(user.uid, (list) => {
            if (!_active) return;
            const normalized = normalizeSessionsFromFirestore(list);
            const normalizedIds = new Set(normalized.map((s) => s.id));

            useSessionsStore.setState((state) => {
              const local = state.sessions ?? [];
              const missingLocal = local.filter((s) => !normalizedIds.has(s.id));
              return { sessions: [...missingLocal, ...normalized] };
            });
            // Rebuild load from history after sessions change
            // Deferred import to avoid circular deps at module level
            import("../orchestrators/rebuildLoad").then((m) => m.rebuildLoad()).catch((err) => {
              if (__DEV__) console.error("[useSyncStore] rebuildLoad after Firestore sync failed:", err);
            });
          });

          const unsubPlanned = watchPlannedSessions(user.uid, (list) => {
            if (!_active) return;
            const today = toDateKey(todayISO());

            const incoming = (list ?? [])
              .filter((p) => {
                const dayKey = toDateKey((p.date ?? "").toString());
                return dayKey >= today;
              })
              .map((p): Session => ({
                id: p.id,
                date: p.date,
                dateISO: p.date,
                focus: p.focus as Session["focus"],
                phase: p.phase,
                intensity: p.intensity,
                volumeScore: p.plannedLoad ?? 0,
                exercises: (p.exercises ?? []) as Session["exercises"],
                completed: false,
                aiV2: p.ai as Record<string, unknown> | undefined,
              }));

            const incomingIds = new Set(incoming.map((p) => p.id));

            useSessionsStore.setState((state) => {
              const local = state.sessions ?? [];
              const completedLocalIds = new Set(
                local.filter((s) => s.completed).map((s) => s.id)
              );
              const completedDayKeys = new Set(
                local
                  .filter((s) => s.completed)
                  .map((s) => toDateKey((s.dateISO ?? s.date ?? "").toString()))
                  .filter(Boolean)
              );

              const planned = incoming
                .filter((p) => !completedLocalIds.has(p.id))
                .filter((p) => {
                  const dayKey = toDateKey((p.dateISO ?? "").toString());
                  return !completedDayKeys.has(dayKey);
                });

              const plannedIds = new Set(planned.map((p) => p.id));
              const nonPlanned = local.filter((s) => !plannedIds.has(s.id) && !incomingIds.has(s.id));
              return { sessions: [...planned, ...nonPlanned] };
            });
          });

          // Stockage dual : module-level (race-proof) + Zustand state (backward compat)
          _trackUnsub("sessions", unsub);
          _trackUnsub("planned", unsubPlanned);
          _trackUnsub("profile", unsubProfile);
          if (_active) {
            set({ _unsubSessions: unsub, _unsubPlanned: unsubPlanned, _unsubProfile: unsubProfile });
          }
        });

        _trackUnsub("auth", unsubAuth);
        if (_active) {
          set({ _unsubAuth: unsubAuth });
        }
      },

      resetForUser: async (uid) => {
        // Delegated to orchestrators/resetUser.ts for cross-store coordination.
        // This is a placeholder — the facade wires it up.
        const { resetForUser: doReset } = await import("../orchestrators/resetUser");
        await doReset(uid);
      },
    }),
    {
      name: "fks-sync-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        _currentUid: s._currentUid,
        plannedFksDays: s.plannedFksDays ?? [],
      }),
      onRehydrateStorage: () => () => { onStoreHydrated(); },
      migrate: (persisted) => persisted as SyncState,
    }
  )
);

export const getSyncDefaults = baseSyncState;
