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
import { createClubAsCoach, lireClubIdDuCompte } from "../../repositories/clubsRepo";
import { STORAGE_KEYS } from "../../constants/storage";
import { publishAppSpaceSwitch, resetAppSpaceGateForTests } from "../../state/appSpaceGate";

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
  lireClubIdDuCompte: jest.fn(async () => null),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// ── Accesseurs typés sur l'arbre rendu ──────────────────────────────────────
// `findAll` rend des nœuds dont les props sont `unknown` : sans ces types,
// chaque `onPress()` est une erreur `tsc` (R3 de la contre-vérification).
type NoeudPressable = { props: { onPress: () => void } };
type NoeudSaisie = {
  props: { onChangeText: (valeur: string) => void; value?: string; editable?: boolean };
};
type BoutonAlerte = { text?: string; onPress?: () => void };

/** Ce que l'écran demande au repository, appel par appel. */
type AppelCreation = {
  name: string;
  uid: string;
  clubId?: string | null;
  etapeDejaFaite?: number;
  nomEnregistre?: string | null;
  onEtapeFaite?: (etape: 0 | 1 | 2 | 3) => void | Promise<void>;
};

const creationMock = createClubAsCoach as unknown as jest.Mock;
const lectureClubMock = lireClubIdDuCompte as unknown as jest.Mock;
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
  resetAppSpaceGateForTests();
  creationMock.mockImplementation(async () => ({
    id: "club-1",
    name: "FC Test",
    ownerUid: "coachA",
  }));
  // Par défaut : ce compte n'a pas de club.
  lectureClubMock.mockImplementation(async () => null);
});

async function rendre(props: { clubIdExistant?: string | null } = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachOnboardingScreen clubIdExistant={props.clubIdExistant} />
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
    // Le nom écrit part avec elle : c'est lui qui fera foi à la reprise (R2 du
    // round 3), le document `clubs/{id}` n'étant plus réécrit.
    expect(JSON.parse(String(brut))).toEqual({ clubId: "club-1", etape: 1, name: "FC Test" });

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

// ─── R2 DU ROUND 3 : LE NOM EST GELÉ DÈS QU'IL EST EN BASE ──────────────────
// À partir de l'étape 1, la reprise saute l'écriture de `clubs/{clubId}` (une
// UPDATE que les règles refuseraient). Un nom corrigé entre deux tentatives ne
// partait donc nulle part : Firestore gardait « AS Alpha » pendant que l'écran
// félicitait le coach pour « AS Beta ». On affiche le vrai, on verrouille, on
// le dit.
describe("le nom du club est gelé à la reprise", () => {
  /** Le texte d'honnêteté affiché sous le champ verrouillé est-il là ? */
  const noteVerrou = (renderer: TestRenderer.ReactTestRenderer) =>
    renderer.root.findAll((n) => n.props?.children === "Le nom du club est déjà enregistré.", {
      deep: true,
    }).length > 0;

  test("nom A à l'essai 1, saisie B à l'essai 2 : c'est A qui part, et le champ est verrouillé", async () => {
    // Essai 1 : le club est écrit sous « AS Alpha », puis le délai de garde
    // rend la main — exactement l'entrelacement d'un timeout.
    creationMock.mockImplementationOnce(async (opts: AppelCreation) => {
      await opts.onEtapeFaite?.(1);
      const { TimeoutError } = require("../../utils/errorHandler");
      throw new TimeoutError();
    });

    const alerte = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_titre, _message, boutons) => {
        (boutons ?? []).forEach((b) => {
          if ((b as BoutonAlerte).text === "Créer mon espace entraîneur") {
            (b as BoutonAlerte).onPress?.();
          }
        });
      });

    const premier = await rendre();
    await act(async () => {
      premier.champ().props.onChangeText("AS Alpha");
    });
    // Avant toute écriture, le nom se corrige librement.
    expect(premier.champ().props.editable).not.toBe(false);
    expect(noteVerrou(premier.renderer)).toBe(false);

    await act(async () => {
      premier.bouton().props.onPress();
    });
    expect(appels()[0].name).toBe("AS Alpha");
    // Le nom est parti sur le disque avec l'étape franchie.
    expect(
      JSON.parse(String(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA")))),
    ).toEqual({ clubId: "club-1", etape: 1, name: "AS Alpha" });

    // Essai 2, montage neuf (l'app a pu être tuée entre-temps).
    const second = await rendre();
    expect(second.champ().props.value).toBe("AS Alpha");
    expect(second.champ().props.editable).toBe(false);
    expect(noteVerrou(second.renderer)).toBe(true);

    // Le coach tente de corriger : le champ n'en veut pas.
    await act(async () => {
      second.champ().props.onChangeText("AS Beta");
    });
    expect(second.champ().props.value).toBe("AS Alpha");

    await act(async () => {
      second.bouton().props.onPress();
    });
    expect(appels()).toHaveLength(2);
    expect(appels()[1].name).toBe("AS Alpha");
    expect(appels()[1].nomEnregistre).toBe("AS Alpha");
    expect(appels()[1].etapeDejaFaite).toBe(1);
    alerte.mockRestore();
  });

  test("aucune écriture passée : rien n'est verrouillé, et rien n'est réservé au montage", async () => {
    const { champ, renderer } = await rendre();
    expect(champ().props.editable).not.toBe(false);
    expect(noteVerrou(renderer)).toBe(false);
    // Le simple affichage de l'écran ne pose PAS de réservation : sans ça, le
    // club suivant hériterait d'un identifiant tiré pour rien.
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID("coachA"))).toBeNull();
  });

  test("réservation d'avant ce lot (sans nom) : le champ reste libre", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CLUB_CREATION_ID("coachA"),
      JSON.stringify({ clubId: "club-1", etape: 1 }),
    );
    const { champ } = await rendre();
    expect(champ().props.editable).not.toBe(false);
    expect(champ().props.value).toBe("");
  });
});

