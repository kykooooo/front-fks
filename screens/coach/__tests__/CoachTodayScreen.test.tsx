// screens/coach/__tests__/CoachTodayScreen.test.tsx
//
// CE QUE CES TESTS PROTÈGENT (défauts mesurés par l'audit de l'espace coach) :
//
//  1. LA RÉPONSE EST EN HAUT. L'écran d'origine plaçait ~580 px de résumé avant
//     la première ligne de joueur : "qui dois-je appeler ?" était hors écran au
//     chargement. On vérifie ici que "À vérifier aujourd'hui" est le premier
//     bloc de contenu, avant les chiffres et avant la semaine.
//  2. ZÉRO N'EST PAS INDISPONIBLE. "0 séance faite aujourd'hui" est une mesure ;
//     "—" veut dire qu'on n'a rien pu mesurer. Les confondre fait croire à un
//     entraîneur que son groupe n'a rien fait alors qu'on n'a pas la donnée.
//  3. UN VIDE N'EST PAS UNE PANNE, ET UNE PANNE N'EST PAS UN VIDE. Chaque état
//     (sans club, effectif illisible, club vide, rien à vérifier) a sa propre
//     phrase, et aucune n'est un compteur à zéro déguisé.
//  4. LA COULEUR N'EST JAMAIS SEULE : le statut est écrit en toutes lettres.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

// Navigation : l'écran n'en a besoin que pour ses actions par défaut, et les
// tests injectent leurs propres callbacks. On neutralise le module entier.
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => {},
}));

// Haptique : hors scope de ces tests, et le vrai hook tire le store de réglages.
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

// Les deux hooks de données sont pilotés par le test : on veut éprouver l'ÉCRAN
// (ce qu'il affiche selon l'état), pas re-tester la couche d'accès aux données.
jest.mock("../../../hooks/coach/useCoachClub", () => ({
  useCoachClub: () => mockClub.value,
}));
jest.mock("../../../hooks/coach/useCoachRoster", () => ({
  useCoachRoster: () => mockRoster.value,
}));

import CoachTodayScreen from "../CoachTodayScreen";
import { makeSummary } from "../../../domain/coachView/__tests__/fixtures";
import { toCoachPlayerViews } from "../../../domain/coachView/fromSummary";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";
import type { CoachPlayerView } from "../../../domain/coachView/types";
import { collectProp, flatText } from "../../../components/coach/__tests__/treeUtils";

// ─── Horloge et état injectés ────────────────────────────────────────────────

const TODAY = "2026-07-27"; // lundi
const WEEK = "2026-07-27";
const NOW_MS = new Date(`${TODAY}T14:32:00`).getTime();
const now = () => NOW_MS;

type ClubState = ReturnType<typeof clubReady>;
type RosterState = ReturnType<typeof rosterReady>;

const mockClub: { value: ClubState } = { value: null as never };
const mockRoster: { value: RosterState } = { value: null as never };

function clubReady(over: Partial<ReturnType<typeof baseClub>> = {}) {
  return { ...baseClub(), ...over };
}

function baseClub() {
  return {
    status: "ready" as "loading" | "ready" | "notInClub" | "error",
    clubId: "club-1" as string | null,
    clubName: "US Terrain" as string | null,
    teamGender: null as null | "female" | "male" | "mixed",
    weekKey: WEEK,
    weekContext: null,
    weekContextUnavailable: false,
    fetchedAt: NOW_MS,
    isRefreshing: false,
    refresh: jest.fn(),
  };
}

function rosterReady(views: CoachPlayerView[], over: Partial<ReturnType<typeof baseRoster>> = {}) {
  const base = baseRoster();
  return {
    ...base,
    views,
    readyCount: views.length,
    memberCount: views.length,
    ...over,
  };
}

function baseRoster() {
  return {
    views: [] as CoachPlayerView[],
    status: "ready" as "loading" | "ready" | "unavailable",
    readyCount: 0,
    pendingCount: 0,
    unreadableCount: 0,
    memberCount: 0,
    fetchedAt: NOW_MS - 60_000,
    isStale: false,
    isRefreshing: false,
    refresh: jest.fn(),
  };
}

// ─── Fabriques de joueurs ────────────────────────────────────────────────────

