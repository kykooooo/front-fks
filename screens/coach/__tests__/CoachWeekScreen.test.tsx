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

// Émission du code d'invitation : appel serveur, piloté par le test.
jest.mock("../../../hooks/coach/useClubInviteCode", () => ({
  useClubInviteCode: () => mockInviteState,
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  saveClubWeekContext: jest.fn(),
  setClubTeamGender: jest.fn(),
  // Note privée et directive : DEUX écritures distinctes, vers DEUX documents
  // distincts. Le test les capture séparément — c'est ce qui prouve qu'un texte
  // privé ne part jamais par le canal de la directive, et réciproquement.
  saveCoachPrivateNote: jest.fn(),
  saveClubDirective: jest.fn(),
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
import {
  saveClubDirective,
  saveClubWeekContext,
  saveCoachPrivateNote,
  setClubTeamGender,
} from "../../../repositories/clubsRepo";
import { showToast } from "../../../utils/toast";
import {
  CLUB_DIRECTIVE_PREPARATION_NOTICE,
  CLUB_DIRECTIVE_SAVED_TOAST,
} from "../../../domain/clubDirective";
import { COACH_FEATURES } from "../../../config/coachFeatures";
import { promessesDInfluence } from "../../../domain/__tests__/helpers/promesseInfluence";
import CoachWeekScreen, { COACH_SAVE_TIMEOUT_MS, semaineLisible } from "../CoachWeekScreen";

const saveMock = saveClubWeekContext as jest.MockedFunction<typeof saveClubWeekContext>;
const genderMock = setClubTeamGender as jest.MockedFunction<typeof setClubTeamGender>;
const noteMock = saveCoachPrivateNote as jest.MockedFunction<typeof saveCoachPrivateNote>;
const directiveMock = saveClubDirective as jest.MockedFunction<typeof saveClubDirective>;
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
    teamGender: null as unknown,
    weekKey: WEEK_KEY,
    // Autorité propriétaire : par défaut le cas nominal d'un encadrant ordinaire
    // (ni désigné, ni porteur du rôle propriétaire) — aucun état à réparer.
    ownerAuthority: "not-owner" as string,
    ownershipInconsistent: false,
    weekContext: null as unknown,
    weekContextUnavailable: false,
    coachNote: null as unknown,
    coachNoteUnavailable: false,
    directive: null as unknown,
    directiveUnavailable: false,
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

/** État du hook d'émission de code (aucun code affiché par défaut). */
function makeInviteState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    code: null as string | null,
    expiresAt: null as number | null,
    maxUses: null as number | null,
    replacedPrevious: false,
    error: null as string | null,
    isIssuing: false,
    issue: jest.fn(),
    ...overrides,
  };
}

let mockClubState: ClubState = makeClubState();
let mockRosterState: RosterState = makeRosterState([]);
let mockInviteState: ReturnType<typeof makeInviteState> = makeInviteState();

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

type TestNode = TestRenderer.ReactTestInstance;

/**
 * Racine de l'arbre d'instances (`renderer.root`), décrite par la déclaration
 * locale `types/react-test-renderer.d.ts` : aucun cast n'est nécessaire.
 */
function racine(renderer: TestRenderer.ReactTestRenderer): TestNode {
  return renderer.root;
}

/**
 * Gestionnaire porté par un nœud. Les props d'une instance sont typées
 * `unknown` : on VÉRIFIE que c'en est bien une fonction avant de l'appeler,
 * plutôt que de l'affirmer par un cast.
 */
function gestionnaire(node: TestNode, nom: string): (...args: unknown[]) => unknown {
  const h = node.props[nom];
  if (typeof h !== "function") throw new Error(`Le nœud ne porte pas de ${nom}`);
  return h as (...args: unknown[]) => unknown;
}

/** Le nœud actionnable portant ce testID (le composant, pas la vue hôte). */
function actionable(renderer: TestRenderer.ReactTestRenderer, testID: string): TestNode {
  const nodes = racine(renderer).findAll(
    (n) => n.props.testID === testID && typeof n.props.onPress === "function"
  );
  if (!nodes.length) throw new Error(`Aucun élément actionnable "${testID}"`);
  return nodes[0];
}

/** Tous les nœuds portant ce testID, quelle que soit leur nature. */
function noeuds(renderer: TestRenderer.ReactTestRenderer, testID: string): TestNode[] {
  return racine(renderer).findAll((n) => n.props.testID === testID);
}

/**
 * Toutes les chaînes rendues SOUS un testID donné.
 *
 * Sert au balayage anti-promesse : on cible la carte concernée plutôt que
 * l'écran entier, parce que le cadre de semaine (un autre objet, transmis au
 * backend depuis bien plus longtemps) porte sa propre formulation, hors du
 * périmètre de ce lot.
 */
function textesDeLaCarte(renderer: TestRenderer.ReactTestRenderer, testID: string): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") {
      const s = n.trim();
      if (s) out.push(s);
      return;
    }
    const enfants = (n as { children?: unknown[] })?.children;
    if (Array.isArray(enfants)) enfants.forEach(walk);
  };
  noeuds(renderer, testID).forEach(walk);
  return out;
}

