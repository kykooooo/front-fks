// hooks/coach/__tests__/useCoachPlayer.test.tsx
//
// La logique de garde vient de CoachPlayerDetailScreen : ces tests verrouillent
// qu'elle n'a PAS régressé en montant dans un hook —
//  - réponse tardive / route changée → aucun état touché ;
//  - refresh raté avec un contenu encore aligné sur la route → contenu conservé,
//    signalé par `staleRefreshCount` (l'écran décide du toast, pas le hook) ;
// et qu'elle gagne la fraîcheur au focus, anti-rebondie comme l'effectif.

import { renderHook, flush, deferred, actAsync } from "./hookHarness";

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
  fetchClubPlayerSummary: jest.fn(),
}));

const mockFocus: { cb: null | (() => void | (() => void)) } = { cb: null };

import { fetchClubPlayerSummary } from "../../../repositories/clubsRepo";
import { useCoachPlayer } from "../useCoachPlayer";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";

const fetchMock = fetchClubPlayerSummary as jest.MockedFunction<typeof fetchClubPlayerSummary>;

const summary = (playerUid: string, firstName: string): CoachPlayerSummary => ({
  playerUid,
  firstName,
  ageCategory: "U17",
  position: "Milieu",
  level: "Régional",
  profileComplete: true,
  latestSession: null,
  lastActivity: { dateKey: "2026-07-20", durationMin: 40 },
  adaptation: { adapted: false, labels: [] },
  activity: { doneDateKeys: ["2026-07-20"] },
  lastPlanned: null,
  lastDone: null,
  execution: null,
});

let clock = 0;
const now = () => clock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.cb = null;
  clock = 1_700_000_000_000;
});

describe("useCoachPlayer — lecture d'une fiche", () => {
  test("résumé lu → ready, vue de domaine construite avec l'horloge du coach", async () => {
    fetchMock.mockResolvedValue({ summary: summary("p1", "Anna"), unavailable: false });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.summary?.playerUid).toBe("p1");
    expect(h.current.view?.prenom).toBe("Anna");
    expect(h.current.fetchedAt).toBe(clock);
    await h.unmount();
  });

  test("projection absente → notFound (distinct d'une lecture refusée)", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: false });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));

    expect(h.current.status).toBe("notFound");
    expect(h.current.view).toBeNull();
    await h.unmount();
  });

  test("lecture refusée au premier chargement → unavailable", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: true });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));

    expect(h.current.status).toBe("unavailable");
    expect(h.current.fetchedAt).toBeNull();
    await h.unmount();
  });

  test("sans route → aucune lecture, aucun chargement bloqué", async () => {
    const h = await renderHook(() => useCoachPlayer(null, null, { now }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.current.status).toBe("notFound");
    await h.unmount();
  });
});

describe("useCoachPlayer — gardes de concurrence", () => {
  test("réponse TARDIVE d'une autre fiche : jamais appliquée (pas de mélange d'identité)", async () => {
    const slow = deferred<{ summary: CoachPlayerSummary | null; unavailable: boolean }>();
    fetchMock.mockImplementationOnce(() => slow.promise as any);
    fetchMock.mockResolvedValue({ summary: summary("p2", "Bea"), unavailable: false });

    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    expect(h.current.status).toBe("loading");

    await h.rerender(() => useCoachPlayer("clubX", "p2", { now }));
    expect(h.current.summary?.playerUid).toBe("p2");

    slow.resolve({ summary: summary("p1", "Anna"), unavailable: false });
    await flush();

    expect(h.current.summary?.playerUid).toBe("p2"); // la fiche affichée n'a pas changé
    await h.unmount();
  });

  test("double refresh concurrent → une seule lecture supplémentaire", async () => {
    fetchMock.mockResolvedValue({ summary: summary("p1", "Anna"), unavailable: false });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const pending = deferred<{ summary: CoachPlayerSummary | null; unavailable: boolean }>();
    fetchMock.mockImplementationOnce(() => pending.promise as any);
    await actAsync(() => {
      h.current.refresh();
      h.current.refresh();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    pending.resolve({ summary: summary("p1", "Anna"), unavailable: false });
    await flush();
    await h.unmount();
  });

  test("réponse arrivée APRÈS démontage : aucun setState", async () => {
    const slow = deferred<{ summary: CoachPlayerSummary | null; unavailable: boolean }>();
    fetchMock.mockImplementationOnce(() => slow.promise as any);

    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    await h.unmount();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    slow.resolve({ summary: summary("p1", "Anna"), unavailable: false });
    await flush();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("useCoachPlayer — conservation du dernier contenu valide", () => {
  test("refresh raté → fiche conservée + staleRefreshCount incrémenté (pas de page vide)", async () => {
    fetchMock.mockResolvedValueOnce({ summary: summary("p1", "Anna"), unavailable: false });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    const firstFetchedAt = h.current.fetchedAt;

    fetchMock.mockResolvedValueOnce({ summary: null, unavailable: true });
    clock += 120_000;
    await actAsync(() => h.current.refresh());
    await flush();

    expect(h.current.status).toBe("ready");
    expect(h.current.summary?.playerUid).toBe("p1");
    expect(h.current.staleRefreshCount).toBe(1);
    // fetchedAt reste l'horodatage de la dernière lecture RÉUSSIE.
    expect(h.current.fetchedAt).toBe(firstFetchedAt);
    await h.unmount();
  });
});

describe("useCoachPlayer — fraîcheur", () => {
  test("anti-rebond au focus : rien avant 60 s, relecture ensuite", async () => {
    fetchMock.mockResolvedValue({ summary: summary("p1", "Anna"), unavailable: false });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock += 30_000;
    await actAsync(() => {
      mockFocus.cb?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clock += 31_000;
    await actAsync(() => {
      mockFocus.cb?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await h.unmount();
  });
});
