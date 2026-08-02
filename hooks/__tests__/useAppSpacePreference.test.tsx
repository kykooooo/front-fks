// hooks/__tests__/useAppSpacePreference.test.tsx
//
// LA MÉMOIRE LOCALE DU DERNIER ESPACE UTILISÉ.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//
//  1. ELLE N'OUVRE RIEN. Ce hook ne lit AUCUNE autorité et n'en produit aucune :
//     il rend une valeur que `resolveAppSpace` n'applique que lorsque le serveur
//     a déjà ouvert les deux espaces. La preuve la plus courte tient dans sa
//     signature — il ne reçoit qu'un uid, jamais un rôle ni une appartenance.
//  2. ELLE EST PAR COMPTE. Sur un téléphone partagé, le choix d'un compte ne
//     doit pas être hérité par le suivant.
//  3. ELLE NE BLOQUE JAMAIS L'APPLICATION. Un stockage illisible retombe sur
//     « rien de choisi », pas sur une attente sans fin ni une erreur.
//  4. LA BASCULE EST IMMÉDIATE À L'ÉCRAN. L'état local change avant l'écriture
//     disque : un choix ne doit pas attendre AsyncStorage pour être visible.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../constants/storage";
import { normalizeAppSpacePreference, useAppSpacePreference } from "../useAppSpacePreference";
import type { AppSpace } from "../../domain/appSpace";

type Etat = ReturnType<typeof useAppSpacePreference>;

/** Monte le hook et laisse la lecture asynchrone se résoudre. */
async function monter(uid: string | null) {
  const ref: { current: Etat } = { current: null as unknown as Etat };
  function Sonde({ compte }: { compte: string | null }) {
    ref.current = useAppSpacePreference(compte);
    return null;
  }
  let arbre!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    arbre = TestRenderer.create(<Sonde compte={uid} />);
  });
  return {
    get current() {
      return ref.current;
    },
    changerDeCompte: async (autre: string | null) => {
      await act(async () => {
        arbre.update(<Sonde compte={autre} />);
      });
    },
    demonter: () => arbre.unmount(),
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe("normalizeAppSpacePreference — default-deny sur tout le reste", () => {
  test("les deux seules valeurs reconnues passent", () => {
    expect(normalizeAppSpacePreference("coach")).toBe("coach");
    expect(normalizeAppSpacePreference("player")).toBe("player");
  });

  test("tout le reste vaut « rien de choisi »", () => {
    for (const valeur of ["COACH", "owner", "", " coach ", 42, true, null, undefined, {}]) {
      expect(normalizeAppSpacePreference(valeur)).toBeNull();
    }
  });
});

describe("lecture au montage", () => {
  test("aucun compte → aucune préférence, et aucune attente", async () => {
    const h = await monter(null);
    expect(h.current.preference).toBeNull();
  });

  test("rien de mémorisé → null (le défaut s'appliquera, pas une valeur inventée)", async () => {
    const h = await monter("u1");
    expect(h.current.preference).toBeNull();
  });

  test("valeur mémorisée → elle est rendue telle quelle", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"), "player");
    const h = await monter("u1");
    expect(h.current.preference).toBe("player");
  });

  test("valeur ABÎMÉE en stockage → « rien de choisi », jamais une valeur inventée", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"), "administrateur");
    const h = await monter("u1");
    expect(h.current.preference).toBeNull();
  });

  test("stockage EN PANNE → « rien de choisi », l'application n'est pas bloquée", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disque"));
    const h = await monter("u1");
    expect(h.current.preference).toBeNull();
  });
});

describe("mémorisation d'un choix", () => {
  test("le choix est visible TOUT DE SUITE, et écrit sous la clé du compte", async () => {
    const h = await monter("u1");
    await act(async () => {
      h.current.choisirEspace("player");
    });
    expect(h.current.preference).toBe("player");
    expect(await AsyncStorage.getItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"))).toBe("player");
  });

  test("une ÉCRITURE en échec ne casse rien : le choix vaut pour la session", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disque plein"));
    const h = await monter("u1");
    await act(async () => {
      h.current.choisirEspace("coach");
    });
    expect(h.current.preference).toBe("coach");
  });

  test("sans compte connecté, rien n'est écrit (aucune clé orpheline)", async () => {
    const h = await monter(null);
    await act(async () => {
      h.current.choisirEspace("coach");
    });
    expect(await AsyncStorage.getAllKeys()).toHaveLength(0);
  });
});

describe("la mémoire est PAR COMPTE", () => {
  test("changer de compte relit la clé du nouveau, sans hériter du précédent", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"), "player");
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u2"), "coach");

    const h = await monter("u1");
    expect(h.current.preference).toBe("player");

    await h.changerDeCompte("u2");
    expect(h.current.preference).toBe("coach");
  });

  test("un compte sans choix mémorisé n'hérite pas de celui d'avant", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"), "player");
    const h = await monter("u1");
    expect(h.current.preference).toBe("player");

    await h.changerDeCompte("inconnu");
    expect(h.current.preference).toBeNull();
  });

  test("la déconnexion efface l'état en mémoire, sans effacer le stockage", async () => {
    // Ne PAS effacer est volontaire : se reconnecter doit retrouver son choix.
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"), "player");
    const h = await monter("u1");
    await h.changerDeCompte(null);
    expect(h.current.preference).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.APP_SPACE_PREFERENCE("u1"))).toBe("player");
  });
});

describe("ce hook n'est pas une autorité", () => {
  test("il ne reçoit QU'UN uid : ni rôle, ni appartenance, ni club", () => {
    // Si quelqu'un rebranchait un jour une autorité ici, il devrait AJOUTER un
    // paramètre — et ce test tomberait sur la longueur de la signature.
    expect(useAppSpacePreference).toHaveLength(1);
  });

  test("la valeur rendue est UNIQUEMENT un espace, jamais un droit", async () => {
    const h = await monter("u1");
    await act(async () => {
      h.current.choisirEspace("coach");
    });
    const valeurs: Array<AppSpace | null | "en-attente"> = ["coach", "player", null, "en-attente"];
    expect(valeurs).toContain(h.current.preference);
  });
});
