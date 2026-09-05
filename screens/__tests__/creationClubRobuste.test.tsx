// screens/__tests__/creationClubRobuste.test.tsx
//
// DEUX APPUIS RAPIDES NE DOIVENT PAS CRÉER DEUX CLUBS.
// ET UN RÉESSAI NE DOIT PAS SE FAIRE REFUSER PAR LES RÈGLES.
//
// Erratum 3 de l'audit d'inscription : la §2.4 affirmait « anti double-tap
// partout ». Faux pour cet écran-ci — `loading` n'était posé que dans
// `doCreate`, c'est-à-dire APRÈS que l'alerte de confirmation a été validée.
// Entre le premier tap et la réponse à l'alerte, le bouton restait vivant :
// deux taps = deux alertes = deux clubs.
//
// R2 de la contre-vérification du 05/09 : réserver l'identifiant fermait bien
// le club en double, mais ouvrait pire. Réécrire `clubs/{clubId}` sur un
// document déjà écrit est une UPDATE, que `firestore.rules:783` n'accepte que
// d'un propriétaire déjà inscrit comme membre (`myAccessRole() == "owner"`,
// `:79-83`). Dans l'entrelacement exact d'un timeout — écriture 1 passée,
// écriture 2 pas passée — chaque réessai revenait en `permission-denied`, la
// réservation n'était jamais libérée, et le coach restait bloqué à vie sur son
// compte. Avant le lot, il finissait au moins par entrer, avec un club en trop.
//
// Ce fichier presse pour de vrai (rendu réel) et regarde ce qui part au
// repository, réessai par réessai.

import React from "react";
import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CoachOnboardingScreen from "../CoachOnboardingScreen";
import { createClubAsCoach } from "../../repositories/clubsRepo";
import { STORAGE_KEYS } from "../../constants/storage";

const mockNavigation = { canGoBack: jest.fn(() => false), goBack: jest.fn(), navigate: jest.fn() };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

// Un compte connecté : sans lui, l'écran s'arrête avant l'alerte.
jest.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: "coachA" } }),
  signOut: jest.fn(async () => undefined),
}));

// La création elle-même est hors sujet ici : on regarde CE QU'ON LUI DEMANDE
// (identifiant réservé, étape de reprise), pas comment elle écrit — c'est le
// travail de repositories/__tests__/clubsRepo.test.ts.
let mockIdSuivant = 0;
jest.mock("../../repositories/clubsRepo", () => ({
  createClubAsCoach: jest.fn(async () => ({ id: "club-1", name: "FC Test", ownerUid: "coachA" })),
  nouvelIdentifiantClub: jest.fn(() => `club-${++mockIdSuivant}`),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// ── Accesseurs typés sur l'arbre rendu ──────────────────────────────────────
// `findAll` rend des nœuds dont les props sont `unknown` : sans ces types,
// chaque `onPress()` est une erreur `tsc` (R3 de la contre-vérification).
type NoeudPressable = { props: { onPress: () => void } };
type NoeudSaisie = { props: { onChangeText: (valeur: string) => void } };
type BoutonAlerte = { text?: string; onPress?: () => void };

/** Ce que l'écran demande au repository, appel par appel. */
type AppelCreation = {
  name: string;
  uid: string;
  clubId?: string | null;
  etapeDejaFaite?: number;
  onEtapeFaite?: (etape: 0 | 1 | 2 | 3) => void | Promise<void>;
};

const creationMock = createClubAsCoach as unknown as jest.Mock;
const appels = (): AppelCreation[] =>
  creationMock.mock.calls.map((appel: unknown[]) => appel[0] as AppelCreation);

const montes: TestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

beforeEach(() => {
  mockIdSuivant = 0;
  creationMock.mockImplementation(async () => ({
    id: "club-1",
    name: "FC Test",
    ownerUid: "coachA",
  }));
});

async function rendre() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachOnboardingScreen />
      </SafeAreaProvider>,
    );
  });
  montes.push(renderer);

  const champ = () =>
    renderer.root.findAll((n) => n.props?.placeholder === "Ex: FC Exemple U17", {
      deep: true,
    })[0] as unknown as NoeudSaisie;
  const bouton = () =>
    renderer.root.findAll(
      (n) => n.props?.label === "Créer mon club" && typeof n.props?.onPress === "function",
      { deep: true },
    )[0] as unknown as NoeudPressable;

  return { renderer, champ, bouton };
}