function exists(renderer: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return noeuds(renderer, testID).length > 0;
}

async function press(renderer: TestRenderer.ReactTestRenderer, testID: string) {
  const onPress = gestionnaire(actionable(renderer, testID), "onPress");
  await act(async () => {
    await onPress();
  });
}

beforeEach(() => {
  mockClubState = makeClubState();
  mockRosterState = makeRosterState([vueSansFenetre()]);
  mockInviteState = makeInviteState();
  saveMock.mockResolvedValue(undefined);
  genderMock.mockResolvedValue(undefined);
  noteMock.mockResolvedValue(undefined);
  directiveMock.mockResolvedValue(undefined);
});

/** État de sélection d'une puce, tel qu'un lecteur d'écran l'entend. */
function chipSelected(renderer: TestRenderer.ReactTestRenderer, testID: string): boolean {
  const etat = actionable(renderer, testID).props.accessibilityState;
  return !!etat && typeof etat === "object" && (etat as { selected?: unknown }).selected === true;
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
    // La note NE VIT PLUS dans le cadre : elle a sa propre carte, et la
    // directive aussi. Un champ « Note » dans ce bloc voudrait dire qu'on a
    // reperdu la séparation.
    expect(texte).not.toContain("Note (optionnel)");
    expect(exists(renderer, "week-frame-note")).toBe(false);
    // Le code club vit toujours dans cet onglet — mais il s'y GÉNÈRE, il ne s'y
    // lit plus (le détail est couvert par le bloc « code club » plus bas).
    expect(texte).toContain("Code club");
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

    // Le cadre part SANS note : le document lisible par les joueurs ne porte
    // plus de texte libre du coach.
    expect(saveMock).toHaveBeenCalledWith({
      clubId: "clubX",
      weekKey: WEEK_KEY,
      uid: "coach1",
      trainingIntensity: "normal",
      weekGoal: "speed",
      matchThisWeekend: null,
    });
    expect(saveMock.mock.calls[0][0]).not.toHaveProperty("note");

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
        matchThisWeekend: true,
      },
    });

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Cadre enregistré pour cette semaine");
    expect(texte).toContain("Mettre à jour le cadre");
    expect(actionable(renderer, "week-frame-save").props.disabled).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// LA SÉPARATION, VUE DE L'ÉCRAN.
// Deux concepts = deux cartes, deux champs, deux boutons, deux documents. Le
// test ne vérifie pas seulement que ça s'affiche : il vérifie qu'un texte saisi
// d'un côté ne part JAMAIS par l'appel de l'autre.

const NOTE_SENSIBLE = "Rachid tendinite genou droit, se plaint tout le temps";

