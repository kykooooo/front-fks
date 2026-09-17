// screens/newSession/__tests__/EnvironmentSelector.test.tsx
//
// Preuve de rendu légère (react-test-renderer, même méthode que
// CarteEchecGeneration.test.tsx) : la règle réelle reste "1 ou 2 lieux",
// filtrée par `allowed`, avec le 3e appui neutralisé + toast (SANS changer
// l'état produit).

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { EnvironmentSelector } from "../ui/EnvironmentSelector";
import type { EnvironmentSelection } from "../types";

jest.mock("../../../utils/toast", () => ({
  showToast: jest.fn(),
}));
import { showToast } from "../../../utils/toast";

function flattenText(node: TestRenderer.ReactTestInstance): string {
  const children = node.props.children;
  const list = Array.isArray(children) ? children : [children];
  return list
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("");
}

function findPressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => {
    const type: any = n.type;
    const name = typeof type === "string" ? type : type?.displayName || type?.name;
    return name === "Pressable";
  });
}

function pressableForLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return findPressables(tree).find((p) =>
    p.props.accessibilityLabel === label
  );
}

function render(
  environment: EnvironmentSelection,
  setEnvironment: jest.Mock,
  allowed?: Array<"gym" | "pitch" | "home">
) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <EnvironmentSelector environment={environment} setEnvironment={setEnvironment} allowed={allowed} />
    );
  });
  return tree;
}

describe("EnvironmentSelector — sélection multi-lieux (1 ou 2)", () => {
  beforeEach(() => {
    (showToast as jest.Mock).mockClear();
  });

  test("sélection d'un lieu : l'updater ajoute le lieu à un tableau vide", () => {
    const setEnvironment = jest.fn();
    const tree = render([], setEnvironment);
    const tuileSalle = pressableForLabel(tree, "Salle");
    expect(tuileSalle).toBeTruthy();

    act(() => {
      (tuileSalle!.props.onPress as () => void)();
    });

    expect(setEnvironment).toHaveBeenCalledTimes(1);
    const updater = setEnvironment.mock.calls[0][0] as (prev: EnvironmentSelection) => EnvironmentSelection;
    expect(updater([])).toEqual(["gym"]);
  });

  test("sélection d'un 2e lieu (mixte) : l'updater ajoute au tableau existant", () => {
    const setEnvironment = jest.fn();
    const tree = render(["gym"], setEnvironment);
    const tuileTerrain = pressableForLabel(tree, "Terrain");

    act(() => {
      (tuileTerrain!.props.onPress as () => void)();
    });

    const updater = setEnvironment.mock.calls[0][0] as (prev: EnvironmentSelection) => EnvironmentSelection;
    expect(updater(["gym"])).toEqual(["gym", "pitch"]);
  });

  test("refus du 3e lieu : l'état produit ne change pas, et un toast informe le joueur UNE SEULE FOIS", () => {
    // REWORK orchestrateur : la décision se prend AVANT `setEnvironment`, sur
    // la prop `environment` — `setEnvironment` n'est plus du tout appelé dans
    // ce cas (la fonction de mise à jour doit rester pure, sans effet de bord
    // type toast ; React peut l'invoquer deux fois en StrictMode).
    const setEnvironment = jest.fn();
    const tree = render(["gym", "pitch"], setEnvironment);
    const tuileMaison = pressableForLabel(tree, "Maison");

    act(() => {
      (tuileMaison!.props.onPress as () => void)();
    });

    expect(setEnvironment).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info", title: "Deux lieux maximum" })
    );
  });

  test("désélection : retire le lieu du tableau", () => {
    const setEnvironment = jest.fn();
    const tree = render(["gym", "pitch"], setEnvironment);
    const tuileSalle = pressableForLabel(tree, "Salle");

    act(() => {
      (tuileSalle!.props.onPress as () => void)();
    });

    const updater = setEnvironment.mock.calls[0][0] as (prev: EnvironmentSelection) => EnvironmentSelection;
    expect(updater(["gym", "pitch"])).toEqual(["pitch"]);
  });

  test("lieu non autorisé par le cycle : sa tuile n'est pas rendue", () => {
    const setEnvironment = jest.fn();
    const tree = render([], setEnvironment, ["gym", "home"]);
    const textes = tree.root.findAllByType(Text).map(flattenText);
    expect(textes).not.toContain("Terrain");
    expect(pressableForLabel(tree, "Terrain")).toBeUndefined();
  });

  test("ordre CANONIQUE des tuiles (Salle, Terrain, Maison), indépendant de l'ordre de `allowed`", () => {
    // L'ordre de `allowedLocations` varie d'un cycle à l'autre (ex: cycle
    // Fondation = ["home","pitch","gym"]) — ce n'est PAS un ordre d'affichage.
    // La maquette impose Salle, Terrain, Maison quelle que soit `allowed`.
    const setEnvironment = jest.fn();
    const tree = render([], setEnvironment, ["home", "gym", "pitch"]);
    const labels = findPressables(tree).map(
      (p) => p.props.accessibilityLabel as string
    );
    expect(labels).toEqual(["Salle", "Terrain", "Maison"]);
  });

  test("état `checked` exposé pour l'accessibilité", () => {
    const setEnvironment = jest.fn();
    const tree = render(["gym"], setEnvironment);
    const tuileSalle = pressableForLabel(tree, "Salle");
    const tuileTerrain = pressableForLabel(tree, "Terrain");

    expect(tuileSalle!.props.accessibilityState).toEqual({ checked: true });
    expect(tuileTerrain!.props.accessibilityState).toEqual({ checked: false });
  });
});