describe("un compte, un club (R4)", () => {
  /** Appuie sur « Créer mon club » et rend les boutons de l'alerte, s'il y en a. */
  async function appuyer(props: { clubIdExistant?: string | null } = {}) {
    let boutonsAlerte: BoutonAlerte[] | null = null;
    const alerte = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_titre, _message, boutons) => {
        boutonsAlerte = (boutons ?? []) as BoutonAlerte[];
      });
    const { champ, bouton } = await rendre(props);
    await act(async () => {
      champ().props.onChangeText("FC Test");
    });
    await act(async () => {
      bouton().props.onPress();
    });
    const appelee = alerte.mock.calls.length > 0;
    alerte.mockRestore();
    return { boutonsAlerte, alerteOuverte: appelee };
  }

  test("le club déjà connu de la racine suffit : ni alerte, ni création", async () => {
    // Le chemin réel : un coach-joueur renvoyé au questionnaire par la garde de
    // complétude, qui suit le lien « Crée ton club coach » de l'étape 1. Sans
    // cette garde, il fabriquait un SECOND club et `users/{uid}.clubId`
    // repointait dessus — le premier, avec ses joueurs, devenait introuvable.
    const { alerteOuverte } = await appuyer({ clubIdExistant: "club-deja-la" });
    expect(alerteOuverte).toBe(false);
    expect(creationMock).not.toHaveBeenCalled();
    // Et on n'est même pas allé le relire : la racine le sait déjà.
    expect(lectureClubMock).not.toHaveBeenCalled();
  });

  test("sans information de la racine, l'écran lit le document lui-même", async () => {
    // L'autre montage : ouvert depuis le questionnaire, sans prop.
    lectureClubMock.mockImplementation(async () => "club-deja-la");
    const { alerteOuverte } = await appuyer();
    expect(lectureClubMock).toHaveBeenCalledWith("coachA");
    expect(alerteOuverte).toBe(false);
    expect(creationMock).not.toHaveBeenCalled();
  });

  test("il bascule vers l'espace coach quand ce compte y a droit", async () => {
    lectureClubMock.mockImplementation(async () => "club-deja-la");
    const choisir = jest.fn();
    publishAppSpaceSwitch({
      peutChoisir: true,
      espace: "player",
      suiviJoueur: "actif",
      choisir,
    });
    await appuyer();
    expect(choisir).toHaveBeenCalledWith("coach");
  });

  test("s'il n'y a pas droit, on ne force rien — mais aucun second club non plus", async () => {
    lectureClubMock.mockImplementation(async () => "club-deja-la");
    const choisir = jest.fn();
    publishAppSpaceSwitch({
      peutChoisir: false,
      espace: "player",
      suiviJoueur: "inconnu",
      choisir,
    });
    const { alerteOuverte } = await appuyer();
    expect(choisir).not.toHaveBeenCalled();
    expect(alerteOuverte).toBe(false);
    expect(creationMock).not.toHaveBeenCalled();
  });

  test("le verrou est rendu : on n'enferme pas le bouton après un refus", async () => {
    lectureClubMock.mockImplementation(async () => "club-deja-la");
    const alerte = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { champ, bouton } = await rendre();
    await act(async () => {
      champ().props.onChangeText("FC Test");
    });
    await act(async () => {
      bouton().props.onPress();
    });
    // Le club disparaît (le compte a été détaché entre-temps) : le bouton
    // remarche, il n'est pas resté verrouillé par le refus précédent.
    lectureClubMock.mockImplementation(async () => null);
    await act(async () => {
      bouton().props.onPress();
    });
    expect(alerte).toHaveBeenCalledTimes(1);
    alerte.mockRestore();
  });

  test("une lecture en ÉCHEC ne bloque pas : ne pas savoir n'est pas « il y a un club »", async () => {
    // Refuser une création parce qu'un document n'a pas pu être lu enfermerait
    // dehors un coach parfaitement légitime. Le serveur, lui, a le dernier mot.
    lectureClubMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    const { alerteOuverte } = await appuyer();
    expect(alerteOuverte).toBe(true);
  });
});
