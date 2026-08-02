// components/__tests__/appSpaceSwitch.test.tsx
//
// LE SÃ‰LECTEUR JOUEUR / COACH â€” ce qu'il affiche, et surtout ce qu'il n'affiche
// PAS.
//
// Ce que ces tests protÃ¨gent, dans l'ordre d'importance :
//
//  1. IL N'APPARAÃŽT QUE POUR QUI A RÃ‰ELLEMENT LES DEUX ESPACES. Pour tous les
//     autres, il rend `null` â€” pas une carte vide, pas un bouton grisÃ©. Un
//     rÃ©glage qui ne sert Ã  personne est un rÃ©glage qu'on n'affiche pas.
//  2. IL NE DÃ‰CIDE RIEN. Sa condition d'affichage vient du portillon
//     (`state/appSpaceGate`), qui RELAIE ce que la racine a dÃ©rivÃ© de
//     l'appartenance. Le composant n'ouvre aucun abonnement et ne lit aucune
//     autoritÃ©.
//  3. LE PORTILLON EST FERMÃ‰ PAR DÃ‰FAUT. Tant que la racine n'a rien publiÃ©,
//     aucun sÃ©lecteur nulle part.
//  4. IL DISPARAÃŽT EN TEMPS RÃ‰EL quand l'encadrement est perdu.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { AppSpaceSwitch } from "../AppSpaceSwitch";
import {
  publishAppSpaceSwitch,
  readAppSpaceSwitch,
  resetAppSpaceGateForTests,
} from "../../state/appSpaceGate";

/** Rend le composant DANS `act` : sans Ã§a le rendu reste inachevÃ© (React 19). */
function rendu(): TestRenderer.ReactTestRenderer {
  let arbre!: TestRenderer.ReactTestRenderer;
  act(() => {
    arbre = TestRenderer.create(<AppSpaceSwitch variant="joueur" />);
  });
  return arbre;
}

/**
 * Les identifiants DISTINCTS des options. DÃ©dupliquÃ© : un `Pressable` expose son
 * `testID` Ã  la fois sur le composant et sur la vue hÃ´te qu'il rend.
 */
const options = (arbre: TestRenderer.ReactTestRenderer) => [
  ...new Set(
    arbre.root
      .findAll(
        (n) =>
          typeof n.props?.testID === "string" && n.props.testID.startsWith("app-space-switch-"),
      )
      .map((n) => n.props.testID as string),
  ),
];

/** DÃ©clenche l'appui sur une option (le `props` du renderer est `unknown`). */
function presser(arbre: TestRenderer.ReactTestRenderer, espace: "coach" | "player"): void {
  const noeud = arbre.root.find((n) => n.props?.testID === `app-space-switch-${espace}`);
  (noeud.props as { onPress: () => void }).onPress();
}

beforeEach(() => {
  resetAppSpaceGateForTests();
});

describe("le portillon d'espace â€” fermÃ© par dÃ©faut", () => {
  test("rien de publiÃ© â†’ aucun choix possible, et un `choisir` sans effet", () => {
    const etat = readAppSpaceSwitch();
    expect(etat.peutChoisir).toBe(false);
    expect(etat.espace).toBe("player");
    expect(() => etat.choisir("coach")).not.toThrow();
  });

  test("le portillon RELAIE, il ne dÃ©cide pas : ce qu'on publie est ce qu'on lit", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir });
    expect(readAppSpaceSwitch()).toEqual({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir });
  });
});

describe("affichage du sÃ©lecteur", () => {
  test("aucune autoritÃ© publiÃ©e â†’ RIEN n'est rendu", () => {
    const arbre = rendu();
    expect(arbre.toJSON()).toBeNull();
  });

  test("un seul espace ouvert â†’ RIEN n'est rendu", () => {
    publishAppSpaceSwitch({ peutChoisir: false, espace: "coach", suiviJoueur: "inconnu", choisir: jest.fn() });
    const arbre = rendu();
    expect(arbre.toJSON()).toBeNull();
  });

  test("les DEUX espaces ouverts â†’ les deux options sont proposÃ©es", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir: jest.fn() });
    const arbre = rendu();
    expect(options(arbre).sort()).toEqual(["app-space-switch-coach", "app-space-switch-player"]);
  });

  test("l'espace courant est annoncÃ© comme sÃ©lectionnÃ© (jamais la couleur seule)", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir: jest.fn() });
    const arbre = rendu();
    const coach = arbre.root.find((n) => n.props?.testID === "app-space-switch-coach");
    const joueur = arbre.root.find((n) => n.props?.testID === "app-space-switch-player");
    expect(coach.props.accessibilityState).toEqual({ selected: true });
    expect(joueur.props.accessibilityState).toEqual({ selected: false });
    // Un lecteur d'Ã©cran doit comprendre ce qui va s'ouvrir, hors contexte.
    expect(String(joueur.props.accessibilityLabel)).toContain("espace joueur");
  });
});

describe("choisir un espace", () => {
  test("appuyer sur l'AUTRE espace transmet le choix", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir });
    const arbre = rendu();
    act(() => {
      presser(arbre, "player");
    });
    expect(choisir).toHaveBeenCalledWith("player");
  });

  test("appuyer sur l'espace DÃ‰JÃ€ affichÃ© ne transmet rien (pas de rÃ©Ã©criture inutile)", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir });
    const arbre = rendu();
    act(() => {
      presser(arbre, "coach");
    });
    expect(choisir).not.toHaveBeenCalled();
  });
});

describe("perte d'autoritÃ© â€” le sÃ©lecteur disparaÃ®t en temps rÃ©el", () => {
  test("le sÃ©lecteur s'efface dÃ¨s que le portillon se referme", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", suiviJoueur: "inconnu", choisir: jest.fn() });
    const arbre = rendu();
    expect(arbre.toJSON()).not.toBeNull();

    // Le serveur retire l'encadrement : la racine republie, le sÃ©lecteur part.
    act(() => {
      publishAppSpaceSwitch({ peutChoisir: false, espace: "player", suiviJoueur: "inconnu", choisir: jest.fn() });
    });
    expect(arbre.toJSON()).toBeNull();
  });
});
