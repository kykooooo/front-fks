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
  // Note privée et directive : DEUX documents distincts du cadre. Le hook les
  // lit séparément, donc le test les pilote séparément.
  getCoachPrivateNote: jest.fn(),
  getClubDirective: jest.fn(),
}));

const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: "coach1" } };

import { getDoc } from "firebase/firestore";
import {
  getClubDirective,
  getClubWeekContext,
  getCoachPrivateNote,
} from "../../../repositories/clubsRepo";
import { useCoachClub } from "../useCoachClub";

const getDocMock = getDoc as jest.MockedFunction<any>;
const weekContextMock = getClubWeekContext as jest.MockedFunction<typeof getClubWeekContext>;
const privateNoteMock = getCoachPrivateNote as jest.MockedFunction<typeof getCoachPrivateNote>;
const directiveMock = getClubDirective as jest.MockedFunction<typeof getClubDirective>;

const snap = (data: unknown | null) => ({
  exists: () => data !== null,
  data: () => data,
});

/**
 * Répond selon le document lu : users/{uid}, clubs/{clubId}, puis
 * clubs/{clubId}/members/{uid} — cette dernière lecture est la SECONDE source du
 * prédicat d'autorité (le rôle porté par sa propre appartenance).
 */
const wireDocs = (opts: {
  user?: unknown | null;
  club?: unknown | null;
  member?: unknown | null;
  throwsOn?: "users" | "clubs" | "members";
}) => {
  getDocMock.mockImplementation(async (ref: { path: string[] }) => {
    const collection = ref.path[0];
    const estMembre = ref.path[2] === "members";
    if (opts.throwsOn === "members" && estMembre) throw new Error("permission-denied");
    if (!estMembre && opts.throwsOn === collection) throw new Error("permission-denied");
    if (collection === "users") return snap(opts.user === undefined ? { clubId: "clubX" } : opts.user);
    if (estMembre) return snap(opts.member === undefined ? null : opts.member);
    return snap(opts.club === undefined ? { name: "AS Test", teamGender: "female" } : opts.club);
  });
};

const now = () => 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = { uid: "coach1" };
  weekContextMock.mockResolvedValue(null);
  privateNoteMock.mockResolvedValue(null);
  directiveMock.mockResolvedValue(null);
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

  // ── Note privée / directive : deux documents, deux états, jamais confondus ──

  test("note privée et directive lues séparément du cadre", async () => {
    wireDocs({});
    privateNoteMock.mockResolvedValue({ weekKey: "2026-07-20", note: "revoir la sortie de balle" });
    directiveMock.mockResolvedValue({
      objective: "prevention",
      instruction: "On garde les appuis",
      validFrom: "2026-07-20",
      validUntil: "2026-08-10",
      active: true,
      createdBy: "coach1",
      createdAt: null,
      updatedAt: null,
    });

    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.coachNote?.note).toBe("revoir la sortie de balle");
    expect(h.current.coachNoteUnavailable).toBe(false);
    expect(h.current.directive?.objective).toBe("prevention");
    expect(h.current.directiveUnavailable).toBe(false);
    await h.unmount();
  });

  test("note privée illisible → signalée, jamais confondue avec « aucune note »", async () => {
    wireDocs({});
    privateNoteMock.mockRejectedValue(new Error("permission-denied"));

    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.coachNote).toBeNull();
    expect(h.current.coachNoteUnavailable).toBe(true);
    // L'échec est ISOLÉ : la directive, elle, reste lue normalement.
    expect(h.current.directiveUnavailable).toBe(false);
    await h.unmount();
  });

  test("directive illisible → signalée, le reste du contexte club tient debout", async () => {
    wireDocs({});
    directiveMock.mockRejectedValue(new Error("permission-denied"));

    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.clubId).toBe("clubX");
    expect(h.current.directive).toBeNull();
    expect(h.current.directiveUnavailable).toBe(true);
    expect(h.current.coachNoteUnavailable).toBe(false);
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

// ─── PREDICAT D'AUTORITE : dire la verite, jamais accorder un droit ──────────
//
// Le hook lit une source de plus : sa PROPRE appartenance. Elle ne sert a rien
// d'autre qu'a nommer un etat incoherent — sans elle, un proprietaire dont
// l'appartenance a disparu verrait l'effectif, le cadre et la note devenir
// illisibles un par un, sans la moindre explication.
describe("useCoachClub — autorite du club", () => {
  const CLUB = { name: "AS Test", teamGender: "female", ownerUid: "coach1" };

  test("PREDICAT VRAI : ownerUid designe ET appartenance proprietaire", async () => {
    wireDocs({ club: CLUB, member: { uid: "coach1", accessRole: "owner" } });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.ownerAuthority).toBe("authorized");
    expect(h.current.ownershipInconsistent).toBe(false);
    await h.unmount();
  });

  test("ownerUid SEUL (appartenance coach) : incoherence NOMMEE", async () => {
    wireDocs({ club: CLUB, member: { uid: "coach1", accessRole: "coach" } });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.ownerAuthority).toBe("designation-without-membership");
    expect(h.current.ownershipInconsistent).toBe(true);
    // Le club reste connu : pas de disparition muette.
    expect(h.current.clubId).toBe("clubX");
    expect(h.current.clubName).toBe("AS Test");
    await h.unmount();
  });

  test("appartenance SEULE (ownerUid designe un autre) : incoherence NOMMEE", async () => {
    wireDocs({
      club: { ...CLUB, ownerUid: "quelquUnDAutre" },
      member: { uid: "coach1", accessRole: "owner" },
    });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.ownerAuthority).toBe("membership-without-designation");
    expect(h.current.ownershipInconsistent).toBe(true);
    await h.unmount();
  });

  test("coach ordinaire : 'not-owner', et surtout AUCUN bandeau", async () => {
    wireDocs({
      club: { ...CLUB, ownerUid: "unAutreCoach" },
      member: { uid: "coach1", accessRole: "coach" },
    });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.ownerAuthority).toBe("not-owner");
    expect(h.current.ownershipInconsistent).toBe(false);
    await h.unmount();
  });

  test("LECTURE EN ECHEC : on n'invente pas une incoherence", async () => {
    // « Je n'ai pas pu lire mon appartenance » et « mon appartenance ne dit pas
    // ce qu'elle devrait » sont deux choses differentes. Accuser la base sur un
    // incident reseau serait exactement le mensonge qu'on s'interdit ailleurs.
    wireDocs({ club: CLUB, throwsOn: "members" });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.ownerAuthority).toBe("not-owner");
    expect(h.current.ownershipInconsistent).toBe(false);
    await h.unmount();
  });

  test("l'echec de cette lecture ne casse PAS le contexte club", async () => {
    wireDocs({ club: CLUB, throwsOn: "members" });
    const h = await renderHook(() => useCoachClub({ now }));

    expect(h.current.clubId).toBe("clubX");
    expect(h.current.clubName).toBe("AS Test");
    expect(h.current.teamGender).toBe("female");
    await h.unmount();
  });
});
