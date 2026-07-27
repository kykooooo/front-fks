// types/react-test-renderer.d.ts
//
// `react-test-renderer` est présent (il arrive avec React 19), mais son paquet de
// types `@types/react-test-renderer` n'est PAS installé. Sans déclaration, tout
// fichier qui l'importe casse `tsc --noEmit` (TS7016 : déclaration introuvable).
//
// On déclare ici le strict minimum réellement utilisé par les tests de rendu du
// chantier coach : monter un composant, lire son arbre, le re-rendre, le
// démonter, et encadrer les mises à jour d'état avec `act`. Ajouter une
// dépendance de types complète pour cinq signatures serait disproportionné.
//
// Forme `export =` (et non `export default`) : c'est celle du vrai paquet, et
// c'est la seule qui autorise LES DEUX usages présents dans le dépôt —
//   import TestRenderer from "react-test-renderer";  // TestRenderer.ReactTestRenderer (type)
//   import { act, create } from "react-test-renderer";

declare namespace ReactTestRendererModule {
  /** Nœud d'arbre rendu, tel que renvoyé par `renderer.toJSON()`. */
  type ReactTestRendererJSON = {
    type: string;
    props: { [key: string]: unknown };
    children: null | Array<ReactTestRendererJSON | string>;
  };

  type ReactTestRenderer = {
    toJSON(): ReactTestRendererJSON | null;
    update(element: import("react").ReactElement): void;
    unmount(): void;
  };

  function create(element: import("react").ReactElement): ReactTestRenderer;

  /**
   * Encadre les mises à jour d'état React. La variante asynchrone (callback
   * `async`) vide aussi les microtâches en attente — c'est celle qui laisse une
   * lecture Firestore mockée se résoudre avant les assertions.
   */
  function act(callback: () => void | Promise<void>): Promise<void>;
}

declare module "react-test-renderer" {
  export = ReactTestRendererModule;
}
