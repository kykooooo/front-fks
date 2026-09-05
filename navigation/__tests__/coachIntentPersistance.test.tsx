// navigation/__tests__/coachIntentPersistance.test.tsx
//
// L'ENTRÉE COACH SURVIT-ELLE À UNE APP TUÉE, ET RESTE-T-ELLE ATTEIGNABLE ?
//
// Deux défauts trouvés par l'audit d'inscription du 05/09, qui n'en font qu'un
// pour le coach qui les subit :
//
//  . ERRATUM 1 — l'entrée coach n'existait QUE sur l'écran d'accueil, et cet
//    écran est INATTEIGNABLE dès le deuxième lancement : ses trois boutons
//    posent `fks_welcome_done`, la route initiale devient « Login », et aucun
//    `navigate("Welcome")` n'existe dans le dépôt. Sur un téléphone qui a déjà
//    ouvert l'app une fois, la porte coach avait disparu pour toujours ;
//
//  . P1-02 — l'intention vivait en `useState`. App tuée entre l'inscription et
//    la création du club (ou reconnexion sur un second téléphone) : le coach
//    retombait sur les 4 étapes du questionnaire joueur.
//
// Ce que cette suite protège :
//  1. le service d'intention écrit, relit et efface une clé locale, et ne lève
//     jamais (une inscription ne doit pas tomber parce qu'AsyncStorage tousse) ;
//  2. le lien existe sur la connexion ET sur l'inscription, il est réversible ;
//  3. le navigateur relit l'intention à chaque changement de compte, attend sa
//     réponse avant de choisir l'écran d'arrivée, et l'oublie quand elle n'a
//     plus de sens ;
//  4. la suppression de compte emporte la clé.

import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  CoachEntryLink,
  TEXTE_ANNULER,
  TEXTE_INTENTION_POSEE,
  TEXTE_LIEN_COACH,
} from "../../components/auth/CoachEntryLink";
import {
  effacerIntentionCoach,
  lireIntentionCoach,
  poserIntentionCoach,
} from "../../services/coachIntent";
import { STORAGE_KEYS } from "../../constants/storage";
import { localAccountKeysToPurge } from "../../services/accountDeletionHelpers";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
const navigateur = lire("navigation/RootNavigator.tsx");

const montes: TestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  await AsyncStorage.clear();
});

describe("services/coachIntent — l'intention sur le disque", () => {
  test("la clé est nommée une seule fois, dans constants/storage", () => {
    expect(STORAGE_KEYS.COACH_INTENT).toBe("fks_coach_intent");
    // Aucune littérale ailleurs : c'est ce qui rendait la clé Welcome
    // introuvable à l'époque où elle était écrite en dur deux fois.
    for (const chemin of [
      "navigation/RootNavigator.tsx",
      "screens/WelcomeScreen.tsx",
      "components/auth/CoachEntryLink.tsx",
    ]) {
      expect(lire(chemin)).not.toContain('"fks_coach_intent"');
    }
  });

  test("poser → relire vrai ; effacer → relire faux", async () => {
    expect(await lireIntentionCoach()).toBe(false);
    await poserIntentionCoach();
    expect(await lireIntentionCoach()).toBe(true);
    // Idempotent : deux gestes coach d'affilée ne fabriquent pas deux états.
    await poserIntentionCoach();
    expect(await lireIntentionCoach()).toBe(true);
    await effacerIntentionCoach();
    expect(await lireIntentionCoach()).toBe(false);
  });

  test("un stockage en panne ne casse rien, et ne pose personne sur la création de club", async () => {
    // Remplacement MANUEL, pas `jest.spyOn` : les méthodes du mock
    // AsyncStorage sont déjà des `jest.fn` partageant un magasin interne, et
    // `mockRestore()` sur l'une d'elles rend une fonction qui ne stocke plus
    // rien — les tests SUIVANTS échouaient alors pour cette raison, pas pour la
    // leur (constaté ici même).
    const stockage = AsyncStorage as unknown as Record<string, unknown>;
    const originaux = {
      setItem: stockage.setItem,
      getItem: stockage.getItem,
      removeItem: stockage.removeItem,
    };
    stockage.setItem = jest.fn().mockRejectedValue(new Error("disque plein"));
    stockage.getItem = jest.fn().mockRejectedValue(new Error("illisible"));
    stockage.removeItem = jest.fn().mockRejectedValue(new Error("nope"));
    try {
      await expect(poserIntentionCoach()).resolves.toBeUndefined();
      // Lecture en échec = « pas d'intention » : on n'improvise jamais un coach.
      await expect(lireIntentionCoach()).resolves.toBe(false);
      await expect(effacerIntentionCoach()).resolves.toBeUndefined();
    } finally {
      Object.assign(stockage, originaux);
    }
  });

  test("une valeur inattendue en base locale ne vaut pas intention", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.COACH_INTENT, "peut-etre");
    expect(await lireIntentionCoach()).toBe(false);
  });
});

