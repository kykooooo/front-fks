// components/__tests__/appSpaceSwitch.test.tsx
//
// LE SÉLECTEUR JOUEUR / COACH — ce qu'il affiche, et surtout ce qu'il n'affiche
// PAS.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//
//  1. IL N'APPARAÎT QUE POUR QUI A RÉELLEMENT LES DEUX ESPACES. Pour tous les
//     autres, il rend `null` — pas une carte vide, pas un bouton grisé. Un
//     réglage qui ne sert à personne est un réglage qu'on n'affiche pas.
//  2. IL NE DÉCIDE RIEN. Sa condition d'affichage vient du portillon
//     (`state/appSpaceGate`), qui RELAIE ce que la racine a dérivé de
//     l'appartenance. Le composant n'ouvre aucun abonnement et ne lit aucune
//     autorité.
//  3. LE PORTILLON EST FERMÉ PAR DÉFAUT. Tant que la racine n'a rien publié,
//     aucun sélecteur nulle part.
//  4. IL DISPARAÎT EN TEMPS RÉEL quand l'encadrement est perdu.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { AppSpaceSwitch } from "../AppSpaceSwitch";
import {
  publishAppSpaceSwitch,
  readAppSpaceSwitch,
  resetAppSpaceGateForTests,
} from "../../state/appSpaceGate";

/** Rend le composant DANS `act` : sans ça le rendu reste inachevé (React 19). */
function rendu(): TestRenderer.ReactTestRenderer {
  let arbre!: TestRenderer.ReactTestRenderer;
  act(() => {
    arbre = TestRenderer.create(<AppSpaceSwitch variant="joueur" />);
  });
  return arbre;
}

/**
 * Les identifiants DISTINCTS des options. Dédupliqué : un `Pressable` expose son
 * `testID` à la fois sur le composant et sur la vue hôte qu'il rend.
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

/** Déclenche l'appui sur une option (le `props` du renderer est `unknown`). */
function presser(arbre: TestRenderer.ReactTestRenderer, espace: "coach" | "player"): void {
  const noeud = arbre.root.find((n) => n.props?.testID === `app-space-switch-${espace}`);
  (noeud.props as { onPress: () => void }).onPress();
}

beforeEach(() => {
  resetAppSpaceGateForTests();
});

describe("le portillon d'espace — fermé par défaut", () => {
  test("rien de publié → aucun choix possible, et un `choisir` sans effet", () => {
    const etat = readAppSpaceSwitch();
    expect(etat.peutChoisir).toBe(false);
    expect(etat.espace).toBe("player");
    expect(() => etat.choisir("coach")).not.toThrow();
  });

  test("le portillon RELAIE, il ne décide pas : ce qu'on publie est ce qu'on lit", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir });
    expect(readAppSpaceSwitch()).toEqual({ peutChoisir: true, espace: "coach", choisir });
  });
});

describe("affichage du sélecteur", () => {
  test("aucune autorité publiée → RIEN n'est rendu", () => {
    const arbre = rendu();
    expect(arbre.toJSON()).toBeNull();
  });

  test("un seul espace ouvert → RIEN n'est rendu", () => {
    publishAppSpaceSwitch({ peutChoisir: false, espace: "coach", choisir: jest.fn() });
    const arbre = rendu();
    expect(arbre.toJSON()).toBeNull();
  });

  test("les DEUX espaces ouverts → les deux options sont proposées", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir: jest.fn() });
    const arbre = rendu();
    expect(options(arbre).sort()).toEqual(["app-space-switch-coach", "app-space-switch-player"]);
  });

  test("l'espace courant est annoncé comme sélectionné (jamais la couleur seule)", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir: jest.fn() });
    const arbre = rendu();
    const coach = arbre.root.find((n) => n.props?.testID === "app-space-switch-coach");
    const joueur = arbre.root.find((n) => n.props?.testID === "app-space-switch-player");
    expect(coach.props.accessibilityState).toEqual({ selected: true });
    expect(joueur.props.accessibilityState).toEqual({ selected: false });
    // Un lecteur d'écran doit comprendre ce qui va s'ouvrir, hors contexte.
    expect(String(joueur.props.accessibilityLabel)).toContain("espace joueur");
  });
});

describe("choisir un espace", () => {
  test("appuyer sur l'AUTRE espace transmet le choix", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir });
    const arbre = rendu();
    act(() => {
      presser(arbre, "player");
    });
    expect(choisir).toHaveBeenCalledWith("player");
  });

  test("appuyer sur l'espace DÉJÀ affiché ne transmet rien (pas de réécriture inutile)", () => {
    const choisir = jest.fn();
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir });
    const arbre = rendu();
    act(() => {
      presser(arbre, "coach");
    });
    expect(choisir).not.toHaveBeenCalled();
  });
});

describe("perte d'autorité — le sélecteur disparaît en temps réel", () => {
  test("le sélecteur s'efface dès que le portillon se referme", () => {
    publishAppSpaceSwitch({ peutChoisir: true, espace: "coach", choisir: jest.fn() });
    const arbre = rendu();
    expect(arbre.toJSON()).not.toBeNull();

    // Le serveur retire l'encadrement : la racine republie, le sélecteur part.
    act(() => {
      publishAppSpaceSwitch({ peutChoisir: false, espace: "player", choisir: jest.fn() });
    });
    expect(arbre.toJSON()).toBeNull();
  });
});
