// state/__tests__/rattachementClubGate.test.tsx
//
// LE DRAPEAU QUI EMPÊCHE LE PORTILLON DE DÉMONTER LA CARTE « CODE CLUB REFUSÉ ».
//
// Ce module minuscule tient à lui seul le correctif R1 de la contre-vérification
// du 05/09 : la sauvegarde du profil écrit `profileCompleted: true`, Firestore
// notifie l'écriture en attente IMMÉDIATEMENT (événement local, avant l'aller-
// retour serveur), le portillon du RootNavigator tombe, `<AppNavigator/>`
// remplace le stack — et la carte qui devait dire « ton club n'est pas rejoint »
// est démontée avant même d'exister. La joueuse range son téléphone en croyant
// avoir rejoint son club ; son coach ne la voit jamais.
//
// Rien ne le verrouillait (P3 du round 3). Il porte pourtant trois promesses
// qu'une refonte pourrait casser en silence :
//   1. le drapeau est PAR COMPTE — sur un téléphone partagé, celui d'un compte
//      ne doit pas barrer l'entrée du suivant ;
//   2. le baisser libère l'abonné EN DIRECT (sinon le portillon ne retombe
//      jamais et l'app reste coincée sur le questionnaire) ;
//   3. le démontage de l'écran le baisse — c'est le filet qui garantit qu'aucun
//      chemin de sortie oublié n'enferme un compte dehors.

import React, { useEffect } from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  leverRattachementClub,
  poserRattachementClub,
  readRattachementClub,
  resetRattachementClubForTests,
  useRattachementClubEnCours,
} from "../rattachementClubGate";

/** Compte les rendus : c'est ce qui prouve la notification (ou son absence). */
type Sonde = { rendus: number; dernier: boolean | null };

// La sonde est nourrie par un effet, pas par une mutation de props pendant le
// rendu (`react-hooks/immutability`) — et un effet sans dépendances tourne à
// CHAQUE rendu, ce qui est exactement le compteur qu'on veut.
function Espion({ uid, onRendu }: { uid: string | null; onRendu: (v: boolean) => void }) {
  const enCours = useRattachementClubEnCours(uid);
  useEffect(() => {
    onRendu(enCours);
  });
  return <Text>{String(enCours)}</Text>;
}

function monter(uid: string | null) {
  const sonde: Sonde = { rendus: 0, dernier: null };
  const noter = (valeur: boolean) => {
    sonde.rendus += 1;
    sonde.dernier = valeur;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Espion uid={uid} onRendu={noter} />);
  });
  return { renderer, sonde };
}

const montes: TestRenderer.ReactTestRenderer[] = [];
const suivre = (r: TestRenderer.ReactTestRenderer) => {
  montes.push(r);
  return r;
};

afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  resetRattachementClubForTests();
});

describe("l'état de départ ne change rien pour personne", () => {
  test("baissé tant que personne n'a rien posé", () => {
    expect(readRattachementClub()).toBeNull();
    const { renderer, sonde } = monter("joueuse-1");
    suivre(renderer);
    expect(sonde.dernier).toBe(false);
  });
});

