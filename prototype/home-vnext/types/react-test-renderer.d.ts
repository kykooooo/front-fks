// prototype/home-vnext/types/react-test-renderer.d.ts
// =============================================================================
// DECLARATION DE TYPES POUR `react-test-renderer`
// =============================================================================
// POURQUOI CE FICHIER EXISTE :
//
// `react-test-renderer` est bien installe dans le depot (il est tire par
// `jest-expo`) mais le paquet `@types/react-test-renderer` ne l'est PAS —
// verifie : `node_modules/@types/` ne le contient pas. Le prototype n'a pas le
// droit d'installer quoi que ce soit (`npm install` interdit par le cadre de
// mission), et `package.json` est un fichier interdit.
//
// Sans declaration, le type-check du prototype sortait 3 erreurs, toutes de la
// meme cause : l'import sans types rend l'arbre `any`, et `noImplicitAny` fait
// alors tomber les callbacks qui le parcourent.
//
// Cette declaration ne DESACTIVE rien : elle decrit la partie de l'API que le
// test utilise reellement, calee sur la forme publiee par
// `@types/react-test-renderer` (dont `props: { [nom: string]: any }`, qui est
// la vraie signature du paquet officiel). Elle vit dans le prototype, elle
// n'est chargee que par `tsconfig.proto.json`, elle ne change rien au
// type-check du depot.
//
// A SUPPRIMER le jour ou `@types/react-test-renderer` entre dans le
// `package.json` du depot.
// =============================================================================

/* eslint-disable @typescript-eslint/no-shadow --
   Les alias de l'espace de noms portent VOLONTAIREMENT les memes noms que les
   types exportes : c'est ce qui permet d'ecrire `TestRenderer.ReactTestRenderer`
   comme type, exactement comme avec le paquet @types officiel. */
declare module "react-test-renderer" {
  import type * as React from "react";

  /** Un noeud de l'arbre rendu (composant React ou noeud natif). */
  export type ReactTestInstance = {
    /** Type du noeud : chaine pour un noeud natif ("View"), composant sinon. */
    type: string | React.ComponentType<unknown>;
    /**
     * Signature reprise telle quelle du paquet officiel. Le `any` est ici la
     * verite : les props d'un noeud quelconque ne sont pas connaissables.
     */
    props: { [nom: string]: any };
    parent: ReactTestInstance | null;
    children: (ReactTestInstance | string)[];
    find(predicat: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(
      predicat: (node: ReactTestInstance) => boolean,
      options?: { deep?: boolean }
    ): ReactTestInstance[];
    findByType(type: React.ElementType): ReactTestInstance;
    findAllByType(type: React.ElementType, options?: { deep?: boolean }): ReactTestInstance[];
    findByProps(props: Record<string, unknown>): ReactTestInstance;
    findAllByProps(
      props: Record<string, unknown>,
      options?: { deep?: boolean }
    ): ReactTestInstance[];
  };

  /** Representation serialisable de l'arbre (ce que renvoie `toJSON`). */
  export type ReactTestRendererJSON = {
    type: string;
    props: { [nom: string]: any };
    children: (ReactTestRendererJSON | string)[] | null;
  };

  export type ReactTestRenderer = {
    root: ReactTestInstance;
    toJSON(): ReactTestRendererJSON | ReactTestRendererJSON[] | null;
    toTree(): unknown;
    update(element: React.ReactElement): void;
    unmount(element?: React.ReactElement): void;
  };

  export function create(
    element: React.ReactElement,
    options?: Record<string, unknown>
  ): ReactTestRenderer;

  export function act(callback: () => void | undefined): void;
  export function act(callback: () => Promise<void>): Promise<void>;

  /**
   * L'export par defaut porte AUSSI les types, sous forme d'espace de noms :
   * le test ecrit `TestRenderer.ReactTestRenderer` comme type, exactement comme
   * avec le paquet officiel. La fusion `namespace` + `const` sous le meme nom
   * est ce qui rend les deux lectures possibles.
   */
  namespace TestRenderer {
    type ReactTestInstance = import("react-test-renderer").ReactTestInstance;
    type ReactTestRenderer = import("react-test-renderer").ReactTestRenderer;
    type ReactTestRendererJSON = import("react-test-renderer").ReactTestRendererJSON;
  }

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };

  export default TestRenderer;
}
