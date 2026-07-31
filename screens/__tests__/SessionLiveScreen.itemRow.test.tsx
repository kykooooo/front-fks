// screens/__tests__/SessionLiveScreen.itemRow.test.tsx
// Preuve de rendu legere du contrat de layout de la ligne d'item (BlockCard) --
// point 3 de la revue adversariale du fix affordance "Adapter" (commit 2449382) :
// l'invariant "tient sur 320px de large" avait ete affirme par raisonnement
// (commentaire du diff), jamais demontre. react-test-renderer ne calcule PAS
// de pixels reels ici (pas de moteur de layout Yoga en JS pur dans ce
// harnais) -- ce test documente donc le CONTRAT DE LAYOUT declaratif :
//  - la colonne nom garde flex:1 (jamais de largeur figee) et numberOfLines,
//  - la colonne actions (Fiche + pill "Adapter") garde une largeur
//    intrinseque au contenu (pas de largeur figee non plus),
//  - le pill "Adapter" garde une cible tactile >=44pt sans largeur figee,
// meme avec un nom d'exercice long ET un item multi-series (le scenario le
// plus a risque d'un ecran etroit).
import React from "react";
import { Animated } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

// BlockCard ne rend jamais ItemActionsSheet/ReplacementSheet (ils vivent dans
// le composant parent SessionLiveScreen, ouverts via callback onOpenActions).
// Mockes ici pour ne pas tirer, au simple import du module, toute la chaine
// ModalContainer -> react-native-reanimated / react-native-gesture-handler --
// hors sujet pour un test de layout de la ligne d'item.
jest.mock("../../components/session/ItemActionsSheet", () => ({ ItemActionsSheet: () => null }));
jest.mock("../../components/session/ReplacementSheet", () => ({ ReplacementSheet: () => null }));
// Meme precaution que screens/feedback/__tests__/useFeedbackSave.test.tsx :
// @amplitude/analytics-react-native touche AsyncStorage natif au simple import.
jest.mock("../../services/analytics", () => ({
  trackEvent: jest.fn(),
  initAnalytics: jest.fn(),
  setAnalyticsUserId: jest.fn(),
}));

import { BlockCard } from "../SessionLiveScreen";
import { getCycleTheme } from "../../constants/cycleTheme";

const LONG_NAME =
  "Fentes bulgares alternees avec charge additionnelle et pause genou controlee";

function buildBlock() {
  return {
    blockId: "b1",
    name: "Bloc test",
    type: "strength",
    intensity: "high",
    durationMin: 12,
    items: [
      {
        id: "item-1",
        exerciseId: "str_bulgarian_split",
        name: LONG_NAME,
        sets: 4,
        reps: 8,
      },
    ],
  };
}

type JsonNode = { type: string; props: Record<string, any>; children: (JsonNode | string)[] | null };

function flattenStyle(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce((acc: Record<string, any>, s) => Object.assign(acc, flattenStyle(s)), {});
  }
  if (typeof style === "object") return style;
  return {};
}

/** Parcourt l'arbre toJSON() et retourne chaque noeud avec son parent direct (par reference). */
function collectNodes(root: unknown): Array<{ node: JsonNode; parent: JsonNode | null }> {
  const out: Array<{ node: JsonNode; parent: JsonNode | null }> = [];
  const visit = (node: any, parent: JsonNode | null) => {
    if (node == null || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, parent));
      return;
    }
    out.push({ node, parent });
    if (node.children) node.children.forEach((c: any) => visit(c, node));
  };
  visit(root, null);
  return out;
}

function findTextContaining(nodes: Array<{ node: JsonNode; parent: JsonNode | null }>, text: string) {
  return nodes.find(
    ({ node }) =>
      node.type === "Text" &&
      Array.isArray(node.children) &&
      node.children.some((c) => typeof c === "string" && c.includes(text))
  );
}

