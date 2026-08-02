// components/coach/__tests__/CoachSelfPlayerCard.test.tsx
//
// « JE M'ENTRAÎNE AUSSI » — ce que l'écran propose, et ce qu'il refuse de
// proposer.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//
//  1. LE BON GESTE SELON L'ÉTAT. Sans suivi -> « Je m'entraîne aussi ». Avec
//     suivi -> « Arrêter mon suivi ». JAMAIS les deux, et RIEN tant que l'état
//     n'est pas connu. Un bouton qui promet de retirer ce qui n'existe pas (ou
//     d'ajouter ce qui existe déjà) est un mensonge d'écran.
//  2. LA DIVULGATION COACH-SAFE EST LÀ, entière, et elle ne bloque rien : le
//     bouton ne dépend d'aucun acquittement.
//  3. LE MESSAGE DIT LA VÉRITÉ DU SERVEUR. Sous une politique d'approbation, la
//     fiche n'apparaît pas tout de suite — l'écran l'annonce, au lieu de laisser
//     chercher un bug là où il n'y en a pas.
//  4. AUCUN IDENTIFIANT DE PERSONNE N'EST COMPOSÉ POUR L'ACTIVATION. La couche
//     service n'en prend pas ; on le vérifie sur l'appel réellement émis.
//  5. LE COMPOSANT N'OUVRE AUCUN ABONNEMENT : il relaie le portillon.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../../services/clubMembers", () => ({
  enrollSelfAsClubPlayer: jest.fn(),
  deactivateClubPlayer: jest.fn(),
}));

jest.mock("../../../utils/toast", () => ({ showToast: jest.fn() }));

jest.mock("../../../hooks/useHaptics", () => ({
  useHaptics: () => ({
    impactLight: jest.fn(),
    impactMedium: jest.fn(),
    impactHeavy: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }),
}));

import { CoachSelfPlayerCard, SELF_PLAYER_COPY } from "../CoachSelfPlayerCard";
import { deactivateClubPlayer, enrollSelfAsClubPlayer } from "../../../services/clubMembers";
import { showToast } from "../../../utils/toast";
import {
  publishAppSpaceSwitch,
  resetAppSpaceGateForTests,
  type AppSpaceSwitchState,
} from "../../../state/appSpaceGate";
import { clubDisclosureTexts } from "../../../domain/clubDataDisclosure";
import { collectText, findByHostType } from "./treeUtils";

const enrollMock = enrollSelfAsClubPlayer as jest.MockedFunction<typeof enrollSelfAsClubPlayer>;
const stopMock = deactivateClubPlayer as jest.MockedFunction<typeof deactivateClubPlayer>;
const toastMock = showToast as jest.MockedFunction<typeof showToast>;

const CLUB = "clubX";
const UID = "coach1";

/** Publie l'état du portillon, comme le fait la racine en production. */
function publier(suiviJoueur: AppSpaceSwitchState["suiviJoueur"]): void {
  publishAppSpaceSwitch({
    peutChoisir: suiviJoueur === "actif",
    espace: "coach",
    suiviJoueur,
    choisir: jest.fn(),
  });
}

/** `await act` : Ionicons charge sa police par un setState asynchrone. */
async function rendre(
  props: Partial<React.ComponentProps<typeof CoachSelfPlayerCard>> = {},
): Promise<TestRenderer.ReactTestRenderer> {
  let arbre!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    arbre = TestRenderer.create(<CoachSelfPlayerCard clubId={CLUB} uid={UID} {...props} />);
  });
  return arbre;
}

/** Le nœud ACTIONNABLE portant ce testID (le composant, pas la vue hôte). */
function bouton(arbre: TestRenderer.ReactTestRenderer, testID: string) {
  const noeuds = arbre.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === "function",
  );
  if (!noeuds.length) throw new Error(`Aucun élément actionnable "${testID}"`);
  return noeuds[0];
}

function existe(arbre: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return arbre.root.findAll((n) => n.props?.testID === testID).length > 0;
}

async function presser(arbre: TestRenderer.ReactTestRenderer, testID: string): Promise<void> {
  const onPress = bouton(arbre, testID).props.onPress as () => unknown;
  await act(async () => {
    await onPress();
  });
}

beforeEach(() => {
  resetAppSpaceGateForTests();
  jest.clearAllMocks();
  enrollMock.mockResolvedValue({ ok: true, alreadyActive: false, coachAccessGranted: true });
  stopMock.mockResolvedValue({ ok: true, alreadyRemoved: false });
});

