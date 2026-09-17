// components/ui/da/__tests__/daPrimitives.test.tsx
//
// Preuve de rendu légère (react-test-renderer, même méthode que
// `components/home/__tests__/homeProgressionCard.test.tsx` et
// `screens/newSession/__tests__/CarteEchecGeneration.test.tsx`) pour les
// primitives neuves de la DA joueur. On ne teste pas le pixel : on teste le
// CONTRAT (rôle, état accessible, callback) que les deux agents suivants
// (Accueil, Création de séance) vont coder contre.

import React from "react";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";

import { DaCheckRow } from "../DaCheckRow";
import { DaPrimaryButton } from "../DaPrimaryButton";
import { DaNotice } from "../DaNotice";
import { DaRowGroup } from "../DaRowGroup";
import { setThemeMode, getThemeMode } from "../../../../constants/theme";
import { da } from "../../../../constants/daJoueur";

function monter(element: React.ReactElement) {
  let rendu!: TestRenderer.ReactTestRenderer;
  act(() => {
    rendu = TestRenderer.create(element);
  });
  return rendu;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

// react-native.Pressable est un composant composite (React.memo/forwardRef) :
// comparer par displayName/name est la façon fiable de le retrouver, plutôt
// que `findByProps` qui peut matcher à la fois le noeud composite et le
// noeud hôte sous-jacent et lever "found multiple instances" (même motif que
// `screens/newSession/__tests__/CarteEchecGeneration.test.tsx`).
function findPressables(racine: ReactTestInstance): ReactTestInstance[] {
  return racine.findAll((n) => {
    const type: unknown = n.type;
    const name =
      typeof type === "string"
        ? type
        : (type as { displayName?: string; name?: string })?.displayName ||
          (type as { displayName?: string; name?: string })?.name;
    return name === "Pressable";
  });
}

// -----------------------------------------------------------------------------
// DaCheckRow — rôle checkbox, état checked, callback
// -----------------------------------------------------------------------------

describe("DaCheckRow", () => {
  test("expose le rôle checkbox et l'état checked=true", () => {
    const rendu = monter(
      <DaCheckRow label="Petit matériel dispo" checked onToggle={() => {}} />
    );
    const [pressable] = findPressables(rendu.root);
    expect(pressable.props.accessibilityRole).toBe("checkbox");
    expect(pressable.props.accessibilityState).toMatchObject({ checked: true });
    demonter(rendu);
  });

  test("l'état non coché est bien reflété", () => {
    const rendu = monter(
      <DaCheckRow label="Petit matériel dispo" checked={false} onToggle={() => {}} />
    );
    const [pressable] = findPressables(rendu.root);
    expect(pressable.props.accessibilityState).toMatchObject({ checked: false });
    demonter(rendu);
  });

  test("un appui appelle onToggle", () => {
    const onToggle = jest.fn();
    const rendu = monter(<DaCheckRow label="Cônes" checked={false} onToggle={onToggle} />);
    const [pressable] = findPressables(rendu.root);
    act(() => {
      (pressable.props.onPress as () => void)();
    });
    expect(onToggle).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("désactivé : disabled=true et onPress non branché", () => {
    const onToggle = jest.fn();
    const rendu = monter(
      <DaCheckRow label="Cônes" checked={false} onToggle={onToggle} disabled />
    );
    const [pressable] = findPressables(rendu.root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toMatchObject({ disabled: true });
    expect(pressable.props.onPress).toBeUndefined();
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// DaPrimaryButton — désactivé n'appelle pas onPress, loading expose busy
// -----------------------------------------------------------------------------

describe("DaPrimaryButton", () => {
  test("appui normal : appelle onPress une fois", () => {
    const onPress = jest.fn();
    const rendu = monter(<DaPrimaryButton label="Créer ma séance" onPress={onPress} />);
    const [bouton] = findPressables(rendu.root);
    act(() => {
      (bouton.props.onPress as () => void)();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("désactivé : n'appelle jamais onPress (handler non branché)", () => {
    const onPress = jest.fn();
    const rendu = monter(
      <DaPrimaryButton label="Créer ma séance" onPress={onPress} disabled />
    );
    const [bouton] = findPressables(rendu.root);
    expect(bouton.props.disabled).toBe(true);
    expect(bouton.props.onPress).toBeUndefined();
    expect(onPress).not.toHaveBeenCalled();
    demonter(rendu);
  });

  test("loading : accessibilityState.busy est vrai et onPress n'est pas branché", () => {
    const onPress = jest.fn();
    const rendu = monter(<DaPrimaryButton label="Créer ma séance" onPress={onPress} loading />);
    const [bouton] = findPressables(rendu.root);
    expect(bouton.props.accessibilityState).toMatchObject({ busy: true });
    expect(bouton.props.onPress).toBeUndefined();
    demonter(rendu);
  });

  test("loading : le libellé reste affiché et la flèche disparaît (remplacée par l'indicateur)", () => {
    const rendu = monter(
      <DaPrimaryButton label="Créer ma séance" onPress={() => {}} loading />
    );
    const textes = rendu.root.findAllByType(Text).map((t) => t.props.children);
    expect(textes).toContain("Créer ma séance");
    const fleches = rendu.root.findAll(
      (n) => (n.props as { name?: unknown }).name === "arrow-forward"
    );
    expect(fleches).toHaveLength(0);
    demonter(rendu);
  });

  test("par défaut (sans loading) : la flèche arrow-forward est présente", () => {
    const rendu = monter(<DaPrimaryButton label="Créer ma séance" onPress={() => {}} />);
    const fleches = rendu.root.findAll(
      (n) => (n.props as { name?: unknown }).name === "arrow-forward"
    );
    expect(fleches.length).toBeGreaterThan(0);
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// DaNotice — live expose le rôle alert
// -----------------------------------------------------------------------------

describe("DaNotice", () => {
  test("live=true expose accessibilityRole=alert et une live region polite", () => {
    const rendu = monter(<DaNotice tone="danger" message="Le serveur ne répond pas." live />);
    const [alerte] = rendu.root.findAll(
      (n) => (n.props as { accessibilityRole?: unknown }).accessibilityRole === "alert"
    );
    expect(alerte).toBeTruthy();
    expect(alerte.props.accessibilityLiveRegion).toBe("polite");
    demonter(rendu);
  });

  test("live=false (défaut) : aucun noeud ne porte le rôle alert", () => {
    const rendu = monter(<DaNotice tone="info" message="Conseil du jour." />);
    const alertes = rendu.root.findAll(
      (n) => (n.props as { accessibilityRole?: unknown }).accessibilityRole === "alert"
    );
    expect(alertes).toHaveLength(0);
    demonter(rendu);
  });

  test("le message est rendu tel quel, sans plafond de lignes (contenu potentiellement long)", () => {
    const message =
      "Un message assez long pour vérifier qu'il n'est jamais tronqué à quelques lignes.";
    const rendu = monter(<DaNotice tone="warn" message={message} />);
    const noeudMessage = rendu.root
      .findAllByType(Text)
      .find((t) => t.props.children === message);
    expect(noeudMessage).toBeTruthy();
    expect(noeudMessage!.props.numberOfLines).toBeUndefined();
    demonter(rendu);
  });

  // ---------------------------------------------------------------------------
  // flat (finition F5, 17/09/2026) — posée DANS une DaCard, la note ne doit
  // plus dessiner son propre cadre (carte dans la carte, interdit).
  // ---------------------------------------------------------------------------

  function styleCarte(rendu: TestRenderer.ReactTestRenderer) {
    const [carte] = rendu.root.findAllByType(View);
    return StyleSheet.flatten(carte.props.style as never) as {
      borderWidth?: number;
      backgroundColor?: string;
      borderRadius?: number;
      padding?: number;
    };
  }

  test("flat=false (défaut) : bordure et fond carte inchangés", () => {
    const rendu = monter(<DaNotice tone="warn" message="Texte." />);
    const style = styleCarte(rendu);
    expect(style.borderWidth).toBe(1);
    expect(style.backgroundColor).toBe(da.colors.card);
    demonter(rendu);
  });

  test("flat=true : aucune bordure, rayon 12, padding 12", () => {
    const rendu = monter(<DaNotice tone="warn" message="Texte." flat />);
    const style = styleCarte(rendu);
    expect(style.borderWidth).toBe(0);
    expect(style.borderRadius).toBe(12);
    expect(style.padding).toBe(12);
    demonter(rendu);
  });

  test.each([
    ["warn", "warnSoft"],
    ["danger", "dangerSoft"],
    ["success", "successSoft"],
    ["info", "bg"],
  ] as const)("flat=true, tone=%s : fond = da.colors.%s", (tone, cle) => {
    const rendu = monter(<DaNotice tone={tone} message="Texte." flat />);
    const style = styleCarte(rendu);
    expect(style.backgroundColor).toBe(da.colors[cle]);
    demonter(rendu);
  });

  test("ton info : le filet passe à controlBorder (icône reste text)", () => {
    const rendu = monter(<DaNotice tone="info" message="Conseil du jour." />);
    // Le filet est la seule View de largeur fixe 3 dans l'arbre.
    const filet = rendu.root
      .findAllByType(View)
      .find((v) => (StyleSheet.flatten(v.props.style as never) as { width?: number }).width === 3);
    expect(filet).toBeTruthy();
    const styleFilet = StyleSheet.flatten(filet!.props.style as never) as {
      backgroundColor?: string;
    };
    expect(styleFilet.backgroundColor).toBe(da.colors.controlBorder);
    const icone = rendu.root.findAll((n) => (n.props as { name?: unknown }).name === "information-circle");
    expect(icone[0].props.color).toBe(da.colors.text);
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// DaRowGroup — n−1 séparateurs
// -----------------------------------------------------------------------------

describe("DaRowGroup", () => {
  /** Le séparateur est la seule View de la hiérarchie sans aucun enfant. */
  function compterSeparateurs(rendu: TestRenderer.ReactTestRenderer): number {
    const vues = rendu.root.findAllByType(View);
    return vues.filter((v) => {
      const enfants = React.Children.toArray(v.props.children as React.ReactNode);
      return enfants.length === 0;
    }).length;
  }

  test("3 enfants -> exactement 2 séparateurs", () => {
    const rendu = monter(
      <DaRowGroup>
        <Text>Ligne 1</Text>
        <Text>Ligne 2</Text>
        <Text>Ligne 3</Text>
      </DaRowGroup>
    );
    expect(compterSeparateurs(rendu)).toBe(2);
    demonter(rendu);
  });

  test("1 seul enfant -> aucun séparateur", () => {
    const rendu = monter(
      <DaRowGroup>
        <Text>Seule ligne</Text>
      </DaRowGroup>
    );
    expect(compterSeparateurs(rendu)).toBe(0);
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// getThemeMode() suit setThemeMode
// -----------------------------------------------------------------------------

describe("getThemeMode()", () => {
  afterEach(() => {
    // Remise à l'état par défaut pour ne pas polluer les autres suites.
    setThemeMode("light");
  });

  test("renvoie light par défaut", () => {
    expect(getThemeMode()).toBe("light");
  });

  test('suit setThemeMode("dark") puis setThemeMode("light")', () => {
    setThemeMode("dark");
    expect(getThemeMode()).toBe("dark");
    setThemeMode("light");
    expect(getThemeMode()).toBe("light");
  });
});
