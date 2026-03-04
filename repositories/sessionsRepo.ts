// repositories/sessionsRepo.ts
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
  } from 'firebase/firestore';
  import { db } from '../services/firebase';
  import type { Phase } from '../domain/types';
  import { completedSessionSchema, plannedSessionSchema, logValidationIssues } from '../schemas/firestoreSchemas';
  
  /** ——— Exercices "simples" (ton type peut remplacer celui-ci si tu en as déjà un) ——— */
  export type Exercise = {
    id?: string;
    name: string;
    modality?: 'run' | 'strength' | 'speed' | 'circuit' | 'plyo' | 'mobility' | 'core' | string;
    sets?: number;
    reps?: number;
    durationSec?: number;
    restSec?: number;
    notes?: string;
  };
  
  /** ——— Blueprint IA (d’après tes captures) ——— */
  export type AiTimerPreset = { label: string; work_s: number; rest_s: number; rounds?: number };
  export type AiBlockItem = { name: string; reps?: number; work_s?: number; rest_s?: number };
  export type AiBlock = {
    id?: string;
    type: string;                 // "mobility", "strength", …
    goal?: string;
    duration_min?: number;
    items?: AiBlockItem[];
  };
  
  export type AiEstimatedLoad = { srpe?: number; notes?: string };
  
  export type AiNextSession = {
    version: string;              // "fks.next_session.v2"
    title?: string;
    subtitle?: string;
    intensity?: 'easy' | 'moderate' | 'hard';
    focus_primary?: 'mobility' | 'strength' | 'speed' | 'circuit' | 'plyo' | 'run' | string;
    focus_secondary?: string;
    duration_min?: number;
    rpe_target?: number;
    estimated_load?: AiEstimatedLoad;
    location?: string;
    equipment_used?: string[];
    badges?: string[];
    blocks?: AiBlock[];
    safety_notes?: string;
    guardrails_applied?: string[];
    coaching_tips?: string[];
    post_session?: { cooldown_min?: number; mobility?: string[] };
    recovery_tips?: string[];
    display?: {
      color_theme?: string;
      icon?: string;
      timer_presets?: AiTimerPreset[];
    };
    analytics?: {
      target_metrics?: { total_reps?: number };
      rationale?: string;
    };
  
    /** brut du modèle */
    raw?: {
      output_text?: string;       // texte complet (JSON stringify)
      output_parsed?: Record<string, any>; // l’objet JSON parsé si tu veux le garder
    };
  };
  
  /** ——— Planned / Completed dans Firestore ——— */
  export type PlannedSession = {
    id?: string;
    userId: string;
    date: string; // "YYYY-MM-DD"
    phase: Phase;
    focus: 'run' | 'strength' | 'speed' | 'circuit' | 'plyo' | 'mobility';
    intensity: 'easy' | 'moderate' | 'hard';
    plannedLoad: number;
    exercises: Exercise[];
    /** Blueprint IA complet */
    ai?: AiNextSession;
    createdAt?: Timestamp;
  };
  
export type CompletedSession = PlannedSession & {
  completedAt?: Timestamp;
  rpe?: number;
  feedback?: {
    fatigue?: number; // 1–5
    sleep?: number;   // 1–5
    pain?: number;    // 0–10
    notes?: string;
  };
};
  
  /** ——— users/{uid}/plannedSessions ——— */
  export async function addPlannedSession(
    userId: string,
    planned: Omit<PlannedSession, 'userId' | 'createdAt' | 'id'>
  ): Promise<string> {
    const colRef = collection(db, 'users', userId, 'plannedSessions');
  
    // ⚠️ Firestore limite un doc à ~1 MiB. Évite de mettre deux fois le même contenu dans ai.raw.*
    const docRef = await addDoc(colRef, {
      ...planned,
      userId,
      createdAt: serverTimestamp(),
    });
  
    // Optionnel: écrire l'id pour faciliter les requêtes/display
    await setDoc(doc(db, 'users', userId, 'plannedSessions', docRef.id), { id: docRef.id }, { merge: true });
    return docRef.id;
  }
  
  /** ——— users/{uid}/sessions ——— */
  export async function saveSession(
    userId: string,
    sessionId: string,
    data: Omit<CompletedSession, 'userId' | 'id' | 'createdAt'>
  ) {
    const ref = doc(db, 'users', userId, 'sessions', sessionId);
    await setDoc(
      ref,
      {
        ...data,
        userId,
        completedAt: (data as any).completedAt ?? serverTimestamp(),
      },
      { merge: true }
    );
  }
  
  /** ——— Watch par utilisateur ——— */
export function watchSessions(
  userId: string,
  cb: (sessions: (CompletedSession & { id: string })[]) => void
) {
  const col = collection(db, 'users', userId, 'sessions');
  const q = query(col, orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        const parsed = completedSessionSchema.safeParse(raw);
        if (!parsed.success) {
          logValidationIssues("completedSession", d.id, parsed.error.issues);
        }
        return {
          ...(parsed.success ? parsed.data : completedSessionSchema.parse({})),
          id: d.id,
        } as CompletedSession & { id: string };
      });
      cb(items);
    },
    (err) => {
      if (err?.code === 'permission-denied') return;
      if (__DEV__) {
        console.warn('watchSessions error:', err);
      }
    }
  );
}

/** ——— Watch plannedSessions (non complétées) ——— */
export function watchPlannedSessions(
  userId: string,
  cb: (sessions: (PlannedSession & { id: string })[]) => void
) {
  const col = collection(db, 'users', userId, 'plannedSessions');
  const q = query(col, orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        const parsed = plannedSessionSchema.safeParse(raw);
        if (!parsed.success) {
          logValidationIssues("plannedSession", d.id, parsed.error.issues);
        }
        return {
          ...(parsed.success ? parsed.data : plannedSessionSchema.parse({})),
          id: d.id,
        } as PlannedSession & { id: string };
      });
      cb(items);
    },
    (err) => {
      if (err?.code === 'permission-denied') return;
      if (__DEV__) {
        console.warn('watchPlannedSessions error:', err);
      }
    }
  );
}

  /** ——— (optionnel) si tu as des collections racine ——— */
  export function watchSessionsByUserIdRoot(
    userId: string,
    cb: (sessions: (CompletedSession & { id: string })[]) => void
  ) {
    const col = collection(db, 'sessions');
    const q = query(col, where('userId', '==', userId), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const raw = d.data();
          const parsed = completedSessionSchema.safeParse(raw);
          if (!parsed.success) {
            logValidationIssues("completedSession (root)", d.id, parsed.error.issues);
          }
          return {
            ...(parsed.success ? parsed.data : completedSessionSchema.parse({})),
            id: d.id,
          } as CompletedSession & { id: string };
        });
        cb(items);
      },
      (err) => {
        if (err?.code === 'permission-denied') return;
        if (__DEV__) {
          console.warn('watchSessionsByUserIdRoot error:', err);
        }
      }
    );
  }
  