// ─── 1. Le bon geste, et un seul ────────────────────────────────────────────

describe("l'état du suivi décide du geste proposé", () => {
  test("suivi INACTIF → « Je m'entraîne aussi », et PAS le geste inverse", async () => {
    publier("inactif");
    const arbre = await rendre();
    expect(existe(arbre, "coach-self-player-enroll")).toBe(true);
    expect(existe(arbre, "coach-self-player-stop")).toBe(false);
    expect(collectText(arbre.toJSON()).join(" | ")).toContain(SELF_PLAYER_COPY.bouton);
  });

  test("suivi ACTIF → « Arrêter mon suivi », et PAS le bouton d'activation", async () => {
    publier("actif");
    const arbre = await rendre();
    expect(existe(arbre, "coach-self-player-stop")).toBe(true);
    expect(existe(arbre, "coach-self-player-enroll")).toBe(false);
    expect(collectText(arbre.toJSON()).join(" | ")).toContain(SELF_PLAYER_COPY.boutonArret);
  });

  test("état INCONNU → RIEN n'est rendu (pas de carte vide, pas de bouton grisé)", async () => {
    publier("inconnu");
    const arbre = await rendre();
    expect(arbre.toJSON()).toBeNull();
  });

  test("portillon jamais publié → RIEN non plus (fermé par défaut)", async () => {
    const arbre = await rendre();
    expect(arbre.toJSON()).toBeNull();
  });

  test("le geste bascule EN TEMPS RÉEL quand le serveur republie", async () => {
    publier("inactif");
    const arbre = await rendre();
    expect(existe(arbre, "coach-self-player-enroll")).toBe(true);

    // Le serveur confirme l'activation : la racine republie, la carte change de
    // geste sans remontage ni reconnexion.
    await act(async () => {
      publier("actif");
    });
    expect(existe(arbre, "coach-self-player-enroll")).toBe(false);
    expect(existe(arbre, "coach-self-player-stop")).toBe(true);
  });
});

// ─── 2. Ce que la carte DIT avant qu'on appuie ──────────────────────────────

