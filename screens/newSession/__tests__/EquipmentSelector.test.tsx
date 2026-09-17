// screens/newSession/__tests__/EquipmentSelector.test.tsx
//
// Preuve de rendu légère (react-test-renderer, même méthode que
// CarteEchecGeneration.test.tsx). Vérifie que le restylage DA garde EXACTEMENT
// les mêmes ids/conditions que l'ancienne version (spec §3.6) : rien de neuf,
// rien d'oublié.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { EquipmentSelector } from "../ui/EquipmentSelector";
import type { EnvironmentSelection } from "../types";

// Fixture volontairement réduite (mêmes ids/sources que EQUIPMENT_CATALOG
// dans NewSessionScreen.tsx) : ne PAS importer l'écran entier ici, il
// entraînerait toute sa chaîne d'imports (Firebase, stores...) pour un test
// qui ne porte que sur EquipmentSelector.
const EQUIPMENT_CATALOG = [
  { id: "barbell", label: "Barre + poids libres", source: "gym" as const },
  { id: "cones", label: "Cônes", source: "pitch" as const },
  { id: "bodyweight", label: "Poids du corps", source: "both" as const },
];

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

function pressableForLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return findPressables(tree).find((p) =>
    p.findAllByType(Text).some((t) => flattenText(t) === label)
  );
}

type Props = React.ComponentProps<typeof EquipmentSelector>;

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    catalog: EQUIPMENT_CATALOG as any,
    environment: [] as EnvironmentSelection,
    availableEquipment: [],
    selectedEquipment: [],
    onSelect: jest.fn(),
    ...overrides,
  };
}

function render(props: Props) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<EquipmentSelector {...props} />);
  });
  return tree;
}

describe("EquipmentSelector — matériel, ids/conditions inchangés", () => {
  test("terrain seul sans coche : la note poids du corps est visible", () => {
    const props = baseProps({ environment: ["pitch"], pitchSmallGearEnabled: false });
    const tree = render(props);
    const textes = allTexts(tree);
    expect(textes).toContain("Aucun matériel ? La séance sera au poids du corps.");
  });

  test("la bascule du petit matériel appelle onTogglePitchSmallGear", () => {
    const onTogglePitchSmallGear = jest.fn();
    const props = baseProps({
      environment: ["pitch"],
      pitchSmallGearEnabled: false,
      onTogglePitchSmallGear,
    });
    const tree = render(props);
    const ligne = pressableForLabel(tree, "Petit matériel dispo");
    expect(ligne).toBeTruthy();

    act(() => {
      (ligne!.props.onPress as () => void)();
    });

    expect(onTogglePitchSmallGear).toHaveBeenCalledWith(true);
  });

  test("séance mixte : les groupes des deux lieux sont présents", () => {
    const props = baseProps({ environment: ["gym", "home"] });
    const tree = render(props);
    const textes = allTexts(tree);
    expect(textes).toContain("Salle");
    expect(textes).toContain("Maison");
  });

  test("aucun en-tête de groupe en lieu unique", () => {
    const props = baseProps({ environment: ["gym"] });
    const tree = render(props);
    const textes = allTexts(tree);
    expect(textes).not.toContain("Salle");
  });

  test("les ids envoyés à onSelect sont exactement ceux du catalogue d'origine", () => {
    const onSelect = jest.fn();
    const props = baseProps({ environment: ["gym"], selectedEquipment: [], onSelect });
    const tree = render(props);
    const ligneSled = pressableForLabel(tree, "Traîneau / Sled");
    expect(ligneSled).toBeTruthy();

    act(() => {
      (ligneSled!.props.onPress as () => void)();
    });

    expect(onSelect).toHaveBeenCalledWith(["power_sled"]);
  });

  test("maison : les 4 items HOME_EQUIPMENT sont rendus", () => {
    const props = baseProps({ environment: ["home"] });
    const tree = render(props);
    const textes = allTexts(tree);
    for (const label of ["Petit matériel", "Sac à dos chargé", "Bouteilles d'eau", "Chaise / Banc"]) {
      expect(textes).toContain(label);
    }
  });

  test("sans lieu choisi : message d'invite, pas de bouton de validation résiduel", () => {
    const props = baseProps({ environment: [] });
    const tree = render(props);
    const textes = allTexts(tree);
    expect(textes).toContain("Choisis d'abord un lieu.");
    expect(textes).not.toContain("Valider le contexte");
  });

  test("contextLoading affiche la ligne de chargement sous le titre", () => {
    const props = baseProps({ environment: ["gym"], contextLoading: true });
    const tree = render(props);
    const textes = allTexts(tree);
    expect(textes).toContain("Chargement de ton matériel…");
  });
});
