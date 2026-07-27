// screens/coach/__tests__/CoachRosterScreen.test.tsx
//
// Ce que ces tests PROTÈGENT (le lot « Effectif » ne vaut que si ça tient) :
//  1. la recherche retrouve un joueur malgré les accents et la casse — un coach
//     ne tape pas « Gaël » avec le tréma sur un clavier de téléphone ;
//  2. CHAQUE puce de filtre renvoie exactement les bons joueurs (une puce qui
//     ment sur son contenu est pire que pas de filtre du tout) ;
//  3. un filtre vide s'EXPLIQUE au lieu d'afficher une liste blanche qui
//     ressemble à une panne — et sans conclure à la place du coach : un filtre
//     bâti sur des faits est aussi vide quand aucun fait ne remonte ;
//  4. le plafond de lecture de 200 membres est ANNONCÉ quand il est atteint :
//     il était silencieux, un club de 210 joueurs en affichait 200 sans le dire.
//
// Les hooks de données sont mockés : cet écran ne doit contenir AUCUNE logique
// métier, donc on lui injecte des `CoachPlayerView` déjà construits par le
// domaine (via les fabriques de domain/coachView) et on n'observe que l'écran.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

// ── Mocks (déclarés avant les imports du module testé) ──────────────────────
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: () => {},
}));

const mockHaptics = {
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  impactHeavy: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
};
jest.mock("../../../hooks/useHaptics", () => ({ useHaptics: () => mockHaptics }));

const mockClub = jest.fn();
jest.mock("../../../hooks/coach/useCoachClub", () => ({ useCoachClub: () => mockClub() }));

const mockRoster = jest.fn();
jest.mock("../../../hooks/coach/useCoachRoster", () => ({ useCoachRoster: () => mockRoster() }));

import CoachRosterScreen from "../CoachRosterScreen";
import { makeView } from "../../../domain/coachView/__tests__/fixtures";
import { collectText, flatText } from "../../../components/coach/__tests__/treeUtils";
import type { CoachPlayerView } from "../../../domain/coachView/types";
import { MEMBERS_FETCH_LIMIT } from "../../../repositories/clubsRepo";

// Métriques figées : sans elles, SafeAreaProvider attend une mesure native qui
// n'arrive jamais en test et ne rend aucun enfant.
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// ── Effectif de référence (todayKey = 2026-07-27, défaut des fabriques) ──────
// Anna  : séance faite hier                         → "normal"
// Gaël  : séance prévue le 20/07, rien fait depuis  → "check"
// Zoé   : séance faite en partie, 2 exos adaptés    → "watch"
// Malik : aucune donnée d'entraînement              → "unknown"
const anna = makeView({
  playerUid: "u1",
  firstName: "Anna",
  position: "Milieu",
  ageCategory: "U15",
  lastActivity: { dateKey: "2026-07-26", durationMin: 45 },
  activity: { doneDateKeys: ["2026-07-26"] },
});

const gael = makeView({
  playerUid: "u2",
  firstName: "Gaël",
  position: "Défenseur",
  ageCategory: "U17",
  lastPlanned: {
    dateKey: "2026-07-20",
    title: "Force bas du corps",
    focusLabel: null,
    intensityLabel: null,
    durationMin: 45,
    blockCount: 4,
  },
});

const zoe = makeView({
  playerUid: "u3",
  firstName: "Zoé",
  position: "Attaquante",
  ageCategory: "U17",
  lastDone: {
    dateKey: "2026-07-26",
    title: "Endurance",
    focusLabel: null,
    intensityLabel: null,
    durationMin: 40,
    blockCount: 3,
  },
  activity: { doneDateKeys: ["2026-07-26"] },
  execution: {
    completionPct: 60,
    completionStatus: "partial",
    itemsDone: 5,
    itemsAdapted: 2,
    itemsSkipped: 0,
    itemsReplaced: 0,
    deviationLabels: ["Manque de temps"],
  },
});

const malik = makeView({
  playerUid: "u4",
  firstName: "Malik",
  position: null,
  ageCategory: null,
  level: null,
});

