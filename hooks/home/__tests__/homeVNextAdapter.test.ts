// hooks/home/__tests__/homeVNextAdapter.test.ts
// =============================================================================
// L'ADAPTATEUR — CE QU'IL A LE DROIT DE FABRIQUER (rien)
// =============================================================================
//
// Les deux selecteurs du Home vNext interdisent d'inventer une valeur. Mais ils
// ne peuvent interdire que ce qu'ils voient : si l'adaptateur ecrit `?? 0` ou
// `?? "Séance"`, ils recoivent un chiffre et ils le croient. Le contrat se
// contourne donc PAR L'ENTREE, en silence.
//
// Ce fichier verrouille l'entree. Il est organise autour de trois questions :
//
//   1. UN COMPTE VIDE PRODUIT-IL DU VIDE ? Aucun champ ne doit sortir rempli
//      d'un compte qui n'a rien fait — c'est la seule maniere de prouver qu'il
//      n'y a pas de valeur de repli cachee.
//   2. LA COURBE EST-ELLE PURGEE DE SES AMORCES ? L'ancienne serie
//      (`hooks/home/useLoadSeries.ts`) part de ATL0/CTL0 et chauffe 21 jours :
//      un compte neuf y obtient une courbe qui ne parle que d'elle-meme, et le
//      store porte deja un « TSB initial = +3 ». Ici, zero doit rester zero.
//   3. CE QUI EST OBSERVE EST-IL VRAIMENT OBSERVE ? Une charge club injectee
//      d'apres des cases cochees au profil n'est pas un fait constate. La
//      compter debloquerait une courbe sur un compte qui n'a rien enregistre.
// =============================================================================

import type { Session } from "../../../domain/types";
import type { ExternalLoad } from "../../../state/stores/types";
import { TRAINING_DEFAULTS } from "../../../config/trainingDefaults";
import { updateTrainingLoad } from "../../../engine/loadModel";
import { buildHomeVNextViewModel } from "../../../screens/homeVNext/viewModel";
import {
  construireChargesEnregistreesParJour,
  construireEntreeDemarrage,
  construireEntreeHome,
  construireEntreeProgression,
  construireProchainMatch,
  construireSemaineCouranteDepuisLeHome,
  construireSerieForme,
  type EtatStoresHome,
} from "../homeVNextAdapter";

const NOW = "2026-08-10T12:00:00"; // un lundi

function seance(patch: Partial<Session>): Session {
  return {
    id: "s1",
    date: "2026-08-10",
    dateISO: "2026-08-10T10:00:00",
    focus: "run",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 1,
    exercises: [],
    ...patch,
  } as Session;
}

function charge(patch: Partial<ExternalLoad>): ExternalLoad {
  return {
    id: "e1",
    source: "other",
    dateISO: "2026-08-09T12:00:00.000Z",
    rpe: 5,
    durationMin: 60,
    ...patch,
  };
}

