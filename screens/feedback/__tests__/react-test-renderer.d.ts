// screens/feedback/__tests__/react-test-renderer.d.ts
// Shim minimal : @types/react-test-renderer n'est pas installe dans ce repo
// (aucun autre test ne montait de hook/composant avant ce lot). Meme pattern
// que types/firebase-auth-rn.d.ts (declaration ambiante locale, pas de deps
// ajoutee a package.json). Scope volontairement limite a screens/feedback/__tests__/
// (fichiers autorises de ce lot) plutot qu'un shim global sous types/.
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export interface TestRendererInstance {
    toJSON(): unknown;
    unmount(): void;
    update(el: ReactElement): void;
  }

  const TestRenderer: {
    create(element: ReactElement): TestRendererInstance;
  };

  export function act<T>(callback: () => T | Promise<T>): Promise<void>;

  export default TestRenderer;
}