describe("CoachWeekScreen — note privée et directive sont deux objets distincts", () => {
  test("les deux libellés promis sont affichés, au mot près", async () => {
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain(
      "Note privée — visible uniquement par l'encadrement autorisé. Cette note ne modifie pas les séances.",
    );
    expect(texte).toContain(
      "Directive d'entraînement — visible par le joueur, dans l'application, dès qu'elle est enregistrée.",
    );
  });

  test("la carte directive dit elle-même qu'elle n'agit pas encore sur les séances", async () => {
    // Le moteur de génération ne lit pas la directive. Tant que c'est le cas,
    // l'écran l'annonce AVANT la saisie, avec les mots exacts du domaine.
    const renderer = await render();
    const texte = flatText(renderer.toJSON());
    expect(texte).toContain(CLUB_DIRECTIVE_PREPARATION_NOTICE);
    expect(noeuds(renderer, "week-directive-preparation").length).toBeGreaterThan(0);
  });

  test("BALAYAGE : aucun texte de la carte directive ne promet un effet sur une séance", async () => {
    // Même détecteur que le balayage des constantes (domain/__tests__/helpers).
    // Il tourne ici sur le RENDU : il couvre donc aussi les libellés écrits en
    // dur dans l'écran, que le balayage des constantes ne voit pas.
    const renderer = await render();
    const fautes = textesDeLaCarte(renderer, "week-directive").flatMap((t) =>
      promessesDInfluence(t),
    );
    expect(fautes).toEqual([]);
  });

  test("l'avertissement « le joueur lit » est affiché AVANT enregistrement", async () => {
    const renderer = await render();
    const texte = flatText(renderer.toJSON());
    // Il est à l'écran dès l'ouverture, pas dans un toast après coup : c'est ce
    // qui permet au coach de choisir ses mots.
    expect(texte).toContain("Tout l'effectif peut lire cette directive.");
    expect(texte).toContain("aucune information de santé");
  });

  test("une note sensible part par saveCoachPrivateNote, et par AUCUN autre appel", async () => {
    const renderer = await render();

    const champ = noeuds(renderer, "week-private-note-input")[0];
    await act(async () => {
      (champ.props.onChangeText as (v: string) => void)(NOTE_SENSIBLE);
    });
    await press(renderer, "week-private-note-save");

    expect(noteMock).toHaveBeenCalledWith({
      clubId: "clubX",
      weekKey: WEEK_KEY,
      uid: "coach1",
      note: NOTE_SENSIBLE,
    });
    // Sonde hostile : le texte n'apparaît dans AUCUN argument des deux autres
    // écritures — ni le cadre lisible par les joueurs, ni la directive.
    expect(JSON.stringify(saveMock.mock.calls)).not.toContain("tendinite");
    expect(JSON.stringify(directiveMock.mock.calls)).not.toContain("tendinite");
    expect(directiveMock).not.toHaveBeenCalled();
  });

  test("enregistrer une directive n'écrit jamais dans la note privée", async () => {
    const renderer = await render();

    await press(renderer, "chip-directive-objective-prevention");
    const champ = noeuds(renderer, "week-directive-instruction")[0];
    await act(async () => {
      (champ.props.onChangeText as (v: string) => void)("On garde les appuis");
    });
    await press(renderer, "week-directive-save");

    expect(directiveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "clubX",
        uid: "coach1",
        objective: "prevention",
        instruction: "On garde les appuis",
        active: true,
      }),
    );
    expect(noteMock).not.toHaveBeenCalled();
    // La fenêtre de validité est bornée : une directive a une fin.
    const args = directiveMock.mock.calls[0][0];
    expect(args.validFrom <= args.validUntil).toBe(true);
  });

  test("directive incomplète : rien ne part, et l'écran dit ce qui manque", async () => {
    const renderer = await render();
    expect(actionable(renderer, "week-directive-save").props.disabled).toBe(true);

    // Un objectif sans consigne ne suffit pas : le joueur lirait une catégorie
    // sans savoir ce qu'on attend de lui.
    await press(renderer, "chip-directive-objective-speed");
    expect(actionable(renderer, "week-directive-save").props.disabled).toBe(true);
    expect(flatText(renderer.toJSON())).toContain(
      "Choisis un objectif et écris la consigne pour pouvoir enregistrer.",
    );
    expect(directiveMock).not.toHaveBeenCalled();
  });

  test("une directive déjà posée est reprise telle quelle, jamais devinée", async () => {
    mockClubState = makeClubState({
      directive: {
        objective: "strength",
        instruction: "Renfo léger avant le derby",
        validFrom: "2026-07-20",
        validUntil: "2026-08-03",
        active: false,
        createdBy: "coach1",
        createdAt: null,
        updatedAt: null,
      },
    });

    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Directive levée"); // le statut n'est pas maquillé
    const champ = noeuds(renderer, "week-directive-instruction");
    expect(champ.some((n) => n.props.value === "Renfo léger avant le derby")).toBe(true);
    expect(chipSelected(renderer, "chip-directive-status-levee")).toBe(true);
  });

  test("AUCUNE conversion automatique : une note privée ne pré-remplit pas la directive", async () => {
    mockClubState = makeClubState({
      coachNote: { weekKey: WEEK_KEY, note: NOTE_SENSIBLE },
    });

    const renderer = await render();

    // La note est bien reprise dans SON champ...
    const champNote = noeuds(renderer, "week-private-note-input");
    expect(champNote.some((n) => n.props.value === NOTE_SENSIBLE)).toBe(true);
    // ...et nulle part ailleurs. Le champ directive reste vide, aucun objectif
    // n'est présélectionné : le code ne décide pas à la place du coach.
    const champDirective = noeuds(renderer, "week-directive-instruction");
    expect(champDirective.every((n) => n.props.value === "")).toBe(true);
    expect(actionable(renderer, "week-directive-save").props.disabled).toBe(true);
  });

  test("la confirmation après enregistrement ne promet AUCUNE adaptation", async () => {
    // C'est le moment le plus dangereux : le coach vient d'agir, il croit ce
    // qu'on lui dit. Le message ne parle donc que de ce qui a eu lieu.
    const renderer = await render();
    await press(renderer, "chip-directive-objective-prevention");
    const champ = noeuds(renderer, "week-directive-instruction")[0];
    await act(async () => {
      (champ.props.onChangeText as (v: string) => void)("On garde les appuis");
    });
    await press(renderer, "week-directive-save");

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: CLUB_DIRECTIVE_SAVED_TOAST.titre,
        message: CLUB_DIRECTIVE_SAVED_TOAST.message,
      }),
    );
    const messages = toastMock.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(messages.flatMap((m) => promessesDInfluence(m))).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("CoachWeekScreen — la création de directive vit derrière une capacité", () => {
  // Le drapeau est ACTIVÉ par défaut (avec le libellé honnête). Ce qu'on teste
  // ici, c'est qu'il est réellement branché : le couper doit retirer le bloc
  // ENTIER, pas seulement le masquer visuellement.
  afterEach(() => {
    COACH_FEATURES.DIRECTIVE_CREATION = true;
  });

  test("capacité coupée : plus de carte, plus de champ, plus de bouton", async () => {
    COACH_FEATURES.DIRECTIVE_CREATION = false;
    const renderer = await render();

    expect(exists(renderer, "week-directive")).toBe(false);
    expect(exists(renderer, "week-directive-instruction")).toBe(false);
    expect(exists(renderer, "week-directive-save")).toBe(false);
    const texte = flatText(renderer.toJSON());
    expect(texte).not.toContain(CLUB_DIRECTIVE_PREPARATION_NOTICE);
    // Et l'écran ne renvoie plus vers un bloc qui n'existe pas.
    expect(texte).not.toContain("utilise la directive plus bas");
    // La note privée, elle, reste : les deux objets sont indépendants.
    expect(exists(renderer, "week-private-note-input")).toBe(true);
  });

  test("capacité coupée : aucune écriture de directive n'est possible", async () => {
    COACH_FEATURES.DIRECTIVE_CREATION = false;
    const renderer = await render();
    // Il n'y a même plus de bouton à presser ; on vérifie surtout qu'aucun
    // chemin résiduel n'a écrit quoi que ce soit pendant le rendu.
    expect(directiveMock).not.toHaveBeenCalled();
    expect(exists(renderer, "week-directive-save")).toBe(false);
  });

  test("capacité active (défaut) : la carte est là, avec sa phrase d'honnêteté", async () => {
    const renderer = await render();
    expect(exists(renderer, "week-directive")).toBe(true);
    expect(flatText(renderer.toJSON())).toContain(CLUB_DIRECTIVE_PREPARATION_NOTICE);
  });
});

