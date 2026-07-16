// state/stores/__tests__/syncHelpers.test.ts
//
// AUDIT P1-4 — microcycleSessionIndex était write-only vers Firestore :
// persisté au feedback (persistCompletedSession) mais jamais relu par le
// watcher profil → réinstallation / nouveau device = progression 0/12.
// La réconciliation prend max(local, distant) : le doc profil peut retarder
// (écriture échouée hors-ligne), une valeur distante périmée ne doit jamais
// rétrograder une progression locale plus avancée.

import { reconcileMicrocycleSessionIndex, normalizeSessionsFromFirestore } from "../syncHelpers";

describe("reconcileMicrocycleSessionIndex (P1-4)", () => {
  test("REPRO AUDIT : réinstallation (local 0, distant 5) → 5, plus de retour à 0/12", () => {
    expect(reconcileMicrocycleSessionIndex(0, 5)).toBe(5);
  });

  test("doc profil en retard (local 5, distant 3) → 5 (jamais de rétrogradation)", () => {
    expect(reconcileMicrocycleSessionIndex(5, 3)).toBe(5);
  });

  test("égalité → la valeur commune (le caller n'applique que si != local)", () => {
    expect(reconcileMicrocycleSessionIndex(4, 4)).toBe(4);
  });

  test("bornes valides : 0 et 12 acceptés", () => {
    expect(reconcileMicrocycleSessionIndex(0, 0)).toBe(0);
    expect(reconcileMicrocycleSessionIndex(0, 12)).toBe(12);
  });

  test("distant invalide → null (ignoré) : non-nombre, non-entier, négatif, > 12", () => {
    expect(reconcileMicrocycleSessionIndex(5, undefined)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, null)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, "7")).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, 3.5)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, -1)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, 13)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(5, Number.NaN)).toBeNull();
  });

  test("local inexploitable → traité comme 0 (le distant valide s'applique)", () => {
    expect(reconcileMicrocycleSessionIndex(undefined, 7)).toBe(7);
    expect(reconcileMicrocycleSessionIndex(Number.NaN, 7)).toBe(7);
  });

  test("local décimal/négatif normalisé avant le max", () => {
    expect(reconcileMicrocycleSessionIndex(5.9, 3)).toBe(5);
    expect(reconcileMicrocycleSessionIndex(-2, 3)).toBe(3);
  });

  test("total personnalisé : distant hors borne ignoré", () => {
    expect(reconcileMicrocycleSessionIndex(1, 7, 6)).toBeNull();
    expect(reconcileMicrocycleSessionIndex(1, 6, 6)).toBe(6);
  });
});

describe("normalizeSessionsFromFirestore — champs de charge préservés", () => {
  test("durationMin top-level et feedback traversent la normalisation (P1-1)", () => {
    const [s] = normalizeSessionsFromFirestore([
      {
        id: "s1",
        date: "2026-07-16",
        durationMin: 60,
        feedback: { rpe: 7, fatigue: 3, sleep: 3, pain: 0, durationMin: 60 },
      },
    ]);
    expect(s.durationMin).toBe(60);
    expect(s.feedback?.durationMin).toBe(60);
    expect(s.completed).toBe(true); // feedback présent → complétée
  });
});
