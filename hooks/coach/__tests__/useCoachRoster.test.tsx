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

// Compte connecté : la mémoire locale de la taille d'effectif est nommée par uid.
// Getter et non valeur figée : la fabrique de `jest.mock` est évaluée avant
// l'initialisation des constantes de ce fichier.
jest.mock("../../../services/firebase", () => ({
  auth: {
    get currentUser() {
      return mockUid.value ? { uid: mockUid.value } : null;
    },
  },
  db: {},
}));

const mockUid: { value: string | null } = { value: "coach-1" };
const mockFocus: { cb: null | (() => void | (() => void)) } = { cb: null };

import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchClubPlayerSummaries } from "../../../repositories/clubsRepo";
import { lireEffectifMemorise } from "../../../services/memoireEffectifCoach";
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
  restrictedCount: 0,
  pendingCount: 0,
  unreadableCount: 0,
  unavailable: false,
  fetchedAt: 1_000,
  ...over,
});

// Horloge de test : on avance le temps à la main, jamais de timers réels.
let clock = 0;
const now = () => clock;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockUid.value = "coach-1";
  mockFocus.cb = null;
  clock = 1_000_000;
});

describe("useCoachRoster — chargement et cohérence", () => {
  test("charge l'effectif au montage et expose les 4 compteurs distincts", async () => {
    fetchMock.mockResolvedValue(
      result({
        summaries: [summary("p1", "Anna"), summary("p2", "Bea")],
        restrictedCount: 3,
        pendingCount: 1,
        unreadableCount: 2,
        fetchedAt: 1_234,
      }),
    );

    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    expect(h.current.status).toBe("ready");
    expect(h.current.views.map((v) => v.playerUid)).toEqual(["p1", "p2"]);
    expect(h.current.readyCount).toBe(2);
    // QUATRE sémantiques, jamais confondues : prêt / non autorisé par le serveur
    // / pas encore projeté / non lu.
    expect(h.current.restrictedCount).toBe(3);
    expect(h.current.pendingCount).toBe(1); // pas encore projeté par le serveur
    expect(h.current.unreadableCount).toBe(2); // non lu — sémantique DIFFÉRENTE
    expect(h.current.memberCount).toBe(8); // effectif réel = 2 + 3 + 1 + 2
    expect(h.current.fetchedAt).toBe(1_234);
    await h.unmount();
  });

  test("un effectif entièrement non autorisé reste 'ready' (décision serveur, pas panne)", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [], restrictedCount: 4 }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    expect(h.current.status).toBe("ready");
    expect(h.current.readyCount).toBe(0);
    expect(h.current.restrictedCount).toBe(4);
    expect(h.current.memberCount).toBe(4);
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

// ─── MÉMOIRE LOCALE DE LA TAILLE D'EFFECTIF ─────────────────────────────────
// Elle sert au portillon d'atterrissage (navigation/CoachTabs) à choisir son
// onglet sans relire l'effectif. Elle s'écrit ICI, dans la couche de lecture,
// pour que les trois écrans coach l'entretiennent en passant.
//
// LE PIÈGE QUE CES TESTS FERMENT : mémoriser un effectif qu'on n'a PAS lu.
// « 0 joueur » et « on n'a pas su lire » donneraient la même valeur, et le
// portillon ouvrirait ensuite un club plein sur Semaine.
describe("useCoachRoster — mémoire locale de la taille d'effectif", () => {
  test("une lecture aboutie mémorise l'effectif réel, pas le seul nombre de fiches", async () => {
    fetchMock.mockResolvedValue(
      result({
        summaries: [summary("p1", "Anna")],
        restrictedCount: 3,
        pendingCount: 1,
        unreadableCount: 2,
      }),
    );
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    // Exactement `memberCount` — la seule implémentation, recopiée telle quelle.
    expect(h.current.memberCount).toBe(7);
    expect(await lireEffectifMemorise("coach-1", "clubX")).toBe(7);
    await h.unmount();
  });

  test("un club sans joueur mémorise bien zéro : c'est une mesure", async () => {
    fetchMock.mockResolvedValue(result({ summaries: [] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    expect(await lireEffectifMemorise("coach-1", "clubX")).toBe(0);
    await h.unmount();
  });

  test("un effectif ILLISIBLE ne mémorise rien : on n'écrit pas un zéro qu'on n'a pas lu", async () => {
    fetchMock.mockResolvedValue(result({ unavailable: true }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    expect(h.current.status).toBe("unavailable");
    expect(await lireEffectifMemorise("coach-1", "clubX")).toBeNull();
    await h.unmount();
  });

  test("sans club, rien n'est lu et rien n'est mémorisé", async () => {
    const h = await renderHook(() => useCoachRoster(null, { now }));
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await lireEffectifMemorise("coach-1", "clubX")).toBeNull();
    await h.unmount();
  });

  test("sans compte connecté, rien n'est mémorisé (la clé porte l'uid)", async () => {
    mockUid.value = null;
    fetchMock.mockResolvedValue(result({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    expect(await lireEffectifMemorise("coach-1", "clubX")).toBeNull();
    await h.unmount();
  });
});
