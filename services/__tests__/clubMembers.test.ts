// services/__tests__/clubMembers.test.ts
//
// Ce que ces tests protègent :
//  1. LE FRONT NE JUGE PAS LE GESTE. Il ne devine pas les droits, il n'anticipe
//     aucun refus : il transmet et affiche la réponse du serveur.
//  2. AUCUN MESSAGE FIREBASE N'ATTEINT L'ÉCRAN. Quelle que soit la phrase portée
//     par l'erreur (elle arrive en anglais), le texte affiché vient d'ici.
//  3. LE SEUL REFUS PARLANT EST RECONNU AU JETON. `OWNER_TRANSFER_REQUIRED` est
//     le seul cas où le message nomme la cause, parce qu'il indique le geste à
//     faire. Il est reconnu par `details.reason`, pas par le code d'erreur seul.
//  4. RIEN NE LÈVE. Un refus ne doit pas démonter la fiche joueur.

const mockCall = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCall);

jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({ __fake: "functions" })),
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...(args as [])),
}));

jest.mock("../firebase", () => ({ app: {}, auth: {}, db: {} }));

import {
  OWNER_TRANSFER_REQUIRED,
  readRemoveFailureReason,
  removeClubMember,
} from "../clubMembers";

/** Erreur telle que la produit le SDK callable. */
const callableError = (
  code: string,
  details?: unknown,
  message = "Missing or insufficient permissions.",
) => {
  const err = new Error(message) as Error & { code: string; details?: unknown };
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
};

beforeEach(() => {
  mockCall.mockReset();
  mockHttpsCallable.mockClear();
});

describe("readRemoveFailureReason — lecture du CODE et du JETON, jamais du message", () => {
  test("le jeton OWNER_TRANSFER_REQUIRED prime sur tout le reste", () => {
    expect(
      readRemoveFailureReason(
        callableError("functions/failed-precondition", { reason: OWNER_TRANSFER_REQUIRED }),
      ),
    ).toBe("ownerTransferRequired");
    // Même jeton porté avec un autre code : reconnu quand même. C'est le jeton
    // qui fait foi, pas le code — un code peut resservir, un jeton non.
    expect(
      readRemoveFailureReason(
        callableError("functions/internal", { reason: OWNER_TRANSFER_REQUIRED }),
      ),
    ).toBe("ownerTransferRequired");
  });

  test("`failed-precondition` SANS jeton ne prétend rien : refus générique", () => {
    expect(readRemoveFailureReason(callableError("functions/failed-precondition"))).toBe("denied");
    expect(
      readRemoveFailureReason(callableError("functions/failed-precondition", { reason: "autre" })),
    ).toBe("denied");
  });

  test("les autres codes callables sont mappés", () => {
    expect(readRemoveFailureReason(callableError("functions/permission-denied"))).toBe("denied");
    expect(readRemoveFailureReason(callableError("functions/not-found"))).toBe("notMember");
    expect(readRemoveFailureReason(callableError("functions/unauthenticated"))).toBe(
      "unauthenticated",
    );
    expect(readRemoveFailureReason(callableError("functions/invalid-argument"))).toBe("notFound");
    expect(readRemoveFailureReason(callableError("functions/internal"))).toBe("unavailable");
    expect(readRemoveFailureReason(new Error("réseau"))).toBe("unavailable");
    expect(readRemoveFailureReason(null)).toBe("unavailable");
  });

  test("des `details` mal formés ne font pas planter la lecture", () => {
    for (const details of [null, "OWNER_TRANSFER_REQUIRED", 42, [OWNER_TRANSFER_REQUIRED], {}]) {
      expect(readRemoveFailureReason(callableError("functions/permission-denied", details))).toBe(
        "denied",
      );
    }
  });
});

describe("removeClubMember", () => {
  test("succès : les identifiants sont transmis TELS QUELS au serveur", async () => {
    mockCall.mockResolvedValue({ data: { alreadyRemoved: false } });

    const res = await removeClubMember("clubX", "playerY");

    expect(res).toEqual({ ok: true, alreadyRemoved: false });
    expect(mockCall).toHaveBeenCalledWith({ clubId: "clubX", memberUid: "playerY" });
  });

  test("rejeu : `alreadyRemoved` est remonté, il ne se confond pas avec un vrai retrait", async () => {
    mockCall.mockResolvedValue({ data: { alreadyRemoved: true } });
    await expect(removeClubMember("clubX", "playerY")).resolves.toEqual({
      ok: true,
      alreadyRemoved: true,
    });
  });

  test("réponse sans le champ : on n'invente pas un rejeu", async () => {
    mockCall.mockResolvedValue({ data: {} });
    await expect(removeClubMember("clubX", "playerY")).resolves.toEqual({
      ok: true,
      alreadyRemoved: false,
    });
  });

  test("retrait du propriétaire : message PARLANT, qui nomme le geste", async () => {
    mockCall.mockRejectedValue(
      callableError("functions/failed-precondition", { reason: OWNER_TRANSFER_REQUIRED }),
    );

    const res = await removeClubMember("clubX", "ownerY");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("refus attendu");
    expect(res.reason).toBe("ownerTransferRequired");
    expect(res.message).toMatch(/propriétaire/i);
    expect(res.message).toMatch(/transf/i);
    expect(res.message).not.toMatch(/permission/i);
  });

  test("refus d'autorité : message FRANÇAIS maison, jamais la phrase Firebase", async () => {
    mockCall.mockRejectedValue(callableError("functions/permission-denied"));

    const res = await removeClubMember("clubX", "playerY");

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("refus attendu");
    expect(res.reason).toBe("denied");
    expect(res.message).not.toContain("Missing or insufficient permissions");
    // Il ne nomme AUCUNE cause : c'est ce qui ferme l'oracle côté serveur, et
    // l'écran ne doit pas le rouvrir en devinant à sa place.
    expect(res.message).not.toMatch(/propriétaire/i);
  });

  test("membre absent : message qui invite à actualiser", async () => {
    mockCall.mockRejectedValue(callableError("functions/not-found"));
    const res = await removeClubMember("clubX", "playerY");
    if (res.ok) throw new Error("refus attendu");
    expect(res.reason).toBe("notMember");
    expect(res.message).toMatch(/actualis/i);
  });

  test("NE LÈVE JAMAIS, même sur une erreur inattendue", async () => {
    mockCall.mockRejectedValue("panne brute, pas même un Error");
    await expect(removeClubMember("clubX", "playerY")).resolves.toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  test("aucun message affiché n'est en anglais", async () => {
    const codes = [
      "functions/permission-denied",
      "functions/not-found",
      "functions/unauthenticated",
      "functions/invalid-argument",
      "functions/internal",
      "functions/failed-precondition",
    ];
    for (const code of codes) {
      mockCall.mockRejectedValue(callableError(code));
      const res = await removeClubMember("clubX", "playerY");
      if (res.ok) throw new Error("refus attendu");
      expect(res.message).not.toContain("Missing");
      expect(res.message).not.toContain("permissions");
      // Un message français utile finit par une invitation à agir.
      expect(res.message.length).toBeGreaterThan(20);
    }
  });
});
