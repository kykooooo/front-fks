// functions/tests/config.test.ts
// Verrou : la région DOIT rester alignée sur l'emplacement de la base Firestore
// `fks-apps/(default)` = europe-west4 (confirmé Codex, lecture seule). Un trigger
// v2 doit être co-localisé avec la base — ce test empêche une régression.

import { REGION, MIN_INSTANCES } from "../src/config";

describe("config", () => {
  it("REGION === 'europe-west4' (co-localisée avec la base Firestore)", () => {
    expect(REGION).toBe("europe-west4");
  });

  it("minInstances = 0 (scale-to-zero)", () => {
    expect(MIN_INSTANCES).toBe(0);
  });
});
