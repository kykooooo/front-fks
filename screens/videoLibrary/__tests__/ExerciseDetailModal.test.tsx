// B2-2 : la fiche exercice affiche le contenu V2 au niveau du guide étalon —
// étapes NUMÉROTÉES, « Un bon geste », « À éviter » — et retombe proprement sur
// le contenu legacy (une étape, pas de section « À éviter ») quand il n'y a pas
// de fiche V2 (les 7 orphelins).
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ExerciseDetailModal } from "../components/ExerciseDetailModal";

// Le conteneur modal (blur + reanimated + gestures) est hors sujet ici : on
// teste le CONTENU de la fiche.
jest.mock("../../../components/modal/ModalContainer", () => ({
  ModalContainer: ({ children }: { children: React.ReactNode }) => children,
}));

const noop = () => {};
const renderModal = (exerciseId: string) => {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ExerciseDetailModal
        visible
        exerciseId={exerciseId}
        onClose={noop}
        onToggleFavorite={noop}
        isFavorite={() => false}
        onOpenVideo={noop}
        onOpenVariant={noop}
        getVariants={() => []}
        getNoEquipmentVariants={() => []}
      />
    );
  });
  return JSON.stringify(tree!.toJSON());
};

describe("fiche V2 complète (str_air_squat)", () => {
  it("affiche étapes numérotées, bon geste et À éviter", () => {
    const rendered = renderModal("str_air_squat");
    expect(rendered).toContain("Comment faire");
    expect(rendered).toContain("1. ");
    expect(rendered).toContain("Descends en poussant les hanches en arrière et en pliant les genoux.");
    expect(rendered).toContain("Un bon geste");
    expect(rendered).toContain("À éviter");
    expect(rendered).toContain("Genoux qui rentrent");
    // Nom français V2 (plus « Air squat »)
    expect(rendered).toContain("Squat poids du corps");
    // Matériel V2
    expect(rendered).toContain("Sans matériel");
  });
});

describe("repli legacy (run_tempo_2x8, orphelin V2)", () => {
  it("affiche la consigne legacy sans numérotation ni section À éviter", () => {
    const rendered = renderModal("run_tempo_2x8");
    expect(rendered).toContain("Comment faire");
    expect(rendered).toContain("Rythme tempo soutenu mais stable, sans sprinter.");
    expect(rendered).not.toContain("1. ");
    expect(rendered).not.toContain("À éviter");
  });
});
