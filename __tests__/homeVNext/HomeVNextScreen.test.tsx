// __tests__/homeVNext/HomeVNextScreen.test.tsx
// =============================================================================
// PROTOTYPE Home vNext — TESTS DE RENDU
// =============================================================================
//
// Le test du ViewModel verifie ce que l'ecran a le DROIT d'afficher.
// Celui-ci verifie ce que l'ecran affiche REELLEMENT : il monte les vrais
// composants sur les 14 etats et relit l'arbre produit.
//
// Les regles verifiees ne sont pas cosmetiques, ce sont les defauts constates
// dans l'audit :
//   - un seul aplat colore par ecran (hierarchie inversee, §3.3) ;
//   - le libelle de l'action ecrit une seule fois (le meme bouton rendu deux
//     fois, §3.2) ;
//   - aucun bouton desactive (etat E3) ;
//   - le mot "Serie" nulle part (interdit par le cadre de mission) ;
//   - aucun jargon ATL / CTL / TSB (§9.2) ;
//   - un `accessibilityRole` sur chaque element tactile (le Home actuel en a
//     zero) ;
//   - `numberOfLines` sur tout contenu venant du backend (§3.4).
//
// NOTE D'EXECUTION : la config jest du depot ignore `.claude/worktrees/`
// (`testPathIgnorePatterns`). Depuis ce worktree, `npx jest` liste 0 test et
// sort en SUCCES. Ce fichier s'execute avec une config dediee dont le `rootDir`
// pointe sur le worktree.
// =============================================================================

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { HomeVNextScreen } from "../../screens/homeVNext/HomeVNextScreen";
import { HOME_VNEXT_FIXTURES_RENDU } from "../../screens/homeVNext/fixtures";

/**
 * Les 14 etats produit PLUS le cas de resistance aux textes longs : la vue doit
 * tenir ses regles sur les deux, sinon la regle n'en est pas une.
 */
const ETATS = HOME_VNEXT_FIXTURES_RENDU;
import { buildHomeVNextViewModel } from "../../screens/homeVNext/viewModel";
import { couleurs, TAILLE_TACTILE_MIN } from "../../components/homeVNext/homeVNextTokens";

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

// -----------------------------------------------------------------------------
// Outils
// -----------------------------------------------------------------------------

function monter(vm: ReturnType<typeof buildHomeVNextViewModel>) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<HomeVNextScreen vm={vm} />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

/** Tous les textes affiches, dans l'ordre. */
function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children).filter(
        (c): c is string => typeof c === "string"
      )
    );
}

/**
 * Tous les elements REELLEMENT tactiles de l'arbre.
 *
 * On ne cherche pas `Pressable` par son type : RN l'exporte enveloppe dans un
 * `memo(forwardRef(...))`, que `findAllByType` ne retrouve pas. On cherche donc
 * ce qui compte vraiment — un noeud natif qui capte le toucher.
 */
function elementsTactiles(instance: ReactTestInstance): ReactTestInstance[] {
  return instance.findAll(
    (n) =>
      typeof n.type === "string" &&
      typeof (n.props as { onStartShouldSetResponder?: unknown })
        .onStartShouldSetResponder === "function"
  );
}

/** Toutes les couleurs de fond posees dans l'arbre. */
function fonds(node: unknown): string[] {
  const trouves: string[] = [];
  const visiter = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const style = StyleSheet.flatten(n.props?.style);
    const bg = (style as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (typeof bg === "string") trouves.push(bg.toUpperCase());
    (n.children ?? []).forEach(visiter);
  };
  visiter(node);
  return trouves;
}

/**
 * Textes rendus par les composants du SOCLE, qui ne prennent pas de
 * `numberOfLines` et que le prototype n'a pas le droit de modifier :
 *   - `components/ui/SectionHeader` (les titres en capitales) ;
 *   - `components/ui/Badge` (la pastille d'etat du header).
 * Tout le reste doit etre borne.
 */
