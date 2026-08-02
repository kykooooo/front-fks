// screens/profileSetup/__tests__/attachClub.test.ts
//
// LE test de ce lot côté parcours. L'audit a mesuré un défaut coûteux :
// un code club refusé faisait perdre TOUT le questionnaire d'inscription,
// parce que le code était résolu avant l'écriture du profil et que son échec
// remontait dans le catch global de l'écran.
//
// Ces tests verrouillent l'ordre inverse et ses conséquences.

import { saveProfileThenAttachClub, type JoinAttempt } from "../attachClub";

const okJoin = (over: Partial<Extract<JoinAttempt, { ok: true }>> = {}): JoinAttempt => ({
  ok: true,
  clubId: "clubX",
  clubName: "AS Test",
  alreadyMember: false,
  ...over,
});

describe("saveProfileThenAttachClub — le profil ne dépend jamais du club", () => {
  test("ORDRE : le profil est enregistré AVANT toute tentative de rattachement", async () => {
    const order: string[] = [];
    const outcome = await saveProfileThenAttachClub(
      {
        saveProfile: async () => {
          order.push("profil");
        },
        joinClub: async () => {
          order.push("club");
          return okJoin();
        },
      },
      "ABCDE-FGHJK",
    );

    expect(order).toEqual(["profil", "club"]);
    expect(outcome.status).toBe("joined");
    expect(outcome.clubId).toBe("clubX");
    expect(outcome.clubName).toBe("AS Test");
  });

  test("CODE REFUSÉ : le profil est quand même enregistré, rien n'est perdu, rien ne lève", async () => {
    const saveProfile = jest.fn(async () => {});
    const outcome = await saveProfileThenAttachClub(
      {
        saveProfile,
        joinClub: async () => ({
          ok: false,
          reason: "rejected",
          message: "Ce code n'est pas valide. Demande à ton coach de t'en envoyer un nouveau.",
        }),
      },
      "MAUVAISCODE",
    );

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("failed");
    expect(outcome.clubId).toBeNull();
    // Message FRANÇAIS et actionnable, transmis tel quel par le service.
    expect(outcome.message).toContain("Ce code n'est pas valide");
    expect(outcome.message).not.toMatch(/[Mm]issing|permission/);
  });

  test("PANNE du rattachement (exception) : contenue, le profil reste enregistré", async () => {
    const saveProfile = jest.fn(async () => {});
    const outcome = await saveProfileThenAttachClub(
      {
        saveProfile,
        joinClub: async () => {
          throw new Error("boom");
        },
      },
      "ABCDE-FGHJK",
    );

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("failed");
    expect(outcome.message).toContain("Ton profil est enregistré");
  });

  test("AUCUN CODE saisi : aucun appel serveur, statut neutre", async () => {
    const joinClub = jest.fn();
    const outcome = await saveProfileThenAttachClub(
      { saveProfile: async () => {}, joinClub },
      "   ",
    );

    expect(joinClub).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: "skipped", clubId: null, clubName: null, message: null });
  });

  test("ÉCHEC D'ÉCRITURE DU PROFIL : là, et seulement là, l'erreur remonte", async () => {
    const joinClub = jest.fn();
    await expect(
      saveProfileThenAttachClub(
        {
          saveProfile: async () => {
            throw new Error("firestore down");
          },
          joinClub,
        },
        "ABCDE-FGHJK",
      ),
    ).rejects.toThrow("firestore down");
    // Et on ne tente pas de rattacher un joueur dont le profil n'existe pas.
    expect(joinClub).not.toHaveBeenCalled();
  });
});