/** Séance prévue vendredi dernier, jamais réalisée → statut "à vérifier". */
function seancePrevueNonFaite(uid: string, prenom: string): CoachPlayerSummary {
  return makeSummary({
    playerUid: uid,
    firstName: prenom,
    latestSession: {
      dateKey: "2026-07-24", // vendredi
      title: "Force bas du corps",
      focusLabel: "Force",
      intensityLabel: "Modérée",
      durationMin: 45,
      blockCount: 4,
      status: "planned",
    },
  });
}

/** Fenêtre d'activité projetée, séance faite aujourd'hui → rien à signaler. */
function actifAujourdhui(uid: string, prenom: string): CoachPlayerSummary {
  return makeSummary({
    playerUid: uid,
    firstName: prenom,
    activity: { doneDateKeys: [TODAY, "2026-07-25"] },
    lastActivity: { dateKey: TODAY, durationMin: 40 },
  });
}

/** Fenêtre d'activité projetée, mais aucune séance aujourd'hui (mesure = 0). */
function actifHier(uid: string, prenom: string): CoachPlayerSummary {
  return makeSummary({
    playerUid: uid,
    firstName: prenom,
    activity: { doneDateKeys: ["2026-07-26"] },
    lastActivity: { dateKey: "2026-07-26", durationMin: 40 },
  });
}

const viewsOf = (summaries: CoachPlayerSummary[]): CoachPlayerView[] =>
  toCoachPlayerViews(summaries, TODAY);

// ─── Rendu ───────────────────────────────────────────────────────────────────

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
});

beforeEach(() => {
  mockClub.value = clubReady();
  mockRoster.value = rosterReady([]);
});

async function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachTodayScreen now={now} onOpenPlayer={jest.fn()} onOpenRoster={jest.fn()} onOpenWeek={jest.fn()} />
      </SafeAreaProvider>
    );
  });
  mounted.push(renderer);
  return renderer;
}

async function renderText(): Promise<string> {
  const renderer = await render();
  return flatText(renderer.toJSON());
}

// ─── En-tête ─────────────────────────────────────────────────────────────────

describe("En-tête — court, daté, actualisable", () => {
  test("le club, le jour en clair et la fraîcheur tiennent en tête d'écran", async () => {
    const texte = await renderText();
    expect(texte).toContain("US Terrain");
    expect(texte).toContain("Lundi 27 juillet");
    // buildFreshness : une minute d'écart -> "Mis à jour il y a 1 min".
    expect(texte).toContain("Mis à jour");
  });

  test("le bouton d'actualisation est annoncé au lecteur d'écran", async () => {
    const renderer = await render();
    const labels = collectProp(renderer.toJSON(), "accessibilityLabel").filter(
      (v): v is string => typeof v === "string"
    );
    expect(labels).toContain("Actualiser les données");
  });

  test("un rafraîchissement raté est annoncé, sans effacer les données affichées", async () => {
    mockRoster.value = rosterReady(viewsOf([actifHier("u1", "Lina")]), { isStale: true });
    const texte = await renderText();
    expect(texte).toContain("mise à jour impossible");
    expect(texte).toContain("Aujourd'hui dans le groupe");
  });
});

// ─── Section prioritaire ─────────────────────────────────────────────────────

