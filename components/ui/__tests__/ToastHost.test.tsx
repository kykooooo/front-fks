// components/ui/__tests__/ToastHost.test.tsx
//
// CE QUE CE TEST PROTEGE.
// ToastHost garde en memoire l'identifiant du minuteur d'auto-fermeture pour
// pouvoir l'annuler (nouveau toast, ou demontage du composant). Cet identifiant
// etait type NodeJS.Timeout, un type de Node absent de React Native : ici
// setTimeout renvoie un identifiant numerique. Le type porte est desormais
// ReturnType<typeof setTimeout>.
//
// Un type ne se verifie pas a l'execution : ce qu'on verifie ici, c'est le
// COMPORTEMENT qui depend de cet identifiant, seule preuve utile.
//   1. rien ne s'affiche tant qu'aucun toast n'est emis ;
//   2. un toast emis s'affiche (titre + message) et arme le minuteur ;
//   3. le minuteur ferme bien le toast a l'echeance ;
//   4. un second toast annule le minuteur du premier ;
//   5. le demontage annule le minuteur en cours.
//
// Aux points 4 et 5 on verifie que clearTimeout recoit EXACTEMENT la valeur
// rendue par setTimeout : c'est le contrat que le type doit decrire.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo } from "react-native";

import { ToastHost } from "../ToastHost";
import { showToast } from "../../../utils/toast";

// Rassemble tout le texte rendu par l'arbre (les Text imbriques compris).
const flatText = (node: unknown): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatText).join(" ");
  const children = (node as { children?: unknown }).children;
  return flatText(children);
};

// Retrouve l'identifiant rendu par le dernier setTimeout arme avec ce delai.
// On filtre sur le delai : React et React Native arment leurs propres minuteurs,
// compter les minuteurs vivants ne prouverait rien.
const minuteurArmeAvec = (
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  results: ReadonlyArray<{ value: unknown }>,
  delai: number
): unknown => {
  const index = calls.map((args) => args[1]).lastIndexOf(delai);
  if (index === -1) {
    throw new Error(`Aucun setTimeout arme avec un delai de ${delai} ms`);
  }
  return results[index].value;
};

describe("ToastHost", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Chemin "mouvement reduit" : le composant ouvre et ferme sans animation,
    // ce qui rend le test independant du pilote d'animation.
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Monte le composant et laisse la promesse de reduceMotion se resoudre.
  const monter = async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ToastHost />);
    });
    return renderer;
  };

  it("n'affiche rien tant qu'aucun toast n'est emis", async () => {
    const renderer = await monter();
    expect(renderer.toJSON()).toBeNull();
    await act(async () => renderer.unmount());
  });

  it("affiche le toast emis et arme le minuteur de fermeture", async () => {
    const renderer = await monter();
    const setSpy = jest.spyOn(globalThis, "setTimeout");

    await act(async () => {
      showToast({ type: "success", title: "Seance enregistree", message: "Bravo" });
    });

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("Seance enregistree");
    expect(texte).toContain("Bravo");
    // 2200 ms = duree par defaut du composant.
    expect(setSpy.mock.calls.some((args) => args[1] === 2200)).toBe(true);

    await act(async () => renderer.unmount());
  });

  it("ferme le toast a l'echeance du minuteur", async () => {
    const renderer = await monter();

    await act(async () => {
      showToast({ title: "Message court", durationMs: 1000 });
    });
    expect(flatText(renderer.toJSON())).toContain("Message court");

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(renderer.toJSON()).toBeNull();

    await act(async () => renderer.unmount());
  });

  it("annule le minuteur du toast precedent quand un nouveau toast arrive", async () => {
    const renderer = await monter();
    const setSpy = jest.spyOn(globalThis, "setTimeout");
    const clearSpy = jest.spyOn(globalThis, "clearTimeout");

    await act(async () => {
      showToast({ title: "Premier", durationMs: 5000 });
    });
    const premierMinuteur = minuteurArmeAvec(setSpy.mock.calls, setSpy.mock.results, 5000);

    await act(async () => {
      showToast({ title: "Second", durationMs: 3000 });
    });

    expect(clearSpy).toHaveBeenCalledWith(premierMinuteur);
    expect(flatText(renderer.toJSON())).toContain("Second");

    await act(async () => renderer.unmount());
  });

  it("annule le minuteur en cours au demontage", async () => {
    const renderer = await monter();
    const setSpy = jest.spyOn(globalThis, "setTimeout");
    const clearSpy = jest.spyOn(globalThis, "clearTimeout");

    await act(async () => {
      showToast({ title: "En cours", durationMs: 4000 });
    });
    const minuteur = minuteurArmeAvec(setSpy.mock.calls, setSpy.mock.results, 4000);

    await act(async () => renderer.unmount());

    expect(clearSpy).toHaveBeenCalledWith(minuteur);
  });
});