const ETAT_VIDE: EtatStoresHome = {
  displayName: null,
  nowISO: NOW,
  storeHydrated: true,
  sessions: [],
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

// -----------------------------------------------------------------------------
// 1. Un compte vide produit du vide
// -----------------------------------------------------------------------------

describe("un compte qui n'a rien fait ne recoit aucune valeur fabriquee", () => {
  const entree = construireEntreeHome(ETAT_VIDE);

  it("aucune tendance de forme — pas de courbe plate, pas de serie amorcee", () => {
    expect(entree.formTrend).toBeNull();
  });

  it("aucun objectif hebdo : `null`, et surtout pas 2", () => {
    expect(entree.weeklyGoalDeclared).toBeNull();
  });

  it("aucune seance, aucun match, aucun prenom, aucune directive", () => {
    expect(entree.completedSessions).toEqual([]);
    expect(entree.pendingSession).toBeNull();
    expect(entree.nextMatch).toBeNull();
    expect(entree.displayName).toBeNull();
    expect(entree.clubDirective).toBeNull();
    expect(entree.generationError).toBeNull();
  });

  it("aucun jour depuis la derniere seance — `null`, pas 0", () => {
    expect(entree.daysSinceLastSession).toBeNull();
    expect(entree.fksSessionsCompletedThisWeek).toBe(0);
  });

  it("et le selecteur en tire un ecran de demarrage, pas un ecran vide", () => {
    const vm = buildHomeVNextViewModel(entree, { variante: "v2", demarrage: "A" });
    // `form` reste `null` : sans donnees, il n'y a meme pas d'etat « courbe
    // indisponible » a rendre — c'est la carte progression qui porte le message.
    expect(vm.form).toBeNull();
    expect(vm.week).toBeNull();
    expect(vm.demarrage).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 2. La courbe est purgee de ses amorces
// -----------------------------------------------------------------------------

describe("la serie de forme ne part d'aucune constante d'amorcage", () => {
  it("sans aucun jour observe, il n'y a pas de serie du tout", () => {
    expect(
      construireSerieForme({
        nowISO: NOW,
        seances: [],
        chargesExternes: [],
      })
    ).toBeNull();
  });

  it("la serie commence au premier jour REELLEMENT observe, jamais avant", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: true, dateISO: "2026-08-08T10:00:00" })],
      chargesExternes: [],
    });
    expect(serie).not.toBeNull();
    expect(serie!.points[0].dateKey).toBe("2026-08-08");
    // 8, 9, 10 aout : trois jours, pas trente.
    expect(serie!.points).toHaveLength(3);
  });

  it("le premier point derive de zero, pas de ATL0/CTL0 — donc pas du « TSB initial = +3 »", () => {
    const seuleSeance = seance({ id: "a", completed: true, dateISO: "2026-08-10T10:00:00" });
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seuleSeance],
      chargesExternes: [],
    });
    expect(serie).not.toBeNull();
    expect(serie!.points).toHaveLength(1);

    // La charge du jour vient de la seance elle-meme. Le point doit etre celui
    // qu'on obtient en partant de (0, 0) — et surtout PAS celui qu'on obtient en
    // partant de l'amorce ATL0/CTL0 du depot.
    const chargeDuJour = construireChargesEnregistreesParJour({
      seances: [seuleSeance],
      chargesExternes: [],
    })["2026-08-10"];
    expect(chargeDuJour).toBeGreaterThan(0);

    const depuisZero = updateTrainingLoad(0, 0, chargeDuJour, { dtDays: 1 });
    const depuisAmorce = updateTrainingLoad(
      TRAINING_DEFAULTS.ATL0,
      TRAINING_DEFAULTS.CTL0,
      chargeDuJour,
      { dtDays: 1 }
    );
    expect(serie!.points[0].value).toBe(Number(depuisZero.tsb.toFixed(1)));
    expect(serie!.points[0].value).not.toBe(Number(depuisAmorce.tsb.toFixed(1)));
  });

  it("aucun jour n'est bouche a zero AVANT le premier fait observe", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: true, dateISO: "2026-08-09T10:00:00" })],
      chargesExternes: [],
    });
    expect(serie!.points.map((p) => p.dateKey)).toEqual(["2026-08-09", "2026-08-10"]);
  });
});

// -----------------------------------------------------------------------------
// 3. Ce qui est observe est vraiment observe
// -----------------------------------------------------------------------------

describe("les jours observes ne comptent que des faits constates", () => {
  it("une seance terminee et une charge saisie a la main comptent", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: true, dateISO: "2026-08-08T10:00:00" })],
      chargesExternes: [charge({ id: "k9x", dateISO: "2026-08-09T12:00:00.000Z" })],
    });
    expect(serie!.observedDayCount).toBe(2);
    expect(serie!.autoClubDaysExcluded).toBe(0);
  });

  it("une charge club auto-injectee ne compte pas comme un jour observe", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: true, dateISO: "2026-08-08T10:00:00" })],
      chargesExternes: [
        charge({ id: "auto_club_2026-08-09", source: "club", dateISO: "2026-08-09T12:00:00.000Z" }),
      ],
    });
    expect(serie!.observedDayCount).toBe(1);
    expect(serie!.autoClubDaysExcluded).toBe(1);
  });

  it("et elle n'apporte AUCUNE charge a la trajectoire", () => {
    const seances = [seance({ id: "a", completed: true, dateISO: "2026-08-08T10:00:00" })];
    const sans = construireSerieForme({ nowISO: NOW, seances, chargesExternes: [] });
    const avec = construireSerieForme({
      nowISO: NOW,
      seances,
      chargesExternes: [
        charge({ id: "auto_club_2026-08-09", source: "club", dateISO: "2026-08-09T12:00:00.000Z" }),
      ],
    });
    // Meme courbe : la charge club deduite des cases du profil n'y entre pas.
    expect(avec!.points).toEqual(sans!.points);
  });

  it("une charge auto SEULE ne suffit pas a faire naitre une courbe", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [],
      chargesExternes: [charge({ id: "auto_match_2026-08-09", source: "match" })],
    });
    expect(serie).toBeNull();
  });

  it("une seance PLANIFIEE non faite n'observe rien", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: false, dateISO: "2026-08-09T10:00:00" })],
      chargesExternes: [],
    });
    expect(serie).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3 bis. Le jour de club n'efface pas la seance FKS qu'on y a faite
