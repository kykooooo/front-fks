// functions/tests/integration/emulatorHelper.ts
// Utilitaires partagés pour les tests d'intégration contre l'émulateur Firestore.
// Projet DEMO local uniquement. Aucune donnée réelle, aucun credential.

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { explicitWatermark, type EventWatermark } from "../../src/watermark";

export const PROJECT_ID = process.env.GCLOUD_PROJECT || "demo-fks-functions";

/** Watermark de test depuis un nombre de ms (+ id optionnel pour tie-break). */
export function wm(ms: number, id = "evt"): EventWatermark {
  return explicitWatermark(new Date(ms).toISOString(), id);
}

/** Firestore admin pointé sur l'émulateur (FIRESTORE_EMULATOR_HOST posé par emulators:exec). */
export function testDb(): Firestore {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}

/** Vide toute la base de l'émulateur (endpoint REST dédié). */
export async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("FIRESTORE_EMULATOR_HOST manquant — lancer via `firebase emulators:exec --only firestore`.");
  const url = `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`clearFirestore a échoué (${res.status})`);
}

/** Jeu de données brut avec sensible VOLONTAIRE (preuve : ne doit jamais fuiter). */
export async function seedClubA(db: Firestore): Promise<void> {
  await db.doc("clubs/clubA").set({ name: "Club A", ownerUid: "coachA", teamGender: "female" });
  await db.doc("clubs/clubA/members/coachA").set({ uid: "coachA", role: "coach" });
  await db.doc("clubs/clubA/members/playerA1").set({ uid: "playerA1", role: "player" });
  await db.doc("clubs/clubA/members/playerA2").set({ uid: "playerA2", role: "player" });

  await db.doc("users/coachA").set({ uid: "coachA", clubId: "clubA", role: "coach", firstName: "CoachA", profileCompleted: true });
  await db.doc("users/playerA1").set({
    uid: "playerA1", clubId: "clubA", role: "player", firstName: "Anna",
    position: "Milieu", level: "Regional", ageCategory: "U15", profileCompleted: true,
  });
  await db.doc("users/playerA2").set({
    uid: "playerA2", clubId: "clubA", role: "player", firstName: "Bea", ageCategory: "U15", profileCompleted: true,
  });

  // Séance FAITE de playerA1 — sensible injecté volontairement.
  await db.doc("users/playerA1/sessions/s1").set({
    date: "2026-06-28",
    dateISO: "2026-06-28",
    title: "Renfo bas du corps",
    intensity: "moderate",
    focus: "strength",
    rpe: 8,
    feedback: { pain: 3, comment: "mal au genou depuis samedi", fatigue: 4, sleep: 2, rpe: 8, durationMin: 40 },
    metrics: { atl: 55.1, ctl: 40.9, tsb: -14.2 },
    aiV2: { title: "Renfo bas du corps", focusPrimary: "strength", intensity: "moderate", blocks: [{}, {}, {}, {}], guardrailsApplied: ["team:female_neuromuscular_focus"] },
  });
}
