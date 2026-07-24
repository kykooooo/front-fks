// Ambient shim minimal pour `react-test-renderer` (le paquet ne fournit pas de
// types et `@types/react-test-renderer` n'est pas installé). Couvre uniquement la
// surface utilisée par les tests Signal FKS.
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  namespace TestRenderer {
    type ReactTestRendererJSON = {
      type: string;
      props: Record<string, unknown>;
      children: null | Array<ReactTestRendererJSON | string>;
    };

    interface ReactTestRenderer {
      toJSON(): ReactTestRendererJSON | ReactTestRendererJSON[] | null;
      unmount(): void;
      update(element: ReactElement): void;
    }

    function create(element: ReactElement, options?: unknown): ReactTestRenderer;
    function act(callback: () => void | Promise<void>): void | Promise<void>;
  }

  export = TestRenderer;
}
