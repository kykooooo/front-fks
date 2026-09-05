// screens/profileSetup/__tests__/attachClub.test.ts
//
// LE test de ce lot côté parcours. L'audit a mesuré un défaut coûteux :
// un code club refusé faisait perdre TOUT le questionnaire d'inscription,
// parce que le code était résolu avant l'écriture du profil et que son échec
// remontait dans le catch global de l'écran.
//
// Ces tests verrouillent l'ordre inverse et ses conséquences.

import { saveProfileThenAttachClub, type JoinAttempt } from "../attachClub";
import { withTimeout } from "../../../utils/errorHandler";
import {
  poserRattachementClub,
  readRattachementClub,
  resetRattachementClubForTests,
} from "../../../state/rattachementClubGate";

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
    expect(outcome).toEqual({
      status: "skipped",
      clubId: null,
      clubName: null,
      message: null,
      coachAccess: null,
      // Pas d'échec, donc pas de nature d'échec (R6).
      nature: null,
    });
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

// ─── R1 DU ROUND 3 : UNE BORNE PAR DÉPENDANCE ───────────────────────────────
// L'écran bornait `saveProfileThenAttachClub` DANS SON ENSEMBLE : un seul
// chronomètre pour l'écriture du profil ET la callable de rattachement. Un
// `setDoc` lent suivi d'une callable lente (cold start Cloud Functions gen2)
// sortait donc en `TimeoutError` au catch global de l'écran — drapeau baissé,
// portillon tombé, accueil, et le toast « Impossible d'enregistrer pour le
// moment » ALORS QUE LE PROFIL ÉTAIT ENREGISTRÉ. La borne du rattachement vit
// désormais DANS la dépendance : son dépassement est un échec de club, pas un
// échec d'enregistrement.
describe("le délai de garde du rattachement est un échec DE CLUB, pas d'enregistrement", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRattachementClubForTests();
  });
  afterEach(() => {
    jest.useRealTimers();
    resetRattachementClubForTests();
  });

  test("joinClub qui pend au-delà de 20 s : failed/technique, drapeau levé, rien ne remonte", async () => {
    // L'écran lève le drapeau AVANT l'écriture du profil : on reproduit
    // exactement cet état de départ.
    poserRattachementClub("joueuse-1");

    let appele!: () => void;
    const appelFait = new Promise<void>((r) => {
      appele = r;
    });

    const promesse = saveProfileThenAttachClub(
      {
        saveProfile: async () => undefined,
        // La borne réelle de l'écran, à l'identique.
        joinClub: () => {
          appele();
          return withTimeout(new Promise<never>(() => {}), 20000);
        },
      },
      "ABCDE-FGHJK",
    );

    await appelFait; // le chronomètre des 20 s est posé
    jest.advanceTimersByTime(20001);

    // AUCUNE exception ne remonte : c'est tout l'objet du try/catch interne.
    const outcome = await promesse;
    expect(outcome.status).toBe("failed");
    expect(outcome.nature).toBe("technique");
    expect(outcome.message).toContain("Ton profil est enregistré");

    // Le drapeau est TOUJOURS levé : l'écran reste monté et peut afficher sa
    // carte. C'est ce que l'ancienne enveloppe globale détruisait.
    expect(readRattachementClub()).toBe("joueuse-1");
  });

  test("sous la borne, le rattachement aboutit normalement", async () => {
    let resoudre!: (v: JoinAttempt) => void;
    const reponse = new Promise<JoinAttempt>((r) => {
      resoudre = r;
    });
    let appele!: () => void;
    const appelFait = new Promise<void>((r) => {
      appele = r;
    });

    const promesse = saveProfileThenAttachClub(
      {
        saveProfile: async () => undefined,
        joinClub: () => {
          appele();
          return withTimeout(reponse, 20000);
        },
      },
      "ABCDE-FGHJK",
    );

    await appelFait;
    jest.advanceTimersByTime(19000); // 19 s de cold start, toujours dans les clous
    resoudre(okJoin());

    await expect(promesse).resolves.toMatchObject({ status: "joined", clubId: "clubX" });
  });
});
