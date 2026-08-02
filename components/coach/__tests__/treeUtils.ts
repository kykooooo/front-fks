// components/coach/__tests__/treeUtils.ts
//
// Petits utilitaires de lecture d'arbre pour les tests de rendu coach.
// Fichier volontairement SANS `.test.` dans son nom : jest ne le collecte pas
// comme suite (testMatch = **/__tests__/**/*.test.ts(x)).

import type { ReactTestRendererJSON } from "react-test-renderer";

type Node = ReactTestRendererJSON | string | null;

/** Tous les textes affichés, dans l'ordre de rendu. */
export function collectText(node: Node | Node[]): string[] {
  const out: string[] = [];
  const walk = (n: Node | Node[]): void => {
    if (n == null) return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (typeof n === "string") {
      const s = n.trim();
      if (s) out.push(s);
      return;
    }
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out;
}

/** Texte affiché concaténé (pratique pour un `toContain`). */
export function flatText(node: Node | Node[]): string {
  return collectText(node).join(" | ");
}

/** Toutes les valeurs d'une prop, pour tous les nœuds qui la portent. */
export function collectProp(node: Node | Node[], prop: string): unknown[] {
  const out: unknown[] = [];
  const walk = (n: Node | Node[]): void => {
    if (n == null || typeof n === "string") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.props && prop in n.props) out.push(n.props[prop]);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out;
}

/**
 * Tous les nœuds `Text` dont le contenu affiché contient `needle`.
 * On cible ainsi les vrais blocs de texte, sans ramasser les glyphes d'icônes
 * (Ionicons se rend lui aussi en `Text`, mais ne porte aucun contenu serveur).
 */
export function findTextNodesContaining(
  node: Node | Node[],
  needle: string
): ReactTestRendererJSON[] {
  return findByHostType(node, "Text").filter((t) => flatText(t).includes(needle));
}

/** Tous les nœuds d'un type d'hôte donné (ex. "Text", "View"). */
export function findByHostType(node: Node | Node[], type: string): ReactTestRendererJSON[] {
  const out: ReactTestRendererJSON[] = [];
  const walk = (n: Node | Node[]): void => {
    if (n == null || typeof n === "string") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.type === type) out.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out;
}
