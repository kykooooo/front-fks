// screens/coach/__tests__/CoachPlayerScreen.test.tsx
//
// Ce que ces tests protègent, dans l'ordre d'importance produit :
//
//  1. L'ÉTAT DÉGRADÉ HONNÊTE. Tant que la boucle de suivi joueur n'est pas
//     déployée, `execution` est absente pour TOUS les joueurs : c'est le cas
//     nominal d'aujourd'hui. L'écran doit le dire, et surtout ne JAMAIS
//     fabriquer de compteurs — un « 0 exercice sauté » se lirait comme « il n'a
//     rien fait » alors qu'on ne sait simplement rien.
//  2. La coexistence PRÉVU / RÉALISÉ, qui est la raison d'être de la fiche.
//  3. La distinction ACCÈS/LECTURE IMPOSSIBLE vs DONNÉE ABSENTE, confondues
//     dans l'ancienne fiche (même cadenas pour les deux → le coach croyait à un
//     problème de droits alors que la projection n'était pas encore produite).
//  4. La règle d'or : tout contenu venant du serveur est borné (`numberOfLines`).
//
// Lancement depuis un worktree : npx jest --config jest.coach.config.js

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

// Navigation mockée : les fonctions ne déréférencent `mockNav` qu'à l'APPEL
// (pendant le rendu), donc bien après l'initialisation du module de test.
jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: mockNav.params }),
  useNavigation: () => mockNav.navigation,
  useFocusEffect: (cb: () => void | (() => void)) => {
    // `require` et non `import` : la fabrique de `jest.mock` est hissée AVANT
    // les imports du fichier, elle ne peut donc pas fermer sur un binding
    // d'import. Nom distinct de `React` pour ne pas masquer l'import du dessus.
    const ReactRuntime = require("react");
    ReactRuntime.useEffect(() => cb(), [cb]);
  },
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  fetchClubPlayerSummary: jest.fn(),
}));

// Retrait d'un membre : la SEULE écriture de cet écran. On mocke le service
// (jamais le hook) pour exercer réellement l'enchaînement écran → hook → appel.
jest.mock("../../../services/clubMembers", () => ({
  removeClubMember: jest.fn(),
}));

const mockNav: {
  params: { clubId: string; playerUid: string } | undefined;
  navigation: {
    setOptions: jest.Mock;
    goBack: jest.Mock;
    canGoBack: jest.Mock;
  };
} = {
  params: { clubId: "club1", playerUid: "u1" },
  navigation: {
    setOptions: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
};

import { fetchClubPlayerSummary } from "../../../repositories/clubsRepo";
import { removeClubMember } from "../../../services/clubMembers";
import { makeSummary } from "../../../domain/coachView/__tests__/fixtures";
import { addDaysToKey } from "../../../domain/coachView";
import { toDateKey } from "../../../utils/dateHelpers";
import {
  collectProp,
  collectText,
  findTextNodesContaining,
  flatText,
} from "../../../components/coach/__tests__/treeUtils";
import CoachPlayerScreen from "../CoachPlayerScreen";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";

const fetchMock = fetchClubPlayerSummary as jest.MockedFunction<typeof fetchClubPlayerSummary>;
const removeMock = removeClubMember as jest.MockedFunction<typeof removeClubMember>;

// Métriques figées : sans elles, SafeAreaProvider attend une mesure native qui
// n'arrive jamais en test et ne rend aucun enfant.
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const TODAY = toDateKey(new Date());
/** Date relative à l'horloge RÉELLE du test (le hook lit l'horloge du coach). */
const jour = (offset: number): string => addDaysToKey(TODAY, offset) ?? TODAY;

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
  jest.clearAllMocks();
});

async function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachPlayerScreen />
      </SafeAreaProvider>,
    );
  });
  // Deuxième passe : la lecture de la projection est asynchrone.
  await act(async () => {});
  mounted.push(renderer);
  return renderer.toJSON();
}