// -----------------------------------------------------------------------------

describe("un jour de club ne fait pas disparaitre la seance FKS du meme jour", () => {
  // LE CAS QUI A CASSE : le joueur coche « club » les mardis/jeudis au setup ;
  // `applyAutoExternalLoads` pose une charge auto ces jours-la ; le joueur fait
  // quand meme sa seance FKS le soir. L'exclusion portait sur le JOUR, pas sur
  // la SOURCE : toute la charge du jour etait remise a zero, seance comprise.
  // Resultat mesure : une courbe plate a zero, sous une phrase affirmant qu'elle
  // etait calculee sur les seances FKS.
  const joursFks = ["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
  const seancesFks = joursFks.map((jour, i) =>
    seance({ id: `s${i}`, completed: true, dateISO: `${jour}T19:00:00` })
  );
  const chargesAutoMemesJours = joursFks.map((jour) =>
    charge({ id: `auto_club_${jour}`, source: "club", dateISO: `${jour}T12:00:00.000Z` })
  );

  it("la trajectoire n'est pas plate : les seances FKS y sont", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: seancesFks,
      chargesExternes: chargesAutoMemesJours,
    });
    expect(serie).not.toBeNull();
    expect(serie!.points.length).toBeGreaterThan(0);
    expect(serie!.points.every((p) => p.value === 0)).toBe(false);
    expect(serie!.observedDayCount).toBe(4);
    expect(serie!.autoClubDaysExcluded).toBe(4);
  });

  it("elle est meme IDENTIQUE a celle qu'on aurait sans les charges club", () => {
    const avecClub = construireSerieForme({
      nowISO: NOW,
      seances: seancesFks,
      chargesExternes: chargesAutoMemesJours,
    });
    const sansClub = construireSerieForme({
      nowISO: NOW,
      seances: seancesFks,
      chargesExternes: [],
    });
    expect(avecClub!.points).toEqual(sansClub!.points);
  });

  it("et le selecteur affiche bien une courbe, pas une ligne a zero", () => {
    const etat: EtatStoresHome = {
      ...ETAT_VIDE,
      sessions: seancesFks,
      chargesExternes: chargesAutoMemesJours,
    };
    const vm = buildHomeVNextViewModel(construireEntreeHome(etat), {
      variante: "v2",
      demarrage: "A",
    });
    expect(vm.form?.kind).toBe("available");
    if (vm.form?.kind === "available") {
      expect(vm.form.points.every((v) => v === 0)).toBe(false);
      // La phrase de portee decrit ce qui a REELLEMENT ete calcule.
      expect(vm.form.scope).toContain("tes entraînements club notés au profil n'y sont pas comptés");
    }
  });
});

// -----------------------------------------------------------------------------
// 4. L'etat du jour ne vient pas du store amorce
// -----------------------------------------------------------------------------

