// navigation/__tests__/portillonRattachementClub.test.tsx
//
// LA CARTE « CODE CLUB REFUSÉ » SURVIT-ELLE AU PORTILLON ?
//
// Le défaut (R1 de la contre-vérification du 05/09), en trois temps :
//   1. le questionnaire enregistre le profil D'ABORD — c'est ce qui empêche un
//      code refusé de faire perdre les quatre étapes ;
//   2. Firestore notifie cette écriture IMMÉDIATEMENT, en local, avant même
//      l'aller-retour serveur. `profileCompleted` et les champs joueur passent
//      à vrai dans l'instantané `users/{uid}` que le RootNavigator écoute ;
//   3. la condition du portillon tombe, `<AppNavigator/>` remplace le stack
//      `nav-gate`, et la carte est DÉMONTÉE — avant même d'exister, puisque le
//      `setDoc` est attendu avant l'appel de rattachement.
//
// Résultat avant correctif : le joueur atterrissait sur l'accueil sans un mot,
// persuadé d'avoir rejoint son club, invisible de son coach. C'est-à-dire
// exactement le P0-01 que le lot A prétendait fermer, plus la disparition du
// toast qui servait au moins d'avertissement.
//
// CE TEST MONTE LE VRAI NAVIGATEUR ET LE VRAI QUESTIONNAIRE. Il rejoue la
// chronologie réelle : l'instantané « profil complet » est émis PAR le `setDoc`
// lui-même (comme le fait Firestore), pas après coup par commodité de test. Les
// écrans qui ne participent pas au scénario sont remplacés par des marqueurs —
// ce sont eux qui prouvent la bascule quand elle doit avoir lieu.

jest.mock("../../services/analytics", () => ({
  trackEvent: jest.fn(),
  setAnalyticsUserId: jest.fn(),
  initAnalytics: jest.fn(),
}));
jest.mock("../../services/monitoring", () => ({
  setSentryUser: jest.fn(),
  captureError: jest.fn(),
  initMonitoring: jest.fn(),
}));
jest.mock("../../services/accountDeletion", () => ({
  onWelcomeReset: () => () => {},
  emitWelcomeReset: jest.fn(),
}));
// Les toasts sont observés, pas affichés : le filet d'avertissement fait partie
// du correctif (la carte SEULE avait remplacé un toast, et si la carte manquait
// son affichage il ne restait plus rien).
const mockToasts: Array<{ type?: string; title?: string; message?: string }> = [];
jest.mock("../../utils/toast", () => ({
  showToast: (t: { type?: string; title?: string; message?: string }) => {
    mockToasts.push(t);
  },
  onToast: () => () => {},
}));

// ── Les écrans hors scénario : des marqueurs, pas des écrans ────────────────
// « APP » = l'application joueur est ouverte, donc le portillon est tombé.
jest.mock("../../screens/HomeScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "APP") }));
jest.mock("../../screens/homeVNext/HomeVNextContainer", () => ({ __esModule: true, HomeVNextContainer: () => require("react").createElement(require("react-native").Text, null, "APP") }));
jest.mock("../../screens/NewSessionScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/FeedbackScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/ExternalLoadScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/RegisterScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/LoginScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/VideoLibraryScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SessionPreviewScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SessionHubScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SessionHistoryScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/PrebuiltSessionsScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/PrebuiltSessionDetailScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/ProfileScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/TestsScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/MonCorpsScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/WelcomeScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SessionLiveScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SessionSummaryScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/SettingsScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/DeleteAccountScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/LegalNoticeScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/PrivacyPolicyScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/RoutineScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/CycleModalScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/ProgressScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/CoachOnboardingScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/coach/CoachPlayerScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../../screens/coach/CoachAccessUnconfirmedScreen", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "ECRAN") }));
jest.mock("../CoachTabs", () => ({ __esModule: true, default: () => require("react").createElement(require("react-native").Text, null, "COACH") }));

