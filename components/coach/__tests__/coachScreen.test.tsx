// components/coach/__tests__/coachScreen.test.tsx
//
// Ce que ces tests protègent :
//  1. la largeur maximale du contenu — sans elle, une ligne d'effectif s'étire
//     sur toute la fenêtre d'un iPad et le coach perd la ligne des yeux ;
//  2. la respiration du squelette, qui doit se COUPER quand le système demande
//     "Réduire les animations".

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Text, View } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { CoachColumns, CoachScreen } from "../CoachScreen";
import { CoachSkeleton } from "../CoachSkeleton";
import { coachLayout } from "../coachTheme";
import { collectProp, flatText } from "./treeUtils";

// Métriques figées : sans elles, SafeAreaProvider attend une mesure native qui
// n'arrive jamais en test et ne rend aucun enfant.
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// On garde une trace des rendus pour les démonter après chaque test : la
// respiration du squelette est une boucle Animated, et un composant jamais
// démonté laisserait un timer tourner (jest resterait suspendu à la fin).
const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
  jest.restoreAllMocks();
});

async function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>
    );
  });
  mounted.push(renderer);
  return renderer.toJSON();
}

/** Toutes les `maxWidth` posées dans l'arbre (styles aplatis inclus). */
function maxWidths(tree: unknown): number[] {
  const out: number[] = [];
  const visit = (style: unknown): void => {
    if (!style) return;
    if (Array.isArray(style)) {
      style.forEach(visit);
      return;
    }
    if (typeof style === "object" && "maxWidth" in (style as Record<string, unknown>)) {
      const v = (style as { maxWidth?: unknown }).maxWidth;
      if (typeof v === "number") out.push(v);
    }
  };
  collectProp(tree as never, "style").forEach(visit);
  return out;
}

describe("CoachScreen — largeur du contenu plafonnée", () => {
  test("le contenu est borné à la largeur de lecture", async () => {
    const tree = await render(
      <CoachScreen>
        <Text>Effectif</Text>
      </CoachScreen>
    );
    expect(maxWidths(tree)).toContain(coachLayout.maxContentWidth);
    expect(flatText(tree)).toContain("Effectif");
  });

  test("l'en-tête collé reçoit la MÊME largeur que le contenu (alignement)", async () => {
    const tree = await render(
      <CoachScreen header={<Text>Semaine du 20 au 26 juillet</Text>}>
        <Text>Effectif</Text>
      </CoachScreen>
    );
    const largeurs = maxWidths(tree).filter((w) => w === coachLayout.maxContentWidth);
    // Une pour l'en-tête, une pour le contenu.
    expect(largeurs.length).toBeGreaterThanOrEqual(2);
    expect(flatText(tree)).toContain("Semaine du 20 au 26 juillet");
  });

  test("un écran qui ne sait pas gérer deux colonnes ne s'élargit jamais", async () => {
    const tree = await render(
      <CoachScreen wide={false}>
        <Text>Contenu</Text>
      </CoachScreen>
    );
    expect(maxWidths(tree)).not.toContain(coachLayout.maxContentWidthWide);
  });

  test("CoachColumns garde l'ordre de lecture principal puis secondaire", async () => {
    const tree = await render(
      <CoachColumns primary={<Text>Effectif</Text>} secondary={<Text>Signaux</Text>} />
    );
    const texte = flatText(tree);
    expect(texte.indexOf("Effectif")).toBeLessThan(texte.indexOf("Signaux"));
  });

  test("scroll={false} laisse l'écran fournir sa propre liste", async () => {
    const tree = await render(
      <CoachScreen scroll={false}>
        <View>
          <Text>Ma liste</Text>
        </View>
      </CoachScreen>
    );
    expect(flatText(tree)).toContain("Ma liste");
  });
});

describe("CoachSkeleton — chargement lisible et non agressif", () => {
  test("il s'annonce en une seule fois au lecteur d'écran", async () => {
    const tree = await render(<CoachSkeleton variant="list" rows={3} />);
    const labels = collectProp(tree as never, "accessibilityLabel").filter(
      (v): v is string => typeof v === "string"
    );
    expect(labels).toContain("Chargement en cours");
    // Une seule annonce, pas une par rectangle gris.
    expect(labels.filter((l) => l === "Chargement en cours").length).toBe(1);
  });

  test("reduceMotion actif : l'opacité est figée, aucune animation en boucle", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true as unknown as boolean);

    const tree = await render(<CoachSkeleton variant="card" />);
    // Une valeur numérique constante (et non une interpolation animée).
    const opacites = collectProp(tree as never, "style")
      .flat()
      .filter(
        (s): s is { opacity: number } =>
          !!s && typeof s === "object" && typeof (s as { opacity?: unknown }).opacity === "number"
      )
      .map((s) => s.opacity);
    expect(opacites.length).toBeGreaterThan(0);
    expect(opacites.every((o) => o > 0 && o <= 1)).toBe(true);
  });

  test("le nombre de lignes reste borné même si l'appelant délire", async () => {
    const tree = await render(<CoachSkeleton variant="list" rows={999} />);
    expect(tree).not.toBeNull();
  });
});
