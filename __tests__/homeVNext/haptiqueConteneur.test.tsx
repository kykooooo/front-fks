// __tests__/homeVNext/haptiqueConteneur.test.tsx
// =============================================================================
// LE NOUVEL ACCUEIL REPOND AU DOIGT
// =============================================================================
//
// Le prototype s'interdisait tout retour haptique, et pour une bonne raison :
// `useHaptics()` tire `expo-haptics` et `state/settingsStore` (donc
// AsyncStorage), qu'un composant destine a se rendre aussi hors de l'app ne peut
// pas embarquer. La regle 3 de `components/homeVNext/HomeVNextPrimitives.tsx`
// l'ecrit noir sur blanc, et annonce le rebranchement « dans les callbacks
// passes en props ». Cette echeance, c'est la reprise en production.
//
// Sans ce rebranchement, le nouvel accueil serait le SEUL ecran muet de l'app :
// l'ancien CTA vibrait (`components/home/HomePrimaryCTA.tsx`, `onPressIn`) et
// tout ce qui passe par `components/ui/Button` vibre — le vNext ne passe par
// aucun des deux, parce qu'il lui fallait un `accessibilityRole` sur un
// `Pressable` brut. Un silence qui ne se voit dans AUCUN test de rendu, et pas
// davantage dans le visualiseur web ou les vibrations n'existent pas.
//
// D'ou ce fichier, qui teste le COMPORTEMENT et pas la presence d'une ligne :
// il monte le conteneur avec un faux ecran, declenche les callbacks reellement
// passes en props, et regarde ce que le hook a recu.
//
// Les trois regles verrouillees ici :
//   1. une action qui EMMENE quelque part -> impulsion legere (comme l'ancien CTA) ;
//   2. une action INDISPONIBLE -> vibration d'avertissement, pour que le joueur
//      comprenne qu'il a bien tape et n'insiste pas ;
//   3. une action qui ne fait RIEN -> silence total. Une vibration qui ne mene
//      nulle part apprend au joueur a s'en mefier.
//
// Ce qui n'est PAS teste ici parce que `useHaptics` s'en charge deja et est
// teste ailleurs : le silence quand le joueur a coupe les vibrations dans les
// Reglages, et le silence quand « reduire les animations » est actif.
// =============================================================================

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { HomeVNextContainer } from "../../screens/homeVNext/HomeVNextContainer";
import type { ActionTarget } from "../../screens/homeVNext/viewModel";

// -----------------------------------------------------------------------------
// Les espions
//
// Le prefixe `mock` n'est pas decoratif : Babel remonte les `jest.mock` en haut
// du fichier, et refuse qu'une fabrique reference une variable exterieure dont
// le nom ne commence pas par la. Les alias en dessous rendent le corps du test
// lisible sans enfreindre la regle.
// -----------------------------------------------------------------------------

const mockHaptique = {
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  impactHeavy: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
};

const mockNaviguer = jest.fn();
const mockToast = jest.fn();

/** Ce que `resoudreDestinationHome` repondra au prochain tap. */
let mockInstruction: { kind: string; [k: string]: unknown } = {
  kind: "navigate",
  route: "NewSession",
  params: undefined,
};

const haptique = mockHaptique;
const naviguer = mockNaviguer;
const toast = mockToast;

// -----------------------------------------------------------------------------
// Les doublures
// -----------------------------------------------------------------------------

jest.mock("../../hooks/useHaptics", () => ({ useHaptics: () => mockHaptique }));

// Ces deux doublures renvoient une reference STABLE, comme les vraies : dans
// l'app, `useNavigation()` rend le meme objet d'un rendu a l'autre et
// `useNavGuard` renvoie un `useCallback` (verifie dans `hooks/useNavGuard.ts`).
// Une doublure qui reconstruirait son objet a chaque rendu rendrait le test de
// stabilite plus bas ininterpretable : il mesurerait les mocks, pas le code.
const mockNav = { navigate: mockNaviguer };
const mockGarde = (action: () => void) => action();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNav,
}));

// La garde de navigation laisse passer : ce n'est pas son proces ici.
jest.mock("../../hooks/useNavGuard", () => ({
  useNavGuard: () => mockGarde,
}));

jest.mock("../../utils/toast", () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));

// La resolution de destination est pilotee par le test : ce fichier verifie le
// retour haptique de CHAQUE issue, pas la table des destinations (elle a son
// propre test, `hooks/home/__tests__/homeVNextNavigation.test.ts`).
jest.mock("../../hooks/home/homeVNextNavigation", () => ({
  resoudreDestinationHome: () => mockInstruction,
}));

jest.mock("../../hooks/home/useHomeVNextViewModel", () => ({
  useHomeVNextViewModel: () => ({
    vm: { etat: "faux" },
    progression: null,
    entree: { pendingSession: null },
  }),
}));

// Etat STABLE, la aussi : le vrai store rend la meme reference de tableau tant
// que rien ne change. Un `[]` reconstruit a chaque rendu ferait echouer le test
// de stabilite pour une raison qui n'existe que dans le test.
const mockEtatSessions = { sessions: [] as unknown[], lastAiSessionV2: null };

jest.mock("../../state/stores/useSessionsStore", () => ({
  useSessionsStore: (selecteur: (s: unknown) => unknown) => selecteur(mockEtatSessions),
}));