describe("le lien coach — présent sur les deux écrans d'entrée, réversible", () => {
  /**
   * Laisse retomber les promesses d'AsyncStorage. Le geste du lien est
   * volontairement `() => void basculer()` (un `onPress` ne rend rien à React) :
   * sans ce temps de respiration, le test lirait le disque avant l'écriture.
   */
  const respirer = async () => {
    await act(async () => {
      // Le mock d'AsyncStorage répond par CALLBACK (macrotâche) : vider la file
      // des micro-tâches ne suffit pas, il faut laisser passer un tour de boucle.
      await new Promise((r) => setTimeout(r, 0));
      await Promise.resolve();
    });
  };

  async function rendreLien() {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CoachEntryLink />);
    });
    montes.push(renderer);
    await respirer();
    const textes = () =>
      renderer.root
        .findAllByType(require("react-native").Text)
        .map((n) => n.props.children)
        .filter((c: unknown) => typeof c === "string") as string[];
    const commande = (index = 0) =>
      renderer.root.findAll(
        (n) => n.props?.accessibilityRole === "button" && typeof n.props?.onPress === "function",
        { deep: true }
      )[index];
    return { renderer, textes, commande };
  }

  test("un tap pose l'intention sur le disque ; un second la retire", async () => {
    const { textes, commande } = await rendreLien();
    expect(textes()).toContain(TEXTE_LIEN_COACH);

    await act(async () => {
      await (commande().props.onPress as () => unknown)();
    });
    await respirer();
    expect(await lireIntentionCoach()).toBe(true);
    expect(textes()).toContain(TEXTE_INTENTION_POSEE);
    expect(textes()).toContain(TEXTE_ANNULER);

    await act(async () => {
      await (commande().props.onPress as () => unknown)();
    });
    await respirer();
    expect(await lireIntentionCoach()).toBe(false);
    expect(textes()).toContain(TEXTE_LIEN_COACH);
  });

  test("l'état posé au lancement précédent est relu au montage", async () => {
    await poserIntentionCoach();
    const { textes } = await rendreLien();
    expect(textes()).toContain(TEXTE_INTENTION_POSEE);
  });

  test("les deux écrans d'entrée le portent, et l'accueil garde le sien", () => {
    for (const chemin of ["screens/LoginScreen.tsx", "screens/RegisterScreen.tsx"]) {
      const source = lire(chemin);
      expect(source).toContain("<CoachEntryLink");
      expect(source).toContain('from "../components/auth/CoachEntryLink"');
    }
    const accueil = lire("screens/WelcomeScreen.tsx");
    expect(accueil).toContain("Je suis coach");
    // L'accueil écrit AUSSI l'intention sur le disque, sans quoi la porte
    // d'origine resterait la seule à ne pas survivre à un redémarrage.
    expect(accueil).toContain("poserIntentionCoach()");
  });

  test("le lien reste un lien : jamais un second bouton primaire", () => {
    const composant = lire("components/auth/CoachEntryLink.tsx");
    expect(composant).not.toContain("<Button");
    // Retour au doigt par le hook central, jamais expo-haptics en direct.
    expect(composant).toContain("useHaptics()");
    expect(composant).not.toContain("expo-haptics");
    // Toasts par le bus, jamais Alert.alert (convention projet).
    expect(composant).toContain("showToast(");
    expect(composant).not.toContain("Alert.alert");
  });
});

describe("le navigateur — il attend la réponse du disque avant de router", () => {
  test("il relit l'intention à chaque changement de compte", () => {
    expect(navigateur).toContain("lireIntentionCoach()");
    // Dépendance sur l'identité du compte : c'est le moment où la relecture
    // compte (l'inscription vient d'aboutir, le portillon n'est pas monté).
    const index = navigateur.indexOf("setIntentionCoachLue(false)");
    expect(index).toBeGreaterThan(-1);
    expect(navigateur.slice(index, index + 1200)).toContain("}, [uidCourant]);");
  });

  test("aucun écran d'arrivée n'est choisi tant que la lecture n'a pas répondu", () => {
    const indexAttente = navigateur.indexOf("if (!intentionCoachLue) return <Splash");
    const indexRoute = navigateur.indexOf("initialRouteName={intentionCoach && !clubId");
    expect(indexAttente).toBeGreaterThan(-1);
    expect(indexRoute).toBeGreaterThan(-1);
    // L'attente précède la décision : `initialRouteName` n'est lu qu'au montage,
    // décider trop tôt c'est décider faux pour toute la traversée.
    expect(indexAttente).toBeLessThan(indexRoute);
  });
});

describe("suppression de compte — la clé part avec le compte", () => {
  test("l'intention coach est dans la liste de purge", () => {
    expect(localAccountKeysToPurge("uid-42")).toEqual(
      expect.arrayContaining(["fks_coach_intent"])
    );
    // Même sans uid : la clé n'est pas par-compte, elle doit tomber quand même.
    expect(localAccountKeysToPurge(null)).toEqual(expect.arrayContaining(["fks_coach_intent"]));
  });
});
