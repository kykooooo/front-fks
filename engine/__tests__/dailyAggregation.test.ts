// engine/__tests__/dailyAggregation.test.ts
//
// AUDIT P1-1 — la durée saisie au feedback était perdue à l'aller-retour
// Firestore : le payload n'écrivait pas durationMin top-level (seulement
// feedback.durationMin) et estimateDurationMin ne lisait QUE le top-level
// avant de retomber sur la somme des durationSec des exos (fallback 30).
// Résultat : après remplacement de la session locale par la version Firestore
// (watcher sessions), une séance force de 60 min réelles pesait ~30 min.
//
// Ces tests verrouillent le round-trip COMPLET :
// session locale → buildCompletedSessionFirestorePayload → completedSessionSchema
// → normalizeSessionsFromFirestore → estimateDurationMin.

import { estimateDurationMin, sumDailyWeightedLoad } from "../dailyAggregation";
import { buildCompletedSessionFirestorePayload } from "../../state/stores/persistHelpers";
import { completedSessionSchema } from "../../schemas/firestoreSchemas";
import { normalizeSessionsFromFirestore } from "../../state/stores/syncHelpers";
import type { Session, SessionFeedback } from "../../domain/types";

const makeSession = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    date: "2026-07-16",
    dateISO: "2026-07-16T10:00:00.000Z",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: true,
    rpe: 7,
    feedback: {
      rpe: 7,
      fatigue: 3,
      sleep: 3,
      pain: 0,
      durationMin: 60,
      createdAt: "2026-07-16T11:00:00.000Z",
    } as SessionFeedback,
    ...over,
  } as Session);

/** Simule le trajet Firestore complet : write → parse Zod → normalisation watcher. */
function roundTrip(local: Session): Session {
  const payload = buildCompletedSessionFirestorePayload(local);
  const parsed = completedSessionSchema.parse(payload);
  const [restored] = normalizeSessionsFromFirestore([{ ...parsed, id: local.id }]);
  return restored;
}

describe("estimateDurationMin — priorités de lecture", () => {
  test("durationMin top-level prioritaire", () => {
    expect(estimateDurationMin(makeSession({ durationMin: 60 }))).toBe(60);
  });

  test("second recours : feedback.durationMin (docs écrits avant le fix)", () => {
    const s = makeSession({ durationMin: undefined });
    expect(s.feedback?.durationMin).toBe(60);
    // Avant le fix : 30 (fallback exos vides) — la charge force était divisée par 2.
    expect(estimateDurationMin(s)).toBe(60);
  });

  test("sans aucune durée : somme des durationSec des exos", () => {
    const s = makeSession({
      durationMin: undefined,
      feedback: { rpe: 7, fatigue: 3, sleep: 3, pain: 0, createdAt: "x" } as SessionFeedback,
      exercises: [
        { id: "e1", name: "Squat", modality: "strength", durationSec: 600 },
        { id: "e2", name: "Fentes", modality: "strength", durationSec: 300 },
      ] as Session["exercises"],
    });
    expect(estimateDurationMin(s)).toBe(15);
  });

  test("fallback minimaliste 30 si rien d'exploitable", () => {
    const s = makeSession({
      durationMin: undefined,
      feedback: { rpe: 7, fatigue: 3, sleep: 3, pain: 0, createdAt: "x" } as SessionFeedback,
      exercises: [],
    });
    expect(estimateDurationMin(s)).toBe(30);
  });
});

describe("round-trip Firestore complet (AUDIT P1-1)", () => {
  test("REPRO AUDIT : 60 min saisies au feedback survivent au round-trip (avant : ~30)", () => {
    const local = makeSession({ durationMin: 60 });
    const restored = roundTrip(local);

    expect(restored.durationMin).toBe(60);
    expect(restored.feedback?.durationMin).toBe(60);
    expect(estimateDurationMin(restored)).toBe(60);
  });

  test("doc legacy (écrit AVANT le fix, sans top-level) : feedback.durationMin sauve la mise", () => {
    // Simule un doc Firestore historique : pas de durationMin top-level.
    const legacyDoc = {
      date: "2026-07-16T10:00:00.000Z",
      dateISO: "2026-07-16T10:00:00.000Z",
      phase: "Construction",
      focus: "strength",
      intensity: "moderate",
      exercises: [],
      rpe: 7,
      feedback: { rpe: 7, fatigue: 3, sleep: 3, pain: 0, durationMin: 60 },
    };
    const parsed = completedSessionSchema.parse(legacyDoc);
    const [restored] = normalizeSessionsFromFirestore([{ ...parsed, id: "old" }]);

    expect(estimateDurationMin(restored)).toBe(60);
  });

  test("la charge journalière ne retombe plus à ~moitié après le round-trip", () => {
    const local = makeSession({ durationMin: 60 });
    const restored = roundTrip(local);

    const before = sumDailyWeightedLoad([local]);
    const after = sumDailyWeightedLoad([restored]);
    expect(after).toEqual(before);
  });

  test("valeur corrompue (string) dans Firestore : ignorée, fallback propre", () => {
    const corruptDoc = {
      date: "2026-07-16",
      phase: "Construction",
      focus: "strength",
      intensity: "moderate",
      exercises: [],
      rpe: 7,
      durationMin: "soixante",
      feedback: { rpe: 7, fatigue: 3, sleep: 3, pain: 0, durationMin: 60 },
    };
    const parsed = completedSessionSchema.parse(corruptDoc);
    expect(parsed.durationMin).toBeUndefined();
    const [restored] = normalizeSessionsFromFirestore([{ ...parsed, id: "c1" }]);
    expect(estimateDurationMin(restored)).toBe(60); // second recours
  });
});
