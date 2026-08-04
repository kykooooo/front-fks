// __tests__/homeVNext/objectifHebdoCouture.test.ts
// =============================================================================
// CHANGER L'OBJECTIF DANS LES REGLAGES CHANGE LE DENOMINATEUR DE L'ACCUEIL
// =============================================================================
//
// LA COUTURE QUE CE FICHIER GARDE FERMEE
// -----------------------------------------------------------------------------
// L'app portait deux objectifs hebdomadaires : le rythme declare au setup
// (`users/{uid}.targetFksSessionsPerWeek`, obligatoire) et un reglage local
// (`useSettingsStore.weeklyGoal`). Le curseur des Reglages ecrivait le second,
// et l'accueil, depuis le resume canonique, lit le PREMIER. Le curseur bougeait,
// le compteur de l'accueil ne bougeait pas : un bouton mort, invisible aux
// tests, et d'autant plus trompeur que le joueur l'avait deliberement change.
//
// La decision fermee est « une info = un endroit = une verite » : les Reglages
// editent le champ canonique. Ce test suit la valeur sur TOUT le trajet —
// ecriture des Reglages -> store -> adaptateur -> ViewModel -> le denominateur
// que le joueur lit — parce que c'est le trajet entier qui etait casse, pas une
// fonction.
//
// CE QUE CE TEST NE FAIT PAS, ET POURQUOI IL LE DIT
// -----------------------------------------------------------------------------
// Il ne monte pas `SettingsScreen` (un ecran de 900 lignes qui tire Firebase,
// expo-file-system, expo-sharing et les notifications). Il appelle ce que
// l'ecran appelle, et une sentinelle de source verifie que l'ecran appelle bien
// ca — pas l'ancien chemin.
// =============================================================================

import { construireEntreeHome, type EtatStoresHome } from "../../hooks/home/homeVNextAdapter";
import { buildHomeVNextViewModel } from "../../screens/homeVNext/viewModel";
import { useExternalStore } from "../../state/stores/useExternalStore";
import { enregistrerObjectifHebdo, normaliserObjectifHebdo } from "../../services/objectifHebdo";
import type { Session } from "../../domain/types";

// -----------------------------------------------------------------------------
// Les doublures : Firestore et le compte connecte
// -----------------------------------------------------------------------------

const mockSetDoc = jest.fn();
let mockUtilisateur: { uid: string } | null = { uid: "joueur-1" };

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...chemin: string[]) => ({ chemin }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));

jest.mock("../../services/firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return mockUtilisateur;
    },
  },
}));

// -----------------------------------------------------------------------------
// Un joueur qui a deja fait des seances : sans quoi le bloc semaine n'existe pas
// (garde `nbSeancesTerminees > 0`, pour ne pas afficher « 0 sur 2 » a un compte
// neuf). Le denominateur ne se lit donc que sur un compte vivant.
// -----------------------------------------------------------------------------

const NOW = "2026-08-10T12:00:00"; // un lundi

function seanceTerminee(id: string, dateISO: string): Session {
  return {
    id,
    date: dateISO.slice(0, 10),
    dateISO,
    focus: "run",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 1,
    exercises: [],
    completed: true,
  } as unknown as Session;
}

const ETAT_BASE: EtatStoresHome = {
  displayName: null,
  nowISO: NOW,
  storeHydrated: true,
  sessions: [seanceTerminee("a", "2026-08-10T10:00:00")],
  chargesExternes: [],
  dailyApplied: {},
  lastAppliedDate: null,
  lastAiSessionV2: null,
  microcycleGoal: null,
  microcycleSessionIndex: 0,
  targetFksSessionsPerWeek: null,
  weeklyGoalReglage: null,
  debutDeSemaine: "mon",
  matchDays: [],
  enLigne: true,
  testsTerrain: [],
  mainObjective: null,
};

/**
 * Le denominateur REELLEMENT lu par le joueur, au bout du trajet : l'etat des
 * stores passe dans l'adaptateur, puis dans le ViewModel de la variante servie
 * en production (v2).
 */
function denominateurAffiche(etat: EtatStoresHome): number | null {
  const entree = construireEntreeHome(etat);
  const vm = buildHomeVNextViewModel(entree, { variante: "v2" });
  return vm.week?.goalCount ?? null;
}

/** L'etat des stores tel que `useEtatStoresHome` le compose apres l'ecriture. */
function etatApresReglages(weeklyGoalReglage: number | null): EtatStoresHome {
  return {
    ...ETAT_BASE,
    targetFksSessionsPerWeek: useExternalStore.getState().targetFksSessionsPerWeek,
    weeklyGoalReglage,
  };
}

beforeEach(() => {
  mockSetDoc.mockReset();
  mockSetDoc.mockResolvedValue(undefined);
  mockUtilisateur = { uid: "joueur-1" };
  useExternalStore.setState({ targetFksSessionsPerWeek: null });
});

// -----------------------------------------------------------------------------
// 1. Le trajet complet
// -----------------------------------------------------------------------------

