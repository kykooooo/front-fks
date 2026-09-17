// screens/newSession/__tests__/GenerationActions.test.tsx
//
// Preuve de rendu légère (react-test-renderer, même méthode que
// CarteEchecGeneration.test.tsx) pour le pied collant de création de séance.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { GenerationActions } from "../ui/GenerationActions";
import type { EnvironmentSelection } from "../types";

// `useWindowDimensions` (réexporté par le barrel "react-native") est un
// getter (interop ESM->CJS) : `jest.spyOn(RN, "useWindowDimensions")` ne
// change pas ce que le composant lit, et remplacer tout le module "react-
// native" casse des natives (DevMenu…) hors du binaire app. On mock UNIQUEMENT
// le sous-module réel — react-native/index.js le réexporte tel quel, donc le
// composant (qui importe depuis "react-native") voit bien le mock. `require`
// (pas `import`) : le sous-module n'a pas de déclaration de type publique, et
// c'est un import profond volontaire, isolé à ce test.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 375, height: 844, scale: 1, fontScale: 1 })),
}));
// eslint-disable-next-line @react-native/no-deep-imports -- mock ciblé ci-dessus, isolé à ce fichier de test
const useWindowDimensionsMock: jest.Mock = require("react-native/Libraries/Utilities/useWindowDimensions").default;

function mockWindowHeight(height: number) {
  useWindowDimensionsMock.mockReturnValue({
    width: 320,
    height,
    scale: 1,
    fontScale: 1,
  });
}

function flattenText(node: TestRenderer.ReactTestInstance): string {
  const children = node.props.children;
  const list = Array.isArray(children) ? children : [children];
  return list
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("");
}

function allTexts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(flattenText);
}

function findPressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => {
    const type: any = n.type;
    const name = typeof type === "string" ? type : type?.displayName || type?.name;
    return name === "Pressable";
  });
}

type Props = React.ComponentProps<typeof GenerationActions>;

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    disabled: false,
    generating: false,
    environment: ["gym"] as EnvironmentSelection,
    selectedEquipment: [],
    libelles: {},
    onGenerate: jest.fn(),
    onAdvanceDay: jest.fn(),
    storeHydrated: true,
    alreadyAppliedToday: false,
    ...overrides,
  };
}

function render(props: Props) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<GenerationActions {...props} />);
  });
  return tree;
}

describe("GenerationActions — pied collant de création de séance", () => {
  beforeEach(() => {
    // Ramène le mock à la valeur par défaut ("grand écran") avant chaque
    // test : `mockWindowHeight` posée par un test précédent ne doit pas fuir.
    mockWindowHeight(844);
  });

  test("disabled=true : le bouton principal n'appelle jamais onGenerate", () => {
    const onGenerate = jest.fn();
    const tree = render(baseProps({ disabled: true, onGenerate }));
    const boutons = findPressables(tree);
    const principal = boutons.find((p) =>
      p.findAllByType(Text).some((t) => flattenText(t).startsWith("Créer ma séance"))
    );
    expect(principal).toBeTruthy();
    expect(principal!.props.onPress).toBeUndefined();

    act(() => {
      (principal!.props.onPress as (() => void) | undefined)?.();
    });
    expect(onGenerate).not.toHaveBeenCalled();
  });

  test("alreadyAppliedToday : le libellé dit « pour demain »", () => {
    const tree = render(baseProps({ alreadyAppliedToday: true }));
    const textes = allTexts(tree);
    expect(textes).toContain("Créer ma séance pour demain");
  });

  test("storeHydrated=false : le libellé annonce le chargement de l'historique", () => {
    const tree = render(baseProps({ storeHydrated: false }));
    const textes = allTexts(tree);
    expect(textes).toContain("Chargement de ton historique…");
  });

  test("clic sur le bouton principal (activé) appelle onGenerate", () => {
    const onGenerate = jest.fn();
    const tree = render(baseProps({ onGenerate }));
    const boutons = findPressables(tree);
    const principal = boutons.find((p) =>
      p.findAllByType(Text).some((t) => flattenText(t) === "Créer ma séance")
    );
    act(() => {
      (principal!.props.onPress as () => void)();
    });
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  test("le bouton dev « Jour OFF (+1j) » est rendu (contexte de test = __DEV__)", () => {
    // __DEV__ est vrai par défaut dans ce contexte Jest — voir
    // jourOffDevOnly.test.ts pour le verrou "absent hors __DEV__" (test de
    // source, plus fiable qu'un test de rendu pour cette bascule globale).
    const onAdvanceDay = jest.fn();
    const tree = render(baseProps({ onAdvanceDay }));
    const textes = allTexts(tree);
    expect(textes).toContain("Jour OFF (+1j)");
  });

  test("petit écran (< 700 de haut) : la légende décorative disparaît", () => {
    mockWindowHeight(568); // 320×568 mesuré par l'orchestrateur
    const tree = render(baseProps());
    const textes = allTexts(tree);
    expect(textes).not.toContain("Ta séance sera adaptée à tes choix.");
  });

  test("grand écran (≥ 700 de haut) : la légende décorative reste affichée", () => {
    mockWindowHeight(844);
    const tree = render(baseProps());
    const textes = allTexts(tree);
    expect(textes).toContain("Ta séance sera adaptée à tes choix.");
  });

  test("petit écran ET alreadyAppliedToday : la note d'info reste, ce n'est pas une déco", () => {
    mockWindowHeight(568);
    const tree = render(baseProps({ alreadyAppliedToday: true }));
    const textes = allTexts(tree);
    expect(textes).toContain(
      "Tu as déjà validé une séance aujourd’hui — la prochaine sera planifiée pour demain."
    );
  });

  test("ligne récapitulative : reflète lieu + matériel via resumerContexte", () => {
    const tree = render(
      baseProps({
        environment: ["gym"],
        selectedEquipment: ["power_sled"],
        libelles: { power_sled: "Traîneau / Sled" },
      })
    );
    const textes = allTexts(tree);
    expect(textes).toContain("Salle · Équipement standard + Traîneau / Sled");
  });
});