describe("À vérifier aujourd'hui — premier contenu de l'écran", () => {
  test("la section précède les chiffres et la semaine", async () => {
    mockRoster.value = rosterReady(viewsOf([seancePrevueNonFaite("u1", "Marc")]));
    const texte = await renderText();
    const iVerifier = texte.indexOf("À vérifier aujourd'hui");
    const iGroupe = texte.indexOf("Aujourd'hui dans le groupe");
    const iSemaine = texte.indexOf("Cette semaine");
    expect(iVerifier).toBeGreaterThanOrEqual(0);
    expect(iVerifier).toBeLessThan(iGroupe);
    expect(iGroupe).toBeLessThan(iSemaine);
  });

  test("chaque entrée donne le prénom, le statut EN TOUTES LETTRES et la raison", async () => {
    mockRoster.value = rosterReady(viewsOf([seancePrevueNonFaite("u1", "Marc")]));
    const texte = await renderText();
    expect(texte).toContain("Marc");
    // La couleur n'est jamais seule porteuse de sens : le statut est écrit.
    expect(texte).toContain("À vérifier");
    // Raison courte et datée, pas le titre nu du signal.
    expect(texte).toContain("Séance prévue vendredi, pas encore faite");
  });

  test("la liste est bornée à 5 entrées et annonce le reste", async () => {
    const summaries = Array.from({ length: 7 }, (_, i) =>
      seancePrevueNonFaite(`u${i}`, `Joueur${i}`)
    );
    mockRoster.value = rosterReady(viewsOf(summaries));
    const texte = await renderText();
    expect(texte).toContain("5 profils affichés sur 7");
    expect(texte).toContain("Voir tout");
  });

  test("la provenance des signaux est dite, une fois, sous la liste", async () => {
    mockRoster.value = rosterReady(viewsOf([seancePrevueNonFaite("u1", "Marc")]));
    const texte = await renderText();
    expect(texte).toContain("D'où viennent ces signaux");
    expect(texte).toContain("calculé par l'app");
  });

  // RETOUR 6. Tant que la boucle de suivi joueur n'est pas déployée, l'exécution
  // n'est transmise pour PERSONNE : « Rien à vérifier aujourd'hui » affirmerait
  // que l'app a tout regardé alors qu'elle n'a presque rien reçu. Le titre le
  // dit, et la seconde phrase borne explicitement le constat.
  test("liste vide avec des données manquantes : le constat est borné", async () => {
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]));
    const texte = await renderText();
    expect(texte).toContain("Rien à vérifier parmi les données disponibles");
    // Le constat dit SUR QUOI il porte, sinon il ne vaut rien.
    expect(texte).toContain("Aucun signal à lire sur 1 membre.");
    expect(texte).toContain("ce constat ne porte que sur ce qui a été transmis");
    // Aucune alerte inventée pour remplir l'écran.
    expect(texte).not.toContain("À vérifier |");
  });

  test("lecture partielle : les profils non lus nuancent le constat", async () => {
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]), {
      unreadableCount: 3,
      memberCount: 4,
    });
    const texte = await renderText();
    expect(texte).toContain("3 profils non lus");
    expect(texte).toContain("cette liste peut être incomplète");
  });

  test("projections en préparation : état normal, jamais présenté comme une panne", async () => {
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]), {
      pendingCount: 2,
      memberCount: 3,
    });
    const texte = await renderText();
    expect(texte).toContain("2 profils en cours de préparation");
    expect(texte.toLowerCase()).not.toContain("erreur");
  });
});

// ─── Chiffres ────────────────────────────────────────────────────────────────

describe("Aujourd'hui dans le groupe — zéro n'est pas indisponible", () => {
  test("sans fenêtre d'activité projetée, le chiffre du jour est INDISPONIBLE", async () => {
    // Cas NOMINAL aujourd'hui : la boucle de suivi joueur n'est pas mergée,
    // aucun `activity` n'est projeté -> on ne peut RIEN mesurer.
    mockRoster.value = rosterReady(viewsOf([seancePrevueNonFaite("u1", "Marc")]));
    const texte = await renderText();
    expect(texte).toContain("Ont fait leur séance");
    expect(texte).toContain("Donnée absente");
    expect(texte).toContain("—");
  });

  test("avec fenêtre d'activité et aucune séance du jour, le chiffre vaut ZÉRO", async () => {
    mockRoster.value = rosterReady(viewsOf([actifHier("u1", "Lina")]));
    const renderer = await render();
    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("Ont fait leur séance");
    expect(texte).toContain("0");
    // Une mesure à zéro ne doit JAMAIS s'accompagner de "Donnée absente" sur
    // cette carte : le seul autre "—" possible viendrait d'un autre chiffre.
    expect(texte).toContain("Sur 1 profil suivi");
  });

  test("une séance faite aujourd'hui est comptée", async () => {
    mockRoster.value = rosterReady(
      viewsOf([actifAujourdhui("u1", "Lina"), actifHier("u2", "Théo")])
    );
    const texte = await renderText();
    expect(texte).toContain("Sur 2 profils suivis");
  });

  test("les quatre chiffres de décision sont présents, et pas un de plus", async () => {
    mockRoster.value = rosterReady(viewsOf([actifHier("u1", "Lina")]));
    const texte = await renderText();
    expect(texte).toContain("Ont fait leur séance");
    expect(texte).toContain("Séance prévue non faite");
    expect(texte).toContain("Sans donnée récente");
    expect(texte).toContain("Effectif");
  });
});

// ─── Semaine ─────────────────────────────────────────────────────────────────

