// repositories/__tests__/coachSafeGuards.test.ts
// Garde-fou STATIQUE : scanne le flow coach (repository + écrans + hooks + domaine
// + composants) pour interdire toute réintroduction d'une lecture brute ou d'une
// donnée sensible. Complète les tests fonctionnels (clubsRepo/coachSummary) par
// une preuve textuelle.
//
// NB : "users" n'est PAS interdit globalement — le coach lit légitimement SON
// propre doc users/{coachUid} pour résoudre son clubId. On interdit les motifs
// spécifiques aux lectures BRUTES joueur (sessions/plannedSessions/ai*/RPE/métriques).
//
// ─── POURQUOI CE FICHIER A ÉTÉ ÉLARGI (refonte espace coach, 2026-07) ─────────
// La liste de fichiers était ÉCRITE EN DUR et ne citait que `CoachHomeScreen` et
// `CoachPlayerDetailScreen`. La refonte a déplacé tout l'espace coach vers
// `screens/coach/`, `hooks/coach/`, `domain/coachView/` et `components/coach/` —
// et RootNavigator ne monte plus les deux anciens écrans. Le garde-fou continuait
// donc à passer au vert en ne scannant QUE du code mort : protection nulle sur le
// flow réellement exécuté.
//
// On ne recopie pas la même erreur : les répertoires coach sont désormais
// PARCOURUS RÉCURSIVEMENT. Tout fichier ajouté demain dans l'espace coach est
// couvert sans que personne ait à penser à modifier ce test — c'est la seule
// forme de garde-fou qui ne pourrit pas avec le temps.

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");
const readRaw = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// On scanne le CODE, pas la documentation : les commentaires décrivent
// justement ce qui est interdit (« jamais de plannedSessions/TSB/aiV2 ») et
// déclencheraient de faux positifs. On retire commentaires bloc + ligne.
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const read = (rel: string) => stripComments(readRaw(rel));

/**
 * Fichiers coach cités un par un : ils ne vivent pas dans un répertoire dédié.
 *
 * Les deux écrans historiques y restent VOLONTAIREMENT tant qu'ils existent dans
 * le dépôt : ils ne sont plus montés par RootNavigator, mais du code mort qu'on
 * arrête de surveiller est exactement ce qui revient un jour par copier-coller.
 * Le jour où ils seront supprimés, `existsSync` les fera simplement sortir du
 * scan (au lieu de faire planter la suite sur un fichier introuvable).
 */
const COACH_FLOW_SINGLE_FILES = [
  "repositories/clubsRepo.ts",
  "domain/coachSummary.ts",
  "domain/coachLabels.ts",
  "navigation/CoachTabs.tsx",
  "screens/CoachHomeScreen.tsx",
  "screens/CoachPlayerDetailScreen.tsx",
].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

/** Répertoires 100% coach : parcourus récursivement, tests exclus. */
const COACH_FLOW_DIRS = [
  "screens/coach",
  "hooks/coach",
  "domain/coachView",
  "components/coach",
];

/** Liste récursivement les sources .ts/.tsx d'un répertoire (hors __tests__). */
const listSources = (relDir: string): string[] => {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSources(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
};

const COACH_FLOW_FILES = [
  ...COACH_FLOW_SINGLE_FILES,
  ...COACH_FLOW_DIRS.flatMap(listSources),
].sort();

// Motifs interdits dans TOUT le flow coach (lecture brute / donnée sensible).
const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: "ancienne lecture roster brut (fetchClubPlayers)", re: /\bfetchClubPlayers\b/ },
  { label: "ancienne lecture séances brutes (fetchPlayerSessionOverview)", re: /\bfetchPlayerSessionOverview\b/ },
  { label: "ancien helper de scan (fetchRecentDocs)", re: /\bfetchRecentDocs\b/ },
  { label: "sous-collection plannedSessions", re: /plannedSessions/ },
  { label: "sous-collection sessions brute", re: /["'`]sessions["'`]/ },
  { label: "blueprint IA brut (aiV2)", re: /\baiV2\b/ },
  { label: "blueprint IA brut (ai.)", re: /\bai\.(title|blocks|focus)/ },
  { label: "RPE (label)", re: /Ressenti \(RPE\)/ },
  { label: "RPE (champ)", re: /\.rpe\b/ },
  { label: "métrique brute TSB", re: /\bTSB\b/ },
  { label: "métrique brute ATL", re: /\bATL\b/ },
  { label: "métrique brute CTL", re: /\bCTL\b/ },
];

describe("garde-fou statique coach-safe", () => {
  // Verrou du verrou : si un jour le parcours de répertoires casse (renommage,
  // déplacement), la liste se viderait en silence et TOUS les tests ci-dessous
  // passeraient sans rien scanner. On ancre donc un plancher explicite.
  test("le scan couvre bien l'espace coach réellement monté", () => {
    expect(COACH_FLOW_FILES).toContain("repositories/clubsRepo.ts");
    expect(COACH_FLOW_FILES).toContain("screens/coach/CoachTodayScreen.tsx");
    expect(COACH_FLOW_FILES).toContain("screens/coach/CoachRosterScreen.tsx");
    expect(COACH_FLOW_FILES).toContain("screens/coach/CoachWeekScreen.tsx");
    expect(COACH_FLOW_FILES).toContain("screens/coach/CoachPlayerScreen.tsx");
    expect(COACH_FLOW_FILES).toContain("hooks/coach/useCoachRoster.ts");
    expect(COACH_FLOW_FILES).toContain("domain/coachView/fromSummary.ts");
    // Ordre de grandeur : l'espace coach fait plusieurs dizaines de fichiers.
    // Un scan retombé à une poignée = régression du garde-fou, pas du code.
    expect(COACH_FLOW_FILES.length).toBeGreaterThanOrEqual(25);
  });

  for (const rel of COACH_FLOW_FILES) {
    describe(rel, () => {
      const src = read(rel);
      for (const { label, re } of FORBIDDEN) {
        test(`ne contient pas : ${label}`, () => {
          expect(src).not.toMatch(re);
        });
      }
    });
  }

  test("clubsRepo lit bien la projection coach-safe (playerSummaries)", () => {
    expect(read("repositories/clubsRepo.ts")).toContain("playerSummaries");
  });

  test("les hooks coach consomment le lecteur coach-safe", () => {
    // Les écrans ne lisent plus Firestore eux-mêmes : ils passent par ces hooks.
    // C'est donc là que doit se trouver l'unique porte d'entrée coach-safe.
    expect(read("hooks/coach/useCoachRoster.ts")).toContain("fetchClubPlayerSummaries");
    expect(read("hooks/coach/useCoachPlayer.ts")).toContain("fetchClubPlayerSummary");
  });

  test("les écrans coach ne lisent PAS Firestore en direct", () => {
    // Toute la frontière coach-safe tient à un point unique de lecture
    // (`repositories/clubsRepo`). Un écran qui importerait `firebase/firestore`
    // pourrait la contourner sans qu'aucun test fonctionnel ne le voie.
    for (const rel of listSources("screens/coach")) {
      expect(read(rel)).not.toMatch(/from "firebase\/firestore"/);
    }
  });
});