// Le store de synchronisation charge son orchestrateur par import dynamique,
// que l'environnement de test ne sait pas exécuter. Rien de ce qu'il fait
// n'entre dans ce scénario : on le remplace par un état inerte et hydraté.
jest.mock("../../state/stores/useSyncStore", () => {
  const etat = {
    startFirestoreWatch: jest.fn(),
    storeHydrated: true,
    resetForUser: jest.fn(),
  };
  const useSyncStore = (selecteur?: (s: typeof etat) => unknown) =>
    typeof selecteur === "function" ? selecteur(etat) : etat;
  // `setState`/`getState` : l'orchestrateur de réhydratation les appelle depuis
  // un `setTimeout` qui retombe APRÈS les tests. Sans eux, le processus meurt
  // sur un `setState is not a function` une fois la suite terminée.
  useSyncStore.setState = jest.fn();
  useSyncStore.getState = () => etat;
  useSyncStore.subscribe = () => () => {};
  return { useSyncStore };
});

// ── L'espace : joueur, décidé, sans club ────────────────────────────────────
jest.mock("../../hooks/useAppSpace", () => ({
  useAppSpace: () => ({
    decision: "player",
    space: "player",
    autorite: "refuse",
    autoriteDejaConfirmee: false,
    membershipAccessRole: null,
    membershipUnreadable: false,
    peutChoisirEspace: false,
    suiviJoueur: "inconnu",
    choisirEspace: jest.fn(),
    revalider: jest.fn(),
  }),
}));

// ── Firebase : un compte connecté, et un profil qu'on pilote à la main ──────
jest.mock("../../services/firebase", () => ({ auth: {}, db: {}, app: {} }));
jest.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: "joueur-1", displayName: "Kylian" } }),
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: "joueur-1", displayName: "Kylian" });
    return () => {};
  },
  signOut: jest.fn(async () => undefined),
}));

const mockFirestore = {
  /** Le dernier écouteur `onSnapshot` posé sur `users/{uid}`. */
  emettre: null as null | ((snap: unknown) => void),
  /** Ce que le `getDoc` de préremplissage rend. */
  profilPrerempli: {} as Record<string, unknown>,
  /** Ce que l'instantané émettra AU MOMENT du setDoc (l'écho local Firestore). */
  echoLocal: null as null | Record<string, unknown>,
  setDocAppels: [] as Array<Record<string, unknown>>,
};

jest.mock("firebase/firestore", () => ({
  doc: (..._args: unknown[]) => ({ path: "users/joueur-1" }),
  collection: () => ({}),
  serverTimestamp: () => "SERVER_TS",
  getDoc: async () => ({
    exists: () => true,
    data: () => mockFirestore.profilPrerempli,
  }),
  setDoc: async (_ref: unknown, data: Record<string, unknown>) => {
    mockFirestore.setDocAppels.push(data);
    // L'ÉCHO LOCAL DE FIRESTORE, REJOUÉ À L'IDENTIQUE : l'écouteur est notifié
    // de l'écriture en attente sans attendre le serveur. C'est CETTE
    // notification qui faisait tomber le portillon.
    if (mockFirestore.echoLocal && mockFirestore.emettre) {
      mockFirestore.emettre({
        metadata: { fromCache: false },
        exists: () => true,
        data: () => mockFirestore.echoLocal,
      });
    }
    return undefined;
  },
  onSnapshot: (_ref: unknown, cb: (snap: unknown) => void) => {
    mockFirestore.emettre = cb;
    return () => {};
  },
}));

// ── Le rattachement : refusé par le serveur ────────────────────────────────
const mockJoin = jest.fn();
jest.mock("../../services/clubInvites", () => ({
  normalizeInviteCodeInput: (raw: string) =>
    String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
  joinClubWithInviteCode: (code: string) => mockJoin(code),
}));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import RootNavigator from "../RootNavigator";
import { readRattachementClub, resetRattachementClubForTests } from "../../state/rattachementClubGate";
import { STORAGE_KEYS } from "../../constants/storage";

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Un profil joueur COMPLET, tel qu'il sort du questionnaire. */
const PROFIL_COMPLET = {
  uid: "joueur-1",
  firstName: "Kylian",
  position: "Attaquant",
  ageCategory: "Senior",
  level: "Amateur",
  dominantFoot: "Pied droit",
  mainObjective: "Mieux encaisser les entrainements et les matchs",
  targetFksSessionsPerWeek: 3,
  hasClubTrainings: "non",
  clubTrainingDays: [],
  matchDays: [],
  hasGymAccess: "none",
};

