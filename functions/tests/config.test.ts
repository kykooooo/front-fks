// functions/tests/config.test.ts
// Verrou : la région DOIT rester alignée sur l'emplacement de la base Firestore
// `fks-apps/(default)` = europe-west4 (confirmé Codex, lecture seule). Un trigger
// v2 doit être co-localisé avec la base — ce test empêche une régression.

import { REGION, MIN_INSTANCES, SESSION_FETCH_LIMIT } from "../src/config";
import { ACTIVITY_MAX_DATES } from "../src/projector";

describe("config", () => {
  it("REGION === 'europe-west4' (co-localisée avec la base Firestore)", () => {
    expect(REGION).toBe("europe-west4");
  });

  it("minInstances = 0 (scale-to-zero)", () => {
    expect(MIN_INSTANCES).toBe(0);
  });

  // Verrou : si quelqu'un rebaisse la limite de lecture, la fenêtre d'activité
  // serait TRONQUÉE en silence — le coach lirait "3 séances" là où il y en a 8.
  it("SESSION_FETCH_LIMIT couvre la fenêtre d'activité projetée", () => {
    expect(SESSION_FETCH_LIMIT).toBeGreaterThanOrEqual(ACTIVITY_MAX_DATES);
    expect(SESSION_FETCH_LIMIT).toBe(20);
  });
});
