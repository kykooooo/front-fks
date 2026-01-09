import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import type { TrainingState } from "../types";
import type { StoreApi } from "zustand";

import { auth, db } from "../../../services/firebase";
import { addDaysISO, todayISO } from "../../../utils/virtualClock";

import {
  addPlannedSession,
  saveSession,
  watchSessions as watchSessionsRepo,
  watchPlannedSessions,
} from "../../../repositories/sessionsRepo";

import { isClubDay, normalizeSessionsFromFirestore } from "../helpers";

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
    delete rest.id;
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
      date: rest.dateISO,
      phase: rest.phase,
      focus: rest.focus,
      intensity: intensityPlanned,
      plannedLoad: plannedLoadSafe,
      exercises: rest.exercises,
    };

    if (aiPayload != null) firestorePlanned.ai = aiPayload;
    if (guardrailsApplied.length > 0) firestorePlanned.guardrailsApplied = guardrailsApplied;

    await addPlannedSession(uid, { ...firestorePlanned });
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
      const unsubProfile = onSnapshot(userRef, (snap) => {
        const data = snap.data();
        const days = Array.isArray(data?.clubTrainingDays) ? data!.clubTrainingDays : [];

        const matchDay = typeof data?.matchDay === "string" ? data!.matchDay : null;
        const matchDays = Array.isArray(data?.matchDays) ? data!.matchDays : matchDay ? [matchDay] : [];

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
      });

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

        const planned = (list ?? [])
          .filter((p) => !completedLocalIds.has(p.id)) // si déjà complété localement, ne réinjecte pas en "open"
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