// ── Petits accesseurs typés sur l'arbre rendu ───────────────────────────────
// `findAll` rend des nœuds dont les props sont `unknown` : sans ces types,
// chaque `onPress()` est une erreur `tsc` (et un `any` de plus dans le dépôt).
type Pressable = { props: { onPress: () => void | Promise<void> } };
type Saisie = { props: { onChangeText: (valeur: string) => void } };

function trouverPressable(
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): Pressable | undefined {
  const trouve = renderer.root.findAll(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function",
    { deep: true },
  )[0];
  return trouve as unknown as Pressable | undefined;
}

function trouverSaisie(
  renderer: TestRenderer.ReactTestRenderer,
  placeholder: string,
): Saisie | undefined {
  const trouve = renderer.root.findAll((n) => n.props?.placeholder === placeholder, {
    deep: true,
  })[0];
  return trouve as unknown as Saisie | undefined;
}

/** Toutes les chaînes affichées à l'écran, à plat. */
function lireTextes(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n) => String(n.type) === "Text", { deep: true })
    .flatMap((n) => {
      const enfants = (n.props as { children?: unknown }).children;
      return Array.isArray(enfants) ? enfants : [enfants];
    })
    .filter((c): c is string => typeof c === "string");
}

const montes: TestRenderer.ReactTestRenderer[] = [];

// TEMPS FAUX, ET C'EST NÉCESSAIRE. Le changement d'étape du questionnaire se
// fait dans le callback d'un `Animated.timing` de 120 ms : sans horloge
// maîtrisée, ces callbacks retombent au hasard — parfois pendant le test
// suivant, parfois après le démontage de l'environnement Jest (constaté : la
// suite tombait une fois sur deux, sur des tests différents).
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  resetRattachementClubForTests();
  mockFirestore.emettre = null;
  mockFirestore.echoLocal = null;
  mockFirestore.setDocAppels = [];
  mockFirestore.profilPrerempli = { ...PROFIL_COMPLET, profileCompleted: false };
  mockJoin.mockReset();
  mockToasts.length = 0;
  await AsyncStorage.clear();
  // Deuxième lancement : l'accueil est déjà passé, sinon le stack d'auth
  // s'affiche à la place (et de toute façon un compte est connecté ici).
  await AsyncStorage.setItem(STORAGE_KEYS.WELCOME_DONE, "true");
});

afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  resetRattachementClubForTests();
});

/** Monte l'application entière et attend que le portillon se décide. */
async function monterApp() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  montes.push(renderer);

  // Premier instantané : le profil n'est pas complet → le portillon s'ouvre.
  await act(async () => {
    mockFirestore.emettre?.({
      metadata: { fromCache: false },
      exists: () => true,
      data: () => ({ ...PROFIL_COMPLET, profileCompleted: false }),
    });
  });

  const textes = () => lireTextes(renderer);
  const parLabel = (label: string) => trouverPressable(renderer, label);

  return { renderer, textes, parLabel };
}

/** Remplit le code club et va jusqu'à « Terminer ». */
async function traverserLeQuestionnaire(
  renderer: TestRenderer.ReactTestRenderer,
  code: string,
) {
  const champCode = () => trouverSaisie(renderer, "Ex: ABCDE-FGHJK");
  const suivant = (label: string) => trouverPressable(renderer, label);

  // Le code club vit à l'étape « Club » (la 3ᵉ) : on y va, on saisit, puis on
  // finit le questionnaire comme n'importe qui.
  for (let i = 0; i < 6; i += 1) {
    const champ = champCode();
    if (champ) break;
    const bouton = suivant("Étape suivante");
    expect(bouton).toBeDefined();
    await act(async () => {
      bouton?.props.onPress();
      // Le changement d'étape vit dans le callback du fondu (120 ms).
      jest.advanceTimersByTime(400);
    });
  }

  const champ = champCode();
  expect(champ).toBeDefined();
  if (code) {
    await act(async () => {
      champ?.props.onChangeText(code);
    });
  }

  for (let i = 0; i < 6; i += 1) {
    if (suivant("Terminer la configuration du profil")) break;
    const bouton = suivant("Étape suivante");
    expect(bouton).toBeDefined();
    await act(async () => {
      bouton?.props.onPress();
      // Le changement d'étape vit dans le callback du fondu (120 ms).
      jest.advanceTimersByTime(400);
    });
  }

  const terminer = suivant("Terminer la configuration du profil");
  expect(terminer).toBeDefined();
  await act(async () => {
    await terminer?.props.onPress();
  });
}

