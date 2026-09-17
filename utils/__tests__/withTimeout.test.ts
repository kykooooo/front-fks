// utils/__tests__/withTimeout.test.ts
//
// LE DÉLAI DE GARDE DE L'OVERLAY BLOQUANT DU SETUP (P1-05).
// Firestore hors-ligne laisse `setDoc` PENDANT indéfiniment (ack serveur
// requis, jamais de reject) : « Terminer » du setup gelait son overlay à
// jamais. withTimeout borne l'attente sans annuler l'écriture (elle peut
// atterrir après coup, latency compensation — voulu). L'autre overlay borné
// (« Créer mon club ») est parti avec l'espace coach (2026-09).

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

describe("l'overlay bloquant du setup passe par le délai de garde (source)", () => {
  const racine = resolve(__dirname, "..", "..");
  const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

  test("setup profil : l'écriture du profil est bornée à 15 s, la saisie conservée", () => {
    const source = lire("screens/ProfileSetupScreen.tsx");
    // L'écriture du profil : un dépassement remonte, et le message est juste.
    // L'écriture est passée à la finalisation (services/finalizeSetup) sous
    // forme de dépendance — toujours enveloppée par le délai de garde.
    expect(source).toMatch(/withTimeout\(setDoc\(/);
    expect(source).toMatch(/\{ merge: true \}\)\.then\(\(\) => undefined\), 15000\)/);
    expect(source).toContain("Tes réponses sont conservées — réessaie dans un instant.");
    expect(source).toMatch(/error instanceof TimeoutError/);
  });

  test("setup profil : plus aucun rattachement club n'est enchaîné à l'écriture", () => {
    // L'espace club est retiré (2026-09) : une seule dépendance réseau, une
    // seule borne. Aucune callable de rattachement ne peut plus geler l'écran.
    const source = lire("screens/ProfileSetupScreen.tsx");
    expect(source).not.toContain("saveProfileThenAttachClub");
    expect(source).not.toContain("joinClubWithInviteCode");
  });
});
