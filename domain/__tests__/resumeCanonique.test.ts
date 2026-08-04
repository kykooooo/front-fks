// domain/__tests__/resumeCanonique.test.ts
// =============================================================================
// LE RESUME CANONIQUE — LES DEUX ANCIENS CHEMINS DONNENT LE MEME CHIFFRE
// =============================================================================
//
// L'unification n'a de valeur que si elle est PROUVEE equivalente : mettre en
// commun un calcul en changeant discretement son resultat, c'est deplacer le
// bug, pas le corriger. Ce fichier compare donc la fonction canonique aux deux
// implementations qu'elle remplace, sur des dates reelles :
//
//   - la semaine « lundi fixe » de `weekKeyOf` (boucle de suivi, cle Firestore
//     partagee coach/joueur) ;
//   - la semaine « reglage du joueur » de `useWeekDays` (Home), reproduite ici
//     avec `date-fns/startOfWeek`, exactement comme le hook la calcule.
//
// Il verrouille aussi les deux regles qui, elles, sont des DECISIONS :
//   - l'objectif hebdo ne vaut jamais 2 par defaut ;
//   - les charges club/match auto-injectees ne font pas un jour observe.
// =============================================================================

import { addDays, startOfWeek } from "date-fns";

import {
  compterJoursObserves,
  compterSeancesFksSurJours,
  construireResumeHebdo,
  estChargeExterneManuelle,
  estSeanceFksTerminee,
  FENETRES_RESUME,
  joursDeLaSemaine,
  resoudreObjectifHebdo,
  type SeanceDatee,
} from "../resumeCanonique";
import { TRACKING_CONFIG } from "../tracking/config";
import { toDateKey, weekKeyOf } from "../../utils/dateHelpers";

/** Quelques instants pieges : bords de semaine, bord de mois, bord d'annee. */
const INSTANTS = [
  "2026-08-03T09:00:00", // un lundi
  "2026-08-09T22:30:00", // un dimanche, tard
  "2026-08-02T00:15:00", // un dimanche, juste apres minuit
  "2026-12-31T18:00:00", // bord d'annee
  "2026-03-29T14:00:00", // week-end du passage a l'heure d'ete (FR)
  "2026-11-01T14:00:00", // bord de mois
];

describe("joursDeLaSemaine reproduit exactement les deux semaines existantes", () => {
  it.each(INSTANTS)("« lundi fixe » : mêmes 7 jours que weekKeyOf (%s)", (instant) => {
    const jours = joursDeLaSemaine(instant, "mon");
    expect(jours).toHaveLength(7);
    // Tous les jours de la fenetre portent la meme cle de semaine que `now`,
    // et cette cle est le premier jour de la fenetre.
    const cle = weekKeyOf(instant);
    expect(jours[0]).toBe(cle);
    for (const j of jours) expect(weekKeyOf(j)).toBe(cle);
  });

  it.each(INSTANTS)("« reglage du joueur » : mêmes 7 jours que useWeekDays (%s)", (instant) => {
    for (const [reglage, index] of [
      ["mon", 1],
      ["sun", 0],
    ] as const) {
      const attendus: string[] = [];
      const debut = startOfWeek(new Date(instant), { weekStartsOn: index });
      for (let i = 0; i < 7; i++) attendus.push(toDateKey(addDays(debut, i)));
      expect(joursDeLaSemaine(instant, reglage)).toEqual(attendus);
    }
  });

  it("une date illisible ne fabrique pas une semaine", () => {
    expect(joursDeLaSemaine("pas une date", "mon")).toEqual([]);
    // Ecart ASSUME face a `weekKeyOf`, qui retombait sur l'horloge systeme et
    // comptait la semaine reelle : ici, le vide remonte jusqu'a l'ecran.
    expect(
      compterSeancesFksSurJours(
        [{ completed: true, dateISO: "2026-08-05T10:00:00" }],
        joursDeLaSemaine("???", "mon")
      )
    ).toBe(0);
  });

  it("une date NUE est lue en LOCAL, jamais en UTC", () => {
    // `new Date("2026-08-09")` vaut minuit UTC : en fuseau negatif, le 9 aout
    // devient le 8 aout local et fait basculer toute la fenetre de semaine.
    // La date nue est donc ancree a midi local, comme `weekKeyOf` et `toDateKey`.
    expect(joursDeLaSemaine("2026-08-09", "mon")).toEqual(
      joursDeLaSemaine("2026-08-09T12:00:00", "mon")
    );
    expect(joursDeLaSemaine("2026-08-09", "mon")[0]).toBe("2026-08-03");
    expect(joursDeLaSemaine("2026-08-09", "sun")[0]).toBe("2026-08-09");
  });
});

