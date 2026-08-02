// hooks/coach/__tests__/hookHarness.tsx
//
// Micro-harnais de rendu de hooks (le projet n'a pas @testing-library/react-native ;
// react-test-renderer est déjà présent via React 19). Volontairement minimal :
// il monte un composant sonde qui appelle le hook et publie son retour.
//
// Ce fichier ne contient AUCUN test : il ne matche pas `*.test.tsx`.

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

export type HookHarness<T> = {
  /** Dernière valeur retournée par le hook. */
  readonly current: T;
  /** Re-rend la sonde avec de nouveaux paramètres. */
  rerender: (next?: () => T) => Promise<void>;
  unmount: () => Promise<void>;
};

/**
 * Monte `useHook` et laisse les effets s'exécuter.
 * `act` asynchrone : les lectures (promesses déjà résolues) sont vidées au montage.
 */
export async function renderHook<T>(useHook: () => T): Promise<HookHarness<T>> {
  const box = { current: undefined as unknown as T, hook: useHook };

  function Probe() {
    box.current = box.hook();
    return null;
  }

  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<Probe />);
  });

  return {
    get current() {
      return box.current;
    },
    rerender: async (next?: () => T) => {
      if (next) box.hook = next;
      await act(async () => {
        renderer?.update(<Probe />);
      });
    },
    unmount: async () => {
      await act(async () => {
        renderer?.unmount();
      });
    },
  };
}

/** Exécute une action utilisateur (refresh, focus…) dans un `act` asynchrone. */
export async function actAsync(fn: () => void | Promise<void>): Promise<void> {
  await act(async () => {
    await fn();
  });
}

/** Laisse tourner les microtâches en attente (résolution d'une promesse différée). */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Promesse contrôlée par le test (pour simuler une réponse tardive). */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
