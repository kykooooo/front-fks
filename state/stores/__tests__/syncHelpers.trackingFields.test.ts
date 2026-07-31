// state/stores/__tests__/syncHelpers.trackingFields.test.ts
// Boucle de suivi (Lot 4) : execution/tracking doivent survivre au round-trip
// watcher Firestore -> normalizeSessionsFromFirestore -> store. Fichier separe
// de state/stores/__tests__/syncHelpers.test.ts (existant, hors perimetre de
// ce lot) pour ne pas toucher a un fichier non explicitement autorise.

import { normalizeSessionsFromFirestore } from "../syncHelpers";

describe("normalizeSessionsFromFirestore · execution/tracking (Lot 4)", () => {
  test("execution et tracking traversent la normalisation sans perte", () => {
    const execution = { version: 1, sessionId: "s1", fingerprint: "fp-1", completion: { pct: 100 } };
    const tracking = { version: 1, kind: "continue_planned", rulesVersion: "tracking-rules/1.0.0" };

    const [s] = normalizeSessionsFromFirestore([
      {
        id: "s1",
        date: "2026-07-25",
        rpe: 7,
        execution,
        tracking,
      },
    ]);

    expect(s.execution).toEqual(execution);
    expect(s.tracking).toEqual(tracking);
  });

  test("absents sur un vieux doc -> restent absents (pas de valeur fabriquee)", () => {
    const [s] = normalizeSessionsFromFirestore([{ id: "s2", date: "2026-06-01", rpe: 5 }]);
    expect(s.execution).toBeUndefined();
    expect(s.tracking).toBeUndefined();
  });
});
