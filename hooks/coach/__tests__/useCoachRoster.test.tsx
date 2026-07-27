// hooks/coach/__tests__/useCoachRoster.test.tsx
//
// Ce que ces tests PROUVENT (défauts mesurés par l'audit) :
//  - une réponse tardive n'écrase jamais l'état courant (aucun état touché) ;
//  - deux refresh concurrents ne produisent qu'UNE lecture ;
//  - un échec PARTIEL ne vide pas l'effectif (29 lisibles sur 30 restent lisibles) ;
//  - le refetch au focus est anti-rebondi (pas de rafale N+1 en allant-venant) ;
//  - un refresh globalement raté conserve le contenu précédent (état `isStale`).

import { renderHook, flush, deferred, actAsync } from "./hookHarness";

// useFocusEffect mocké : on capture le callback pour rejouer un focus à la main.
// Le corps de la fabrique ne touche à RIEN d'externe (il est exécuté à l'import,
// avant l'initialisation des constantes du fichier).
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // `require` et non `import` : la fabrique de `jest.mock` est hissée AVANT
    // les imports du fichier, elle ne peut donc pas fermer sur un binding d'import.
    const React = require("react");
    React.useEffect(() => {
      mockFocus.cb = cb;
      return cb();
    }, [cb]);
  },
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  fetchClubPlayerSummaries: jest.fn(),
}));

const mockFocus: { cb: null | (() => void | (() => void)) } = { cb: null };

import { fetchClubPlayerSummaries } from "../../../repositories/clubsRepo";
import { useCoachRoster } from "../useCoachRoster";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";

const fetchMock = fetchClubPlayerSummaries as jest.MockedFunction<typeof fetchClubPlayerSummaries>;

const summary = (playerUid: string, firstName: string): CoachPlayerSummary => ({
  playerUid,
  firstName,
  ageCategory: null,
  position: null,
  level: null,
  profileComplete: true,
  latestSession: null,
  lastActivity: { dateKey: "2026-07-20", durationMin: 45 },
  adaptation: { adapted: false, labels: [] },
  activity: { doneDateKeys: ["2026-07-20"] },
  lastPlanned: null,
  lastDone: null,
  execution: null,
});

const result = (over: Partial<Awaited<ReturnType<typeof fetchClubPlayerSummaries>>> = {}) => ({
  summaries: [] as CoachPlayerSummary[],
  pendingCount: 0,
  unreadableCount: 0,
  unavailable: false,
  fetchedAt: 1_000,
  ...over,
});

// Horloge de test : on avance le temps à la main, jamais de timers réels.
let clock = 0;
const now = () => clock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.cb = null;
  clock = 1_000_000;
});

describe("useCoachRoster — chargement et cohérence", () => {
  test("charge l'effectif au montage et expose les 3 compteurs distincts", async () => {
    fetchMock.mockResolvedValue(
      result({
        summaries: [summary("p1", "Anna"), summary("p2", "Bea")],
        pendingCount: 1,
        unreadableCount: 2,
        fetchedAt: 1_234,
      }),
    );

    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.views.map((v) => v.playerUid)).toEqual(["p1", "p2"]);
    expect(h.current.readyCount).toBe(2);
    expect(h.current.pendingCount).toBe(1); // pas encore projeté par le serveur
    expect(h.current.unreadableCount).toBe(2); // non lu — sémantique DIFFÉRENTE
    expect(h.current.memberCount).toBe(5); // effectif réel = 2 + 1 + 2
    expect(h.current.fetchedAt).toBe(1_234);
    await h.unmount();
  });

  test("échec PARTIEL non destructeur : les projections lisibles restent affichées", async () => {
    fetchMock.mockResolvedValue(
      result({ summaries: [summary("p1", "Anna")], unreadableCount: 29 }),
    );

    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    // L'ancien comportement rendait l'écran vide ("Effectif indisponible").
    expect(h.current.status).toBe("ready");
    expect(h.current.views).toHaveLength(1);
    expect(h.current.unreadableCount).toBe(29);
    await h.unmount();
  });

  test("indisponibilité GLOBALE au premier chargement → statut unavailable, sans invention", async () => {
    fetchMock.mockResolvedValue(result({ unavailable: true }));

    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    expect(h.current.status).toBe("unavailable");
    expect(h.current.views).toEqual([]);
    expect(h.current.fetchedAt).toBeNull(); // aucune lecture aboutie : rien à dater
    await h.unmount();
  });

  test("sans club → aucune lecture, aucun état de chargement bloqué", async () => {
    const h = await renderHook(() => useCoachRoster(null, { now }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.current.status).toBe("ready");
    expect(h.current.views).toEqual([]);
    expect(h.current.memberCount).toBe(0);
    await h.unmount();
  });
});

