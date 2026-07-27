// screens/coach/__tests__/CoachWeekScreen.test.tsx
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//
//  1. ON NE MENT PAS AVEC DES ZÉROS. Tant que le serveur ne projette pas de
//     fenêtre d'activité (cas NOMINAL aujourd'hui), les compteurs de la semaine
//     valent « — / Donnée absente », jamais « 0 séance ». Un coach qui lit 0 en
//     déduit que son groupe n'a rien fait ; c'est faux, on ne sait simplement pas.
//  2. LE CADRE DIT SON VRAI ÉTAT. Non renseigné, enregistré, ou modifié non
//     enregistré — et JAMAIS « enregistré » tant que FKS n'a pas confirmé.
//  3. L'ÉCHEC D'ÉCRITURE NE BLOQUE PAS L'ÉCRAN. Le défaut mesuré (bouton figé
//     sur « Enregistrement... » à l'infini hors ligne) est couvert deux fois :
//     rejet explicite, et absence totale de réponse (délai maximal).
//  4. PAS DE FLÈCHE MORTE. La semaine précédente n'est proposée que si les
//     données permettent réellement de la lire.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// L'écran est testé SEUL : les hooks de données et le repository sont pilotés
// par le test. On ne rejoue pas Firestore ici, on vérifie ce que l'écran fait
// des états qu'on lui donne.

jest.mock("../../../hooks/coach/useCoachClub", () => ({
  useCoachClub: () => mockClubState,
}));

jest.mock("../../../hooks/coach/useCoachRoster", () => ({
  useCoachRoster: () => mockRosterState,
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  saveClubWeekContext: jest.fn(),
  setClubTeamGender: jest.fn(),
}));

jest.mock("../../../services/firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return { uid: "coach1" };
    },
  },
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

import { toCoachPlayerView } from "../../../domain/coachView";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";
import type { CoachPlayerView } from "../../../domain/coachView";
import { saveClubWeekContext, setClubTeamGender } from "../../../repositories/clubsRepo";
import { showToast } from "../../../utils/toast";
import CoachWeekScreen, { COACH_SAVE_TIMEOUT_MS, semaineLisible } from "../CoachWeekScreen";

const saveMock = saveClubWeekContext as jest.MockedFunction<typeof saveClubWeekContext>;
const genderMock = setClubTeamGender as jest.MockedFunction<typeof setClubTeamGender>;
const toastMock = showToast as jest.MockedFunction<typeof showToast>;

// ─── États injectés dans l'écran ────────────────────────────────────────────
// Objets stables (identité conservée entre deux rendus) : sinon les effets
// d'hydratation du cadre se rejoueraient à chaque rendu et écraseraient les
// choix faits par le test.

const WEEK_KEY = "2026-07-20"; // lundi de la semaine affichée
const TODAY_MS = new Date(2026, 6, 24, 10, 0, 0).getTime(); // vendredi 24/07, heure locale

type ClubState = ReturnType<typeof makeClubState>;
type RosterState = ReturnType<typeof makeRosterState>;

function makeClubState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: "ready" as string,
    clubId: "clubX",
    clubName: "AS Test" as string | null,
    inviteCode: "TEST-0001" as string | null,
    teamGender: null as unknown,
    weekKey: WEEK_KEY,
    weekContext: null as unknown,
    weekContextUnavailable: false,
    fetchedAt: TODAY_MS as number | null,
    isRefreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