/** Projection telle qu'elle existe AUJOURD'HUI : aucun champ d'exécution. */
function summaireSansExecution(overrides: Partial<CoachPlayerSummary> = {}): CoachPlayerSummary {
  return makeSummary({
    firstName: "Anna",
    latestSession: {
      dateKey: jour(-1),
      title: "Force bas du corps",
      focusLabel: "Force",
      intensityLabel: "Modérée",
      durationMin: 45,
      blockCount: 4,
      status: "done",
    },
    lastActivity: { dateKey: jour(-1), durationMin: 45 },
    activity: { doneDateKeys: [jour(-1), jour(-4)] },
    ...overrides,
  });
}

describe("CoachPlayerScreen — cas nominal (boucle de suivi non déployée)", () => {
  test("affiche l'identité, le prévu/réalisé, et DIT que le détail du réalisé manque", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);

    expect(texte).toContain("Anna");
    expect(texte).toContain("Prévu vs réalisé");
    expect(texte).toContain("Prescrit par FKS");
    expect(texte).toContain("Réalisé par le joueur");
    // État dégradé nommé, sans aucun compteur inventé.
    expect(texte).toContain("Détail du réalisé pas encore disponible");
    expect(texte).not.toContain("Exercices faits");
    expect(texte).not.toContain("Séance réalisée en entier");
  });

  test("le titre du header porte le prénom, jamais « Joueur » en dur", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    await render();

    const titres = mockNav.navigation.setOptions.mock.calls.map(
      (call) => (call[0] as { title?: string }).title,
    );
    expect(titres).toContain("Anna");
    expect(titres).not.toContain("Joueur");
  });

  test("joueur sans aucune séance : un seul message, pas une pile de blocs vides", async () => {
    fetchMock.mockResolvedValue({
      summary: makeSummary({ firstName: "Bea" }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Aucune séance pour l'instant");
    // Le signal d'attention dit l'absence de donnée, il ne la maquille pas.
    expect(texte).toContain("Aucune donnée d'entraînement");
    // Rien à réaliser -> on ne parle pas du détail d'exécution manquant.
    expect(texte).not.toContain("Détail du réalisé pas encore disponible");
  });

  test("assiduité indisponible quand le serveur ne projette pas la fenêtre d'activité", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({ activity: null }),
      unavailable: false,
    });

    const tree = await render();
    expect(flatText(tree)).toContain("Assiduité indisponible");
  });

  test("assiduité affichée quand la fenêtre existe : deux fenêtres explicites", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("7 derniers jours");
    expect(texte).toContain("14 derniers jours");
    expect(texte).toContain("Case cochée = séance terminée ce jour-là.");
  });

  test("aucun ajustement moteur → « Séance standard », et jamais le mot « Adaptée »", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Séance standard");
    // « Adaptée » tout court confondait l'ajustement du MOTEUR avec un choix du
    // joueur : le mot ne doit plus apparaître seul dans la fiche.
    expect(texte).not.toContain("Adaptée");
  });
});