describe("compterSeancesFksSurJours", () => {
  const seances: SeanceDatee[] = [
    { completed: true, dateISO: "2026-08-03T10:00:00" }, // lundi
    { completed: true, dateISO: "2026-08-09T21:00:00" }, // dimanche
    { completed: false, dateISO: "2026-08-05T10:00:00" }, // planifiee, pas faite
    { completed: true, dateISO: "2026-07-31T10:00:00" }, // semaine precedente
    { completed: true, date: "2026-08-06" }, // champ `date` legacy
  ];

  it("compte les seances terminees de la fenetre, et rien d'autre", () => {
    const jours = joursDeLaSemaine("2026-08-05T12:00:00", "mon");
    expect(compterSeancesFksSurJours(seances, jours)).toBe(3);
  });

  it("une seance non terminee ne compte jamais", () => {
    expect(compterSeancesFksSurJours([{ completed: false, dateISO: "2026-08-05" }], ["2026-08-05"])).toBe(0);
  });

  it("une fenetre vide rend zero, pas la liste entiere", () => {
    expect(compterSeancesFksSurJours(seances, [])).toBe(0);
  });

  it("donne le meme chiffre que l'ancienne comparaison par weekKeyOf", () => {
    const nowISO = "2026-08-05T12:00:00";
    const ancien = seances.filter((s) => {
      if (!s.completed) return false;
      const v = s.dateISO ?? s.date;
      return v ? weekKeyOf(v) === weekKeyOf(nowISO) : false;
    }).length;
    expect(compterSeancesFksSurJours(seances, joursDeLaSemaine(nowISO, "mon"))).toBe(ancien);
  });
});

describe("estSeanceFksTerminee : UNE seule definition pour toute la couche de calcul", () => {
  // Le cas qui a motive le predicat unique : une seance legacy portant un
  // `feedback` sans `completed`. `selectPendingSession` la considere EN ATTENTE
  // (il filtre `!s.completed`) ; si le comptage la disait terminee, le meme objet
  // d'entree affirmerait qu'elle est faite ET qu'elle reste a faire.
  const legacy = { dateISO: "2026-08-05T10:00:00", feedback: { rpe: 7 } } as unknown as SeanceDatee;

  it("une seance sans `completed` n'est pas terminee, meme si elle porte un ressenti", () => {
    expect(estSeanceFksTerminee(legacy)).toBe(false);
    expect(estSeanceFksTerminee({ completed: true, dateISO: "2026-08-05" })).toBe(true);
    expect(estSeanceFksTerminee(null)).toBe(false);
    expect(estSeanceFksTerminee(undefined)).toBe(false);
  });

  it("le comptage hebdo et le comptage de jours observes tranchent PAREIL", () => {
    const jours = joursDeLaSemaine("2026-08-05T12:00:00", "mon");
    expect(compterSeancesFksSurJours([legacy], jours)).toBe(0);
    expect(
      compterJoursObserves({
        nowISO: "2026-08-05T12:00:00",
        seances: [legacy],
        chargesExternes: [],
      })
    ).toBe(0);
  });
});

describe("resoudreObjectifHebdo : le declare gagne, et il n'y a pas de 2 par defaut", () => {
  it("prend le rythme declare au setup avant le reglage", () => {
    expect(
      resoudreObjectifHebdo({ targetFksSessionsPerWeek: 4, weeklyGoalReglage: 2 })
    ).toBe(4);
  });

  it("retombe sur le reglage quand rien n'est declare", () => {
    expect(
      resoudreObjectifHebdo({ targetFksSessionsPerWeek: null, weeklyGoalReglage: 3 })
    ).toBe(3);
  });

  it("rend null quand personne n'a rien dit — surtout pas 2", () => {
    expect(
      resoudreObjectifHebdo({ targetFksSessionsPerWeek: null, weeklyGoalReglage: null })
    ).toBeNull();
    expect(
      resoudreObjectifHebdo({ targetFksSessionsPerWeek: undefined, weeklyGoalReglage: undefined })
    ).toBeNull();
  });

  it("zero, negatif et NaN sont des champs vides, pas des objectifs", () => {
    expect(resoudreObjectifHebdo({ targetFksSessionsPerWeek: 0, weeklyGoalReglage: null })).toBeNull();
    expect(resoudreObjectifHebdo({ targetFksSessionsPerWeek: -3, weeklyGoalReglage: null })).toBeNull();
    expect(resoudreObjectifHebdo({ targetFksSessionsPerWeek: NaN, weeklyGoalReglage: 2 })).toBe(2);
  });
});