/**
 * Un cycle complet : on tape le nom, on appuie, on confirme l'alerte.
 * Rend les boutons de l'alerte pour les scénarios qui veulent annuler.
 */
async function creer(nom = "FC Test") {
  let boutonsAlerte: BoutonAlerte[] = [];
  const alerte = jest
    .spyOn(Alert, "alert")
    .mockImplementation((_titre, _message, boutons) => {
      boutonsAlerte = (boutons ?? []) as BoutonAlerte[];
    });
  const { champ, bouton } = await rendre();

  await act(async () => {
    champ().props.onChangeText(nom);
  });
  await act(async () => {
    bouton().props.onPress();
  });
  await act(async () => {
    boutonsAlerte.find((b) => b.text === "Créer mon espace entraîneur")?.onPress?.();
  });
  alerte.mockRestore();
}

describe("création de club — le verrou tombe AVANT l'alerte", () => {
  test("deux appuis rapides n'ouvrent qu'UNE alerte", async () => {
    const alerte = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { champ, bouton } = await rendre();

    await act(async () => {
      champ().props.onChangeText("FC Test");
    });

    // Le doigt qui rebondit : deux appuis avant toute réponse à l'alerte.
    await act(async () => {
      bouton().props.onPress();
      bouton().props.onPress();
    });

    expect(alerte).toHaveBeenCalledTimes(1);
    alerte.mockRestore();
  });

  test("« Annuler » rend le bouton : le verrou n'enferme personne", async () => {
    let boutonsAlerte: BoutonAlerte[] = [];
    const alerte = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_titre, _message, boutons) => {
        boutonsAlerte = (boutons ?? []) as BoutonAlerte[];
      });
    const { champ, bouton } = await rendre();

    await act(async () => {
      champ().props.onChangeText("FC Test");
    });
    await act(async () => {
      bouton().props.onPress();
    });
    expect(alerte).toHaveBeenCalledTimes(1);

    // Annuler.
    await act(async () => {
      boutonsAlerte.find((b) => b.text === "Annuler")?.onPress?.();
    });

    // Et on peut retenter : une seconde alerte s'ouvre.
    await act(async () => {
      bouton().props.onPress();
    });
    expect(alerte).toHaveBeenCalledTimes(2);
    alerte.mockRestore();
  });

  test("l'identifiant est réservé AVANT l'écriture, et libéré au succès", () => {
    // Lecture de source : monter le vrai chemin d'écriture demanderait
    // Firestore. Ce qui compte ici est l'ORDRE des trois gestes.
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "CoachOnboardingScreen.tsx"),
      "utf8",
    ) as string;
    const iReserve = source.indexOf("reserverIdClub(uid, nouvelIdentifiantClub)");
    const iEcriture = source.indexOf("createClubAsCoach({");
    const iLibere = source.indexOf("libererIdClub(uid)");
    expect(iReserve).toBeGreaterThan(-1);
    expect(iReserve).toBeLessThan(iEcriture);
    expect(iEcriture).toBeLessThan(iLibere);
    // Et l'identifiant réservé part bien dans l'écriture.
    expect(source).toContain("clubId: reservation.clubId,");
  });

  test("le message de timeout n'affirme pas ce qu'on ne sait pas", () => {
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "CoachOnboardingScreen.tsx"),
      "utf8",
    ) as string;
    // Au timeout, l'écriture a très bien pu atterrir après notre garde de 15 s.
    expect(source).toContain("La création a peut-être abouti, on vérifie");
    expect(source).not.toContain("Impossible de créer le club pour le moment");
    // Et on ne promet plus « aucun club en double ne sera créé » : ce qu'on
    // tient vraiment, c'est de reprendre là où ça s'est arrêté.
    expect(source).not.toContain("aucun club en double ne sera créé");
    expect(source).toContain("on reprendra là où ça s'est arrêté");
    // PAS D'APPEL à `writeBatch` : les règles le refuseraient et plus aucun
    // coach ne pourrait créer de club (erratum 2 de l'audit). Les COMMENTAIRES,
    // eux, ont le droit de le nommer — ils expliquent précisément pourquoi on
    // ne s'en sert pas ; c'est l'appel et l'import qu'on interdit.
    const repo = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "..", "repositories", "clubsRepo.ts"),
      "utf8",
    ) as string;
    for (const fichier of [source, repo]) {
      expect(fichier).not.toMatch(/writeBatch\s*\(/);
      expect(fichier).not.toMatch(/^\s*writeBatch,\s*$/m);
    }
  });

  test("un nom trop court ne déclenche rien du tout", async () => {
    const alerte = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { champ, bouton } = await rendre();
    await act(async () => {
      champ().props.onChangeText("F");
    });
    await act(async () => {
      bouton().props.onPress();
    });
    expect(alerte).not.toHaveBeenCalled();
    alerte.mockRestore();
  });
});