describe("portillon — un rattachement de club en cours retient l'écran", () => {
  test("code refusé : la carte reste montée MALGRÉ l'instantané « profil complet »", async () => {
    // Le serveur refuse le code. Et le `setDoc` du profil, lui, déclenche
    // l'instantané qui dit « profil complet » — dans cet ordre-là, celui du vrai
    // parcours.
    mockFirestore.echoLocal = { ...PROFIL_COMPLET, profileCompleted: true };
    mockJoin.mockResolvedValue({
      ok: false,
      reason: "rejected",
      message: "Ce code n'est pas valide. Demande à ton coach de t'en envoyer un nouveau.",
    });

    const { renderer, textes } = await monterApp();
    await traverserLeQuestionnaire(renderer, "ABCDEFGHJK");

    // Le profil A BIEN été écrit (on ne fait pas survivre la carte en
    // sacrifiant l'enregistrement) …
    expect(mockFirestore.setDocAppels).toHaveLength(1);
    expect(mockFirestore.setDocAppels[0].profileCompleted).toBe(true);
    // … et l'instantané « profil complet » a bien été émis pendant l'écriture.
    // C'est exactement là que la carte disparaissait.
    const affiche = textes();
    expect(affiche).toContain("Ton profil est enregistré.");
    expect(affiche).not.toContain("APP");
    // Le drapeau qui retient le portillon est levé POUR CE COMPTE.
    expect(readRattachementClub()).toBe("joueur-1");
    // Et le filet : un toast d'avertissement, en plus de la carte. Le lot A
    // l'avait retiré — si la carte manquait son affichage, le joueur n'avait
    // plus AUCUN message, c'est-à-dire moins bien qu'avant le lot.
    expect(mockToasts).toContainEqual(
      expect.objectContaining({ type: "warn", title: "Club non rejoint" }),
    );
  });

  test("« Plus tard » : le drapeau tombe et l'application s'ouvre", async () => {
    mockFirestore.echoLocal = { ...PROFIL_COMPLET, profileCompleted: true };
    mockJoin.mockResolvedValue({ ok: false, reason: "rejected", message: "Code refusé." });

    const { renderer, textes, parLabel } = await monterApp();
    await traverserLeQuestionnaire(renderer, "ABCDEFGHJK");
    expect(textes()).toContain("Ton profil est enregistré.");

    const plusTard = parLabel("Plus tard, continuer sans club");
    expect(plusTard).toBeDefined();
    await act(async () => {
      plusTard?.props.onPress();
    });

    expect(readRattachementClub()).toBeNull();
    const affiche = textes();
    expect(affiche).toContain("APP");
    expect(affiche).not.toContain("Ton profil est enregistré.");
  });

  test("code accepté : rien ne retient personne, l'application s'ouvre", async () => {
    mockFirestore.echoLocal = { ...PROFIL_COMPLET, profileCompleted: true };
    mockJoin.mockResolvedValue({
      ok: true,
      clubId: "club-1",
      clubName: "FC Exemple",
      alreadyMember: false,
      coachAccess: "not_required",
    });

    const { renderer, textes } = await monterApp();
    await traverserLeQuestionnaire(renderer, "ABCDEFGHJK");

    expect(readRattachementClub()).toBeNull();
    expect(textes()).toContain("APP");
  });

  test("aucun code saisi : le drapeau n'est jamais levé (zéro diff)", async () => {
    mockFirestore.echoLocal = { ...PROFIL_COMPLET, profileCompleted: true };

    const { renderer, textes } = await monterApp();
    await traverserLeQuestionnaire(renderer, "");

    expect(mockJoin).not.toHaveBeenCalled();
    expect(readRattachementClub()).toBeNull();
    expect(textes()).toContain("APP");
  });
});