describe("compterJoursObserves : ce que l'app a VU, pas ce qu'elle a deduit", () => {
  const nowISO = "2026-08-10T12:00:00";

  it("compte les jours distincts, pas les enregistrements", () => {
    const n = compterJoursObserves({
      nowISO,
      seances: [
        { completed: true, dateISO: "2026-08-09T10:00:00" },
        { completed: true, dateISO: "2026-08-09T18:00:00" }, // meme jour
        { completed: true, dateISO: "2026-08-05T10:00:00" },
      ],
      chargesExternes: [],
    });
    expect(n).toBe(2);
  });

  it("une charge externe MANUELLE fait un jour observe", () => {
    const n = compterJoursObserves({
      nowISO,
      seances: [],
      chargesExternes: [{ id: "k3f9a", dateISO: "2026-08-08T12:00:00.000Z" }],
    });
    expect(n).toBe(1);
  });

  it("une charge club/match AUTO-INJECTEE n'en fait pas un", () => {
    const n = compterJoursObserves({
      nowISO,
      seances: [],
      chargesExternes: [{ id: "auto_club_2026-08-08", dateISO: "2026-08-08T12:00:00.000Z" }],
    });
    expect(n).toBe(0);
  });

  it("ne regarde pas au-dela de sa fenetre", () => {
    const n = compterJoursObserves({
      nowISO,
      fenetreJours: 7,
      seances: [{ completed: true, dateISO: "2026-06-01T10:00:00" }],
      chargesExternes: [],
    });
    expect(n).toBe(0);
  });

  it("la fenetre par defaut est celle que la carte annonce au joueur", () => {
    expect(FENETRES_RESUME.charge.jours).toBe(30);
  });

  it("estChargeExterneManuelle suit le marquage reel d'applyExternalLoad", () => {
    expect(estChargeExterneManuelle({ id: "auto_match_2026-08-08" })).toBe(false);
    expect(estChargeExterneManuelle({ id: "auto_club_2026-08-08" })).toBe(false);
    expect(estChargeExterneManuelle({ id: "abc123" })).toBe(true);
    expect(estChargeExterneManuelle({})).toBe(false);
  });
});

describe("les fenetres sont nommees, et branchees sur le moteur", () => {
  it("la fenetre de suivi recite TRACKING_CONFIG, elle ne la recopie pas", () => {
    expect(FENETRES_RESUME.suiviRecent.seancesMax).toBe(TRACKING_CONFIG.window.sessions);
    expect(FENETRES_RESUME.suiviRecent.jours).toBe(TRACKING_CONFIG.window.days);
  });

  it("« suivies » et « terminees » portent deux libelles distincts", () => {
    expect(FENETRES_RESUME.suiviRecent.libelle).not.toBe(FENETRES_RESUME.cumul.libelle);
  });
});

describe("construireResumeHebdo assemble les deux moities", () => {
  it("un numerateur, une cible, et la fenetre qui les explique", () => {
    const resume = construireResumeHebdo({
      nowISO: "2026-08-05T12:00:00",
      debutDeSemaine: "mon",
      seances: [
        { completed: true, dateISO: "2026-08-03T10:00:00" },
        { completed: true, dateISO: "2026-08-04T10:00:00" },
      ],
      targetFksSessionsPerWeek: 3,
      weeklyGoalReglage: 2,
    });
    expect(resume).toEqual({
      faites: 2,
      objectif: 3,
      jours: joursDeLaSemaine("2026-08-05T12:00:00", "mon"),
    });
  });

  it("sans objectif declare, la fraction n'existe pas", () => {
    const resume = construireResumeHebdo({
      nowISO: "2026-08-05T12:00:00",
      debutDeSemaine: "mon",
      seances: [{ completed: true, dateISO: "2026-08-03T10:00:00" }],
      targetFksSessionsPerWeek: null,
      weeklyGoalReglage: null,
    });
    expect(resume.faites).toBe(1);
    expect(resume.objectif).toBeNull();
  });
});
