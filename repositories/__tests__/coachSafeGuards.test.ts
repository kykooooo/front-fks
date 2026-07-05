// repositories/__tests__/coachSafeGuards.test.ts
// Garde-fou STATIQUE : scanne le flow coach (repository + écrans + domaine) pour
// interdire toute réintroduction d'une lecture brute ou d'une donnée sensible.
// Complète les tests fonctionnels (clubsRepo/coachSummary) par une preuve textuelle.
//
// NB : "users" n'est PAS interdit globalement — le coach lit légitimement SON
// propre doc users/{coachUid} pour résoudre son clubId. On interdit les motifs
// spécifiques aux lectures BRUTES joueur (sessions/plannedSessions/ai*/RPE/métriques).

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

const COACH_FLOW_FILES = [
  "repositories/clubsRepo.ts",
  "screens/CoachHomeScreen.tsx",
  "screens/CoachPlayerDetailScreen.tsx",
  "domain/coachSummary.ts",
  "domain/coachLabels.ts",
];

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

  test("les écrans coach consomment le lecteur coach-safe", () => {
    expect(read("screens/CoachHomeScreen.tsx")).toContain("fetchClubPlayerSummaries");
    expect(read("screens/CoachPlayerDetailScreen.tsx")).toContain("fetchClubPlayerSummary");
  });
});
