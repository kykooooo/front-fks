// domain/coachView/__tests__/roster.test.ts
// Effectif : recherche, filtres, tri. Le tri doit être STABLE et déterministe.

import {
  COACH_ROSTER_FILTERS,
  buildCoachRoster,
  countCoachRosterFilters,
  matchesCoachFilter,
  matchesCoachSearch,
  normalizeSearchText,
  sortCoachViews,
} from "../roster";
import type { CoachPlayerView } from "../types";
import { makeView } from "./fixtures";

const TODAY = "2026-07-27";

// ── Personnages de test, chacun dans un état différent ──────────────────────
/** Séance prévue le 22, rien de fait depuis → à vérifier. */
const nonFaite = makeView(
  {
    playerUid: "u-nonfaite",
    firstName: "Bilal",
    lastPlanned: {
      dateKey: "2026-07-22",
      title: "Force",
      focusLabel: null,
      intensityLabel: null,
      durationMin: null,
      blockCount: null,
    },
    activity: { doneDateKeys: ["2026-07-18"] },
  },
  TODAY,
);

/** A sauté 2 exercices hier → à surveiller. */
const adaptee = makeView(
  {
    playerUid: "u-adaptee",
    firstName: "Chloé",
    activity: { doneDateKeys: ["2026-07-26"] },
    lastDone: {
      dateKey: "2026-07-26",
      title: "Renfo",
      focusLabel: null,
      intensityLabel: null,
      durationMin: 40,
      blockCount: 4,
    },
    execution: {
      completionPct: 80,
      completionStatus: "partial",
      itemsDone: 8,
      itemsAdapted: 0,
      itemsSkipped: 2,
      itemsReplaced: 0,
      deviationLabels: ["Manque de temps"],
    },
  },
  TODAY,
);

/** Séance faite hier, rien à signaler. */
const ok = makeView(
  {
    playerUid: "u-ok",
    firstName: "Ana",
    position: "Gardien",
    activity: { doneDateKeys: ["2026-07-26", "2026-07-23"] },
  },
  TODAY,
);

/** Aucune donnée du tout. */
const inconnu = makeView({ playerUid: "u-inconnu", firstName: "Damien" }, TODAY);

const tous = [nonFaite, adaptee, ok, inconnu];

describe("normalizeSearchText / matchesCoachSearch", () => {
  test("insensible à la casse et aux accents", () => {
    expect(normalizeSearchText("Gaël ")).toBe("gael");
    expect(matchesCoachSearch(adaptee, "chloe")).toBe(true);
    expect(matchesCoachSearch(adaptee, "CHLOÉ")).toBe(true);
  });

  test("cherche aussi dans le poste et le niveau", () => {
    expect(matchesCoachSearch(ok, "gardien")).toBe(true);
    expect(matchesCoachSearch(ok, "regional")).toBe(true);
  });

  test("requête vide → tout le monde passe", () => {
    expect(matchesCoachSearch(inconnu, "  ")).toBe(true);
  });

  test("sans correspondance → false", () => {
    expect(matchesCoachSearch(ok, "zzz")).toBe(false);
  });
});

describe("filtres", () => {
  test("statuts attendus des personnages de test", () => {
    expect(nonFaite.statut).toBe("check");
    expect(adaptee.statut).toBe("watch");
    expect(ok.statut).toBe("normal");
    expect(inconnu.statut).toBe("unknown");
  });

  test("a_verifier / a_surveiller suivent le statut global", () => {
    expect(tous.filter((v) => matchesCoachFilter(v, "a_verifier"))).toEqual([nonFaite]);
    expect(tous.filter((v) => matchesCoachFilter(v, "a_surveiller"))).toEqual([adaptee]);
  });

  test("seance_non_faite s'appuie sur le signal, pas sur une heuristique d'écran", () => {
    expect(tous.filter((v) => matchesCoachFilter(v, "seance_non_faite"))).toEqual([nonFaite]);
  });

  test("seance_adaptee = le JOUEUR a dévié, pas le moteur", () => {
    const ajusteParFks = makeView(
      {
        playerUid: "u-moteur",
        firstName: "Eva",
        adaptation: { adapted: true, labels: ["Volume réduit"] },
        activity: { doneDateKeys: ["2026-07-26"] },
      },
      TODAY,
    );
    expect(matchesCoachFilter(adaptee, "seance_adaptee")).toBe(true);
    expect(matchesCoachFilter(ajusteParFks, "seance_adaptee")).toBe(false);
  });

  test("aucune_donnee_recente couvre l'inconnu ET l'inactif long", () => {
    const inactif = makeView(
      { playerUid: "u-inactif", firstName: "Farid", activity: { doneDateKeys: ["2026-07-05"] } },
      TODAY,
    );
    expect(matchesCoachFilter(inconnu, "aucune_donnee_recente")).toBe(true);
    expect(matchesCoachFilter(inactif, "aucune_donnee_recente")).toBe(true);
    expect(matchesCoachFilter(ok, "aucune_donnee_recente")).toBe(false);
  });

  test("aucun filtre de douleur ou de fatigue n'est proposé", () => {
    const noms = COACH_ROSTER_FILTERS.join(" ");
    expect(noms).not.toMatch(/douleur|pain|fatigue|blessure/i);
  });

  test("countCoachRosterFilters compte 'tous' = effectif complet", () => {
    const counts = countCoachRosterFilters(tous);
    expect(counts.tous).toBe(4);
    expect(counts.a_verifier).toBe(1);
    expect(counts.a_surveiller).toBe(1);
    expect(counts.seance_non_faite).toBe(1);
    expect(counts.seance_adaptee).toBe(1);
  });
});

