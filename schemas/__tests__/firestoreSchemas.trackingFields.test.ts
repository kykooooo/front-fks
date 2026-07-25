// schemas/__tests__/firestoreSchemas.trackingFields.test.ts
// Boucle de suivi (Lot 4, docs/boucle-suivi-2026-07-25/) : `execution` et
// `tracking` sont des champs OPTIONNELS ajoutes au doc `users/{uid}/sessions/{id}`.
// Ce fichier verifie que les vieux docs (sans ces champs) restent lisibles et
// que les nouveaux (avec) survivent au parse sans perte.
//
// Fichier separe de schemas/__tests__/firestoreSchemas.test.ts (existant,
// hors perimetre de ce lot) pour ne pas toucher a un fichier non explicitement
// autorise -- voir brief Lot 4.

import { completedSessionSchema } from "../firestoreSchemas";

describe("completedSessionSchema · execution/tracking (Lot 4)", () => {
  test("vieux doc SANS execution/tracking -> parse OK, champs absents (pas d'exception)", () => {
    const oldDoc = {
      date: "2026-07-01",
      dateISO: "2026-07-01T10:00:00.000Z",
      phase: "Construction",
      focus: "strength",
      intensity: "moderate",
      exercises: [],
      rpe: 7,
      feedback: { fatigue: 3, sleep: 3, pain: 0 },
    };
    const parsed = completedSessionSchema.parse(oldDoc);
    expect(parsed.execution).toBeUndefined();
    expect(parsed.tracking).toBeUndefined();
    expect(parsed.rpe).toBe(7);
  });

  test("nouveau doc AVEC execution + tracking -> les deux survivent tels quels au parse", () => {
    const execution = {
      version: 1,
      sessionId: "s1",
      fingerprint: "fp-1",
      snapshot: { sessionId: "s1", items: [] },
      items: [],
      startedAtISO: "2026-07-25T09:00:00.000Z",
      finishedAtISO: "2026-07-25T10:00:00.000Z",
      actualDurationMin: 55,
      allAsPlanned: true,
      completion: { pct: 100, done: 2, adapted: 0, skipped: 0, replacedEquivalent: 0, replacedPartial: 0, status: "full", mainReasons: [] },
    };
    const tracking = {
      version: 1,
      rulesVersion: "tracking-rules/1.0.0",
      decidedAtISO: "2026-07-25T10:00:00.000Z",
      kind: "continue_planned",
      targets: [],
      explanation: "Test.",
      signalsDigest: { completionRateAvg: 100, rpeDeltaAvg: 0, painActive: false, gapDays: 0, dataQuality: "ok" },
      mode: "shadow",
    };

    const doc = {
      date: "2026-07-25",
      dateISO: "2026-07-25T10:00:00.000Z",
      phase: "Progression",
      focus: "strength",
      intensity: "moderate",
      exercises: [],
      rpe: 7,
      execution,
      tracking,
    };

    const parsed = completedSessionSchema.parse(doc);
    expect(parsed.execution).toEqual(execution);
    expect(parsed.tracking).toEqual(tracking);
  });

  test("safeParse reste success meme avec execution/tracking de forme inattendue (jamais de crash)", () => {
    const res = completedSessionSchema.safeParse({
      date: "2026-07-25",
      execution: "not-an-object",
      tracking: 42,
    });
    expect(res.success).toBe(true);
  });
});
