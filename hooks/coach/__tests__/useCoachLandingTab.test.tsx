// hooks/coach/__tests__/useCoachLandingTab.test.tsx
//
// Ce hook ne porte AUCUNE règle (elle est testée dans
// domain/coachView/__tests__/landing.test.ts). Ce qu'on éprouve ici, c'est son
// CÂBLAGE : lit-il bien l'effectif de la couche coach, et le délai de garde
// ouvre-t-il vraiment l'espace au lieu de le laisser derrière un squelette ?

import { act } from "react-test-renderer";

// Les deux lectures sont pilotées par le test : on veut éprouver le branchement,
// pas re-tester Firestore.
jest.mock("../useCoachClub", () => ({ useCoachClub: () => mockClub.value }));
jest.mock("../useCoachRoster", () => ({ useCoachRoster: () => mockRoster.value }));

import { COACH_LANDING_TIMEOUT_MS, useCoachLandingTab } from "../useCoachLandingTab";
import { renderHook } from "./hookHarness";

type ClubState = { status: "loading" | "ready" | "notInClub" | "error"; clubId: string | null };
type RosterState = {
  status: "loading" | "ready" | "unavailable";
  memberCount: number;
  fetchedAt: number | null;
};

const mockClub: { value: ClubState } = { value: { status: "ready", clubId: "club-1" } };
const mockRoster: { value: RosterState } = {
  value: { status: "ready", memberCount: 3, fetchedAt: 1000 },
};

beforeEach(() => {
  mockClub.value = { status: "ready", clubId: "club-1" };
  mockRoster.value = { status: "ready", memberCount: 3, fetchedAt: 1000 };
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
});