describe("le reglage des Reglages atteint le compteur de l'accueil", () => {
  test("passer l'objectif a 4 change le denominateur affiche", async () => {
    // Depart : le joueur a declare 2 seances par semaine au setup.
    useExternalStore.setState({ targetFksSessionsPerWeek: 2 });
    expect(denominateurAffiche(etatApresReglages(2))).toBe(2);

    // Il tape « 4 » dans les Reglages.
    await enregistrerObjectifHebdo(4);

    // Le denominateur suit. AVANT LA CORRECTION, l'ecriture partait dans
    // `weeklyGoal` et cette valeur-la restait a 2 : le compteur ne bougeait pas.
    expect(denominateurAffiche(etatApresReglages(2))).toBe(4);
  });

  test("le champ canonique l'emporte, et c'est lui qui a ete ecrit", async () => {
    await enregistrerObjectifHebdo(3);
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBe(3);
    // Le reglage local peut dire n'importe quoi : il n'est plus la source.
    expect(denominateurAffiche(etatApresReglages(1))).toBe(3);
  });

  test("un compte ancien sans champ canonique lit encore le repli deprecie", () => {
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBeNull();
    expect(denominateurAffiche(etatApresReglages(3))).toBe(3);
  });
});

// -----------------------------------------------------------------------------
// 2. La persistance — la valeur doit survivre a la fermeture de l'app
// -----------------------------------------------------------------------------

describe("l'objectif est persiste dans users/{uid}, comme au setup", () => {
  test("une seule ecriture, deux clefs, en merge", async () => {
    await enregistrerObjectifHebdo(4);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [reference, charge, options] = mockSetDoc.mock.calls[0];
    expect(reference).toEqual({ chemin: ["users", "joueur-1"] });
    expect(options).toEqual({ merge: true });
    // Exactement les clefs autorisees par firestore.rules (userMutableFields) :
    // une clef de plus et l'ecriture entiere serait refusee.
    expect(Object.keys(charge).sort()).toEqual(["targetFksSessionsPerWeek", "updatedAt"]);
    expect(charge.targetFksSessionsPerWeek).toBe(4);
  });

  test("sans compte resolu, la valeur reste locale et rien n'est ecrit", async () => {
    mockUtilisateur = null;
    const issue = await enregistrerObjectifHebdo(3);
    expect(issue).toBe("hors-ligne");
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBe(3);
  });
});

// -----------------------------------------------------------------------------
// 3. Le retour arriere
// -----------------------------------------------------------------------------

describe("un refus de la base ne laisse pas un objectif fantome a l'ecran", () => {
  test("refus franc : l'ancienne valeur est retablie", async () => {
    useExternalStore.setState({ targetFksSessionsPerWeek: 2 });
    mockSetDoc.mockRejectedValue({ code: "permission-denied" });

    const issue = await enregistrerObjectifHebdo(4);

    expect(issue).toBe("refuse");
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBe(2);
    expect(denominateurAffiche(etatApresReglages(2))).toBe(2);
  });

  test("coupure reseau : la valeur reste, Firestore rejouera l'ecriture", async () => {
    useExternalStore.setState({ targetFksSessionsPerWeek: 2 });
    mockSetDoc.mockRejectedValue({ code: "unavailable" });

    const issue = await enregistrerObjectifHebdo(4);

    expect(issue).toBe("hors-ligne");
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBe(4);
  });
});

// -----------------------------------------------------------------------------
// 4. Les bornes
// -----------------------------------------------------------------------------

describe("un objectif reste un objectif", () => {
  test("zero, negatif et decimales sont ramenes dans les bornes", () => {
    expect(normaliserObjectifHebdo(0)).toBe(1);
    expect(normaliserObjectifHebdo(-4)).toBe(1);
    expect(normaliserObjectifHebdo(99)).toBe(6);
    expect(normaliserObjectifHebdo(2.6)).toBe(3);
    expect(normaliserObjectifHebdo(Number.NaN)).toBe(1);
  });

  test("la valeur ecrite est la valeur normalisee, pas la saisie", async () => {
    await enregistrerObjectifHebdo(99);
    expect(useExternalStore.getState().targetFksSessionsPerWeek).toBe(6);
    expect(mockSetDoc.mock.calls[0][1].targetFksSessionsPerWeek).toBe(6);
  });
});

// -----------------------------------------------------------------------------
// 5. La sentinelle sur l'ecran
// -----------------------------------------------------------------------------

describe("screens/SettingsScreen.tsx", () => {
  const ecran = require("fs").readFileSync(
    require("path").join(__dirname, "..", "..", "screens", "SettingsScreen.tsx"),
    "utf8"
  );

  test("le curseur n'ecrit plus le reglage local deprecie", () => {
    expect(ecran).not.toMatch(/updateSettings\(\s*\{\s*weeklyGoal/);
  });

  test("il passe par le seul ecrivain du champ canonique", () => {
    expect(ecran).toMatch(/from\s*"\.\.\/services\/objectifHebdo"/);
    expect(ecran).toContain("enregistrerObjectifHebdo");
  });

  test("et il AFFICHE la valeur canonique, pas le reglage local", () => {
    expect(ecran).toContain("resoudreObjectifHebdo");
    expect(ecran).not.toMatch(/value=\{String\(settings\.weeklyGoal\)\}/);
  });
});