describe("useCoachRoster — gardes de concurrence", () => {
  test("réponse TARDIVE d'un club quitté : ignorée, l'état du club courant est intact", async () => {
    const slow = deferred<ReturnType<typeof result>>();
    fetchMock.mockImplementationOnce(() => slow.promise as any);
    fetchMock.mockResolvedValue(result({ summaries: [summary("p9", "Zoe")] }));

    // Montage sur clubA : la lecture reste en vol.
    const h = await renderHook(() => useCoachRoster("clubA", { now }));
    expect(h.current.status).toBe("loading");

    // L'écran change de club AVANT la réponse de clubA.
    await h.rerender(() => useCoachRoster("clubB", { now }));
    expect(h.current.views.map((v) => v.playerUid)).toEqual(["p9"]);

    // clubA répond enfin, avec un effectif complètement différent.
    slow.resolve(result({ summaries: [summary("p1", "Anna"), summary("p2", "Bea")] }));
    await flush();

    // Rien n'a bougé : la réponse périmée n'a touché aucun état.
    expect(h.current.views.map((v) => v.playerUid)).toEqual(["p9"]);
    expect(h.current.status).toBe("ready");
    await h.unmount();
  });

  test("double refresh concurrent → une seule lecture supplémentaire", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const pending = deferred<ReturnType<typeof result>>();
    fetchMock.mockImplementationOnce(() => pending.promise as any);

    // Deux appels dans le même tour : le second doit être rejeté par le garde
    // synchrone (`inFlightRef`), pas par un état React pas encore commité.
    await actAsync(() => {
      h.current.refresh();
      h.current.refresh();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    pending.resolve(result({ summaries: [summary("p1", "Anna")] }));
    await flush();
    await h.unmount();
  });

  test("réponse arrivée APRÈS démontage : aucun setState (pas de fuite)", async () => {
    const slow = deferred<ReturnType<typeof result>>();
    fetchMock.mockImplementationOnce(() => slow.promise as any);

    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await h.unmount();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    slow.resolve(result({ summaries: [summary("p1", "Anna")] }));
    await flush();
    // Un setState après démontage ferait crier React ici.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("useCoachRoster — fraîcheur", () => {
  test("le focus au montage ne double PAS la requête initiale", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await h.unmount();
  });

  test("anti-rebond : pas de relecture si la dernière date de moins de 60 s", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock += 30_000; // retour sur l'écran 30 s plus tard
    await flush();
    await actAsync(() => {
      mockFocus.cb?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // toujours une seule lecture

    clock += 31_000; // 61 s au total
    await actAsync(() => {
      mockFocus.cb?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2); // les données d'hier ne restent pas
    await h.unmount();
  });

  test("seuil d'anti-rebond configurable (l'écran ne code pas sa propre valeur)", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() =>
      useCoachRoster("clubX", { now, minRefetchIntervalMs: 5_000 }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock += 6_000;
    await actAsync(() => {
      mockFocus.cb?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await h.unmount();
  });

  test("refresh raté après un chargement réussi → contenu conservé + isStale", async () => {
    fetchMock.mockResolvedValueOnce(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    expect(h.current.views).toHaveLength(1);
    expect(h.current.fetchedAt).toBe(1_000);

    fetchMock.mockResolvedValueOnce(result({ unavailable: true, fetchedAt: 9_999 }));
    await flush();
    await actAsync(() => h.current.refresh());
    await flush();

    // L'effectif ne disparaît pas sous les yeux du coach ; on le DIT (isStale),
    // et l'horodatage reste celui de la dernière lecture RÉUSSIE.
    expect(h.current.views).toHaveLength(1);
    expect(h.current.status).toBe("ready");
    expect(h.current.isStale).toBe(true);
    expect(h.current.fetchedAt).toBe(1_000);
    expect(h.current.isRefreshing).toBe(false);
    await h.unmount();
  });
});