describe("CoachPlayerScreen — exécution réelle disponible", () => {
  const avecExecution = () =>
    summaireSansExecution({
      lastPlanned: {
        dateKey: jour(-1),
        title: "Force bas du corps",
        focusLabel: "Force",
        intensityLabel: "Modérée",
        durationMin: 45,
        blockCount: 4,
      },
      lastDone: {
        dateKey: jour(-1),
        title: "Force bas du corps",
        focusLabel: "Force",
        intensityLabel: "Modérée",
        durationMin: 38,
        blockCount: 4,
      },
      execution: {
        completionPct: 100,
        completionStatus: "full",
        itemsDone: 12,
        itemsAdapted: 1,
        itemsSkipped: 0,
        itemsReplaced: 0,
        itemsReplacedEquivalent: 0,
        itemsReplacedPartial: 0,
        itemsTotal: 13,
        deviationLabels: ["Manque de temps"],
      },
    });

  test("compteurs, statut et raisons affichés ; l'état dégradé disparaît", async () => {
    fetchMock.mockResolvedValue({ summary: avecExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    const textes = collectText(tree);

    expect(texte).toContain("Séance réalisée en entier");
    // « Faits | 12 » et non « Faits » seul : le mot apparaît aussi dans le
    // sous-titre de l'historique, une assertion large ne prouverait rien.
    expect(texte).toContain("Faits | 12");
    expect(texte).toContain("Manque de temps");
    expect(textes).toContain("12");
    expect(textes).toContain("100");
    // Un zéro MESURÉ s'affiche : ce n'est pas une donnée absente.
    expect(textes).toContain("0");
    expect(texte).not.toContain("Détail du réalisé pas encore disponible");
  });

  test("prévu et réalisé coexistent : deux durées distinctes, pas un seul créneau", async () => {
    fetchMock.mockResolvedValue({ summary: avecExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("45 min"); // prescrit
    expect(texte).toContain("38 min"); // réalisé
  });

  test("un compteur non transmis reste « donnée absente », jamais un zéro", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        execution: {
          completionPct: null,
          completionStatus: "partial",
          itemsDone: 6,
          itemsAdapted: null,
          itemsSkipped: 2,
          itemsReplaced: null,
          itemsReplacedEquivalent: null,
          itemsReplacedPartial: null,
          itemsTotal: null,
          deviationLabels: [],
        },
      }),
      unavailable: false,
    });

    const tree = await render();
    expect(flatText(tree)).toContain("Donnée absente");
  });

  // Le pourcentage vient d'un COMPTAGE d'exercices. Le signal d'attention le
  // disait prudemment ("Environ 55 % des exercices prévus…") pendant que la
  // fiche affichait "Séance réalisée : 55 %", qui se lit comme un rendement du
  // joueur. Les deux côtés parlent maintenant d'exercices.
  test("le pourcentage est présenté comme une part d'EXERCICES, pas une performance", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        execution: {
          completionPct: 55,
          completionStatus: "partial",
          itemsDone: 6,
          itemsAdapted: 1,
          itemsSkipped: 2,
          itemsReplaced: 0,
          itemsReplacedEquivalent: 0,
          itemsReplacedPartial: 0,
          // Total ABSENT : le calcul n'est donc pas affiché, mais la mention
          // prudente sur le pourcentage, elle, reste.
          itemsTotal: null,
          deviationLabels: [],
        },
      }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);
    expect(collectText(tree)).toContain("55");
    expect(texte).toContain("Exercices réalisés");
    expect(texte).toContain("part des exercices prévus, pas une mesure d'effort");
    // Le chiffre n'est jamais présenté comme "la séance réalisée à 55 %".
    expect(texte).not.toContain("part de la séance effectuée");
  });
});