function makeRosterState(views: CoachPlayerView[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    views,
    status: "ready" as string,
    readyCount: views.length,
    pendingCount: 0,
    unreadableCount: 0,
    memberCount: views.length,
    fetchedAt: TODAY_MS as number | null,
    isStale: false,
    isRefreshing: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

let mockClubState: ClubState = makeClubState();
let mockRosterState: RosterState = makeRosterState([]);

// ─── Fabrique de vues joueur (vrai pipeline domaine, pas un objet bricolé) ──

function makeSummary(overrides: Partial<CoachPlayerSummary> = {}): CoachPlayerSummary {
  return {
    playerUid: "u1",
    firstName: "Anna",
    ageCategory: "U15",
    position: "Milieu",
    level: "Regional",
    profileComplete: true,
    latestSession: null,
    lastActivity: null,
    adaptation: { adapted: false, labels: [] },
    activity: null,
    lastPlanned: null,
    lastDone: null,
    execution: null,
    ...overrides,
  };
}

const TODAY_KEY = "2026-07-24";

/** Vue SANS fenêtre d'activité : le cas nominal tant que la boucle n'est pas mergée. */
const vueSansFenetre = (uid = "u1") =>
  toCoachPlayerView(makeSummary({ playerUid: uid }), TODAY_KEY);

/** Vue AVEC fenêtre d'activité : le comptage devient une mesure réelle. */
const vueAvecFenetre = (doneDateKeys: string[], uid = "u1") =>
  toCoachPlayerView(makeSummary({ playerUid: uid, activity: { doneDateKeys } }), TODAY_KEY);

// ─── Rendu ──────────────────────────────────────────────────────────────────

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()?.unmount();
  });
  jest.clearAllMocks();
});

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CoachWeekScreen />
      </SafeAreaProvider>
    );
  });
  mounted.push(renderer);
  return renderer;
}

/** Tout le texte affiché, aplati (suffisant pour des `toContain`). */
function flatText(node: unknown): string {
  const out: string[] = [];
  const walk = (n: any): void => {
    if (n == null) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === "string") {
      const s = n.trim();
      if (s) out.push(s);
      return;
    }
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join(" | ");
}

/**
 * Racine de l'arbre d'instances. Le shim de types local (types/react-test-renderer.d.ts)
 * ne déclare que `toJSON/update/unmount` : on caste ici plutôt que d'élargir un
 * fichier de types qui appartient à un autre lot.
 */
function racine(renderer: TestRenderer.ReactTestRenderer): any {
  return (renderer as any).root;
}

/** Le nœud actionnable portant ce testID (le composant, pas la vue hôte). */
function actionable(renderer: TestRenderer.ReactTestRenderer, testID: string) {
  const nodes = racine(renderer).findAll(
    (n: any) => n.props?.testID === testID && typeof n.props?.onPress === "function"
  );
  if (!nodes.length) throw new Error(`Aucun élément actionnable "${testID}"`);
  return nodes[0];
}

/** Tous les nœuds portant ce testID, quelle que soit leur nature. */
function noeuds(renderer: TestRenderer.ReactTestRenderer, testID: string): any[] {
  return racine(renderer).findAll((n: any) => n.props?.testID === testID);
}

function exists(renderer: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return noeuds(renderer, testID).length > 0;
}

async function press(renderer: TestRenderer.ReactTestRenderer, testID: string) {
  const node = actionable(renderer, testID);
  await act(async () => {
    await node.props.onPress();
  });
}

beforeEach(() => {
  mockClubState = makeClubState();
  mockRosterState = makeRosterState([vueSansFenetre()]);
  saveMock.mockResolvedValue(undefined);
  genderMock.mockResolvedValue(undefined);
});

/** État de sélection d'une puce, tel qu'un lecteur d'écran l'entend. */
function chipSelected(renderer: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return actionable(renderer, testID).props.accessibilityState?.selected === true;
}

// ────────────────────────────────────────────────────────────────────────────

describe("CoachWeekScreen — cadre vide", () => {
  test("aucun cadre enregistré : l'écran le dit et l'enregistrement reste bloqué", async () => {
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Ton cadre de la semaine");
    expect(texte).toContain("Cadre non renseigné");
    // Rien n'est choisi -> le bouton est désactivé, et il explique pourquoi.
    expect(actionable(renderer, "week-frame-save").props.disabled).toBe(true);
    expect(texte).toContain("Choisis une intensité et un objectif pour pouvoir enregistrer.");
    expect(saveMock).not.toHaveBeenCalled();
  });

  test("le formulaire porte bien les champs métier d'origine", async () => {
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Type d'équipe");
    expect(texte).toContain("Intensité club cette semaine");
    expect(texte).toContain("Objectif FKS");
    expect(texte).toContain("Match ce week-end ?");
    expect(texte).toContain("Note (optionnel)");
    // Le code club vit toujours dans cet onglet.
    expect(texte).toContain("Code club");
    expect(texte).toContain("TEST-0001");
  });
});