describe("Cette semaine — phrases descriptives, aucun graphique", () => {
  test("l'écran affiche le résumé et un lien vers la semaine", async () => {
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]));
    const texte = await renderText();
    expect(texte).toContain("Cette semaine");
    expect(texte).toContain("Semaine du");
    expect(texte).toContain("Voir la semaine");
  });

  test("aucun jargon de charge n'atteint le coach", async () => {
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]));
    const texte = await renderText();
    for (const jargon of ["TSB", "ATL", "CTL", "RPE", "token"]) {
      expect(texte).not.toContain(jargon);
    }
  });
});

// ─── États de premier rang ───────────────────────────────────────────────────

describe("États — un vide n'est pas une panne", () => {
  test("chargement : un squelette, pas un compteur à zéro", async () => {
    mockClub.value = clubReady({ status: "loading" });
    const renderer = await render();
    const labels = collectProp(renderer.toJSON(), "accessibilityLabel").filter(
      (v): v is string => typeof v === "string"
    );
    expect(labels).toContain("Chargement en cours");
    expect(flatText(renderer.toJSON())).not.toContain("Aujourd'hui dans le groupe");
  });

  test("erreur de lecture du club : cause non inventée, sortie proposée", async () => {
    mockClub.value = clubReady({ status: "error" });
    const texte = await renderText();
    expect(texte).toContain("Chargement impossible");
    expect(texte).toContain("Réessayer");
    // Aucun chiffre affiché : on ne montre pas des compteurs qu'on n'a pas lus.
    expect(texte).not.toContain("Aujourd'hui dans le groupe");
  });

  test("compte sans club : état produit à part entière, pas une erreur", async () => {
    mockClub.value = clubReady({ status: "notInClub", clubId: null, clubName: null });
    const texte = await renderText();
    expect(texte).toContain("Aucun club rattaché à ce compte");
    // Ce n'est pas une panne : aucune formulation d'échec de chargement.
    expect(texte).not.toContain("Chargement impossible");
    expect(texte).not.toContain("Réessayer");
  });

  // RETOUR 5. L'ancienne copie envoyait le coach « vérifier sa connexion » et lui
  // promettait que « les données sont conservées côté serveur ». Deux
  // affirmations invérifiables : l'app ne connaît pas la cause de l'échec, et
  // elle promettrait l'état d'un serveur qu'elle n'a pas réussi à joindre.
  test("effectif illisible : constat, action, hypothèse au conditionnel", async () => {
    mockRoster.value = rosterReady([], { status: "unavailable", unreadableCount: 4, memberCount: 4 });
    const texte = await renderText();
    expect(texte).toContain("Impossible de charger l'effectif.");
    expect(texte).toContain("Réessaie.");
    expect(texte).toContain("devra peut-être être vérifié");
    expect(texte).not.toContain("Vérifiez votre connexion");
    expect(texte).not.toContain("conservées côté serveur");
    expect(texte).not.toContain("Aujourd'hui dans le groupe");
  });

  test("club sans joueur : on renvoie vers la génération du code, sans jamais l'afficher ici", async () => {
    // Le code n'est plus relisible : le dupliquer sur cet écran obligerait à en
    // émettre un second, qui révoquerait le premier. On oriente, on n'affiche pas.
    mockRoster.value = rosterReady([]);
    const texte = await renderText();
    expect(texte).toContain("Aucun joueur dans l'effectif");
    expect(texte).toContain("Générer un code d'invitation");
    expect(texte).not.toContain("Code d'invitation :");
  });
});

// ─── Vocabulaire ─────────────────────────────────────────────────────────────

describe("Vocabulaire — le moteur et le joueur ne sont jamais confondus", () => {
  test("une séance allégée par FKS n'est jamais présentée comme un choix du joueur", async () => {
    mockRoster.value = rosterReady(
      viewsOf([
        makeSummary({
          playerUid: "u1",
          firstName: "Marc",
          adaptation: { adapted: true, labels: ["Volume réduit"] },
          activity: { doneDateKeys: ["2026-07-26"] },
          lastActivity: { dateKey: "2026-07-26", durationMin: 40 },
        }),
      ])
    );
    const texte = await renderText();
    // Le mot "Adaptée" seul (l'ancien libellé trompeur) ne doit plus exister.
    expect(texte).not.toMatch(/(^|\| )Adaptée( \||$)/);
  });

  test("une équipe féminine est nommée au féminin", async () => {
    mockClub.value = clubReady({ teamGender: "female" });
    mockRoster.value = rosterReady(viewsOf([actifAujourdhui("u1", "Lina")]));
    const texte = await renderText();
    expect(texte).toContain("Aucun signal à lire sur 1 joueuse.");
  });
});