const EFFECTIF = [anna, gael, zoe, malik];
const PRENOMS = ["Anna", "Gaël", "Zoé", "Malik"];

// Garde-fou : si le domaine change ses seuils, ces tests doivent tomber ICI et
// pas dans une assertion de filtre incompréhensible trois écrans plus loin.
describe("effectif de référence — statuts attendus", () => {
  test("les quatre statuts de la hiérarchie sont représentés", () => {
    expect([anna.statut, gael.statut, zoe.statut, malik.statut]).toEqual([
      "normal",
      "check",
      "watch",
      "unknown",
    ]);
  });
});

// ── Harnais ─────────────────────────────────────────────────────────────────
const monte: TestRenderer.ReactTestRenderer[] = [];

function clubReady(over: Record<string, unknown> = {}) {
  return {
    status: "ready",
    clubId: "club-1",
    clubName: "US Test",
    inviteCode: "ABC123",
    teamGender: null,
    weekKey: "2026-07-27",
    weekContext: null,
    weekContextUnavailable: false,
    fetchedAt: 1_000,
    isRefreshing: false,
    refresh: jest.fn(),
    ...over,
  };
}

function rosterReady(views: CoachPlayerView[], over: Record<string, unknown> = {}) {
  return {
    views,
    status: "ready",
    readyCount: views.length,
    pendingCount: 0,
    unreadableCount: 0,
    memberCount: views.length,
    fetchedAt: 1_000,
    isStale: false,
    isRefreshing: false,
    refresh: jest.fn(),
    ...over,
  };
}

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachRosterScreen />
      </SafeAreaProvider>,
    );
  });
  monte.push(renderer);
  return renderer;
}

// `toJSON()` ne rend que des composants hôtes : le `onPress` d'un Pressable n'y
// apparaît jamais (il devient des gestionnaires de responder). Pour déclencher un
// vrai appui il faut l'arbre d'instances, donc `renderer.root` — que la
// déclaration locale `types/react-test-renderer.d.ts` (propriété d'un autre lot)
// ne décrit pas. On la complète ICI, au strict minimum, sans toucher à ce fichier.
type TestNode = {
  props: Record<string, unknown>;
  findAll(predicate: (node: TestNode) => boolean): TestNode[];
};

function racine(renderer: TestRenderer.ReactTestRenderer): TestNode {
  return (renderer as unknown as { root: TestNode }).root;
}

/** Gestionnaire d'un nœud, ou `null` s'il n'en porte pas. */
function gestionnaire(node: TestNode, nom: string): ((...args: unknown[]) => void) | null {
  const h = node.props[nom];
  return typeof h === "function" ? (h as (...args: unknown[]) => void) : null;
}

/** Le nœud porteur du testID QUI a bien le gestionnaire attendu. */
function nodeWith(
  renderer: TestRenderer.ReactTestRenderer,
  testID: string,
  handler: string,
): TestNode {
  const found = racine(renderer).findAll(
    (n) => n.props.testID === testID && gestionnaire(n, handler) !== null,
  );
  if (found.length === 0) throw new Error(`Aucun nœud "${testID}" avec ${handler}`);
  return found[0];
}

async function press(renderer: TestRenderer.ReactTestRenderer, testID: string): Promise<void> {
  const onPress = gestionnaire(nodeWith(renderer, testID, "onPress"), "onPress");
  await act(async () => {
    onPress?.();
  });
}

/** Bouton d'un bloc d'état (vide / erreur), repéré par son libellé affiché. */
async function pressLabel(
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
): Promise<void> {
  const found = racine(renderer).findAll(
    (n) => gestionnaire(n, "onPress") !== null && n.props.accessibilityLabel === label,
  );
  if (found.length === 0) throw new Error(`Aucun bouton "${label}"`);
  const onPress = gestionnaire(found[0], "onPress");
  await act(async () => {
    onPress?.();
  });
}

async function type(renderer: TestRenderer.ReactTestRenderer, saisie: string): Promise<void> {
  const onChangeText = gestionnaire(
    nodeWith(renderer, "coach-roster-search", "onChangeText"),
    "onChangeText",
  );
  await act(async () => {
    onChangeText?.(saisie);
  });
}