describe("le réessai REPREND, il ne rejoue pas (R2)", () => {
  test("timeout après l'étape 1 : le réessai ne réécrit PAS le club", async () => {
    // Premier essai : le club est écrit (étape 1 annoncée), puis plus rien ne
    // revient — c'est le délai de garde qui rend la main.
    creationMock.mockImplementationOnce(async (opts: AppelCreation) => {
      await opts.onEtapeFaite?.(1);
      const { TimeoutError } = require("../../utils/errorHandler");
      throw new TimeoutError();
    });

    await creer();
    expect(appels()).toHaveLength(1);
    expect(appels()[0].etapeDejaFaite).toBe(0);
    // La réservation a retenu l'étape franchie.
    const brut = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"));
    expect(JSON.parse(String(brut))).toEqual({ clubId: "club-1", etape: 1 });

    // Deuxième essai : MÊME identifiant, et on repart de l'étape 1 — donc ni
    // réécriture du club (que les règles refuseraient), ni club en double.
    await creer();
    expect(appels()).toHaveLength(2);
    expect(appels()[1].clubId).toBe("club-1");
    expect(appels()[1].etapeDejaFaite).toBe(1);
  });

  test("permission-denied : la réservation est remplacée par un identifiant NEUF", async () => {
    creationMock.mockImplementationOnce(async () => {
      const refus: Error & { code?: string } = new Error("Missing or insufficient permissions");
      refus.code = "permission-denied";
      throw refus;
    });

    await creer();
    expect(appels()[0].clubId).toBe("club-1");
    // On ne s'entête pas sur un identifiant que le serveur vient de refuser.
    const brut = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"));
    expect(JSON.parse(String(brut))).toEqual({ clubId: "club-2", etape: 0 });

    await creer();
    expect(appels()[1].clubId).toBe("club-2");
    expect(appels()[1].etapeDejaFaite).toBe(0);
  });

  test("deux réessais sans erreur inattendue : UN SEUL identifiant", async () => {
    const echouer = async () => {
      const { TimeoutError } = require("../../utils/errorHandler");
      throw new TimeoutError();
    };
    creationMock.mockImplementationOnce(echouer);
    creationMock.mockImplementationOnce(echouer);

    await creer();
    await creer();
    await creer();

    const identifiants = new Set(appels().map((a) => a.clubId));
    expect(appels()).toHaveLength(3);
    expect([...identifiants]).toEqual(["club-1"]);
  });

  test("succès : la réservation est effacée, le club suivant sera un VRAI nouveau club", async () => {
    creationMock.mockImplementationOnce(async (opts: AppelCreation) => {
      await opts.onEtapeFaite?.(1);
      await opts.onEtapeFaite?.(2);
      await opts.onEtapeFaite?.(3);
      return { id: "club-1", name: "FC Test", ownerUid: "coachA" };
    });

    await creer();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"))).toBeNull();
  });
});
