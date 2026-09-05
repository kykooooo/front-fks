// utils/__tests__/withTimeout.test.ts
//
// LE DÉLAI DE GARDE DES OVERLAYS BLOQUANTS (P1-05 / P1-27 inventaire clubs).
// Firestore hors-ligne laisse `setDoc` PENDANT indéfiniment (ack serveur
// requis, jamais de reject) : « Terminer » du setup et « Créer mon club »
// gelaient leur overlay à jamais. withTimeout borne l'attente sans annuler
// l'écriture (elle peut atterrir après coup, latency compensation — voulu).

import { readFileSync } from "fs";
import { resolve } from "path";
import { withTimeout, TimeoutError } from "../errorHandler";

describe("withTimeout — exécuté", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("résout normalement avant le délai", async () => {
    const p = withTimeout(Promise.resolve("ok"), 15000);
    await expect(p).resolves.toBe("ok");
  });

  test("rejette en TimeoutError quand la promesse pend (le cas Firestore hors-ligne)", async () => {
    const pendante = new Promise<never>(() => {}); // ni resolve ni reject, comme setDoc offline
    const p = withTimeout(pendante, 15000);
    const attente = expect(p).rejects.toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(15001);
    await attente;
  });

  test("propage un vrai échec tel quel (jamais maquillé en timeout)", async () => {
    const echec = Promise.reject(new Error("permission-denied"));
    await expect(withTimeout(echec, 15000)).rejects.toThrow("permission-denied");
  });

  test("le timer est nettoyé quand la promesse résout (pas de faux rejet tardif)", async () => {
    await withTimeout(Promise.resolve(1), 15000);
    jest.advanceTimersByTime(20000); // aucun unhandled rejection attendu
  });
});

describe("les deux overlays bloquants passent par le délai de garde (source)", () => {
  const racine = resolve(__dirname, "..", "..");
  const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

  test("setup profil : saveProfileThenAttachClub est borné, réponses conservées", () => {
    const source = lire("screens/ProfileSetupScreen.tsx");
    expect(source).toMatch(/withTimeout\(saveProfileThenAttachClub\(/);
    expect(source).toContain("Tes réponses sont conservées — réessaie dans un instant.");
    expect(source).toMatch(/error instanceof TimeoutError/);
  });

  test("création de club : createClubAsCoach est borné, saisie conservée", () => {
    const source = lire("screens/CoachOnboardingScreen.tsx");
    expect(source).toMatch(/withTimeout\(createClubAsCoach\(/);
    // Au timeout on ne SAIT pas si l'écriture est arrivée : le message ne
    // l'affirme plus (audit inscription 2026-09), et la saisie reste en place.
    expect(source).toContain("La création a peut-être abouti, on vérifie");
    expect(source).toContain("Ta saisie est conservée.");
    expect(source).toMatch(/error instanceof TimeoutError/);
  });
});
