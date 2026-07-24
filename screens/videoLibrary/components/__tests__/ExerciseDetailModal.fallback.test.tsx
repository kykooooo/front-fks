// screens/videoLibrary/components/__tests__/ExerciseDetailModal.fallback.test.tsx
// Fallback safe : un exercise_id inconnu du front (nouvel exo backend pas
// encore backfillé) doit afficher une fiche minimale — jamais un modal muet.
// Flag catalogue V2 OFF (comportement nominal prod).
jest.mock("../../../../config/features", () => ({
  FKS_SIGNAL_V1_ENABLED: false,
  FKS_CATALOG_V2_ENABLED: false,
}));
jest.mock("../../../../services/exerciseCatalog", () => {
  const empty = { exercises: [], aliases: {}, variants: {} };
  return {
    useExerciseCatalog: () => empty,
    getExerciseCatalogSnapshot: () => empty,
    resolveExerciseCatalogId: (id: string) => id,
    reconcileCatalogVersion: () => {},
    hydrateExerciseCatalog: () => Promise.resolve(empty),
    refreshExerciseCatalog: () => Promise.resolve(empty),
  };
});
jest.mock("../../../../components/modal/ModalContainer", () => {
  const React = require("react");
  return {
    ModalContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ExerciseDetailModal } from "../ExerciseDetailModal";

const noop = () => {};
const baseProps = {
  visible: true,
  onClose: noop,
  onToggleFavorite: noop,
  isFavorite: () => false,
  onOpenVideo: noop,
  onOpenVariant: noop,
  getVariants: () => [],
  getNoEquipmentVariants: () => [],
};

const renderedJson = (tree: TestRenderer.ReactTestRenderer): string =>
  JSON.stringify(tree.toJSON());

describe("ExerciseDetailModal — fallback ID inconnu (flag OFF)", () => {
  it("un ID inconnu affiche une fiche minimale au nom humanisé, sans crash", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseDetailModal {...baseProps} exerciseId="str_nouvel_exo_mystere" />
      );
    });
    const json = renderedJson(tree);
    expect(json).toContain("Nouvel exo mystere");
    expect(json).toContain("Fiche détaillée à venir");
  });

  it("un ID connu de la banque garde son rendu nominal (neutralité)", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseDetailModal {...baseProps} exerciseId="sprint_acceleration" />
      );
    });
    const json = renderedJson(tree);
    // Nom éditorial V2 backfillé, pas le stub humanisé.
    expect(json.toLowerCase()).toContain("accélération");
    expect(json).not.toContain("Fiche détaillée à venir");
  });

  it("sans exerciseId, le modal ne rend rien (inchangé)", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ExerciseDetailModal {...baseProps} exerciseId={null} />);
    });
    expect(tree.toJSON()).toBeNull();
  });
});