describe("CoachWeekScreen — cadre enregistré", () => {
  test("intensité + objectif choisis, puis enregistrement confirmé", async () => {
    const renderer = await render();

    await press(renderer, "chip-intensity-normal");
    await press(renderer, "chip-goal-speed");

    // Tant que rien n'est parti, l'écran annonce des modifications non enregistrées.
    expect(flatText(renderer.toJSON())).toContain("Modifications non enregistrées");

    await press(renderer, "week-frame-save");

    // Métier INCHANGÉ : mêmes arguments qu'avant le portage de l'UI.
    expect(saveMock).toHaveBeenCalledWith({
      clubId: "clubX",
      weekKey: WEEK_KEY,
      uid: "coach1",
      trainingIntensity: "normal",
      weekGoal: "speed",
      note: "",
      matchThisWeekend: null,
    });

    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("Cadre enregistré pour cette semaine");
    expect(texte).not.toContain("Enregistrement...");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Cadre enregistré" })
    );
  });

  test("un cadre déjà enregistré côté serveur est repris tel quel", async () => {
    mockClubState = makeClubState({
      weekContext: {
        weekKey: WEEK_KEY,
        clubId: "clubX",
        createdBy: "coach1",
        trainingIntensity: "heavy",
        weekGoal: "prevention",
        note: "gros match dimanche",
        matchThisWeekend: true,
      },
    });

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Cadre enregistré pour cette semaine");
    expect(texte).toContain("Mettre à jour le cadre");
    // La note vit dans la VALEUR du champ, pas dans le texte rendu.
    const champNote = noeuds(renderer, "week-frame-note");
    expect(champNote.some((n) => n.props.value === "gros match dimanche")).toBe(true);
    expect(actionable(renderer, "week-frame-save").props.disabled).toBe(false);
  });
});

describe("CoachWeekScreen — échec d'enregistrement", () => {
  test("refus serveur : message honnête, aucun faux 'enregistré', bouton rendu", async () => {
    saveMock.mockRejectedValue(new Error("permission-denied"));

    const renderer = await render();
    await press(renderer, "chip-intensity-light");
    await press(renderer, "chip-goal-strength");
    await press(renderer, "week-frame-save");

    const texte = flatText(renderer.toJSON());
    // Le retour visuel « enregistré » est ANNULÉ : on n'affirme rien que FKS
    // n'ait confirmé.
    expect(texte).not.toContain("Cadre enregistré pour cette semaine");
    expect(texte).toContain("Modifications non enregistrées");
    // Et surtout : le bouton n'est plus figé sur « Enregistrement... ».
    expect(texte).not.toContain("Enregistrement...");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Enregistrement impossible" })
    );
  });

  test("aucune réponse (hors ligne) : l'attente est bornée, pas infinie", async () => {
    jest.useFakeTimers();
    // Hors ligne, setDoc ne rejette pas : sa promesse reste EN ATTENTE.
    saveMock.mockImplementation(() => new Promise<void>(() => {}));

    const renderer = await render();
    await press(renderer, "chip-intensity-normal");
    await press(renderer, "chip-goal-freshness");

    const bouton = actionable(renderer, "week-frame-save");
    await act(async () => {
      bouton.props.onPress();
    });
    // Pendant l'attente, l'écran assume qu'il attend.
    expect(flatText(renderer.toJSON())).toContain("Enregistrement...");

    await act(async () => {
      jest.advanceTimersByTime(COACH_SAVE_TIMEOUT_MS + 100);
    });

    const texte = flatText(renderer.toJSON());
    expect(texte).not.toContain("Enregistrement...");
    expect(texte).not.toContain("Cadre enregistré pour cette semaine");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Enregistrement non confirmé" })
    );

    jest.useRealTimers();
  });
});