/** Prénoms réellement affichés, dans l'ordre de rendu. */
function prenomsAffiches(renderer: TestRenderer.ReactTestRenderer): string[] {
  return collectText(renderer.toJSON()).filter((t) => PRENOMS.includes(t));
}

function texte(renderer: TestRenderer.ReactTestRenderer): string {
  return flatText(renderer.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClub.mockReturnValue(clubReady());
  mockRoster.mockReturnValue(rosterReady(EFFECTIF));
});

afterEach(() => {
  act(() => {
    while (monte.length) monte.pop()?.unmount();
  });
});

// ── Recherche ───────────────────────────────────────────────────────────────
describe("recherche", () => {
  test("tout l'effectif est visible au départ, avec un compteur", async () => {
    const r = await render();
    expect(prenomsAffiches(r).sort()).toEqual(["Anna", "Gaël", "Malik", "Zoé"]);
    expect(texte(r)).toContain("4 membres sur 4");
  });

  test("elle ignore les accents et la casse", async () => {
    const r = await render();
    await type(r, "GAE");
    expect(prenomsAffiches(r)).toEqual(["Gaël"]);
    expect(texte(r)).toContain("1 résultat pour « GAE »");
  });

  test("elle porte aussi sur le poste", async () => {
    const r = await render();
    await type(r, "milieu");
    expect(prenomsAffiches(r)).toEqual(["Anna"]);
  });

  test("le compteur s'accorde au pluriel", async () => {
    const r = await render();
    await type(r, "u"); // présent dans "Défenseur", "Attaquante", "Milieu"...
    const n = prenomsAffiches(r).length;
    expect(n).toBeGreaterThan(1);
    expect(texte(r)).toContain(`${n} résultats pour « u »`);
  });

  test("le bouton d'effacement rend tout l'effectif", async () => {
    const r = await render();
    await type(r, "zzz");
    expect(prenomsAffiches(r)).toEqual([]);
    await press(r, "coach-roster-search-clear");
    expect(prenomsAffiches(r).length).toBe(4);
  });
});

// ── Filtres ─────────────────────────────────────────────────────────────────
describe("filtres", () => {
  const ATTENDU: Record<string, string[]> = {
    tous: ["Gaël", "Zoé", "Malik", "Anna"], // ordre par priorité
    a_verifier: ["Gaël"],
    a_surveiller: ["Zoé"],
    seance_non_faite: ["Gaël"],
    seance_adaptee: ["Zoé"],
    aucune_donnee_recente: ["Gaël", "Malik"],
  };

  test.each(Object.keys(ATTENDU))(
    "la puce %s affiche exactement les bons joueurs",
    async (cle: string) => {
      const r = await render();
      await press(r, `coach-roster-filter-${cle}`);
      expect(prenomsAffiches(r).sort()).toEqual(ATTENDU[cle].slice().sort());
    },
  );

  test("le tri par défaut remonte d'abord ce qui demande une action", async () => {
    const r = await render();
    expect(prenomsAffiches(r)).toEqual(ATTENDU.tous);
  });

  test("le tri par prénom réordonne la liste", async () => {
    const r = await render();
    await press(r, "coach-roster-sort-prenom");
    expect(prenomsAffiches(r)).toEqual(["Anna", "Gaël", "Malik", "Zoé"]);
  });

  test("aucune puce de douleur ou de fatigue n'est proposée", async () => {
    const r = await render();
    const t = texte(r).toLowerCase();
    expect(t).not.toContain("douleur");
    expect(t).not.toContain("fatigue");
  });

  test("la puce active est reconnaissable sans la couleur", async () => {
    const r = await render();
    await press(r, "coach-roster-filter-a_verifier");
    const puce = nodeWith(r, "coach-roster-filter-a_verifier", "onPress");
    // Un lecteur d'écran ET un œil daltonien doivent pouvoir la distinguer.
    expect(puce.props.accessibilityState).toEqual({ selected: true });
    const autre = nodeWith(r, "coach-roster-filter-tous", "onPress");
    expect(autre.props.accessibilityState).toEqual({ selected: false });
  });

  test("chaque puce annonce son nombre", async () => {
    const r = await render();
    const labels = ["tous", "a_verifier", "aucune_donnee_recente"].map(
      (cle) => nodeWith(r, `coach-roster-filter-${cle}`, "onPress").props.accessibilityLabel,
    );
    expect(labels[0]).toContain("4");
    expect(labels[1]).toContain("1");
    expect(labels[2]).toContain("2");
  });
});