// ─── RETOUR 2 : le pourcentage doit être REFAISABLE de tête ──────────────────
// Le défaut relevé en démonstration : « 79 % » à côté de compteurs qui, mis bout
// à bout, ne redonnaient pas 79. Ces tests protègent les deux moitiés de la
// correction — on montre le calcul quand on peut le prouver, on ne montre RIEN
// quand on ne peut pas.
describe("CoachPlayerScreen — le calcul du pourcentage est montré", () => {
  /** Cas réaliste, identique au test de preuve côté functions : 12 exercices → 79 %. */
  const executionDetaillee = () =>
    summaireSansExecution({
      lastDone: {
        dateKey: jour(-1),
        title: "Force bas du corps",
        focusLabel: "Force",
        intensityLabel: "Modérée",
        durationMin: 38,
        blockCount: 4,
      },
      execution: {
        completionPct: 79,
        completionStatus: "partial",
        itemsDone: 7,
        itemsAdapted: 1,
        itemsSkipped: 1,
        itemsReplaced: 2,
        itemsReplacedEquivalent: 1,
        itemsReplacedPartial: 1,
        itemsTotal: 12,
        deviationLabels: [],
      },
    });

  test("catégories exclusives, total affiché, et l'opération qui redonne le chiffre", async () => {
    fetchMock.mockResolvedValue({ summary: executionDetaillee(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);

    // Les six cases où un exercice peut tomber, sans chevauchement possible :
    // 7 + 1 + 1 + 1 + 1 + 1 = 12, soit exactement le total affiché. C'est CE
    // point-là que Kyllian voulait pouvoir vérifier à l'œil.
    expect(texte).toContain("Faits | 7");
    expect(texte).toContain("Adaptés | 1");
    expect(texte).toContain("Remplacés par un équivalent | 1");
    expect(texte).toContain("Remplacés en partie | 1");
    expect(texte).toContain("Sautés | 1");
    expect(texte).toContain("Non renseignés | 1");
    expect(texte).toContain("Total des exercices | 12");

    // L'opération elle-même : 7 + 1 + 1 + 0,5 = 9,5 sur 12, soit 79 %.
    expect(texte).toContain("7 + 1 + 1 + 0,5 = 9,5 sur 12 exercices, soit 79 %");
  });

  test("la règle de calcul est écrite en français, pas déduite d'un graphique", async () => {
    fetchMock.mockResolvedValue({ summary: executionDetaillee(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);

    expect(texte).toContain("compte comme fait");
    expect(texte).toContain("compte pour moitié");
    expect(texte).toContain("ne compte pas");
    expect(texte).toContain("divisée par le nombre total d'exercices de la séance");
  });

  test("total absent : aucune formule inventée, mais le pourcentage garde sa mention prudente", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        execution: {
          completionPct: 79,
          completionStatus: "partial",
          itemsDone: 7,
          itemsAdapted: 1,
          itemsSkipped: 1,
          itemsReplaced: 2,
          itemsReplacedEquivalent: 1,
          itemsReplacedPartial: 1,
          itemsTotal: null,
          deviationLabels: [],
        },
      }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);

    expect(texte).toContain("Exercices réalisés");
    expect(texte).toContain("part des exercices prévus, pas une mesure d'effort");
    expect(texte).toContain("Le nombre total d'exercices de la séance n'a pas été transmis");
    expect(texte).not.toContain("Total des exercices");
    expect(texte).not.toContain("sur 12 exercices");
  });

  test("nature des remplacements inconnue : on le dit, on ne répartit pas au hasard", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        execution: {
          completionPct: 79,
          completionStatus: "partial",
          itemsDone: 7,
          itemsAdapted: 1,
          itemsSkipped: 1,
          itemsReplaced: 2,
          itemsReplacedEquivalent: null,
          itemsReplacedPartial: null,
          itemsTotal: 12,
          deviationLabels: [],
        },
      }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);

    expect(texte).toContain("La nature des remplacements");
    expect(texte).not.toContain("Total des exercices");
  });
});

describe("CoachPlayerScreen — ajustements du moteur", () => {
  test("TOUS les motifs sont affichés (l'ancienne fiche en tronquait à quatre)", async () => {
    const labels = [
      "Charge allégée",
      "Volume réduit",
      "Impacts limités",
      "Durée raccourcie",
      "Intensité abaissée",
      "Sauts retirés",
    ];
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({ adaptation: { adapted: true, labels } }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);
    labels.forEach((label) => expect(texte).toContain(label));
    expect(texte).toContain("Séance ajustée par FKS");
  });
});