// Le faux ecran : il ne rend rien et se contente de tendre ses props au test.
type PropsCaptures = {
  onAction?: (cible: ActionTarget) => void;
  onSecondaryAction?: (cible: ActionTarget) => void;
  onExit?: (cible: "progression") => void;
};
let mockPropsRecues: PropsCaptures = {};

jest.mock("../../screens/homeVNext/HomeVNextScreen", () => ({
  HomeVNextScreen: (props: PropsCaptures) => {
    mockPropsRecues = props;
    return null;
  },
}));

// -----------------------------------------------------------------------------
// Outils
// -----------------------------------------------------------------------------

function monter() {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<HomeVNextContainer />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

/** Compte toutes les vibrations, tous canaux confondus. */
const totalVibrations = () =>
  Object.values(haptique).reduce((n, espion) => n + espion.mock.calls.length, 0);

beforeEach(() => {
  Object.values(haptique).forEach((espion) => espion.mockClear());
  naviguer.mockClear();
  toast.mockClear();
  mockPropsRecues = {};
  mockInstruction = { kind: "navigate", route: "NewSession", params: undefined };
});

// -----------------------------------------------------------------------------
// 1. Le bouton principal
// -----------------------------------------------------------------------------

describe("l'action principale repond au doigt", () => {
  test("une action qui emmene quelque part vibre — impulsion legere, comme l'ancien CTA", () => {
    const rendu = monter();
    act(() => {
      mockPropsRecues.onAction?.("generate" as ActionTarget);
    });

    expect(haptique.impactLight).toHaveBeenCalledTimes(1);
    expect(naviguer).toHaveBeenCalledWith("NewSession", undefined);
    // Une seule vibration, pas deux : rien d'autre ne doit s'y ajouter en route.
    expect(totalVibrations()).toBe(1);

    act(() => rendu.unmount());
  });

  test("le lien secondaire vibre lui aussi : c'est la meme action, tapee ailleurs", () => {
    const rendu = monter();
    act(() => {
      mockPropsRecues.onSecondaryAction?.("preview" as ActionTarget);
    });

    expect(haptique.impactLight).toHaveBeenCalledTimes(1);
    act(() => rendu.unmount());
  });
});

// -----------------------------------------------------------------------------
// 2. Les deux issues qui ne naviguent pas
// -----------------------------------------------------------------------------

describe("les issues sans navigation", () => {
  test("une action indisponible AVERTIT le doigt en meme temps que l'ecran", () => {
    mockInstruction = { kind: "indisponible", titre: "Pas encore", message: "Rien a montrer" };

    const rendu = monter();
    act(() => {
      mockPropsRecues.onAction?.("preview" as ActionTarget);
    });

    // Le joueur a bien tape : sans retour, il croit avoir rate sa cible et retape.
    expect(haptique.warning).toHaveBeenCalledTimes(1);
    expect(haptique.impactLight).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(naviguer).not.toHaveBeenCalled();

    act(() => rendu.unmount());
  });

  test("une action qui ne fait RIEN ne vibre pas du tout", () => {
    mockInstruction = { kind: "aucune" };

    const rendu = monter();
    act(() => {
      mockPropsRecues.onAction?.("none" as ActionTarget);
    });

    expect(totalVibrations()).toBe(0);
    expect(naviguer).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();

    act(() => rendu.unmount());
  });
});

// -----------------------------------------------------------------------------
// 3. Le pied de page
// -----------------------------------------------------------------------------

describe("le passage vers la Progression", () => {
  test("« Voir ma progression » vibre et ouvre la bonne route", () => {
    const rendu = monter();
    act(() => {
      mockPropsRecues.onExit?.("progression");
    });

    expect(haptique.impactLight).toHaveBeenCalledTimes(1);
    expect(naviguer).toHaveBeenCalledWith("Progression");

    act(() => rendu.unmount());
  });
});

// -----------------------------------------------------------------------------
// 4. La memoisation ne doit pas etre la victime du rebranchement
// -----------------------------------------------------------------------------

describe("le retour haptique n'a pas coute la stabilite des callbacks", () => {
  test("`onAction` garde la MEME identite d'un rendu a l'autre", () => {
    // `useHaptics()` reconstruit son objet a chaque rendu. Le mettre en
    // dependance de `useCallback` recreerait `executer` a chaque rendu, alors
    // que ce callback descend loin dans l'arbre. D'ou la reference tenue dans un
    // `ref`. Si quelqu'un la remplace par une dependance directe, ce test tombe.
    const rendu = monter();
    const premier = mockPropsRecues.onAction;

    act(() => {
      rendu.update(<HomeVNextContainer />);
    });

    expect(mockPropsRecues.onAction).toBe(premier);
    act(() => rendu.unmount());
  });

  test("la reference haptique reste vivante apres un re-rendu", () => {
    // Le piege du `ref` : s'il n'est jamais mis a jour, il fige la toute
    // premiere valeur. Ici on verifie juste qu'apres un re-rendu, le tap vibre
    // encore — un `ref` casse rendrait ce cas silencieux.
    const rendu = monter();
    act(() => {
      rendu.update(<HomeVNextContainer />);
    });
    act(() => {
      mockPropsRecues.onAction?.("generate" as ActionTarget);
    });

    expect(haptique.impactLight).toHaveBeenCalledTimes(1);
    act(() => rendu.unmount());
  });
});
