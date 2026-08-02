// components/coach/__tests__/coachTruncation.test.tsx
//
// Ce que ces tests protègent : la règle d'or CLAUDE.md #11 sur les blocs de
// texte — `numberOfLines` sur TOUT contenu venu du serveur, et `minHeight`
// (jamais `height`) sur les conteneurs de texte.
//
// POURQUOI c'est un vrai risque : le prénom et les libellés viennent de la
// projection serveur. Un prénom à rallonge, ou un libellé traduit plus long que
// prévu, casse une ligne d'effectif — la pastille de statut part hors écran et
// le coach ne voit plus le statut, qui est justement l'information utile.
//
// NB : on cible les nœuds `Text` qui portent RÉELLEMENT le contenu testé.
// Ionicons se rend lui aussi en `Text` (un glyphe), mais il n'a rien à tronquer.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { CoachPlayerRow } from "../CoachPlayerRow";
import { CoachSignalRow } from "../CoachSignalRow";
import { findByHostType, findTextNodesContaining, flatText } from "./treeUtils";

const LONG_NAME = "Jean-Baptiste-Emmanuel De La Villardière-Beauchamp Du Plessis Montfort";
const LONG_META = "Milieu défensif central relayeur box-to-box · U17 Régional 1 · Pied gauche";
const LONG_ACTIVITY =
  "Séance terminée il y a trois jours, avec plusieurs exercices remplacés faute de matériel";

async function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  // `await act(async ...)` : le chargement de police d'Ionicons déclenche un
  // setState asynchrone, on le laisse se stabiliser avant de lire l'arbre.
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return renderer.toJSON();
}

/** Le contenu `needle` est affiché, et le bloc qui le porte borne ses lignes. */
function expectBounded(tree: unknown, needle: string, max: number): void {
  const nodes = findTextNodesContaining(tree as never, needle);
  expect(nodes.length).toBeGreaterThan(0);
  // Le nœud le plus profond qui contient le texte est le <Text> réel.
  const leaf = nodes[nodes.length - 1];
  expect(typeof leaf.props.numberOfLines).toBe("number");
  expect(leaf.props.numberOfLines).toBeGreaterThan(0);
  expect(leaf.props.numberOfLines).toBeLessThanOrEqual(max);
}

describe("Troncature — contenu serveur long", () => {
  test("CoachPlayerRow : prénom, contexte et activité sont tous bornés", async () => {
    const tree = await render(
      <CoachPlayerRow
        firstName={LONG_NAME}
        meta={LONG_META}
        statusLevel="check"
        activityLabel={LONG_ACTIVITY}
        onPress={() => {}}
      />
    );

    expectBounded(tree, LONG_NAME, 1); // le prénom ne doit JAMAIS passer sur 2 lignes
    // 2 lignes, pas 1 : cette ligne porte la RAISON d'attention sur l'écran
    // "Aujourd'hui" ("Séance prévue vendredi, pas encore faite"), qui ne tient
    // pas en une ligne à 375 pt. Elle reste BORNÉE — c'est ce que ce test garde.
    expectBounded(tree, LONG_META, 2);
    expectBounded(tree, LONG_ACTIVITY, 1);
  });

  test("CoachPlayerRow : le libellé de statut est borné lui aussi", async () => {
    const long = "Aucune séance terminée depuis plus de deux semaines complètes";
    const tree = await render(
      <CoachPlayerRow firstName="Léa" statusLevel="check" statusLabel={long} />
    );
    expectBounded(tree, long, 1);
  });

  test("CoachPlayerRow : aucun bloc de texte ne fige une `height`", async () => {
    const tree = await render(
      <CoachPlayerRow firstName={LONG_NAME} meta={LONG_META} statusLevel="watch" />
    );

    for (const t of findByHostType(tree as never, "Text")) {
      const flat = (StyleSheet.flatten(t.props.style) ?? {}) as { height?: unknown };
      expect(flat.height).toBeUndefined();
    }
  });

  test("CoachPlayerRow : le nom absent devient un texte honnête, pas une ligne vide", async () => {
    const texte = flatText(
      (await render(<CoachPlayerRow firstName={null} statusLevel="unknown" />)) as never
    );
    expect(texte).toContain("Joueur sans prénom");
    expect(texte).toContain("Aucune séance enregistrée");
    expect(texte).toContain("?"); // initiale d'avatar : jamais une lettre inventée
  });

  test("CoachSignalRow : titre et 'pourquoi' sont bornés, la provenance est affichée", async () => {
    const tree = await render(
      <CoachSignalRow
        title={LONG_ACTIVITY}
        why={LONG_META}
        provenance="execution"
        level="watch"
      />
    );

    expectBounded(tree, LONG_ACTIVITY, 2);
    expectBounded(tree, LONG_META, 3);
    // La provenance est TOUJOURS affichée : une estimation ne se présente
    // jamais comme une mesure.
    expectBounded(tree, "Relevé pendant la séance", 1);
  });
});