describe("tri", () => {
  test("priorité : à vérifier → à surveiller → indisponible → normal", () => {
    const ordre = sortCoachViews([ok, inconnu, adaptee, nonFaite]).map((v) => v.playerUid);
    expect(ordre).toEqual(["u-nonfaite", "u-adaptee", "u-inconnu", "u-ok"]);
  });

  test("à statut égal, le plus ancien sans séance d'abord", () => {
    const recent = makeView(
      { playerUid: "u-recent", firstName: "Zoé", activity: { doneDateKeys: ["2026-07-26"] } },
      TODAY,
    );
    const ancien = makeView(
      { playerUid: "u-ancien", firstName: "Alix", activity: { doneDateKeys: ["2026-07-24"] } },
      TODAY,
    );
    expect(sortCoachViews([recent, ancien]).map((v) => v.playerUid)).toEqual([
      "u-ancien",
      "u-recent",
    ]);
  });

  test("tri par prénom (fr), accents compris", () => {
    const ordre = sortCoachViews(tous, "prenom").map((v) => v.prenom);
    expect(ordre).toEqual(["Ana", "Bilal", "Chloé", "Damien"]);
  });

  test("tri par dernière activité : plus récent d'abord, inconnu en dernier", () => {
    const ordre = sortCoachViews(tous, "activite").map((v) => v.playerUid);
    // Ana et Chloé ont toutes les deux fait leur séance hier → départage au prénom.
    expect(ordre).toEqual(["u-ok", "u-adaptee", "u-nonfaite", "u-inconnu"]);
  });

  test("tri STABLE à égalité complète : départage par prénom puis uid", () => {
    const a = makeView({ playerUid: "uid-b", firstName: "Sam" }, TODAY);
    const b = makeView({ playerUid: "uid-a", firstName: "Sam" }, TODAY);
    const attendu = ["uid-a", "uid-b"];
    expect(sortCoachViews([a, b]).map((v) => v.playerUid)).toEqual(attendu);
    expect(sortCoachViews([b, a]).map((v) => v.playerUid)).toEqual(attendu);
    expect(sortCoachViews([a, b], "prenom").map((v) => v.playerUid)).toEqual(attendu);
    expect(sortCoachViews([a, b], "activite").map((v) => v.playerUid)).toEqual(attendu);
  });

  test("ne trie jamais la liste d'origine en place", () => {
    const source: CoachPlayerView[] = [ok, nonFaite];
    const copie = source.slice();
    sortCoachViews(source);
    expect(source).toEqual(copie);
  });
});

describe("buildCoachRoster", () => {
  test("recherche + filtre + tri combinés", () => {
    const res = buildCoachRoster(tous, { query: "chlo", filter: "a_surveiller" });
    expect(res.map((v) => v.playerUid)).toEqual(["u-adaptee"]);
  });

  test("sans options → tout l'effectif, trié par priorité", () => {
    expect(buildCoachRoster(tous).map((v) => v.playerUid)).toEqual([
      "u-nonfaite",
      "u-adaptee",
      "u-inconnu",
      "u-ok",
    ]);
  });

  test("liste vide → liste vide (aucun cas particulier à gérer côté écran)", () => {
    expect(buildCoachRoster([], { filter: "a_verifier" })).toEqual([]);
  });
});