describe("le libelle d'etat suit la serie purgee, pas le TSB du store", () => {
  it("sans serie, il n'y a pas de libelle", () => {
    expect(construireEntreeHome(ETAT_VIDE).formTrend).toBeNull();
  });

  it("avec une serie, il est calcule sur le dernier point de CETTE serie", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [seance({ id: "a", completed: true, dateISO: "2026-08-08T10:00:00" })],
      chargesExternes: [],
    });
    expect(typeof serie!.stateLabel).toBe("string");
    expect(serie!.stateLabel!.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// 5. Le compteur hebdo passe par le resume canonique
// -----------------------------------------------------------------------------

describe("le compteur hebdo et sa cible viennent du resume canonique", () => {
  const seances = [
    seance({ id: "a", completed: true, dateISO: "2026-08-10T10:00:00" }), // lundi
    seance({ id: "b", completed: true, dateISO: "2026-08-09T10:00:00" }), // dimanche precedent
  ];

  it("le reglage `weekStart` du joueur change la fenetre, pas l'algorithme", () => {
    const lundi = construireEntreeHome({ ...ETAT_VIDE, sessions: seances, debutDeSemaine: "mon" });
    const dimanche = construireEntreeHome({ ...ETAT_VIDE, sessions: seances, debutDeSemaine: "sun" });
    expect(lundi.fksSessionsCompletedThisWeek).toBe(1);
    expect(dimanche.fksSessionsCompletedThisWeek).toBe(2);
  });

  it("le rythme declare au setup l'emporte sur le reglage", () => {
    const entree = construireEntreeHome({
      ...ETAT_VIDE,
      targetFksSessionsPerWeek: 4,
      weeklyGoalReglage: 2,
    });
    expect(entree.weeklyGoalDeclared).toBe(4);
  });
});

// -----------------------------------------------------------------------------
// 6. Les autres derivations
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 5 bis. Un seul predicat « seance terminee » dans tout l'objet d'entree
// -----------------------------------------------------------------------------

describe("l'entree ne porte qu'UNE definition de « seance FKS terminee »", () => {
  // Donnee legacy : un `feedback` sans `completed`. Le chemin normal
  // (`state/orchestrators/applyFeedback.ts`) ecrit toujours les deux ensemble ;
  // seule une vieille donnee Firestore peut produire cette forme.
  const legacy = seance({
    id: "legacy",
    completed: false,
    dateISO: "2026-08-10T10:00:00",
    feedback: { rpe: 7 } as never,
  });

  it("le cumul et le compteur hebdo comptent les MEMES seances", () => {
    const entree = construireEntreeHome({ ...ETAT_VIDE, sessions: [legacy] });
    // Avant : `completedSessions` (predicat large) disait 1, le compteur hebdo
    // (predicat strict) disait 0 — deux chiffres a une ligne d'intervalle.
    expect(entree.completedSessions).toHaveLength(0);
    expect(entree.fksSessionsCompletedThisWeek).toBe(0);
  });

  it("et cette seance n'est pas dite « faite » alors qu'elle reste EN ATTENTE", () => {
    // `selectPendingSession` filtre `!s.completed` : pour l'app, elle est a faire.
    const entree = construireEntreeHome({ ...ETAT_VIDE, sessions: [legacy] });
    expect(entree.pendingSession?.id).toBe("legacy");
    expect(entree.completedSessions).toHaveLength(0);
  });

  it("la serie de forme et le compte de jours observes s'accordent aussi", () => {
    const serie = construireSerieForme({
      nowISO: NOW,
      seances: [legacy],
      chargesExternes: [],
    });
    // Avant : `premierIndex` demarrait sur le predicat large (donc des points)
    // alors que `observedDayCount` comptait sur le strict (donc zero jour).
    expect(serie).toBeNull();
  });

  it("la carte progression tranche comme le Home", () => {
    const entree = construireEntreeProgression(
      { ...ETAT_VIDE, sessions: [legacy] },
      { blocAffiche: false, seancesAffichees: 0 }
    );
    expect(entree.seancesTerminees).toHaveLength(0);
  });
});

describe("le prochain match est projete, jamais devine", () => {
  it("sans jour coche au profil, il n'y a pas de match", () => {
    expect(construireProchainMatch([], NOW)).toBeNull();
  });

  it("le jour coche devient une VRAIE date, marquee comme deduite du profil", () => {
    const match = construireProchainMatch(["wed"], NOW);
    expect(match).toEqual({ dateKey: "2026-08-12", source: "profil_jour_recurrent" });
  });

  it("aujourd'hui compte comme le prochain match", () => {
    expect(construireProchainMatch(["mon"], NOW)?.dateKey).toBe("2026-08-10");
  });
});

describe("la seance en attente ne pretend jamais avoir ete commencee", () => {
  it("l'app ne sait pas tracer une seance ouverte puis abandonnee", () => {
    const entree = construireEntreeHome({
      ...ETAT_VIDE,
      sessions: [seance({ id: "p", completed: false, dateISO: "2026-08-10T10:00:00" })],
    });
    expect(entree.pendingSession?.status).toBe("non_commencee");
    expect(entree.pendingSession?.feedbackGiven).toBe(false);
  });

  it("un titre absent reste `null` — jamais « Séance »", () => {
    const entree = construireEntreeHome({
      ...ETAT_VIDE,
      sessions: [seance({ id: "p", completed: false, dateISO: "2026-08-10T10:00:00" })],
    });
    expect(entree.pendingSession?.title).toBeNull();
    expect(entree.pendingSession?.durationMin).toBeNull();
    expect(entree.pendingSession?.sessionTheme).toBeNull();
  });
});

describe("l'entree de demarrage lit les trois champs que l'app possede deja", () => {
  it("un objectif vide reste `null`", () => {
    expect(construireEntreeDemarrage({ mainObjective: "   ", testsTerrain: [] })).toEqual({
      mainObjective: null,
      testEntryCount: 0,
      lastTestPlaylist: null,
    });
  });

  it("le cycle du test le plus recent est recanonicalise", () => {
    const entree = construireEntreeDemarrage({
      mainObjective: "Gagner en vitesse / explosivite",
      testsTerrain: [
        { ts: 1_700_000_000_000, playlist: "endurance" },
        { ts: 1_800_000_000_000, playlist: "rsa" }, // ancien nom -> endurance
      ] as never,
    });
    expect(entree.testEntryCount).toBe(2);
    expect(entree.lastTestPlaylist).toBe("endurance");
  });
});

// -----------------------------------------------------------------------------
// 7. R7 — la carte progression et « Ma semaine » parlent du MEME chiffre
// -----------------------------------------------------------------------------
//
// Le dossier d'integration prevoyait `appariementVariante2.test.ts` au L2. Ce
// test-la portait sur l'outil de demonstration (il dependait du harnais
// react-native-web, qui vit dans un autre worktree) et n'a pas ete porte —
// l'invariant qu'il protegeait, lui, s'etait retrouve cable en dur dans le hook,
// vrai par construction et verrouille par aucun test. Il l'est ici.

describe("R7 : ce que la carte progression suppose de « Ma semaine » vient du Home", () => {
  const seances = [
    seance({ id: "a", completed: true, dateISO: "2026-08-10T10:00:00" }),
    seance({ id: "b", completed: true, dateISO: "2026-08-11T10:00:00" }),
  ];

  it("le cablage recopie `week.doneCount`, il ne le recalcule pas", () => {
    expect(construireSemaineCouranteDepuisLeHome({ week: { doneCount: 3 } })).toEqual({
      blocAffiche: true,
      seancesAffichees: 3,
    });
  });

  it("sans bloc « Ma semaine », aucun doublon n'est possible : le garde-fou se retire", () => {
    expect(construireSemaineCouranteDepuisLeHome({ week: null })).toEqual({
      blocAffiche: false,
      seancesAffichees: 0,
    });
  });

  it("bout en bout : le chiffre suppose est EXACTEMENT celui que le Home affiche", () => {
    const etat: EtatStoresHome = {
      ...ETAT_VIDE,
      sessions: seances,
      targetFksSessionsPerWeek: 3, // sans objectif declare, le bloc semaine ne sort pas
    };
    const vm = buildHomeVNextViewModel(construireEntreeHome(etat), {
      variante: "v2",
      demarrage: "A",
    });
    expect(vm.week).not.toBeNull();

    const semaine = construireSemaineCouranteDepuisLeHome(vm);
    expect(semaine.seancesAffichees).toBe(vm.week!.doneCount);
    expect(construireEntreeProgression(etat, semaine).semaineCourante).toEqual(semaine);
  });
});

describe("l'entree progression dit la verite sur ce qui n'est pas capture", () => {
  it("les charges club realisees ne sont pas capturees : le champ le dit", () => {
    const entree = construireEntreeProgression(ETAT_VIDE, {
      blocAffiche: false,
      seancesAffichees: 0,
    });
    expect(entree.chargesClubCapturees).toBe(false);
    expect(entree.tendance).toBeNull();
    expect(entree.seancesTerminees).toEqual([]);
  });

  it("« ressenti enregistre » exige un VRAI retour, pas une seance cochee terminee", () => {
    const entree = construireEntreeProgression(
      {
        ...ETAT_VIDE,
        sessions: [
          seance({ id: "a", completed: true, dateISO: "2026-08-09T10:00:00" }),
          seance({
            id: "b",
            completed: true,
            dateISO: "2026-08-08T10:00:00",
            feedback: { rpe: 7 } as never,
          }),
        ],
      },
      { blocAffiche: false, seancesAffichees: 0 }
    );
    const parId = Object.fromEntries(entree.seancesTerminees.map((s) => [s.id, s]));
    expect(parId.a.ressentiEnregistre).toBe(false);
    expect(parId.b.ressentiEnregistre).toBe(true);
    expect(parId.a.dureeMin).toBeNull();
  });
});