// ── Vides ───────────────────────────────────────────────────────────────────
describe("liste vide", () => {
  test("un filtre sans résultat s'explique au lieu d'afficher du blanc", async () => {
    mockRoster.mockReturnValue(rosterReady([anna])); // personne à vérifier
    const r = await render();
    await press(r, "coach-roster-filter-a_verifier");
    const t = texte(r);
    expect(prenomsAffiches(r)).toEqual([]);
    expect(t).toContain("Personne à vérifier");
    expect(t).toContain("Voir tout l'effectif");
  });

  // Un vide de filtre ne doit JAMAIS être lu comme une bonne nouvelle générale :
  // ces filtres reposent sur des faits, et une absence de fait les vide autant
  // qu'un fait rassurant. Ces assertions figent la formulation non affirmative
  // ET le renvoi vers le filtre qui rend l'absence visible.
  describe("un vide de filtre ne conclut jamais à la place du coach", () => {
    test("« Séance non faite » nomme les DEUX causes possibles du vide", async () => {
      // Un effectif dont personne n'a de séance préparée : le filtre est vide
      // par ABSENCE de donnée, pas parce que tout a été fait.
      mockRoster.mockReturnValue(rosterReady([malik]));
      const r = await render();
      await press(r, "coach-roster-filter-seance_non_faite");
      const t = texte(r);
      expect(prenomsAffiches(r)).toEqual([]);
      // Aucune affirmation du type « chaque séance a bien été suivie ».
      expect(t).not.toContain("Chaque séance");
      expect(t).toContain("aucune séance préparée ne remonte");
      expect(t).toContain("Sans donnée récente");
    });

    test("« À vérifier » ne conclut pas « bon signe » devant un groupe sans donnée", async () => {
      mockRoster.mockReturnValue(rosterReady([malik]));
      const r = await render();
      await press(r, "coach-roster-filter-a_verifier");
      const t = texte(r);
      expect(t).toContain("Personne à vérifier");
      expect(t).not.toContain("bon signe");
      expect(t).toContain("Sans donnée récente");
    });

    test("« Séance adaptée » rappelle que le détail ne remonte pas pour tous", async () => {
      mockRoster.mockReturnValue(rosterReady([anna]));
      const r = await render();
      await press(r, "coach-roster-filter-seance_adaptee");
      expect(texte(r)).toContain("ne remonte pas encore pour tous les joueurs");
    });
  });

  test("le retour à « Tous » depuis un vide filtré remet l'effectif", async () => {
    mockRoster.mockReturnValue(rosterReady([anna]));
    const r = await render();
    await press(r, "coach-roster-filter-a_verifier");
    await pressLabel(r, "Voir tout l'effectif");
    expect(prenomsAffiches(r)).toEqual(["Anna"]);
  });

  test("une recherche sans résultat dit ce qui a été cherché", async () => {
    const r = await render();
    await type(r, "zzz");
    const t = texte(r);
    expect(t).toContain("Aucun résultat");
    expect(t).toContain("« zzz »");
    expect(t).toContain("Effacer la recherche");
  });

  test("un club sans joueur affiche un vide, jamais une erreur", async () => {
    mockRoster.mockReturnValue(rosterReady([]));
    const r = await render();
    const t = texte(r);
    expect(t).toContain("Aucun joueur dans l'effectif");
    expect(t.toLowerCase()).not.toContain("erreur");
  });

  test("des projections en préparation proposent d'actualiser", async () => {
    mockRoster.mockReturnValue(rosterReady([], { pendingCount: 3, memberCount: 3 }));
    const r = await render();
    expect(texte(r)).toContain("Synchronisation en cours");
  });
});

