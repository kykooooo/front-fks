// components/coach/__tests__/coachMetric.test.tsx
//
// Ce que ces tests protègent : ZÉRO N'EST PAS "INDISPONIBLE".
// Si un jour quelqu'un "simplifie" en affichant `value ?? 0` ou en rendant "—"
// pour les deux cas, ces tests tombent. Sans eux, un coach pourrait lire
// "0 séance" alors que la donnée n'est simplement jamais arrivée — et relancer
// un joueur qui s'est entraîné.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { CoachMetric } from "../CoachMetric";
import { COACH_VALUE_UNAVAILABLE } from "../coachTheme";
import { collectProp, flatText } from "./treeUtils";

// `await act(async ...)` : Ionicons charge sa police via un setState async, on
// laisse le rendu se stabiliser avant de lire l'arbre.
async function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return renderer.toJSON();
}

const a11y = (tree: unknown): string =>
  collectProp(tree as never, "accessibilityLabel")
    .filter((v): v is string => typeof v === "string")
    .join(" | ");

describe("CoachMetric — zéro mesuré vs donnée absente", () => {
  test("une valeur à zéro affiche le chiffre 0, PAS un tiret", async () => {
    const tree = await render(
      <CoachMetric label="Séances terminées" value={0} icon="checkmark-done-outline" />
    );
    const texte = flatText(tree);
    expect(texte).toContain("0");
    expect(texte).not.toContain(COACH_VALUE_UNAVAILABLE);
    expect(texte).not.toContain("Donnée absente");
  });

  test("une valeur absente affiche le tiret ET le dit explicitement", async () => {
    const tree = await render(
      <CoachMetric label="Séances terminées" value={null} icon="checkmark-done-outline" />
    );
    const texte = flatText(tree);
    expect(texte).toContain(COACH_VALUE_UNAVAILABLE);
    expect(texte).toContain("Donnée absente");
    expect(texte).not.toContain("0");
  });

  test("les deux états ne produisent PAS le même rendu", async () => {
    const zero = flatText(
      await render(<CoachMetric label="Séances" value={0} icon="checkmark-done-outline" />)
    );
    const absent = flatText(
      await render(<CoachMetric label="Séances" value={null} icon="checkmark-done-outline" />)
    );
    expect(zero).not.toBe(absent);
  });

  test("le lecteur d'écran entend 'indisponible', jamais 'tiret'", async () => {
    const absent = a11y(
      await render(<CoachMetric label="Séances terminées" value={null} icon="calendar-outline" />)
    );
    expect(absent).toContain("donnée indisponible");
    expect(absent).not.toContain(COACH_VALUE_UNAVAILABLE);

    const zero = a11y(
      await render(<CoachMetric label="Séances terminées" value={0} icon="calendar-outline" />)
    );
    expect(zero).toContain("Séances terminées : 0");
    expect(zero).not.toContain("indisponible");
  });

  test("l'unité accompagne une mesure, jamais une absence de mesure", async () => {
    const avec = flatText(
      await render(<CoachMetric label="Durée" value={45} unit="min" icon="time-outline" />)
    );
    expect(avec).toContain("min");

    const sans = flatText(
      await render(<CoachMetric label="Durée" value={null} unit="min" icon="time-outline" />)
    );
    expect(sans).not.toContain("min");
  });
});
