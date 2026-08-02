// hooks/coach/__tests__/useCoachNowMs.test.tsx
//
// Ce que ce hook doit garantir, et pourquoi ça compte pour le coach :
//
//  1. Le rendu ne lit JAMAIS l'heure lui-même (idempotence) — sinon deux rendus
//     identiques donnent deux résultats différents.
//  2. La valeur BAT. C'est le point produit : la ligne "Mis à jour il y a N min"
//     ne doit pas rester bloquée sur son libellé de montage pendant qu'un écran
//     posé sur la table vieillit. Un écran qui annonce "à l'instant" vingt
//     minutes après ment sur la seule chose qu'il était censé garantir.
//  3. Le battement s'arrête au démontage (aucun setState orphelin).
//  4. L'horloge injectée est honorée : les tests pilotent le temps.
//
// Lancement depuis un worktree : npx jest --config jest.coach.config.js

import { act } from "react-test-renderer";

import { renderHook } from "./hookHarness";
import { useCoachNowMs, COACH_CLOCK_TICK_MS } from "../useCoachNowMs";

/** Horloge pilotée : le test décide quelle heure il est. */
const makeClock = (start: number) => {
  let t = start;
  return {
    now: () => t,
    avance: (ms: number) => {
      t += ms;
    },
  };
};

const T0 = 1_700_000_000_000;

afterEach(() => {
  jest.useRealTimers();
});

describe("useCoachNowMs", () => {
  test("au montage, retourne l'instant de l'horloge injectée", async () => {
    const clock = makeClock(T0);
    const h = await renderHook(() => useCoachNowMs({ now: clock.now, tickMs: 0 }));

    expect(h.current).toBe(T0);
    await h.unmount();
  });

  test("la valeur ne change PAS toute seule d'un rendu à l'autre", async () => {
    // Preuve d'idempotence : l'horloge avance, mais tant qu'aucun battement n'a
    // eu lieu, un re-rendu doit rendre exactement la même valeur.
    const clock = makeClock(T0);
    const h = await renderHook(() => useCoachNowMs({ now: clock.now, tickMs: 0 }));

    clock.avance(10 * 60_000);
    await h.rerender();

    expect(h.current).toBe(T0);
    await h.unmount();
  });

  test("la valeur suit l'horloge à chaque battement", async () => {
    jest.useFakeTimers();
    const clock = makeClock(T0);
    const h = await renderHook(() => useCoachNowMs({ now: clock.now, tickMs: 1_000 }));

    expect(h.current).toBe(T0);

    clock.avance(60_000);
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });

    expect(h.current).toBe(T0 + 60_000);
    await h.unmount();
  });

  test("tickMs <= 0 fige l'horloge (aucun battement programmé)", async () => {
    jest.useFakeTimers();
    const clock = makeClock(T0);
    const h = await renderHook(() => useCoachNowMs({ now: clock.now, tickMs: 0 }));

    clock.avance(60_000);
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });

    expect(h.current).toBe(T0);
    await h.unmount();
  });

  test("le battement s'arrête au démontage (aucun setState orphelin)", async () => {
    jest.useFakeTimers();
    const clock = makeClock(T0);
    const h = await renderHook(() => useCoachNowMs({ now: clock.now, tickMs: 1_000 }));
    await h.unmount();

    // React signale par console.error tout état écrit après démontage.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    clock.avance(60_000);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("cadence par défaut : plus fine que la minute affichée", async () => {
    // Le libellé le plus précis est à la minute ; battre moins souvent
    // afficherait des minutes fausses.
    expect(COACH_CLOCK_TICK_MS).toBeLessThanOrEqual(60_000);
    expect(COACH_CLOCK_TICK_MS).toBeGreaterThan(0);
  });
});