function estTexteDuSocle(contenu: string, vm: ReturnType<typeof buildHomeVNextViewModel>) {
  if (contenu === "MA SEMAINE" || contenu === "MA FORME") return true;
  return vm.header.stateChip !== null && contenu === vm.header.stateChip.label;
}

// -----------------------------------------------------------------------------

describe("HomeVNextScreen — rendu de tous les etats", () => {
  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s se rend sans erreur",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      expect(rendu.toJSON()).toBeTruthy();
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne pose qu'un seul aplat d'action",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      const orange = fonds(rendu.toJSON()).filter(
        (c) => c === couleurs.action.toUpperCase()
      );
      // 1 quand l'action est un aplat, 0 quand c'est un accuse de reception.
      expect(orange.length).toBe(vm.action.emphasis === "aplat" ? 1 : 0);
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s n'ecrit le libelle de l'action qu'une seule fois",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      const occurrences = textes(rendu.root).filter((t) => t === vm.action.label);
      expect(occurrences).toHaveLength(1);
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s n'affiche aucun bouton desactive",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      for (const p of elementsTactiles(rendu.root)) {
        expect(p.props.disabled).toBeFalsy();
      }
      // Un accuse de reception n'est pas un bouton : rien a presser.
      if (vm.action.emphasis === "accuse_reception") {
        const boutons = elementsTactiles(rendu.root).filter(
          (p) => p.props.accessibilityRole === "button"
        );
        expect(boutons).toHaveLength(0);
      }
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne parle ni de serie ni de jargon de charge",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      const corpus = textes(rendu.root).join(" ");
      expect(corpus).not.toMatch(/s[ée]rie/i);
      expect(corpus).not.toMatch(/streak|flamme/i);
      expect(corpus).not.toMatch(/\b(ATL|CTL|TSB)\b/);
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s donne un role et une zone tactile suffisante a chaque element pressable",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      const pressables = elementsTactiles(rendu.root);
      expect(pressables.length).toBeGreaterThan(0);
      for (const p of pressables) {
        expect(["button", "link"]).toContain(p.props.accessibilityRole);
        expect(typeof p.props.accessibilityLabel).toBe("string");
        expect(String(p.props.accessibilityLabel).length).toBeGreaterThan(0);
        const style = StyleSheet.flatten(p.props.style) as { minHeight?: number };
        expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
      }
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s borne tous ses textes sauf ceux du socle",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      for (const t of rendu.root.findAllByType(Text)) {
        const contenu = React.Children.toArray(t.props.children).filter(
          (c): c is string => typeof c === "string"
        );
        if (contenu.length === 0) continue;
        if (contenu.some((c) => estTexteDuSocle(c, vm))) continue;
        // Les fragments imbriques (prefixe "Pourquoi : ", nom du cycle) heritent
        // du `numberOfLines` de leur parent : on ne les compte pas deux fois.
        if (t.props.numberOfLines === undefined && estFragmentImbrique(t)) continue;
        expect(typeof t.props.numberOfLines).toBe("number");
      }
      demonter(rendu);
    }
  );

  it("n'affiche aucun texte tant que les stores ne sont pas hydrates", () => {
    const base = ETATS[0]!;
    const vm = buildHomeVNextViewModel({ ...base.input, storeHydrated: false });
    expect(vm.dataState).toBe("hydrating");
    const rendu = monter(vm);
    // Aucun mot lisible : ni "En forme", ni un CTA actionnable sur des valeurs
    // d'amorcage (defaut P0.4).
    expect(textes(rendu.root)).toHaveLength(0);
    expect(elementsTactiles(rendu.root)).toHaveLength(0);
    demonter(rendu);
  });
});

/** Un `Text` imbrique dans un autre `Text` herite de son `numberOfLines`. */
function estFragmentImbrique(node: ReactTestInstance): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.type === Text) return true;
    parent = parent.parent;
  }
  return false;
}
