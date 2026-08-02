// screens/coach/__tests__/CoachAccessUnconfirmedScreen.test.tsx
//
// L'ÉCRAN DU « JE NE SAIS PAS ».
//
// Ce que ces tests protègent :
//  1. il DIT ce qui s'est passé et ce qu'il a fait des données. Un écran vide
//     sans un mot laisserait croire à une perte ;
//  2. il ne DIAGNOSTIQUE pas. La cause peut être le réseau comme un droit
//     retiré ; affirmer l'une des deux enverrait le coach chercher au mauvais
//     endroit (« vérifiez votre wifi » quand c'est son accès qui a sauté) ;
//  3. il offre UNE sortie, et elle relance la vérification.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import CoachAccessUnconfirmedScreen from "../CoachAccessUnconfirmedScreen";
import { COACH_ACCESS_UNCONFIRMED_COPY } from "../../../domain/coachAuthority";

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function rendre(onRetry = jest.fn()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachAccessUnconfirmedScreen onRetry={onRetry} />
      </SafeAreaProvider>,
    );
  });
  return { renderer, onRetry };
}

/** Tout le texte affiché, aplati. */
function texteDe(node: unknown): string {
  const out: string[] = [];
  const walk = (n: any): void => {
    if (n == null) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === "string") {
      const s = n.trim();
      if (s) out.push(s);
      return;
    }
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join(" | ");
}

describe("CoachAccessUnconfirmedScreen", () => {
  test("dit ce qui n'a pas marché, et ce qui a été fait des données", async () => {
    const { renderer } = await rendre();
    const texte = texteDe(renderer.toJSON());

    expect(texte).toContain(COACH_ACCESS_UNCONFIRMED_COPY.titre);
    expect(texte).toContain("vérifier tes accès");
    expect(texte).toContain("effacées de cet appareil");
    expect(texte).toContain("rien n'est perdu");
  });

  test("ne diagnostique rien et n'accuse personne", async () => {
    const { renderer } = await rendre();
    const texte = texteDe(renderer.toJSON()).toLowerCase();

    expect(texte).not.toContain("une erreur est survenue");
    expect(texte).not.toContain("permission");
    expect(texte).not.toContain("retiré du club");
    expect(texte).not.toContain("non autorisé");
  });

  test("une seule sortie, et elle relance la vérification", async () => {
    const onRetry = jest.fn();
    const { renderer } = await rendre(onRetry);
    const boutons = renderer.root.findAll(
      (n) => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function",
    );
    expect(boutons).toHaveLength(1);
    expect(boutons[0].props.accessibilityLabel).toBe(COACH_ACCESS_UNCONFIRMED_COPY.action);

    await act(async () => {
      (boutons[0].props.onPress as () => void)();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