describe("CoachWeekScreen — note historique encore logée dans le cadre", () => {
  const CLUB_AVEC_LEGACY = () =>
    makeClubState({
      weekContext: {
        weekKey: WEEK_KEY,
        clubId: "clubX",
        createdBy: "coach1",
        trainingIntensity: "heavy",
        weekGoal: "prevention",
        matchThisWeekend: true,
        legacyNote: NOTE_SENSIBLE,
      },
    });

  test("l'écran DIT que cette note est encore lisible par les joueurs", async () => {
    mockClubState = CLUB_AVEC_LEGACY();
    const renderer = await render();

    expect(exists(renderer, "week-private-note-legacy")).toBe(true);
    const texte = flatText(renderer.toJSON());
    expect(texte).toContain("écrite avant la séparation");
    expect(texte).toContain("lisible par tes joueurs");
    // Elle est reprise dans le champ privé, sans être convertie en directive.
    const champ = noeuds(renderer, "week-private-note-input");
    expect(champ.some((n) => n.props.value === NOTE_SENSIBLE)).toBe(true);
    expect(actionable(renderer, "week-directive-save").props.disabled).toBe(true);
  });

  test("enregistrer le cadre met la note à l'abri AVANT de l'effacer du document public", async () => {
    mockClubState = CLUB_AVEC_LEGACY();
    const ordre: string[] = [];
    noteMock.mockImplementation(async () => {
      ordre.push("note-privee");
    });
    saveMock.mockImplementation(async () => {
      ordre.push("cadre");
    });

    const renderer = await render();
    await press(renderer, "week-frame-save");

    // L'ordre n'est pas cosmétique : le cadre SUPPRIME le champ `note`. S'il
    // partait en premier, un échec du sauvetage perdrait le texte.
    expect(ordre).toEqual(["note-privee", "cadre"]);
    expect(noteMock).toHaveBeenCalledWith(
      expect.objectContaining({ note: NOTE_SENSIBLE, weekKey: WEEK_KEY }),
    );
  });

  test("si le sauvetage échoue, le cadre n'est PAS enregistré (donc la note n'est pas effacée)", async () => {
    mockClubState = CLUB_AVEC_LEGACY();
    noteMock.mockRejectedValue(new Error("permission-denied"));

    const renderer = await render();
    await press(renderer, "week-frame-save");

    expect(saveMock).not.toHaveBeenCalled();
    expect(flatText(renderer.toJSON())).not.toContain("Cadre enregistré pour cette semaine");
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

    const bouton = gestionnaire(actionable(renderer, "week-frame-save"), "onPress");
    await act(async () => {
      bouton();
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
          // 5 faits + 1 adapté = 6 sur 8 exercices → 75 %. Les compteurs somment
          // ici exactement au total (5 + 1 + 2 sautés = 8). L'ancien 70 % était
          // impossible avec ces compteurs : aucun total entier ne le produit.
          execution: {
            completionPct: 75,
            completionStatus: "partial",
            itemsDone: 5,
            itemsAdapted: 1,
            itemsSkipped: 2,
            itemsReplaced: 0,
            itemsReplacedEquivalent: 0,
            itemsReplacedPartial: 0,
            itemsTotal: 8,
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

// ─── Code club : émis à la demande, affiché une seule fois ──────────────────
// Le contrat a changé : le code n'est plus stocké en clair, donc plus relisible.
// Ces tests protègent la seule chose qui compte pour le coach — savoir qu'il ne
// le reverra pas, et savoir qu'en régénérer un annule le précédent.

describe("CoachWeekScreen — code club", () => {
  test("sans code émis : aucun code affiché, et l'écran dit pourquoi", async () => {
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Code club");
    expect(texte).toContain("Aucun code affiché");
    expect(texte).toContain("génère-en un nouveau");
    // Aucun tiret muet à la place d'un code : on explique, on n'affiche pas « — ».
    expect(actionable(renderer, "week-invite-issue")).toBeTruthy();
    expect(() => actionable(renderer, "week-invite-share")).toThrow();
  });

  test("le bouton déclenche l'émission serveur (jamais un tirage local)", async () => {
    const renderer = await render();
    await press(renderer, "week-invite-issue");
    expect(mockInviteState.issue).toHaveBeenCalledTimes(1);
  });

  test("code émis : affiché, partageable, avec validité, quota et avertissement", async () => {
    mockInviteState = makeInviteState({
      code: "ABCDE-FGHJK",
      expiresAt: new Date(2026, 7, 10, 12, 0, 0).getTime(),
      maxUses: 30,
    });
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("ABCDE-FGHJK");
    expect(texte).toContain("il ne sera plus affiché");
    expect(texte).toContain("10 août");
    expect(texte).toContain("30 utilisations maximum");
    expect(actionable(renderer, "week-invite-share")).toBeTruthy();
  });

  test("nouveau code : l'écran DIT que l'ancien ne marche plus, et que personne n'est exclu", async () => {
    mockInviteState = makeInviteState({ code: "ABCDE-FGHJK", replacedPrevious: true });
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("L'ancien code ne fonctionne plus");
    expect(texte).toContain("restent");
  });

  // ── L'INTERFACE NE PROPOSE PAS UN GESTE QUE LE SERVEUR REFUSERA ───────────
  // Quand l'autorité du club est incohérente (`ownerUid` et l'appartenance se
  // contredisent), la Cloud Function `issueClubInviteCode` refuse AVANT même de
  // regarder si l'appelant est encadrant (functions/src/inviteCodes.ts). Le
  // bouton restait pourtant proposé : le coach appuyait, et récoltait un refus
  // qu'aucun geste de sa part ne peut lever.
  test.each(["designation-without-membership", "membership-without-designation"])(
    "autorité incohérente (%s) : l'émission de code est fermée, et l'écran dit pourquoi",
    async (authority) => {
      mockClubState = makeClubState({ ownerAuthority: authority, ownershipInconsistent: true });
      const renderer = await render();
      const texte = flatText(renderer.toJSON());

      // Le bouton existe encore (on n'escamote pas la fonction), mais il est
      // désactivé et n'appelle plus le serveur.
      const bouton = noeuds(renderer, "week-invite-issue")[0];
      expect(bouton.props.disabled).toBe(true);
      expect(bouton.props.accessibilityState).toMatchObject({ disabled: true });
      await press(renderer, "week-invite-issue");
      expect(mockInviteState.issue).not.toHaveBeenCalled();

      // L'état est NOMMÉ : ni bouton mort, ni échec inexpliqué.
      expect(texte).toContain("Les actions d'encadrement sont fermées");
      expect(noeuds(renderer, "week-invite-incoherence").length).toBeGreaterThan(0);
    },
  );

  test("autorité saine : l'émission reste ouverte (on ne ferme rien 'au cas où')", async () => {
    const renderer = await render();
    const bouton = noeuds(renderer, "week-invite-issue")[0];
    expect(bouton.props.disabled).toBe(false);
    expect(noeuds(renderer, "week-invite-incoherence")).toHaveLength(0);
    await press(renderer, "week-invite-issue");
    expect(mockInviteState.issue).toHaveBeenCalledTimes(1);
  });

  test("échec d'émission : message FR du service, jamais une phrase Firebase", async () => {
    mockInviteState = makeInviteState({
      error: "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
    });
    const renderer = await render();
    const texte = flatText(renderer.toJSON());

    expect(texte).toContain("Impossible de joindre le serveur.");
    expect(texte.toLowerCase()).not.toContain("permission");
    expect(texte.toLowerCase()).not.toContain("insufficient");
  });
});