describe("CoachWeekScreen — type d'équipe", () => {
  test("écriture réussie : la puce reste allumée", async () => {
    const renderer = await render();
    expect(chipSelected(renderer, "chip-team-female")).toBe(false);

    await press(renderer, "chip-team-female");

    expect(genderMock).toHaveBeenCalledWith("clubX", "female");
    expect(chipSelected(renderer, "chip-team-female")).toBe(true);
  });

  test("écriture refusée : la puce est ÉTEINTE, pas de persistance imaginaire", async () => {
    genderMock.mockRejectedValue(new Error("permission-denied"));

    const renderer = await render();
    await press(renderer, "chip-team-female");

    // Le défaut d'origine : la puce s'allumait et restait allumée sans que rien
    // ne soit enregistré. Ici le retour visuel est annulé.
    expect(chipSelected(renderer, "chip-team-female")).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Enregistrement impossible" })
    );
  });
});

describe("CoachWeekScreen — semaine sans activité", () => {
  test("sans fenêtre d'activité : « — / Donnée absente », JAMAIS un zéro", async () => {
    mockRosterState = makeRosterState([vueSansFenetre("u1"), vueSansFenetre("u2")]);

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    // Les trois compteurs sont indisponibles, pas nuls.
    expect(texte.split("Donnée absente").length - 1).toBe(3);
    expect(texte).toContain("assiduité de la semaine non mesurable");
    // Aucune formulation qui laisserait croire à une mesure.
    expect(texte).not.toContain("séance réalisée cette semaine");
  });

  test("fenêtre présente mais aucune séance dans la semaine : le zéro est une mesure", async () => {
    // Séance faite AVANT la semaine affichée : la fenêtre couvre la semaine,
    // et la bonne réponse est bien « 0 ».
    mockRosterState = makeRosterState([vueAvecFenetre(["2026-07-15"])]);

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Aucune séance enregistrée cette semaine");
    expect(texte).toContain("Séances réalisées");
    // Un compteur mesuré à zéro n'est pas « Donnée absente ».
    expect(texte).not.toContain("Donnée absente");
  });

  test("aucun membre : état vide nommé, pas un écran cassé", async () => {
    mockRosterState = makeRosterState([], { memberCount: 0 });

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Aucun joueur dans l'effectif");
    expect(texte).not.toContain("Donnée absente");
  });
});

describe("CoachWeekScreen — adaptations : moteur ≠ joueur", () => {
  test("une séance allégée par le moteur est attribuée à FKS, jamais au joueur", async () => {
    mockRosterState = makeRosterState([
      toCoachPlayerView(
        makeSummary({
          activity: { doneDateKeys: ["2026-07-21"] },
          adaptation: { adapted: true, labels: ["Charge allégée"] },
        }),
        TODAY_KEY
      ),
    ]);

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Séance ajustée par FKS");
    expect(texte).toContain("Ce n'est pas une modification du joueur.");
    expect(texte).toContain("Règle FKS");
    // L'ancien libellé ambigu ne doit jamais réapparaître.
    expect(texte).not.toContain("Adaptée");
    // Rien sur l'exécution tant que la boucle de suivi n'est pas mergée.
    expect(exists(renderer, "adaptation-joueur")).toBe(false);
  });

  test("les écarts du joueur sont attribués au joueur, avec les raisons du serveur", async () => {
    mockRosterState = makeRosterState([
      toCoachPlayerView(
        makeSummary({
          activity: { doneDateKeys: ["2026-07-21"] },
          execution: {
            completionPct: 70,
            completionStatus: "partial",
            itemsDone: 5,
            itemsAdapted: 1,
            itemsSkipped: 2,
            itemsReplaced: 0,
            deviationLabels: ["Manque de temps", "Autre raison"],
          },
        }),
        TODAY_KEY
      ),
    ]);

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Séance modifiée par le joueur");
    expect(texte).toContain("Manque de temps");
    // Libellés serveur repris tels quels : aucune re-traduction côté front.
    expect(texte).toContain("Autre raison");
    expect(texte).toContain("Relevé pendant la séance");
    expect(exists(renderer, "adaptation-moteur")).toBe(false);
  });

  test("aucune adaptation connue : aucun bloc, aucun zéro décoratif", async () => {
    mockRosterState = makeRosterState([vueAvecFenetre(["2026-07-21"])]);
    const renderer = await render();
    expect(exists(renderer, "week-adaptations")).toBe(false);
  });
});

