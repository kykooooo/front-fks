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

    // `coachAccess` absent de la réponse = état INCONNU, jamais inventé.
    expect(res).toEqual({ ok: true, clubId: "clubX", clubName: "AS Test", alreadyMember: false, coachAccess: null });
    expect(mockCall).toHaveBeenCalledWith({ code: "ABCDEFGHJK" });
  });

  test("l'état d'accès du serveur est transmis tel quel — et lui seul", async () => {
    // Club en validation manuelle : le joueur est rattaché, son suivi attend.
    mockCall.mockResolvedValue({
      data: { clubId: "clubX", clubName: "AS Test", alreadyMember: false, coachAccess: "pending" },
    });
    const enAttente = await joinClubWithInviteCode("ABCDEFGHJK");
    expect(enAttente).toMatchObject({ ok: true, coachAccess: "pending" });

    // Valeur inconnue du contrat : deny-first, on ne la propage PAS.
    mockCall.mockResolvedValue({
      data: { clubId: "clubX", clubName: "AS Test", alreadyMember: false, coachAccess: "peut-etre" },
    });
    const exotique = await joinClubWithInviteCode("ABCDEFGHJK");
    expect(exotique).toMatchObject({ ok: true, coachAccess: null });
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

  // Le serveur répond désormais `permission-denied` pour TROIS causes qu'il
  // refuse de distinguer (pas coach / club disparu / identifiant malformé) :
  // les distinguer rouvrirait l'oracle d'existence de club fermé côté
  // Functions. La contrepartie est ici : le message affiché ne doit affirmer
  // AUCUNE des trois causes, et doit quand même donner un geste utile.
  test("refus d'émission : un seul message, qui n'affirme aucune cause", async () => {
    mockCall.mockRejectedValue(callableError("functions/permission-denied"));

    const res = await issueClubInviteCode("clubX");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("forbidden");
    // Le geste utile est donné…
    expect(res.message).toContain("Actualise l'écran");
    // …et aucune cause n'est affirmée : ni « tu n'es pas coach », ni « le club
    // n'existe pas ». Le coach dont le club a disparu ne doit pas être envoyé
    // chercher au mauvais endroit, et l'inverse non plus.
    expect(res.message).not.toContain("Seul le coach");
    expect(res.message).not.toMatch(/club est introuvable/i);
    // Et toujours : rien de la phrase Firebase n'atteint l'écran.
    expect(res.message).not.toContain("permissions");
    expect(res.message).not.toMatch(/[Mm]issing/);
  });

  test("callable absente / non déployée : message FR honnête, aucune exception", async () => {
    mockCall.mockRejectedValue(callableError("functions/not-found", "NOT_FOUND"));

    const res = await issueClubInviteCode("clubX");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inattendu");
    expect(res.reason).toBe("notFound");
    // `not-found` ne peut plus vouloir dire « club introuvable » côté émission :
    // le serveur ne le renvoie plus jamais pour ça. Le message ne doit donc pas
    // accuser le club, sinon il ment dans le seul cas qui reste (fonction
    // absente ou route inconnue).
    expect(res.message).not.toMatch(/club/i);
    expect(res.message).toContain("service d'invitation");
  });
});
