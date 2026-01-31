import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import type { TrainingState } from "../types";
import type { StoreApi } from "zustand";

import { auth, db } from "../../../services/firebase";
import { addDaysISO, todayISO } from "../../../utils/virtualClock";

import {
  saveSession,
  watchSessions as watchSessionsRepo,
  watchPlannedSessions,
} from "../../../repositories/sessionsRepo";
import { savePlannedSessionToFirestore } from "../../../services/plannedSessionsRepo";

import { isClubDay, normalizeSessionsFromFirestore } from "../helpers";
import { toDayKey } from "../../../engine/dailyAggregation";

type SetFn = StoreApi<TrainingState>["setState"];
type GetFn = StoreApi<TrainingState>["getState"];

type FirestoreSlice = Pick<
  TrainingState,
  | "startFirestoreWatch"
  | "persistCompletedSession"
  | "persistPlannedSession"
>;

export const createFirestoreSlice = (set: SetFn, get: GetFn): FirestoreSlice => ({
 


  persistPlannedSession: async (payload) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const rest = { ...payload } as any;
    const sessionId = rest.id ?? null;
    const aiPayload = (rest as any).ai ?? (rest as any).aiV2;

    const tsb = get().tsb ?? 0;
    const clubDays = get().clubTrainingDays ?? [];

    const plannedDateKey = rest.dateISO?.slice(0, 10) ?? todayISO();
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

    const firestorePlanned: any = {
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

    const completedPayload: any = {
      date: s.dateISO,
      phase: s.phase as any,
      focus: s.focus as any,
      intensity: s.intensity as any,
      exercises: s.exercises,
      rpe: s.rpe,
    };

    if (s.feedback) {
      const fb: any = {
        fatigue: s.feedback.fatigue,
        sleep: s.feedback.sleep,
        pain: s.feedback.pain,
      };
      if ((s as any).ai != null) fb.ai = (s as any).ai;
      completedPayload.feedback = fb;
    }

    await saveSession(uid, s.id, completedPayload as any);

    const microcycleGoal = typeof get().microcycleGoal === "string" ? get().microcycleGoal?.trim() : null;
    const microcycleSessionIndex =
      typeof get().microcycleSessionIndex === "number" && Number.isFinite(get().microcycleSessionIndex)
        ? Math.max(0, Math.trunc(get().microcycleSessionIndex))
        : 0;
    const lastSessionDate =
      typeof s.dateISO === "string"
        ? s.dateISO
        : typeof (s as any).date === "string"
          ? (s as any).date
          : null;

    const userPatch: Record<string, any> = {
      updatedAt: serverTimestamp(),
      lastSessionDate: lastSessionDate ?? null,
      lastSessionAt: serverTimestamp(),
    };
    if (microcycleGoal) userPatch.microcycleGoal = microcycleGoal;
    userPatch.microcycleSessionIndex = microcycleSessionIndex;

    await setDoc(doc(db, "users", uid), userPatch, { merge: true });
  },

  startFirestoreWatch: () => {
    const st = get();
    if (st._unsubAuth) return;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (get()._unsubSessions) {
        get()._unsubSessions!();
        set({ _unsubSessions: undefined });
      }
      if ((get() as any)._unsubPlanned) {
        (get() as any)._unsubPlanned!();
        set({ _unsubPlanned: undefined } as any);
      }
      if (get()._unsubProfile) {
        get()._unsubProfile!();
        set({ _unsubProfile: undefined });
      }

      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          const data = snap.data();
          const days = Array.isArray(data?.clubTrainingDays) ? data!.clubTrainingDays : [];

          const matchDay = typeof data?.matchDay === "string" ? data!.matchDay : null;
          const matchDays = Array.isArray(data?.matchDays) ? data!.matchDays : matchDay ? [matchDay] : [];

          const goalRaw =
            typeof (data as any)?.microcycleGoal === "string"
              ? String((data as any).microcycleGoal)
              : typeof (data as any)?.programGoal === "string"
                ? String((data as any).programGoal)
                : typeof (data as any)?.goal === "string"
                  ? String((data as any).goal)
                  : null;
          const goal = goalRaw?.trim() ? goalRaw.trim() : null;
          if (get().setMicrocycleGoal) {
            get().setMicrocycleGoal(goal);
          }

          const autoExternalConfig = {
            club:
              typeof data?.clubTypicalRPE === "number" && typeof data?.clubTypicalDurationMin === "number"
                ? { rpe: data!.clubTypicalRPE, durationMin: data!.clubTypicalDurationMin }
                : undefined,
            match:
              typeof data?.matchTypicalRPE === "number" && typeof data?.matchTypicalDurationMin === "number"
                ? { rpe: data!.matchTypicalRPE, durationMin: data!.matchTypicalDurationMin }
                : undefined,
          };

          set({ clubTrainingDays: days, matchDays, matchDay, autoExternalConfig });
        },
        (err: any) => {
          // Peut arriver pendant une déconnexion: le listener reçoit un dernier event sans droits.
          if (err?.code === "permission-denied" && !auth.currentUser) return;
          if (err?.code === "permission-denied") return;
          console.warn("users/{uid} profile onSnapshot error:", err);
        }
      );

      const unsub = watchSessionsRepo(user.uid, (list: any[]) => {
        const normalized = normalizeSessionsFromFirestore(list);

        const local = get().sessions ?? [];
        const missingLocal = local.filter((s) => !normalized.some((r) => r.id === s.id));

        set({ sessions: [...missingLocal, ...normalized] });
        get()._rebuildLoadFromHistory?.();
      });

      const unsubPlanned = watchPlannedSessions(user.uid, (list: any[]) => {
        const local = get().sessions ?? [];
        const completedLocalIds = new Set(local.filter((s: any) => s.completed).map((s: any) => s.id));
        const completedDayKeys = new Set(
          local
            .filter((s: any) => s.completed)
            .map((s: any) => toDayKey((s.dateISO ?? s.date ?? "").toString()))
            .filter(Boolean)
        );

        const planned = (list ?? [])
          .filter((p) => !completedLocalIds.has(p.id)) // si déjà complété localement, ne réinjecte pas en "open"
          .filter((p) => {
            const dayKey = toDayKey((p.date ?? p.dateISO ?? "").toString());
            return !completedDayKeys.has(dayKey);
          })
          .map((p) => ({
            id: p.id,
            dateISO: p.date,
            focus: p.focus,
            phase: p.phase,
            intensity: p.intensity,
            volumeScore: p.plannedLoad ?? 0,
            exercises: p.exercises ?? [],
            completed: false,
            aiV2: p.ai,
          })) as any[];

        // garde tout ce qui n'est pas planifié (ou déjà complété)
        const nonPlanned = local.filter((s: any) => s.completed || !list.some((p) => p.id === s.id));
        set({ sessions: [...planned, ...nonPlanned] });
      });

      set({ _unsubSessions: unsub, _unsubPlanned: unsubPlanned, _unsubProfile: unsubProfile } as any);
    });

    set({ _unsubAuth: unsubAuth });
  },
});