// ── Plafond de lecture ──────────────────────────────────────────────────────
describe("plafond de lecture de l'effectif", () => {
  test("il est annoncé quand il est atteint", async () => {
    mockRoster.mockReturnValue(rosterReady(EFFECTIF, { memberCount: MEMBERS_FETCH_LIMIT }));
    const r = await render();
    expect(texte(r)).toContain(`${MEMBERS_FETCH_LIMIT} premiers membres`);
  });

  test("il reste silencieux tant qu'il ne l'est pas", async () => {
    const r = await render();
    expect(texte(r)).not.toContain(`${MEMBERS_FETCH_LIMIT} premiers membres`);
  });

  // Le nombre affiché doit être CELUI qui borne la requête Firestore, pas un
  // jumeau recopié : un plafond annoncé faux est pire qu'un plafond silencieux.
  test("le nombre annoncé est bien la borne du repository", async () => {
    mockRoster.mockReturnValue(rosterReady(EFFECTIF, { memberCount: MEMBERS_FETCH_LIMIT - 1 }));
    const r = await render();
    expect(texte(r)).not.toContain("premiers membres");
  });
});

// ── États de chargement / panne / lecture partielle ─────────────────────────
describe("états", () => {
  test("le chargement montre un squelette de liste", async () => {
    mockRoster.mockReturnValue(rosterReady([], { status: "loading" }));
    const r = await render();
    // Le squelette s'annonce en UNE fois, pas une ligne grise à la fois.
    const squelette = racine(r).findAll(
      (n) =>
        n.props.testID === "coach-roster-skeleton" &&
        n.props.accessibilityLabel === "Chargement en cours",
    );
    expect(squelette.length).toBeGreaterThan(0);
    // Et surtout : aucun compteur pendant qu'on ne sait rien.
    expect(texte(r)).not.toContain("membres sur");
  });

  test("un effectif totalement illisible n'affiche AUCUN compteur", async () => {
    mockRoster.mockReturnValue(rosterReady([], { status: "unavailable" }));
    const r = await render();
    const t = texte(r);
    expect(t).toContain("Chargement impossible");
    // Un "0 membre" ici serait un mensonge : on ne sait pas, on ne compte pas.
    expect(t).not.toContain("0 membre");
  });

  test("un refresh raté conserve la liste et le dit", async () => {
    mockRoster.mockReturnValue(rosterReady(EFFECTIF, { isStale: true }));
    const r = await render();
    expect(prenomsAffiches(r).length).toBe(4);
    expect(texte(r)).toContain("Mise à jour impossible");
  });

  test("les profils non lus sont annoncés, sans nom ni identifiant", async () => {
    mockRoster.mockReturnValue(
      rosterReady(EFFECTIF, { unreadableCount: 2, memberCount: 6 }),
    );
    const r = await render();
    const t = texte(r);
    expect(t).toContain("2 profils non lus");
    expect(t).not.toContain("u1");
  });

  test("un coach sans club le sait, au lieu de voir un effectif vide", async () => {
    mockClub.mockReturnValue(clubReady({ status: "notInClub", clubId: null }));
    const r = await render();
    expect(texte(r)).toContain("Aucun club rattaché");
  });
});

// ── Navigation ──────────────────────────────────────────────────────────────
describe("ouverture d'une fiche", () => {
  test("toucher une ligne ouvre la fiche du bon joueur", async () => {
    const r = await render();
    const ligne = racine(r).findAll(
      (n) =>
        gestionnaire(n, "onPress") !== null &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.startsWith("Zoé"),
    )[0];
    const onPress = gestionnaire(ligne, "onPress");
    await act(async () => {
      onPress?.();
    });
    expect(mockNavigate).toHaveBeenCalledWith("CoachPlayerDetail", {
      clubId: "club-1",
      playerUid: "u3",
    });
  });
});

