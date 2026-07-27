// types/react-test-renderer.d.ts
//
// `react-test-renderer` est présent (il arrive avec React 19), mais son paquet de
// types `@types/react-test-renderer` n'est PAS installé. Sans déclaration, tout
// fichier qui l'importe casse `tsc --noEmit` (TS7016 : déclaration introuvable).
//
// On déclare ici le strict minimum réellement utilisé par les tests de rendu du
// chantier coach : monter un composant, lire son arbre (JSON *et* instances),
// le re-rendre, le démonter, et encadrer les mises à jour d'état avec `act`.
// Ajouter une dépendance de types complète pour ces signatures serait
// disproportionné — mais ce qui est déclaré doit être FIDÈLE au vrai paquet :
// une déclaration incomplète ne protège pas, elle pousse les tests à caster.
//
// Forme `export =` (et non `export default`) : c'est celle du vrai paquet, et
// c'est la seule qui autorise LES DEUX usages présents dans le dépôt —
//   import TestRenderer from "react-test-renderer";  // TestRenderer.ReactTestRenderer (type)
//   import { act, create } from "react-test-renderer";
//
// ---------------------------------------------------------------------------
// DÉCLARATION CANONIQUE — UNE SEULE DANS LE DÉPÔT. NE PAS EN CRÉER D'AUTRE.
// ---------------------------------------------------------------------------
// Un module ambiant ne peut être déclaré qu'une fois avec un style d'export
// donné : deux fichiers `.d.ts` qui déclarent tous les deux
// `declare module "react-test-renderer"`, l'un en `export =` et l'autre en
// `export default`, ne produisent AUCUN conflit git (fichiers différents) et
// laissent Jest VERT (Jest ne lit pas les types) — mais font sauter le
// typecheck. Mesuré sur ce dépôt : 0 -> 45 erreurs, dont 30 `TS2503 Cannot
// find namespace 'TestRenderer'` (le style `export default` détruit l'accès
// aux types via `TestRenderer.ReactTestRenderer`).
//
// La branche `claude/player-tracking-loop-559906` (boucle de suivi joueur)
// porte un second shim en `export default` dans
// `screens/feedback/__tests__/react-test-renderer.d.ts`. AU MOMENT DU MERGE :
// supprimer ce fichier-là, garder celui-ci. Aucune modification n'est requise
// dans les tests de la boucle — ils écrivent
// `import TestRenderer, { act } from "react-test-renderer"`, exactement la
// même forme que les tests coach, et `esModuleInterop: true` (tsconfig.json)
// synthétise le `default` à partir du `export =`.
//
// Ce fichier est donc un SUR-ENSEMBLE des deux shims : il couvre
// `TestRenderer.create()` + `act()` (usage boucle) et l'arbre d'instances
// `root` / `findAllByType` + les types nommés (usage coach).

declare namespace ReactTestRendererModule {
  /** Nœud d'arbre rendu, tel que renvoyé par `renderer.toJSON()`. */
  type ReactTestRendererJSON = {
    type: string;
    props: { [key: string]: unknown };
    children: null | Array<ReactTestRendererJSON | string>;
  };

  /**
   * Nœud de l'arbre d'INSTANCES (`renderer.root`), à ne pas confondre avec le
   * JSON : `toJSON()` ne rend que les composants hôtes, donc le `onPress` d'un
   * Pressable n'y apparaît jamais (il devient des gestionnaires de responder).
   * Pour déclencher un vrai appui dans un test, c'est cet arbre qu'il faut lire.
   *
   * Les valeurs de props sont typées `unknown` (et non `any`) : un test doit
   * dire ce qu'il attend d'une prop avant de s'en servir.
   */
  type ReactTestInstance = {
    /** Instance du composant de classe, `null` pour une fonction ou un hôte. */
    instance: unknown;
    type: import("react").ElementType;
    props: { [key: string]: unknown };
    parent: ReactTestInstance | null;
    children: Array<ReactTestInstance | string>;

    /** Lève si le prédicat ne correspond pas à exactement un nœud. */
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findByType(type: import("react").ElementType): ReactTestInstance;
    findByProps(props: { [key: string]: unknown }): ReactTestInstance;

    /** `deep: false` = ne descend pas dans un nœud déjà retenu (défaut : true). */
    findAll(
      predicate: (node: ReactTestInstance) => boolean,
      options?: { deep: boolean },
    ): ReactTestInstance[];
    findAllByType(
      type: import("react").ElementType,
      options?: { deep: boolean },
    ): ReactTestInstance[];
    findAllByProps(
      props: { [key: string]: unknown },
      options?: { deep: boolean },
    ): ReactTestInstance[];
  };

  type ReactTestRenderer = {
    toJSON(): ReactTestRendererJSON | null;
    /** Racine de l'arbre d'instances. Toujours présente après `create()`. */
    root: ReactTestInstance;
    update(element: import("react").ReactElement): void;
    unmount(): void;
  };

  function create(element: import("react").ReactElement): ReactTestRenderer;

  /**
   * Encadre les mises à jour d'état React. La variante asynchrone (callback
   * `async`) vide aussi les microtâches en attente — c'est celle qui laisse une
   * lecture Firestore mockée se résoudre avant les assertions.
   *
   * Le paramètre `T` accepte un callback qui RENVOIE une valeur (ex.
   * `await act(async () => renderer.root.findByType(X))`) sans forcer le test à
   * caster. La valeur n'est pas remontée : le vrai paquet ne la restitue pas
   * non plus, d'où le `Promise<void>`. Cette forme générique est celle du shim
   * de la branche boucle — la garder ici évite d'avoir à retoucher ses tests.
   */
  function act<T = void>(callback: () => T | Promise<T>): Promise<void>;
}

declare module "react-test-renderer" {
  export = ReactTestRendererModule;
}
