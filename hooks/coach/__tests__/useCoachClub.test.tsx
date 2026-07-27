// hooks/coach/__tests__/useCoachClub.test.tsx
//
// Le défaut central corrigé ici : il n'existait AUCUN état "coach sans club".
// Un coach non rattaché voyait "Mon club" et un effectif vide — un écran qui ment.
// `notInClub` est maintenant un état de premier rang, distinct d'une erreur.

import { renderHook, flush, deferred, actAsync } from "./hookHarness";

jest.mock("../../../services/firebase", () => ({
  db: {},
  auth: { get currentUser() { return mockAuth.currentUser; } },
}));

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path }),
  getDoc: jest.fn(),
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  getClubWeekContext: jest.fn(),
}));

const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: "coach1" } };

import { getDoc } from "firebase/firestore";
import { getClubWeekContext } from "../../../repositories/clubsRepo";
import { useCoachClub } from "../useCoachClub";

const getDocMock = getDoc as jest.MockedFunction<any>;
const weekContextMock = getClubWeekContext as jest.MockedFunction<typeof getClubWeekContext>;

const snap = (data: unknown | null) => ({
  exists: () => data !== null,
  data: () => data,
});

/** Répond selon la collection lue : users/{uid} puis clubs/{clubId}. */
const wireDocs = (opts: { user?: unknown | null; club?: unknown | null; throwsOn?: "users" | "clubs" }) => {
  getDocMock.mockImplementation(async (ref: { path: string[] }) => {
    const collection = ref.path[0];
    if (opts.throwsOn === collection) throw new Error("permission-denied");
    if (collection === "users") return snap(opts.user === undefined ? { clubId: "clubX" } : opts.user);
    return snap(opts.club === undefined ? { name: "AS Test", teamGender: "female" } : opts.club);
  });
};

const now = () => 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: "coach1" };
  weekContextMock.mockResolvedValue(null);
});

describe("useCoachClub — coach SANS club (l'écran ne doit plus mentir)", () => {
  test("users/{uid} sans clubId → notInClub, aucun nom de club inventé", async () => {
    wireDocs({ user: { uid: "coach1" } });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("notInClub");
    expect(h.current.clubId).toBeNull();
    expect(h.current.clubName).toBeNull();
    await h.unmount();
  });

  test("clubId qui pointe vers un club supprimé → notInClub (pas 'error')", async () => {
    wireDocs({ user: { clubId: "clubGone" }, club: null });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("notInClub");
    expect(h.current.clubId).toBeNull();
    await h.unmount();
  });

  test("aucun utilisateur authentifié → notInClub, aucune lecture Firestore", async () => {
    mockAuth.currentUser = null;
    wireDocs({});
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("notInClub");
    expect(getDocMock).not.toHaveBeenCalled();
    await h.unmount();
  });
});

describe("useCoachClub — contexte club résolu", () => {
  test("club complet → ready + code d'invitation + type d'équipe + weekKey du coach", async () => {
    wireDocs({});
    weekContextMock.mockResolvedValue({
      weekKey: "2026-07-20",
      clubId: "clubX",
      createdBy: "coach1",
      trainingIntensity: "normal",
      weekGoal: "speed",
      note: null,
      matchThisWeekend: true,
    });

    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.clubId).toBe("clubX");
    expect(h.current.clubName).toBe("AS Test");
    expect(h.current.teamGender).toBe("female");
    expect(h.current.weekContext?.weekGoal).toBe("speed");
    // weekKey = lundi de la semaine, calculé avec l'HORLOGE DU COACH.
    expect(h.current.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(h.current.fetchedAt).toBe(now());
    await h.unmount();
  });

  test("cadre de semaine illisible → club quand même ready, échec annoncé", async () => {
    wireDocs({});
    weekContextMock.mockRejectedValue(new Error("permission-denied"));

    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.weekContext).toBeNull();
    expect(h.current.weekContextUnavailable).toBe(true);
    await h.unmount();
  });

  test("lecture users refusée → error, rien d'inventé", async () => {
    wireDocs({ throwsOn: "users" });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("error");
    expect(h.current.clubId).toBeNull();
    await h.unmount();
  });

  test("refresh raté APRÈS un succès → error mais le club reste affiché", async () => {
    wireDocs({});
    const h = await renderHook(() => useCoachClub({ now }));
    expect(h.current.status).toBe("ready");

    wireDocs({ throwsOn: "clubs" });
    await actAsync(() => h.current.refresh());
    await flush();

    expect(h.current.status).toBe("error");
    // On ne retire pas le club des mains du coach parce qu'une requête a échoué.
    expect(h.current.clubId).toBe("clubX");
    expect(h.current.clubName).toBe("AS Test");
    expect(h.current.isRefreshing).toBe(false);
    await h.unmount();
  });

  test("réponse tardive ignorée après démontage (pas de setState orphelin)", async () => {
    const slow = deferred<any>();
    getDocMock.mockImplementationOnce(() => slow.promise);

    const h = await renderHook(() => useCoachClub({ now }));
    await h.unmount();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    slow.resolve(snap({ clubId: "clubX" }));
    await flush();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("useCoachClub — invariant de montage (adossé à un eslint-disable)", () => {
  test("aucun rendu en cascade au montage : rien n'écrit l'état avant le premier await", async () => {
    // POURQUOI CE TEST EXISTE.
    // `useCoachClub` porte un `eslint-disable-next-line react-hooks/set-state-in-effect`
    // sur l'effet de montage. La règle voit les `setState` de `runFetch` sans
    // modéliser la frontière `await`, et croit à un rendu en cascade. On ne laisse
    // pas cette affirmation reposer sur un commentaire : on la MESURE.
    //
    // Lecture qui ne se résout jamais → le montage s'arrête net au premier
    // `await`. Si un `setState` était atteignable avant lui, la sonde serait
    // rendue une seconde fois. Elle doit l'être exactement une fois.
    const jamais = deferred<any>();
    getDocMock.mockImplementation(() => jamais.promise);

    let rendus = 0;
    const h = await renderHook(() => {
      rendus += 1;
      return useCoachClub({ now });
    });

    expect(rendus).toBe(1);
    // Et l'état affiché est bien celui du premier rendu, pas un état réécrit.
    expect(h.current.status).toBe("loading");
    await h.unmount();
  });
});