async function renderRow() {
  let tree: { toJSON(): unknown } | undefined;
  await act(async () => {
    tree = TestRenderer.create(
      <BlockCard
        block={buildBlock() as any}
        blockIndex={0}
        blockWidth={320}
        itemSize={320}
        scrollX={new Animated.Value(0)}
        checkedSets={{}}
        onToggleSet={jest.fn()}
        onOpenExercise={jest.fn()}
        getPulse={() => new Animated.Value(1)}
        cycleTheme={getCycleTheme(null)}
        execItemsByKey={{}}
        onOpenActions={jest.fn()}
      />
    );
  });
  return tree!;
}

describe("SessionLiveScreen — contrat de layout de la ligne d'item (nom long + multi-series)", () => {
  test("le nom (numberOfLines=2) vit dans une colonne flex:1 sans largeur figee", async () => {
    const tree = await renderRow();
    const nodes = collectNodes(tree.toJSON());

    const nameEntry = findTextContaining(nodes, LONG_NAME);
    expect(nameEntry).toBeTruthy();
    expect(nameEntry!.node.props.numberOfLines).toBe(2);

    // Parent immediat : <View style={{ flex: 1 }}> (screens/SessionLiveScreen.tsx ~L579).
    const nameColumn = nameEntry!.parent;
    expect(nameColumn).toBeTruthy();
    const nameColumnStyle = flattenStyle(nameColumn!.props.style);
    expect(nameColumnStyle.flex).toBe(1);
    expect(nameColumnStyle.width).toBeUndefined();

    // Grand-parent : itemMain (styles.itemMain -- flex:1, flexDirection:"row").
    const nameColumnEntry = nodes.find((n) => n.node === nameColumn);
    const itemMain = nameColumnEntry?.parent;
    expect(itemMain).toBeTruthy();
    const itemMainStyle = flattenStyle(itemMain!.props.style);
    expect(itemMainStyle.flex).toBe(1);
    expect(itemMainStyle.flexDirection).toBe("row");
    expect(itemMainStyle.width).toBeUndefined();
  });

  test("l'item multi-series (4 sets) affiche bien la variante compteur + puces, pas la case unique", async () => {
    const tree = await renderRow();
    const nodes = collectNodes(tree.toJSON());
    const counter = findTextContaining(nodes, "séries");
    expect(counter).toBeTruthy();
    expect((counter!.node.children as string[]).join("")).toContain("0/4");
  });

  test("le pill 'Adapter' garde une cible tactile >=44pt sans largeur figee (pas de retour au bouton 32x32)", async () => {
    const tree = await renderRow();
    const nodes = collectNodes(tree.toJSON());

    const pillEntry = nodes.find(
      ({ node }) =>
        node.props?.accessibilityRole === "button" &&
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Options pour")
    );
    expect(pillEntry).toBeTruthy();
    // Point 2 de la revue : le label reflete les VRAIES options de la sheet
    // (Adapte / Saute / Je ne peux pas -- pas "remplacer, adapter ou passer").
    expect(pillEntry!.node.props.accessibilityLabel).toBe(
      `Options pour ${LONG_NAME} : adapter, sauter, ou signaler que tu ne peux pas le faire`
    );

    const pillStyle = flattenStyle(pillEntry!.node.props.style);
    expect(pillStyle.width).toBeUndefined();
    expect(pillStyle.minHeight).toBe(44);
    expect(pillStyle.paddingHorizontal).toBe(12);

    const adapterLabel = findTextContaining(nodes, "Adapter");
    expect(adapterLabel).toBeTruthy();
  });

  test("la colonne actions (Fiche + pill) garde une largeur intrinseque au contenu, jamais figee", async () => {
    const tree = await renderRow();
    const nodes = collectNodes(tree.toJSON());

    // styles.itemActionsCol : { alignItems: "flex-end", gap: 8 } -- ni flex, ni width.
    const actionsColumnEntry = nodes.find(({ node }) => {
      const style = flattenStyle(node.props?.style);
      return style.alignItems === "flex-end" && style.gap === 8;
    });
    expect(actionsColumnEntry).toBeTruthy();
    const actionsColumnStyle = flattenStyle(actionsColumnEntry!.node.props.style);
    expect(actionsColumnStyle.width).toBeUndefined();
    expect(actionsColumnStyle.flex).toBeUndefined();
  });
});
