// screens/videoLibrary/__tests__/nonSoloBadge.test.tsx
//
// Preuve de rendu légère (react-test-renderer, même approche que
// CarteEchecGeneration.test.tsx) : toute fiche à 2 visible en bibliothèque
// porte le badge « À deux » — et une fiche solo ne le porte jamais.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ExerciseListCard } from "../components/ExerciseListCard";
import { EXERCISE_BY_ID } from "../../../engine/exerciseBank";

const noop = () => {};

function renderCard(exerciseId: string) {
  const item = EXERCISE_BY_ID[exerciseId];
  expect(item).toBeDefined();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ExerciseListCard
        item={item}
        isFavorite={false}
        isHighlighted={false}
        onPress={noop}
        onToggleFavorite={noop}
        onOpenVideo={noop}
      />
    );
  });
  return JSON.stringify(renderer.toJSON());
}

describe("bibliothèque — badge « À deux » sur les cartes", () => {
  test("chaque fiche partenaire rédigée porte le badge", () => {
    for (const id of [
      "str_nordic",
      "str_eccentric_nordic_3s",
      "str_nordic_hamstring_eccentric",
      "str_razor_curl",
    ]) {
      expect(renderCard(id)).toContain("À deux");
    }
  });

  test("une fiche solo ne porte jamais le badge", () => {
    expect(renderCard("str_air_squat")).not.toContain("À deux");
  });
});