describe("CoachPlayerScreen — états d'exception distingués", () => {
  test("lecture impossible ≠ donnée absente : message d'erreur, pas de synchronisation", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: true });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Chargement impossible");
    expect(texte).not.toContain("Synchronisation en cours");
    // Aucune identité inventée quand on n'a rien pu lire.
    expect(texte).not.toContain("Joueur sans prénom");
  });

  test("projection pas encore produite : synchronisation en cours, pas une erreur", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Synchronisation en cours");
    expect(texte).not.toContain("Chargement impossible");
  });

  // TROIS états, TROIS rendus différents. Le troisième — l'accès non autorisé —
  // est une DÉCISION serveur : ni une panne (rien n'est cassé), ni une attente
  // (rien n'arrivera tout seul). Les confondre ferait dire à l'écran une chose
  // fausse dans les deux sens.
  test("accès non autorisé : message dédié, ni erreur ni synchronisation", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: false, restricted: true });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Suivi non accessible");
    expect(texte).not.toContain("Chargement impossible");
    expect(texte).not.toContain("Synchronisation en cours");
  });

  test("accès non autorisé : aucune donnée de suivi, et jamais 'ne s'entraîne pas'", async () => {
    fetchMock.mockResolvedValue({ summary: null, unavailable: false, restricted: true });

    const tree = await render();
    const texte = flatText(tree);
    const bas = texte.toLowerCase();
    // Le joueur reste dans l'effectif : on ne laisse pas croire qu'il a disparu
    // ni qu'il ne s'entraîne pas.
    expect(bas).toContain("fait partie de l'effectif");
    expect(bas).toContain("peut s'entraîner normalement");
    // Aucun contenu de suivi ne fuit dans cet état.
    expect(texte).not.toContain("Séance prévue");
    expect(texte).not.toContain("Séance faite");
    expect(texte).not.toContain("Assiduité");
    // Vocabulaire produit NEUTRE : rien de juridique, rien de médical.
    for (const mot of ["consentement", "parental", "rgpd", "tuteur", "légal", "mineur", "santé"]) {
      expect(bas).not.toContain(mot);
    }
  });

  test("le pied de page rappelle la lecture seule et l'absence de donnée de santé", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Lecture seule");
    expect(texte).toContain("Aucune donnée de santé");
  });

  test("aucune action inventée : pas de messagerie ni de modification de programme", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Revenir à l'effectif");
    expect(texte).toContain("Actualiser");
    expect(texte.toLowerCase()).not.toContain("message");
    expect(texte.toLowerCase()).not.toContain("modifier le programme");
  });
});

describe("CoachPlayerScreen — textes longs (règle d'or)", () => {
  test("tout contenu serveur est borné par numberOfLines", async () => {
    const LONG_TITRE = "Séance de force du bas du corps avec prévention ischios et gainage long";
    const LONG_LABEL = "Volume réduit parce que la semaine de club est particulièrement chargée";

    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        firstName: "Alexandrina-Maximilienne",
        position: "Milieu récupérateur axial et relayeuse",
        latestSession: {
          dateKey: jour(-1),
          title: LONG_TITRE,
          focusLabel: "Force et prévention des ischio-jambiers en fin de cycle",
          intensityLabel: "Modérée à soutenue selon la fraîcheur du jour",
          durationMin: 45,
          blockCount: 4,
        status: "done",
        },
        adaptation: { adapted: true, labels: [LONG_LABEL] },
      }),
      unavailable: false,
    });

    const tree = await render();

    for (const aiguille of [LONG_TITRE, LONG_LABEL, "Alexandrina-Maximilienne"]) {
      const noeuds = findTextNodesContaining(tree, aiguille);
      expect(noeuds.length).toBeGreaterThan(0);
      noeuds.forEach((noeud) => {
        expect(typeof noeud.props.numberOfLines).toBe("number");
      });
    }
  });
});

