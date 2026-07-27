// services/__tests__/clubInvites.test.ts
//
// Ce que ces tests protègent :
//  1. LE FRONT NE JUGE PAS UN CODE. Il transmet la saisie et n'invente aucun
//     verdict local — plus de « code trop court », plus de « club introuvable »
//     décidé sans le serveur.
//  2. AUCUN MESSAGE FIREBASE N'ATTEINT L'ÉCRAN. Le défaut relevé par l'audit
//     (un joueur français lisant « Missing or insufficient permissions ») est
//     couvert : quel que soit le message de l'erreur, la phrase affichée vient
//     d'ici, en français.
//  3. RIEN NE LÈVE. Ces fonctions sont appelées au milieu d'un parcours
//     d'inscription : une exception qui remonte ferait perdre la saisie.

const mockCall = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCall);

jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({ __fake: "functions" })),
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...(args as [])),
}));

jest.mock("../firebase", () => ({ app: {}, auth: {}, db: {} }));

import {
  issueClubInviteCode,
  joinClubWithInviteCode,
  normalizeInviteCodeInput,
  readFailureReason,
} from "../clubInvites";

/** Erreur telle que la produit le SDK callable. */
const callableError = (code: string, message = "Missing or insufficient permissions.") => {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
};

beforeEach(() => {
  mockCall.mockReset();
  mockHttpsCallable.mockClear();
});

describe("normalizeInviteCodeInput — transport, pas validation", () => {
  test("majuscules, tirets et espaces retirés ; ne juge jamais la longueur", () => {
    expect(normalizeInviteCodeInput(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCodeInput("abcde fghjk")).toBe("ABCDEFGHJK");
    // Une saisie manifestement trop courte est transmise quand même : c'est le
    // serveur qui tranche, jamais l'application.
    expect(normalizeInviteCodeInput("ab")).toBe("AB");
  });
});

describe("readFailureReason — lecture du CODE d'erreur, jamais du message", () => {
  test("codes callables mappés", () => {
    expect(readFailureReason(callableError("functions/permission-denied"))).toBe("rejected");
    expect(readFailureReason(callableError("functions/resource-exhausted"))).toBe("rateLimited");
    expect(readFailureReason(callableError("functions/unauthenticated"))).toBe("unauthenticated");
    expect(readFailureReason(callableError("functions/not-found"))).toBe("notFound");
    expect(readFailureReason(callableError("functions/internal"))).toBe("unavailable");
    expect(readFailureReason(new Error("réseau"))).toBe("unavailable");
    expect(readFailureReason(null)).toBe("unavailable");
  });
});

describe("joinClubWithInviteCode", () => {
  test("succès : club renvoyé par le serveur, code normalisé transmis", async () => {
    mockCall.mockResolvedValue({ data: { clubId: "clubX", clubName: "AS Test", alreadyMember: false } });

    const res = await joinClubWithInviteCode(" abcde-fghjk ");

    expect(res).toEqual({ ok: true, clubId: "clubX", clubName: "AS Test", alreadyMember: false });
    expect(mockCall).toHaveBeenCalledWith({ code: "ABCDEFGHJK" });
  });

  test("refus serveur : message FRANÇAIS maison, jamais la phrase Firebase", async () => {
    mockCall.mockRejectedValue(callableError("functions/permission-denied"));

    const res = await joinClubWithInviteCode("ABCDEFGHJK");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("rejected");
    expect(res.message).toContain("Ce code n'est pas valide");
    expect(res.message).not.toContain("permissions");
    expect(res.message).not.toMatch(/[Mm]issing/);
  });

  test("trop de tentatives : message dédié, pas un « code invalide » trompeur", async () => {
    mockCall.mockRejectedValue(callableError("functions/resource-exhausted", "Too many attempts"));

    const res = await joinClubWithInviteCode("ABCDEFGHJK");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("rateLimited");
    expect(res.message).toContain("Trop de tentatives");
  });

  test("panne réseau : ne lève jamais, et n'accuse pas le code", async () => {
    mockCall.mockRejectedValue(new Error("network request failed"));

    const res = await joinClubWithInviteCode("ABCDEFGHJK");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("unavailable");
    expect(res.message).toContain("Vérifie ta connexion");
  });

  test("réponse serveur incomplète : traitée comme indisponible, jamais comme un succès", async () => {
    mockCall.mockResolvedValue({ data: { clubName: "AS Test" } });

    const res = await joinClubWithInviteCode("ABCDEFGHJK");

    expect(res.ok).toBe(false);
  });
});

describe("issueClubInviteCode", () => {
  test("succès : code affichable + validité + quota remontés tels quels", async () => {
    mockCall.mockResolvedValue({
      data: { code: "ABCDE-FGHJK", expiresAt: 123, maxUses: 30, replacedPrevious: true },
    });

    const res = await issueClubInviteCode("clubX");

    expect(res).toEqual({
      ok: true,
      code: "ABCDE-FGHJK",
      expiresAt: 123,
      maxUses: 30,
      replacedPrevious: true,
    });
    expect(mockCall).toHaveBeenCalledWith({ clubId: "clubX" });
  });

  test("refus de droits : message coach explicite (ici, il n'y a rien à deviner)", async () => {
    mockCall.mockRejectedValue(callableError("functions/permission-denied"));

    const res = await issueClubInviteCode("clubX");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("forbidden");
    expect(res.message).toContain("Seul le coach");
  });

  test("fonction indisponible / non déployée : message FR, aucune exception", async () => {
    mockCall.mockRejectedValue(callableError("functions/not-found", "NOT_FOUND"));

    const res = await issueClubInviteCode("clubX");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.message).toContain("introuvable");
  });
});