describe("CoachWeekScreen — navigation de semaine", () => {
  test("sans donnée exploitable, aucune flèche vers la semaine précédente", async () => {
    mockRosterState = makeRosterState([vueSansFenetre()]);
    const renderer = await render();
    expect(exists(renderer, "week-prev")).toBe(false);
    expect(exists(renderer, "week-next")).toBe(false);
  });

  test("avec une fenêtre couvrant la semaine passée, on peut reculer puis revenir", async () => {
    mockRosterState = makeRosterState([vueAvecFenetre(["2026-07-15"])]);
    const renderer = await render();

    expect(exists(renderer, "week-prev")).toBe(true);
    await press(renderer, "week-prev");

    const texte = flatText(renderer.toJSON());
    // Une semaine passée ne se modifie pas : le formulaire cède la place à une
    // explication, et la flèche de retour apparaît.
    expect(texte).toContain("Le cadre ne se modifie que sur la semaine en cours");
    expect(exists(renderer, "week-next")).toBe(true);

    await press(renderer, "week-next");
    expect(flatText(renderer.toJSON())).toContain("Cadre non renseigné");
  });

  test("semaineLisible : une fenêtre saturée qui ne remonte pas assez loin ferme la porte", () => {
    const quatorzeDates = Array.from({ length: 14 }, (_, i) => `2026-07-${String(24 - i).padStart(2, "0")}`);
    const sature = toCoachPlayerView(
      makeSummary({ activity: { doneDateKeys: quatorzeDates } }),
      TODAY_KEY
    );
    // La plus ancienne date connue est le 11/07. La semaine du 13/07 est donc
    // entièrement couverte ; celle du 06/07 ne l'est pas, on ne l'ouvre pas.
    expect(semaineLisible([sature], "2026-07-13")).toBe(true);
    expect(semaineLisible([sature], "2026-07-06")).toBe(false);
    // Une fenêtre non saturée, elle, est un historique complet.
    expect(semaineLisible([vueAvecFenetre(["2026-07-15"])], "2026-07-06")).toBe(true);
    // Pas de fenêtre du tout -> on ne conclut rien.
    expect(semaineLisible([vueSansFenetre()], "2026-07-13")).toBe(false);
  });
});

describe("CoachWeekScreen — états globaux", () => {
  test("coach sans club : l'écran ne fabrique ni club ni effectif", async () => {
    mockClubState = makeClubState({
      status: "notInClub",
      clubId: null,
      clubName: null,
      inviteCode: null,
    });
    mockRosterState = makeRosterState([]);

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Aucun club rattaché");
    expect(texte).not.toContain("Ton cadre de la semaine");
    expect(texte).not.toContain("Code club");
  });

  test("effectif illisible : erreur nommée, aucun compteur inventé", async () => {
    mockRosterState = makeRosterState([], { status: "unavailable", memberCount: 3 });

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    // RETOUR 5 : constat sur l'objet réellement concerné, action, puis
    // hypothèse au conditionnel. Aucune cause affirmée, aucune garantie sur des
    // données qu'on n'a pas réussi à lire.
    expect(texte).toContain("Impossible de charger l'effectif.");
    expect(texte).toContain("devra peut-être être vérifié");
    expect(texte).not.toContain("Vérifiez votre connexion");
    expect(texte).not.toContain("conservées côté serveur");
    expect(texte).toContain("Données non lues");
    // Ni « 0 séance », ni « 0 sur 0 » : on n'a rien lu, on ne compte rien.
    expect(texte).not.toContain("Séances réalisées");
  });

  test("aucune donnée de ressenti ni de santé n'est annoncée au coach", async () => {
    mockRosterState = makeRosterState([vueAvecFenetre(["2026-07-21"])]);
    const renderer = await render();
    const texte = flatText(renderer.toJSON()).toLowerCase();

    for (const interdit of ["rpe", "tsb", "atl", "ctl", "fatigue", "douleur", "sommeil"]) {
      expect(texte).not.toContain(interdit);
    }
  });
});