// ─── RETOUR 6 : un statut qui ne dit que ce qu'il sait ──────────────────────
describe("CoachPlayerScreen — « Rien à signaler » n'est pas « tout va bien »", () => {
  test("aucun signal + données manquantes : la nuance est écrite, pas sous-entendue", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const texte = flatText(tree);

    // La carte de statut porte la phrase entière (il y a la place).
    expect(texte).toContain("Rien à signaler parmi les données disponibles");
    // Et l'en-tête aussi, sous la pastille restée courte.
    expect(texte).toContain("l'app ne connaît pas tout de ce joueur");
  });

  test("le lecteur d'écran entend la nuance, pas seulement le raccourci de la pastille", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });

    const tree = await render();
    const labels = collectProp(tree, "accessibilityLabel").filter(
      (v): v is string => typeof v === "string",
    );
    expect(labels.join(" | ")).toContain(
      "Statut : Rien à signaler parmi les données disponibles",
    );
  });

  test("des signaux présents : la carte dit quand même que la lecture est partielle", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({ profileComplete: false }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);
    expect(texte).toContain("Profil incomplet");
    expect(texte).toContain("ce constat ne porte que sur ce qui est connu");
  });
});

// ─── RETOUR 8 : accents à l'écran, valeur stockée intacte ───────────────────
describe("CoachPlayerScreen — libellés d'identité accentués", () => {
  test("« Regional » et « Defenseur » se lisent accentués sur la fiche", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({
        firstName: "Sami",
        // Valeurs PERSISTÉES, comparées à une allowlist serveur : sans accent.
        position: "Defenseur",
        level: "Regional",
        ageCategory: "U17",
      }),
      unavailable: false,
    });

    const tree = await render();
    const texte = flatText(tree);

    expect(texte).toContain("Défenseur · Régional · U17");
    expect(texte).not.toContain("Defenseur · Regional");
  });

  test("un niveau inconnu de la table d'affichage reste lisible tel quel", async () => {
    fetchMock.mockResolvedValue({
      summary: summaireSansExecution({ level: "Départemental", position: null }),
      unavailable: false,
    });

    const tree = await render();
    expect(flatText(tree)).toContain("Départemental");
  });
});

// ─── RETRAIT DE L'EFFECTIF ───────────────────────────────────────────────────
//
// La seule ÉCRITURE de cet écran. Ce que ces tests protègent :
//  1. LA DISTINCTION QUI COMPTE. « Retirer du club » et « supprimer le compte »
//     sont indiscernables dans le vocabulaire courant. La phrase « le retrait du
//     club ne supprime JAMAIS le compte FKS du joueur » doit être à l'écran,
//     AVANT la confirmation. Elle est verrouillée ici, mot pour mot.
//  2. LA CONFIRMATION : un seul appui ne retire personne.
//  3. LE REFUS DU PROPRIÉTAIRE, affiché tel que le serveur le formule — c'est le
//     seul refus qui nomme le geste à faire.
//  4. AUCUNE ANTICIPATION : l'écran propose l'action à tout le monde, il ne
//     duplique pas le prédicat d'autorité, il affiche le verdict du serveur.

function noeudParTestID(node: unknown, testID: string): any {
  const pile: unknown[] = [node];
  while (pile.length) {
    const courant: any = pile.pop();
    if (!courant || typeof courant !== "object") continue;
    if (Array.isArray(courant)) {
      pile.push(...courant);
      continue;
    }
    if (courant.props?.testID === testID) return courant;
    if (courant.children) pile.push(...courant.children);
  }
  return null;
}

/** Rend l'écran et renvoie le renderer (pour relire l'arbre après un appui). */
async function rendreAvecRenderer(): Promise<TestRenderer.ReactTestRenderer> {
  await render();
  return mounted[mounted.length - 1];
}

/**
 * Appuie sur un bouton par son testID.
 *
 * On passe par `renderer.root` et NON par l'arbre JSON : `toJSON()` ne rend que
 * les composants hôtes, où `onPress` d'un `Pressable` a déjà été traduit en
 * gestionnaires de responder. L'instance de test, elle, porte encore la prop
 * telle que l'écran l'a écrite — c'est bien ce comportement-là qu'on veut
 * exercer.
 */