// ── Rangée de filtres : le défilement doit se VOIR ──────────────────────────
//
// CE QUE CES TESTS PROTÈGENT. La rangée de six puces mesure 869 pt et n'en
// montre que 375 sur un téléphone (720 sur tablette et sur le web, où la colonne
// de lecture est plafonnée) : trois filtres sur six sont hors champ à toutes les
// largeurs. Rien ne le signalait — une puce tranchée au bord droit se lit comme
// un défaut d'affichage, pas comme une invitation à faire glisser.
//
// La règle qu'on verrouille ici est double, et c'est la seconde moitié qui
// compte : l'indice n'apparaît QUE lorsqu'il reste réellement quelque chose de
// ce côté-là. Une flèche permanente qui ne mène nulle part serait une promesse
// fausse — exactement ce que le reste de l'espace coach s'interdit.
describe("rangée de filtres — indice de défilement", () => {
  /** La ScrollView horizontale des puces (la seule de l'écran). */
  function rangee(r: TestRenderer.ReactTestRenderer): TestNode {
    // `findAll` rend le composite ET les hôtes qui reçoivent les mêmes props :
    // ils portent la MÊME référence de gestionnaire, le premier suffit.
    const trouve = racine(r).findAll(
      (n) => n.props.horizontal === true && gestionnaire(n, "onContentSizeChange") !== null,
    );
    expect(trouve.length).toBeGreaterThan(0);
    return trouve[0];
  }

  /** Rejoue la géométrie que la plateforme remonterait, puis un défilement. */
  async function mesurer(
    r: TestRenderer.ReactTestRenderer,
    visible: number,
    contenu: number,
    offset = 0,
  ): Promise<void> {
    const n = rangee(r);
    await act(async () => {
      gestionnaire(n, "onLayout")?.({
        nativeEvent: { layout: { x: 0, y: 0, width: visible, height: 48 } },
      });
      gestionnaire(n, "onContentSizeChange")?.(contenu, 48);
      gestionnaire(n, "onScroll")?.({ nativeEvent: { contentOffset: { x: offset, y: 0 } } });
    });
  }

  function bord(r: TestRenderer.ReactTestRenderer, cote: "gauche" | "droite"): TestNode | null {
    const trouve = racine(r).findAll(
      (n) => n.props.testID === `coach-roster-filters-${cote}` && gestionnaire(n, "onPress") !== null,
    );
    return trouve[0] ?? null;
  }

  test("rangée entièrement visible : AUCUN indice (pas de fausse promesse)", async () => {
    const r = await render();
    await mesurer(r, 1200, 869);
    expect(bord(r, "droite")).toBeNull();
    expect(bord(r, "gauche")).toBeNull();
  });

  test("des filtres hors champ à droite : l'indice le dit, et il est nommé", async () => {
    const r = await render();
    await mesurer(r, 375, 869);
    const droite = bord(r, "droite");
    expect(droite).not.toBeNull();
    // Le sens ne passe JAMAIS par la seule couleur : un rôle et un libellé.
    expect(droite?.props.accessibilityRole).toBe("button");
    expect(droite?.props.accessibilityLabel).toBe("Filtres suivants");
    // Rien n'est masqué à gauche tant qu'on n'a pas bougé.
    expect(bord(r, "gauche")).toBeNull();
  });

  test("rangée défilée : les deux indices coexistent", async () => {
    const r = await render();
    await mesurer(r, 375, 869, 280);
    expect(bord(r, "gauche")?.props.accessibilityLabel).toBe("Filtres précédents");
    expect(bord(r, "droite")?.props.accessibilityLabel).toBe("Filtres suivants");
  });

  test("butée droite atteinte : l'indice de droite disparaît", async () => {
    const r = await render();
    await mesurer(r, 375, 869, 869 - 375);
    expect(bord(r, "droite")).toBeNull();
    expect(bord(r, "gauche")).not.toBeNull();
  });

  test("les six filtres restent atteignables, libellé complet et compteur", async () => {
    const r = await render();
    await mesurer(r, 375, 869);
    const t = texte(r);
    // Aucun libellé n'est raccourci : « adaptée par le joueur » distingue une
    // adaptation FAITE PAR LE JOUEUR d'un allègement décidé par le moteur FKS.
    for (const libelle of [
      "Tous",
      "À vérifier",
      "À surveiller",
      "Séance non faite",
      "Séance adaptée par le joueur",
      "Sans donnée récente",
    ]) {
      expect(t).toContain(libelle);
    }
  });

  test("toucher l'indice fait défiler la rangée, sans planter", async () => {
    const r = await render();
    await mesurer(r, 375, 869);
    const onPress = gestionnaire(bord(r, "droite") as TestNode, "onPress");
    await act(async () => {
      onPress?.();
    });
    expect(mockHaptics.impactLight).toHaveBeenCalled();
  });
});

