// __tests__/homeVNext/reduceMotionSysteme.test.tsx
// =============================================================================
// INTEGRATION L1 — « reduire les animations » vient du TELEPHONE, pas d'une prop
// =============================================================================
//
// Ce que ce fichier verrouille, et pourquoi chaque regle y est :
//
//  1. SANS PROP, C'EST LE TELEPHONE QUI DECIDE. Dans le prototype, l'unique
//     source du drapeau etait l'appelant : un ecran branche en production sans
//     prop serait donc reste eternellement a `false`, c'est-a-dire aurait ignore
//     le reglage d'accessibilite du joueur. C'est precisement le defaut qui a
//     ete corrige en production sur `HomePrimaryCTA` (75b5f19) ; il ne doit pas
//     revenir par la porte du vNext.
//
//  2. LA PROP RESTE UNE SURCHARGE. Les tests et le visualiseur doivent pouvoir
//     rendre les deux etats sans toucher aux reglages de l'appareil. Si la prop
//     cessait de gagner, toutes les assertions « reduceMotion: true » des autres
//     suites deviendraient des assertions sur l'etat par defaut du simulateur —
//     vertes et vides de sens.
//
//  3. LE CHANGEMENT EN COURS DE SESSION EST SERVI. C'est ce que le hook
//     canonique apporte par rapport au pattern recopie a la main dans
//     `screens/HomeScreen.tsx`, qui ne lit la preference qu'au montage.
//
// Le hook n'est PAS mocke : on mock `AccessibilityInfo`, la frontiere systeme.
// Mocker `hooks/useReduceMotion` ferait passer ce test meme si le provider ne
// l'appelait pas — il ne verifierait plus que le branchement existe.
// =============================================================================

import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import {
  HomeVNextPresentation,
  usePresentation,
} from "../../components/homeVNext/homeVNextPresentation";

/** Sonde : rend le drapeau tel que le contexte le sert. */
function Sonde() {
  const { reduceMotion } = usePresentation();
  return <Text>{reduceMotion ? "reduit" : "normal"}</Text>;
}

type Auditeur = (valeur: boolean) => void;

/**
 * Remplace la frontiere systeme et rend la main sur l'auditeur enregistre, pour
 * pouvoir simuler un changement de reglage pendant que l'app tourne.
 */
function poserSysteme(valeurInitiale: boolean) {
  const auditeurs: Auditeur[] = [];
  const remove = jest.fn();

  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockImplementation(() => Promise.resolve(valeurInitiale));

  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(((evenement: string, auditeur: Auditeur) => {
      if (evenement === "reduceMotionChanged") auditeurs.push(auditeur);
      return { remove } as never;
    }) as never);

  return {
    remove,
    /** Simule le joueur qui bascule le reglage sans quitter l'app. */
    async basculer(valeur: boolean) {
      await act(async () => {
        for (const auditeur of auditeurs) auditeur(valeur);
      });
    },
  };
}

async function monter(props: { reduceMotion?: boolean }) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    rendu = TestRenderer.create(
      <HomeVNextPresentation reduceMotion={props.reduceMotion}>
        <Sonde />
      </HomeVNextPresentation>
    );
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function lu(rendu: TestRenderer.ReactTestRenderer): string {
  const texte = rendu.root.findByType(Text);
  return React.Children.toArray(texte.props.children as React.ReactNode).join("");
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("le provider de presentation lit le reglage du telephone", () => {
  it("sans prop, un telephone en « animations reduites » coupe le mouvement", async () => {
    poserSysteme(true);
    const rendu = await monter({});
    expect(lu(rendu)).toBe("reduit");
    act(() => rendu.unmount());
  });

  it("sans prop, un telephone ordinaire laisse le mouvement", async () => {
    poserSysteme(false);
    const rendu = await monter({});
    expect(lu(rendu)).toBe("normal");
    act(() => rendu.unmount());
  });

  it("la prop reste une surcharge : elle gagne contre le systeme, dans les deux sens", async () => {
    poserSysteme(true);
    const force = await monter({ reduceMotion: false });
    expect(lu(force)).toBe("normal");
    act(() => force.unmount());

    jest.restoreAllMocks();
    poserSysteme(false);
    const reduit = await monter({ reduceMotion: true });
    expect(lu(reduit)).toBe("reduit");
    act(() => reduit.unmount());
  });

  it("un changement de reglage en cours de session est servi sans quitter l'ecran", async () => {
    const systeme = poserSysteme(false);
    const rendu = await monter({});
    expect(lu(rendu)).toBe("normal");

    await systeme.basculer(true);
    expect(lu(rendu)).toBe("reduit");

    await systeme.basculer(false);
    expect(lu(rendu)).toBe("normal");

    act(() => rendu.unmount());
  });

  it("l'abonnement systeme est resilie au demontage", async () => {
    const systeme = poserSysteme(false);
    const rendu = await monter({});
    expect(systeme.remove).not.toHaveBeenCalled();
    act(() => rendu.unmount());
    expect(systeme.remove).toHaveBeenCalled();
  });
});
