// hooks/coach/__tests__/useCoachLandingTab.test.tsx
//
// Ce hook ne porte AUCUNE règle (elle est testée dans
// domain/coachView/__tests__/landing.test.ts). Ce qu'on éprouve ici, c'est son
// CÂBLAGE, et surtout ce qu'il COÛTE :
//
//  1. lit-il bien l'effectif de la couche coach, et le délai de garde ouvre-t-il
//     vraiment l'espace au lieu de le laisser derrière un squelette ?
//  2. quand la taille de l'effectif est déjà mémorisée pour CE club, décide-t-il
//     sans demander l'effectif du tout ? C'est tout l'objet du lot : ne plus
//     faire attendre 26 requêtes à un coach dont le club est plein.

import { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Les deux lectures sont pilotées par le test : on veut éprouver le branchement,
// pas re-tester Firestore. `useCoachRoster` enregistre en plus le clubId qu'on
// lui passe — c'est LUI qui dit si une lecture d'effectif a été demandée : le
// hook n'émet aucune requête quand il reçoit `null`.
jest.mock("../useCoachClub", () => ({ useCoachClub: () => mockClub.value }));
jest.mock("../useCoachRoster", () => ({
  useCoachRoster: (clubId: string | null) => {
    mockRoster.clubIdsDemandes.push(clubId);
    return mockRoster.value;
  },
}));

// Compte connecté : la mémoire est nommée par uid.
jest.mock("../../../services/firebase", () => ({
  auth: {
    get currentUser() {
      return mockUid.value ? { uid: mockUid.value } : null;
    },
  },
  db: {},
}));

import { COACH_LANDING_TIMEOUT_MS, useCoachLandingTab } from "../useCoachLandingTab";
import { memoriserEffectifCoach } from "../../../services/memoireEffectifCoach";
import { renderHook } from "./hookHarness";

type ClubState = { status: "loading" | "ready" | "notInClub" | "error"; clubId: string | null };
type RosterState = {
  status: "loading" | "ready" | "unavailable";
  memberCount: number;
  fetchedAt: number | null;
};

const mockUid: { value: string | null } = { value: "coach-1" };
const mockClub: { value: ClubState } = { value: { status: "ready", clubId: "club-1" } };
const mockRoster: { value: RosterState; clubIdsDemandes: Array<string | null> } = {
  value: { status: "ready", memberCount: 3, fetchedAt: 1000 },
  clubIdsDemandes: [],
};

/** Une lecture d'effectif a-t-elle été demandée ? (clubId non nul passé au hook) */
const effectifDemande = () => mockRoster.clubIdsDemandes.some((c) => c !== null);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUid.value = "coach-1";
  mockClub.value = { status: "ready", clubId: "club-1" };
  mockRoster.value = { status: "ready", memberCount: 3, fetchedAt: 1000 };
  mockRoster.clubIdsDemandes = [];
});

describe("useCoachLandingTab", () => {
  test("club sans joueur : Semaine", async () => {
    mockRoster.value = { status: "ready", memberCount: 0, fetchedAt: 1000 };
    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBe("CoachWeek");
    await harness.unmount();
  });

  test("club avec joueurs : Aujourd'hui", async () => {
    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBe("CoachToday");
    await harness.unmount();
  });

  test("effectif pas encore chargé : aucune décision", async () => {
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };
    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBeNull();

    // La réponse arrive : la décision se prend alors, et une seule fois.
    mockRoster.value = { status: "ready", memberCount: 0, fetchedAt: 2000 };
    await harness.rerender();
    expect(harness.current).toBe("CoachWeek");
    await harness.unmount();
  });

  test("effectif illisible : repli sur le comportement actuel", async () => {
    mockRoster.value = { status: "unavailable", memberCount: 0, fetchedAt: null };
    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBe("CoachToday");
    await harness.unmount();
  });

  test("lecture qui ne répond jamais : le délai de garde ouvre l'espace", async () => {
    jest.useFakeTimers();
    try {
      mockClub.value = { status: "loading", clubId: null };
      mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };
      const harness = await renderHook(() => useCoachLandingTab());
      expect(harness.current).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(COACH_LANDING_TIMEOUT_MS + 1);
      });
      expect(harness.current).toBe("CoachToday");
      await harness.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  // Trois secondes, et non huit : ce délai ne couvre plus que la PREMIÈRE
  // ouverture d'un club (ensuite la mémoire tranche). Un squelette de huit
  // secondes avant la moindre barre d'onglets se lit comme une app bloquée.
  test("le délai de garde tient en trois secondes", () => {
    expect(COACH_LANDING_TIMEOUT_MS).toBe(3000);
  });
});

// ─── LA MÉMOIRE LOCALE : DÉCIDER SANS LIRE L'EFFECTIF ────────────────────────
describe("useCoachLandingTab — mémoire locale", () => {
  test("taille mémorisée non nulle : décision immédiate, AUCUNE lecture d'effectif", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    // L'effectif ne répondra jamais : si le hook l'attendait, il ne déciderait pas.
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };

    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBe("CoachToday");
    expect(effectifDemande()).toBe(false);
    await harness.unmount();
  });

  test("taille mémorisée à zéro : Semaine immédiatement, AUCUNE lecture d'effectif", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 0);
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };

    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBe("CoachWeek");
    expect(effectifDemande()).toBe(false);
    await harness.unmount();
  });

  test("aucune mémoire : on lit l'effectif, on attend sa réponse, puis on décide", async () => {
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };
    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBeNull();
    expect(effectifDemande()).toBe(true);

    mockRoster.value = { status: "ready", memberCount: 4, fetchedAt: 2000 };
    await harness.rerender();
    expect(harness.current).toBe("CoachToday");
    await harness.unmount();
  });

  // LE CAS QUI PROTÈGE DU MENSONGE. La mémoire d'un club ne doit jamais décider
  // de l'écran d'un autre : on retombe alors sur la lecture réelle.
  test("changement de club : la mémoire d'avant n'est pas appliquée", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 0);
    mockClub.value = { status: "ready", clubId: "club-2" };
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };

    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBeNull();
    expect(effectifDemande()).toBe(true);
    await harness.unmount();
  });

  test("mémoire d'un autre compte : elle n'est pas appliquée non plus", async () => {
    await memoriserEffectifCoach("coach-2", "club-1", 0);
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };

    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBeNull();
    expect(effectifDemande()).toBe(true);
    await harness.unmount();
  });

  test("club pas encore résolu : rien n'est lu, et rien n'est décidé", async () => {
    await memoriserEffectifCoach("coach-1", "club-1", 25);
    mockClub.value = { status: "loading", clubId: null };
    mockRoster.value = { status: "loading", memberCount: 0, fetchedAt: null };

    const harness = await renderHook(() => useCoachLandingTab());
    expect(harness.current).toBeNull();
    expect(effectifDemande()).toBe(false);
    await harness.unmount();
  });
});