// ─── RETOUR 6 : « Rien à signaler » n'est pas « tout va bien » ───────────────
describe("Effectif — un statut qui ne dit que ce qu'il sait", () => {
  test("un joueur au vert dont il manque des données porte la nuance, en toutes lettres", async () => {
    // Anna n'a AUCUN signal : l'ancienne ligne affichait « Rien à signaler » sec,
    // alors qu'on ignore ce qu'elle a fait de sa séance.
    expect(anna.statut).toBe("normal");
    expect(anna.donneesPartielles).toBe(true);

    mockRoster.mockReturnValue(rosterReady([anna]));
    const r = await render();
    const t = flatText(r.toJSON());

    expect(t).toContain("Rien à signaler parmi les données disponibles");
  });

  test("le lecteur d'écran entend la nuance, pas seulement le raccourci", async () => {
    mockRoster.mockReturnValue(rosterReady([anna]));
    const r = await render();
    const labels = (r.root as unknown as TestNode)
      .findAll((n) => typeof n.props.accessibilityLabel === "string")
      .map((n) => String(n.props.accessibilityLabel));

    expect(labels.join(" | ")).toContain(
      "Statut : Rien à signaler parmi les données disponibles",
    );
  });

  test("aucune ligne de nuance sur les statuts qui disent déjà d'aller regarder", async () => {
    // Gaël est « à vérifier » : le libellé demande déjà une lecture, l'alourdir
    // ferait du bruit sans rien corriger.
    mockRoster.mockReturnValue(rosterReady([gael]));
    const r = await render();
    expect(flatText(r.toJSON())).not.toContain("parmi les données disponibles");
  });
});

// ─── RETOUR 8 : accents à l'écran, valeur stockée intacte ────────────────────
describe("Effectif — les libellés d'identité s'affichent accentués", () => {
  const brut = makeView({
    playerUid: "u9",
    firstName: "Sami",
    position: "Defenseur", // valeur PERSISTÉE, allowlist serveur, sans accent
    level: "Regional",
    ageCategory: "U17",
    lastActivity: { dateKey: "2026-07-26", durationMin: 45 },
    activity: { doneDateKeys: ["2026-07-26"] },
  });

  test("« Defenseur » se lit « Défenseur » sans que la donnée change", async () => {
    // Ce que le domaine porte : la valeur brute, telle qu'écrite en base.
    expect(brut.poste).toBe("Defenseur");
    expect(brut.niveau).toBe("Regional");

    mockRoster.mockReturnValue(rosterReady([brut]));
    const r = await render();
    const t = flatText(r.toJSON());

    // Ce que le coach lit : la version accentuée.
    expect(t).toContain("Défenseur · U17");
    expect(t).not.toContain("Defenseur ·");
    // Et la vue n'a pas bougé d'un caractère après le rendu.
    expect(brut.poste).toBe("Defenseur");
  });

  test("la recherche continue de fonctionner avec ou sans accent", async () => {
    mockRoster.mockReturnValue(rosterReady([brut, anna]));
    const r = await render();
    const champ = (r.root as unknown as TestNode)
      .findAll((n) => n.props.testID === "coach-roster-search")[0];

    await act(async () => {
      (champ.props.onChangeText as (v: string) => void)("défenseur");
    });
    expect(flatText(r.toJSON())).toContain("Sami");

    await act(async () => {
      (champ.props.onChangeText as (v: string) => void)("defenseur");
    });
    expect(flatText(r.toJSON())).toContain("Sami");
  });
});
