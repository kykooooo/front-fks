// navigation/__tests__/coachTabsAtterrissage.test.tsx
//
// LE PORTILLON D'ATTERRISSAGE COACH FAIT-IL CE QU'IL DIT ?
//
// La règle (`domain/coachView/landing.ts`) peut être juste et n'être branchée
// nulle part. Ici on monte le vrai composant et on regarde DEUX choses :
//
//  1. tant que la décision n'est pas prise, la tab bar N'EXISTE PAS — on affiche
//     un squelette. C'est ce qui empêche le clignotement « Aujourd'hui →
//     Semaine » que Kyllian aurait vu autrement ;
//  2. quand elle est prise, l'onglet décidé arrive bien en `initialRouteName`.
//
// Les écrans coach sont neutralisés : ils tirent Firestore, et ce n'est pas eux
// qu'on éprouve. Le navigateur d'onglets est remplacé par un marqueur qui écrit
// son `initialRouteName` — la seule prop qui nous intéresse.

import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { flatText } from "../../components/coach/__tests__/treeUtils";
import type { CoachLandingTab } from "../../domain/coachView/landing";

const mockOnglet: { value: CoachLandingTab | null } = { value: null };

jest.mock("../../hooks/coach/useCoachLandingTab", () => ({
  useCoachLandingTab: () => mockOnglet.value,
}));

jest.mock("../../screens/coach/CoachTodayScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../screens/coach/CoachRosterScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../screens/coach/CoachWeekScreen", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/SwipeTabsWrapper", () => ({
  SwipeTabsWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

// Marqueur : le navigateur d'onglets se réduit à l'affichage de la seule prop
// qui porte la décision. Ses enfants (les `Tabs.Screen`) ne sont pas rendus.
jest.mock("@react-navigation/bottom-tabs", () => {
  const ReactLocal = require("react");
  const { Text } = require("react-native");
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ initialRouteName }: { initialRouteName?: string }) =>
        ReactLocal.createElement(Text, null, `initialRouteName=${String(initialRouteName)}`),
      Screen: () => null,
    }),
  };
});

import CoachTabs from "../CoachTabs";

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montes: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
});

async function rendu(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachTabs />
      </SafeAreaProvider>,
    );
  });
  montes.push(renderer);
  return renderer;
}

describe("atterrissage de l'espace coach", () => {
  test("décision non prise : un squelette, pas d'onglets", async () => {
    mockOnglet.value = null;
    const renderer = await rendu();
    expect(renderer.root.findAllByProps({ testID: "coach-tabs-landing" }).length).toBeGreaterThan(
      0,
    );
    expect(flatText(renderer.toJSON())).not.toContain("initialRouteName=");
  });

  test("club sans joueur : la tab bar naît sur Semaine", async () => {
    mockOnglet.value = "CoachWeek";
    const renderer = await rendu();
    expect(flatText(renderer.toJSON())).toContain("initialRouteName=CoachWeek");
  });

  test("club avec joueurs : la tab bar naît sur Aujourd'hui, comme avant", async () => {
    mockOnglet.value = "CoachToday";
    const renderer = await rendu();
    expect(flatText(renderer.toJSON())).toContain("initialRouteName=CoachToday");
  });
});

// ─── LA MÉMOIRE D'ATTERRISSAGE TOMBE AVEC LE COMPTE ─────────────────────────
// Elle ne peut rien ouvrir (elle choisit entre deux onglets déjà autorisés),
// mais elle est nommée PAR COMPTE : la laisser en place à la déconnexion ferait
// atterrir la session suivante sur une photo d'avant. Lecture de source, comme
// les autres invariants du navigateur (coachIntentPersistance).
describe("la mémoire d'atterrissage tombe avec le compte", () => {
  const navigateur = readFileSync(resolve(__dirname, "..", "RootNavigator.tsx"), "utf8");

  test("une déconnexion CONFIRMÉE efface la mémoire du compte qui part", () => {
    expect(navigateur).toContain("oublierEffectifCoach(comptePrecedent)");
  });

  test("le repère de session porte l'IDENTITÉ du compte, pas un simple booléen", () => {
    // À l'instant où l'on constate le logout, `uidCourant` vaut déjà `null` :
    // sans l'uid gardé, on ne saurait plus quelle clé effacer.
    expect(navigateur).toContain("const compteDejaConnecteRef = useRef<string | null>(null);");
  });
});