async function appuyer(renderer: TestRenderer.ReactTestRenderer, testID: string): Promise<void> {
  const cibles = renderer.root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === "function",
    { deep: true },
  );
  if (!cibles.length) throw new Error(`bouton introuvable : ${testID}`);
  const onPress = cibles[0].props.onPress as () => void;
  await act(async () => {
    onPress();
  });
}

describe("CoachPlayerScreen — retrait de l'effectif", () => {
  test("l'action existe, et rien n'est appelé tant que personne n'appuie", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    const tree = await render();
    expect(flatText(tree)).toContain("Retirer du club");
    expect(removeMock).not.toHaveBeenCalled();
  });

  test("un premier appui CONFIRME au lieu de retirer", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("Retirer Anna de l'effectif ?");
    expect(texte).toContain("Confirmer le retrait");
    expect(removeMock).not.toHaveBeenCalled();
  });

  test("la confirmation DIT que le compte FKS n'est pas supprimé", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    const renderer = await rendreAvecRenderer();
    await appuyer(renderer, "coach-player-retrait-ouvrir");

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("Le retrait du club ne supprime JAMAIS le compte FKS du joueur");
    // Les deux portées sont DISTINGUÉES, jamais mélangées.
    expect(texte).toContain("ne fait plus partie de l'effectif de ce club");
    expect(texte).toContain("son historique personnel lui appartiennent et restent intacts");
  });

  test("annuler ne retire personne et referme la confirmation", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    const renderer = await rendreAvecRenderer();
    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-annuler");

    expect(removeMock).not.toHaveBeenCalled();
    const texte = flatText(renderer.toJSON());
    expect(texte).not.toContain("Confirmer le retrait");
    expect(texte).toContain("Retirer du club");
  });

  test("confirmer appelle le serveur avec le club et le joueur de la ROUTE", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: false });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-confirmer");

    expect(removeMock).toHaveBeenCalledWith("club1", "u1");
    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("a été retiré de l'effectif");
    expect(texte).toContain("n'ont pas été touchés");
  });

  test("REFUS PROPRIÉTAIRE : le message du serveur est affiché tel quel", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    removeMock.mockResolvedValue({
      ok: false,
      reason: "ownerTransferRequired",
      message:
        "Ce compte est le propriétaire du club : il ne peut pas être retiré. Transférez d'abord la propriété à un autre encadrant.",
    });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-confirmer");

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("propriétaire du club");
    expect(texte).toContain("Transférez d'abord la propriété");
    // L'écran n'annonce PAS un succès qui n'a pas eu lieu.
    expect(texte).not.toContain("a été retiré de l'effectif");
  });

  test("REFUS D'AUTORITÉ : message affiché, et le geste reste possible", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    removeMock.mockResolvedValue({
      ok: false,
      reason: "denied",
      message: "Retrait impossible avec ce compte.",
    });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-confirmer");

    expect(flatText(renderer.toJSON())).toContain("Retrait impossible avec ce compte.");
    // Un refus n'est pas une impasse : le bouton reste là.
    expect(noeudParTestID(renderer.toJSON(), "coach-player-retrait-confirmer")).not.toBeNull();
  });

  test("REJEU : « déjà retiré » n'est pas annoncé comme un nouveau retrait", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: true });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-confirmer");

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("ne faisait déjà plus partie de l'effectif");
    expect(texte).not.toContain("a été retiré de l'effectif");
  });

  test("le message d'erreur venant du serveur reste borné (règle d'or)", async () => {
    fetchMock.mockResolvedValue({ summary: summaireSansExecution(), unavailable: false });
    removeMock.mockResolvedValue({ ok: false, reason: "denied", message: "x".repeat(400) });
    const renderer = await rendreAvecRenderer();

    await appuyer(renderer, "coach-player-retrait-ouvrir");
    await appuyer(renderer, "coach-player-retrait-confirmer");

    const erreur = noeudParTestID(renderer.toJSON(), "coach-player-retrait-erreur");
    expect(erreur).not.toBeNull();
    expect(typeof erreur.props.numberOfLines).toBe("number");
  });
});