describe("la carte annonce ce que le geste change", () => {
  test("les deux conséquences sont écrites : l'effectif, et la visibilité", async () => {
    publier("inactif");
    const affiche = collectText((await rendre()).toJSON()).join(" | ");
    expect(affiche).toContain(SELF_PLAYER_COPY.effet);
    expect(affiche).toContain("effectif suivi");
    expect(affiche).toContain("visibles par l'encadrement");
  });

  test("la divulgation coach-safe est affichée EN ENTIER, sans repli", async () => {
    publier("inactif");
    const affiche = collectText((await rendre()).toJSON());
    for (const phrase of clubDisclosureTexts()) {
      expect(affiche).toContain(phrase);
    }
  });

  test("la divulgation ne bloque RIEN : aucun contrôle, et le bouton reste actif", async () => {
    publier("inactif");
    const arbre = await rendre();
    // Aucune case à cocher, aucun champ : rien à acquitter avant d'agir.
    expect(findByHostType(arbre.toJSON(), "TextInput")).toHaveLength(0);
    expect(findByHostType(arbre.toJSON(), "Switch")).toHaveLength(0);
    expect(bouton(arbre, "coach-self-player-enroll").props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  test("la sortie est dite ICI, dans les mots d'un encadrant", async () => {
    publier("inactif");
    const affiche = collectText((await rendre()).toJSON()).join(" | ");
    // La divulgation partagée parle de « quitter son club depuis son profil » —
    // ce qui n'est pas le geste d'un encadrant, et est même impossible pour un
    // propriétaire. La carte dit donc la vraie sortie, en plus.
    expect(affiche).toContain(SELF_PLAYER_COPY.sortie);
    expect(affiche).toContain("ne touche pas à tes accès d'encadrement");
  });
});

// ─── 3. L'appel émis ────────────────────────────────────────────────────────

describe("le geste appelé, et ce qu'on lui transmet", () => {
  test("ACTIVATION : le club seul est transmis, aucun identifiant de personne", async () => {
    publier("inactif");
    await presser(await rendre(), "coach-self-player-enroll");

    expect(enrollMock).toHaveBeenCalledTimes(1);
    // UN SEUL argument, et c'est le club. Il n'y a pas d'identifiant de cible à
    // composer, donc rien à substituer.
    expect(enrollMock.mock.calls[0]).toEqual([CLUB]);
    expect(stopMock).not.toHaveBeenCalled();
  });

  test("ARRÊT : la callable EXISTANTE est appelée sur soi-même", async () => {
    publier("actif");
    await presser(await rendre(), "coach-self-player-stop");

    // Aucune seconde porte n'a été écrite : c'est `deactivateClubPlayer`, celle
    // des trois retraits, dont la matrice serveur autorise déjà « soi-même ».
    expect(stopMock).toHaveBeenCalledWith(CLUB, UID);
    expect(enrollMock).not.toHaveBeenCalled();
  });

  test("sans club, le bouton est inactif et rien n'est appelé", async () => {
    publier("inactif");
    const arbre = await rendre({ clubId: null });
    expect(bouton(arbre, "coach-self-player-enroll").props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await presser(arbre, "coach-self-player-enroll");
    expect(enrollMock).not.toHaveBeenCalled();
  });

  test("sans compte connu, l'ARRÊT n'est pas appelable", async () => {
    publier("actif");
    const arbre = await rendre({ uid: null });
    await presser(arbre, "coach-self-player-stop");
    expect(stopMock).not.toHaveBeenCalled();
  });
});

// ─── 4. Ce qui est annoncé APRÈS ────────────────────────────────────────────

describe("le message dit la vérité du serveur", () => {
  test("accès ouvert : on annonce l'apparition dans l'effectif", async () => {
    publier("inactif");
    await presser(await rendre(), "coach-self-player-enroll");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Suivi activé",
        message: expect.stringContaining("effectif suivi"),
      }),
    );
  });

  test("accès NON ouvert (club en approbation) : on le DIT, on ne promet pas", async () => {
    enrollMock.mockResolvedValue({ ok: true, alreadyActive: false, coachAccessGranted: false });
    publier("inactif");
    await presser(await rendre(), "coach-self-player-enroll");

    const message = String(toastMock.mock.calls[0][0].message);
    expect(message).toContain("masquée");
    // Surtout PAS l'annonce inverse : c'est elle qui ferait chercher un bug.
    expect(message).not.toContain("Tu apparais dans l'effectif");
  });

  test("REJEU : le succès est annoncé comme un rejeu, pas comme un second geste", async () => {
    enrollMock.mockResolvedValue({ ok: true, alreadyActive: true, coachAccessGranted: true });
    publier("inactif");
    await presser(await rendre(), "coach-self-player-enroll");
    expect(toastMock.mock.calls[0][0].title).toBe("Suivi déjà actif");
  });

  test("REFUS : le message du service est affiché tel quel, et la carte survit", async () => {
    enrollMock.mockResolvedValue({
      ok: false,
      reason: "notMember",
      message: "Ton compte n'est pas membre actif de ce club.",
    });
    publier("inactif");
    const arbre = await rendre();
    await presser(arbre, "coach-self-player-enroll");

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Ton compte n'est pas membre actif de ce club.",
      }),
    );
    // La carte n'est pas démontée par un refus : le geste reste réessayable.
    expect(existe(arbre, "coach-self-player-enroll")).toBe(true);
  });

  test("ARRÊT réussi : on rappelle ce qui N'A PAS bougé", async () => {
    publier("actif");
    await presser(await rendre(), "coach-self-player-stop");
    expect(String(toastMock.mock.calls[0][0].message)).toContain(
      "accès d'encadrement sont intacts",
    );
  });
});

// ─── 5. Le composant ne décide rien ─────────────────────────────────────────

describe("aucune décision locale", () => {
  test("il n'ouvre AUCUN abonnement Firestore : il relaie le portillon", () => {
    // Lecture de source : c'est le seul moyen de prouver une ABSENCE.
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "CoachSelfPlayerCard.tsx"),
      "utf8",
    ) as string;
    expect(source).not.toContain("onSnapshot");
    expect(source).not.toContain("firebase/firestore");
    expect(source).toContain("useAppSpaceSwitch");
  });

  test("il ne juge NI le rôle NI la propriété : le serveur reste seul juge", () => {
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "CoachSelfPlayerCard.tsx"),
      "utf8",
    ) as string;
    for (const interdit of ["accessRole", "ownerUid", "isClubOwner", "resolveOwnerAuthority"]) {
      expect(source).not.toContain(interdit);
    }
  });
});