describe("le drapeau est PAR COMPTE", () => {
  test("posé pour un compte, il ne vaut QUE pour lui", () => {
    act(() => poserRattachementClub("joueuse-1"));
    expect(readRattachementClub()).toBe("joueuse-1");

    const sien = monter("joueuse-1");
    const autre = monter("joueuse-2");
    suivre(sien.renderer);
    suivre(autre.renderer);

    expect(sien.sonde.dernier).toBe(true);
    // Le téléphone partagé : le drapeau d'un compte ne barre pas l'entrée du
    // suivant. C'est la raison d'être de l'`uid`, plutôt qu'un booléen global.
    expect(autre.sonde.dernier).toBe(false);
  });

  test("uid null (personne de connectée) : jamais retenu", () => {
    act(() => poserRattachementClub("joueuse-1"));
    const { renderer, sonde } = monter(null);
    suivre(renderer);
    // Un drapeau ne survit pas à une déconnexion, et surtout il ne se transmet
    // pas au compte suivant.
    expect(sonde.dernier).toBe(false);
  });

  test("un uid vide ou blanc ne pose rien du tout", () => {
    act(() => poserRattachementClub("   "));
    expect(readRattachementClub()).toBeNull();
    act(() => poserRattachementClub(""));
    expect(readRattachementClub()).toBeNull();
  });

  test("poser le MÊME compte deux fois ne renotifie pas", () => {
    act(() => poserRattachementClub("joueuse-1"));
    const { renderer, sonde } = monter("joueuse-1");
    suivre(renderer);
    const avant = sonde.rendus;
    act(() => poserRattachementClub("joueuse-1"));
    expect(sonde.rendus).toBe(avant);
  });

  test("changer de compte bascule les deux abonnés d'un coup", () => {
    act(() => poserRattachementClub("joueuse-1"));
    const un = monter("joueuse-1");
    const deux = monter("joueuse-2");
    suivre(un.renderer);
    suivre(deux.renderer);

    act(() => poserRattachementClub("joueuse-2"));
    expect(un.sonde.dernier).toBe(false);
    expect(deux.sonde.dernier).toBe(true);
  });
});

describe("baisser le drapeau libère l'abonné EN DIRECT", () => {
  test("sans remontage : le portillon peut retomber", () => {
    act(() => poserRattachementClub("joueuse-1"));
    const { renderer, sonde } = monter("joueuse-1");
    suivre(renderer);
    expect(sonde.dernier).toBe(true);

    act(() => leverRattachementClub());

    // C'est LA promesse : sans notification immédiate, le RootNavigator
    // resterait bloqué sur le questionnaire une fois la question réglée.
    expect(sonde.dernier).toBe(false);
    expect(readRattachementClub()).toBeNull();
  });

  test("baisser un drapeau déjà baissé ne notifie personne", () => {
    const { renderer, sonde } = monter("joueuse-1");
    suivre(renderer);
    const avant = sonde.rendus;
    act(() => leverRattachementClub());
    expect(sonde.rendus).toBe(avant);
  });
});

describe("le démontage de l'écran baisse le drapeau", () => {
  // Le filet de sécurité : quel que soit le chemin de sortie emprunté (y
  // compris un qu'on aurait oublié), un compte ne peut pas rester enfermé
  // dehors par un drapeau que plus aucun écran ne porte.
  function EcranPorteur() {
    useEffect(() => leverRattachementClub, []);
    return <Text>questionnaire</Text>;
  }

  test("le nettoyage d'effet le baisse", () => {
    act(() => poserRattachementClub("joueuse-1"));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<EcranPorteur />);
    });
    // Le montage ne touche à rien : c'est le DÉMONTAGE qui baisse.
    expect(readRattachementClub()).toBe("joueuse-1");
    act(() => renderer.unmount());
    expect(readRattachementClub()).toBeNull();
  });

  test("et c'est bien l'idiome que le questionnaire emploie", () => {
    const source = readFileSync(
      resolve(__dirname, "..", "..", "screens", "ProfileSetupScreen.tsx"),
      "utf8",
    );
    expect(source).toContain("useEffect(() => leverRattachementClub, []);");
  });
});

describe("aucune fuite d'écouteur", () => {
  test("un abonné démonté n'est plus notifié — et les vivants le sont toujours", () => {
    const parti = monter("joueuse-1");
    const reste = monter("joueuse-1");
    suivre(reste.renderer);

    act(() => parti.renderer.unmount());
    const rendusApresDemontage = parti.sonde.rendus;

    act(() => poserRattachementClub("joueuse-1"));

    // Le démonté n'a pas bougé (un `setState` sur un composant démonté, c'est
    // exactement la fuite qu'on interdit)…
    expect(parti.sonde.rendus).toBe(rendusApresDemontage);
    // … et le vivant, lui, a bien reçu la notification.
    expect(reste.sonde.dernier).toBe(true);
  });

  test("tous démontés : poser et baisser ne lèvent rien", () => {
    const { renderer } = monter("joueuse-1");
    act(() => renderer.unmount());
    expect(() => {
      act(() => poserRattachementClub("joueuse-1"));
      act(() => leverRattachementClub());
    }).not.toThrow();
  });
});
