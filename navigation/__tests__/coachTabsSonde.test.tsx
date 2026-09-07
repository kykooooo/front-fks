// navigation/__tests__/coachTabsSonde.test.tsx
//
// LA SONDE D'ATTERRISSAGE DISPARAÎT-ELLE VRAIMENT UNE FOIS SA DÉCISION PRISE ?
//
// LE COÛT QU'ON FERME. `useCoachRoster` se relit AU FOCUS de l'écran : c'est sa
// fraîcheur, et elle est juste pour les trois écrans coach. Portée par le
// portillon d'atterrissage, elle aurait vécu toute la session — chaque retour
// d'une fiche joueuse passé l'anti-rebond de 60 s aurait relancé l'effectif
// ENTIER (une requête sur les membres plus une par joueur, 26 lectures sur un
// effectif de 25) pour un booléen déjà consommé, dont plus personne ne regardait
// le résultat.
//
// La correction n'est pas un drapeau : c'est un DÉMONTAGE. Le portillon rend la
// tab bar à la place de la sonde, React démonte la sonde, donc le hook, donc son
// abonnement au focus. Ce test l'observe directement — il compte les abonnés au
// focus VIVANTS, avant et après la décision.
//
// Ici, contrairement à coachTabsAtterrissage.test.tsx, `useCoachLandingTab` et
// `useCoachRoster` sont les VRAIS : c'est justement leur montage qu'on mesure.
// Seuls le club (Firestore) et le dépôt sont pilotés par le test.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

// ── Abonnés au focus VIVANTS ────────────────────────────────────────────────
// L'ensemble se vide tout seul au démontage (le nettoyage de l'effet retire le
// callback) : sa taille dit donc combien de hooks écoutent ENCORE le focus.
const mockAbonnesFocus = new Set<() => void>();

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const ReactLocal = require("react");
    ReactLocal.useEffect(() => {
      mockAbonnesFocus.add(cb);
      const nettoyage = cb();
      return () => {
        mockAbonnesFocus.delete(cb);
        if (typeof nettoyage === "function") nettoyage();
      };
    }, [cb]);
  },
}));

jest.mock("../../hooks/coach/useCoachClub", () => ({ useCoachClub: () => mockClub.value }));

jest.mock("../../repositories/clubsRepo", () => ({ fetchClubPlayerSummaries: jest.fn() }));

jest.mock("../../services/firebase", () => ({
  auth: { currentUser: { uid: "coach-1" } },
  db: {},
}));

jest.mock("../../screens/coach/CoachTodayScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../screens/coach/CoachRosterScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../screens/coach/CoachWeekScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/SwipeTabsWrapper", () => ({
  SwipeTabsWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

// Marqueur : le navigateur d'onglets se réduit à sa seule prop de décision.
jest.mock("@react-navigation/bottom-tabs", () => {
  const ReactLocal = require("react");
  const { Text } = require("react-native");
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ initialRouteName }: { initialRouteName?: string }) =>
        ReactLocal.createElement(Text, null, `initialRouteName=${String(initialRouteName)}`),
      Screen: () => null,
    }),
  };
});

import { fetchClubPlayerSummaries } from "../../repositories/clubsRepo";
import { flatText } from "../../components/coach/__tests__/treeUtils";
import CoachTabs from "../CoachTabs";

const fetchMock = fetchClubPlayerSummaries as jest.MockedFunction<typeof fetchClubPlayerSummaries>;

const mockClub: { value: { status: string; clubId: string | null } } = {
  value: { status: "ready", clubId: "club-1" },
};

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const reponse = (nb: number) => ({
  summaries: Array.from({ length: nb }, (_, i) => ({
    playerUid: `p${i}`,
    firstName: `J${i}`,
    ageCategory: null,
    position: null,
    level: null,
    profileComplete: true,
    latestSession: null,
    lastActivity: null,
    adaptation: { adapted: false, labels: [] },
    activity: { doneDateKeys: [] },
    lastPlanned: null,
    lastDone: null,
    execution: null,
  })),
  restrictedCount: 0,
  pendingCount: 0,
  unreadableCount: 0,
  unavailable: false,
  fetchedAt: 1_000,
});

const montes: TestRenderer.ReactTestRenderer[] = [];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAbonnesFocus.clear();
  mockClub.value = { status: "ready", clubId: "club-1" };
});

afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
});

async function rendu(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachTabs />
      </SafeAreaProvider>,
    );
  });
  montes.push(renderer);
  return renderer;
}

/** Rejoue un retour sur l'écran : appelle tous les abonnés ENCORE vivants. */
function rejouerFocus(): void {
  for (const cb of [...mockAbonnesFocus]) cb();
}

describe("la sonde d'atterrissage ne survit pas à sa décision", () => {
  // CONTRE-ÉPREUVE. Sans elle, un test qui trouve « 0 abonné après » ne
  // prouverait rien : il pourrait ne jamais rien avoir observé du tout.
  test("avant la décision, la sonde est bien là et elle écoute le focus", async () => {
    // La lecture reste en vol : la décision ne peut pas se prendre.
    fetchMock.mockImplementation(() => new Promise(() => {}) as never);
    const renderer = await rendu();

    expect(flatText(renderer.toJSON())).not.toContain("initialRouteName=");
    expect(mockAbonnesFocus.size).toBe(1);
  });

  test("club plein : la tab bar naît sur Aujourd'hui et PLUS RIEN n'écoute le focus", async () => {
    fetchMock.mockResolvedValue(reponse(25) as never);
    const renderer = await rendu();

    expect(flatText(renderer.toJSON())).toContain("initialRouteName=CoachToday");
    expect(mockAbonnesFocus.size).toBe(0);
  });

  test("club vide : même démontage, l'onglet décidé ne change rien à la règle", async () => {
    fetchMock.mockResolvedValue(reponse(0) as never);
    const renderer = await rendu();

    expect(flatText(renderer.toJSON())).toContain("initialRouteName=CoachWeek");
    expect(mockAbonnesFocus.size).toBe(0);
  });

  // LE CŒUR DU LOT. Un retour de fiche joueuse, une heure plus tard : la
  // décision est prise depuis longtemps, aucune lecture ne doit repartir.
  test("après la décision, un retour de focus ne déclenche AUCUNE nouvelle lecture", async () => {
    fetchMock.mockResolvedValue(reponse(25) as never);
    await rendu();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejouerFocus();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ET DÈS LA DEUXIÈME OUVERTURE, IL N'Y A MÊME PLUS DE PREMIÈRE LECTURE.
  // La taille d'effectif mémorisée tranche sans réseau, la tab bar naît tout de
  // suite, et l'effectif n'est jamais demandé par le portillon.
  test("effectif déjà mémorisé : la tab bar naît sans qu'aucune lecture soit émise", async () => {
    const { memoriserEffectifCoach } = require("../../services/memoireEffectifCoach");
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    // Si le portillon lisait quand même, il resterait bloqué sur le squelette.
    fetchMock.mockImplementation(() => new Promise(() => {}) as never);

    const renderer = await rendu();

    expect(flatText(renderer.toJSON())).toContain("initialRouteName=CoachToday");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockAbonnesFocus.size).toBe(0);
  });
});
