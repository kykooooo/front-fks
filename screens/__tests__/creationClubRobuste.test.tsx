// screens/__tests__/creationClubRobuste.test.tsx
//
// DEUX APPUIS RAPIDES NE DOIVENT PAS CRÉER DEUX CLUBS.
//
// Erratum 3 de l'audit d'inscription : la §2.4 affirmait « anti double-tap
// partout ». Faux pour cet écran-ci — `loading` n'était posé que dans
// `doCreate`, c'est-à-dire APRÈS que l'alerte de confirmation a été validée.
// Entre le premier tap et la réponse à l'alerte, le bouton restait vivant :
// deux taps = deux alertes = deux clubs.
//
// Ce test presse pour de vrai (rendu réel) et compte les alertes.

import React from "react";
import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import CoachOnboardingScreen from "../CoachOnboardingScreen";

const mockNavigation = { canGoBack: jest.fn(() => false), goBack: jest.fn(), navigate: jest.fn() };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

// Un compte connecté : sans lui, l'écran s'arrête avant l'alerte.
jest.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: "coachA" } }),
  signOut: jest.fn(async () => undefined),
}));

// La création elle-même est hors sujet ici : on vérifie le VERROU, pas l'écriture.
jest.mock("../../repositories/clubsRepo", () => ({
  createClubAsCoach: jest.fn(async () => ({ id: "club-1", name: "FC Test", ownerUid: "coachA" })),
  nouvelIdentifiantClub: jest.fn(() => "club-1"),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montes: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  jest.clearAllMocks();
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
    renderer.root.findAll((n) => n.props?.placeholder === "Ex: FC Exemple U17", { deep: true })[0];
  const bouton = () =>
    renderer.root.findAll(
      (n) => n.props?.label === "Créer mon club" && typeof n.props?.onPress === "function",
      { deep: true },
    )[0];

  return { renderer, champ, bouton };
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
    let boutonsAlerte: Array<{ text?: string; onPress?: () => void }> = [];
    const alerte = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_titre, _message, boutons) => {
        boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
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
    expect(source).toContain("clubId,");
  });

  test("le message de timeout n'affirme pas ce qu'on ne sait pas", () => {
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "CoachOnboardingScreen.tsx"),
      "utf8",
    ) as string;
    // Au timeout, l'écriture a très bien pu atterrir après notre garde de 15 s.
    expect(source).toContain("La création a peut-être abouti, on vérifie");
    expect(source).not.toContain("Impossible de créer le club pour le moment");
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
