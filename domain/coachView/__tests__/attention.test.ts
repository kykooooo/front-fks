// domain/coachView/__tests__/attention.test.ts
// Règles d'attention : les seuils sont arbitrés, ces tests les VERROUILLENT.

import { aDesDonneesManquantes, buildAttentionSignals, RETARD_SEANCE_JOURS_CHECK } from "../attention";
import type { CoachPlayerFacts, CoachSignalCode } from "../types";
import { makeView } from "./fixtures";

const TODAY = "2026-07-27";

/** Faits minimaux : un joueur dont on ne sait rien. */
function facts(overrides: Partial<CoachPlayerFacts> = {}): CoachPlayerFacts {
  return {
    playerUid: "u1",
    prenom: "Anna",
    initiale: "A",
    categorieAge: "U15",
    poste: "Milieu",
    niveau: "Regional",
    profilComplet: true,
    derniereActivite: null,
    seancePrevue: null,
    seanceFaite: null,
    execution: null,
    ajustementsMoteur: [],
    datesSeancesFaites: [],
    assiduite: null,
    ...overrides,
  };
}

const seance = (dateKey: string | null) => ({
  dateKey,
  titre: "Renfo",
  focus: "Renfo / Force",
  intensite: "Modérée",
  dureeMin: 40,
  nbBlocs: 4,
});

const activite = (dateKey: string, joursEcoules: number) => ({
  dateKey,
  joursEcoules,
  libelle: "peu importe",
});

const codes = (out: { signaux: { code: CoachSignalCode }[] }) => out.signaux.map((s) => s.code);

describe("aucune donnée", () => {
  test("rien du tout → statut 'unknown' et signal explicite", () => {
    const out = buildAttentionSignals(facts(), TODAY);
    expect(out.statut).toBe("unknown");
    expect(codes(out)).toEqual(["aucune_donnee"]);
    expect(out.signaux[0].source).toBe("absent");
    expect(out.signaux[0].pourquoi.length).toBeGreaterThan(0);
  });

  test("une absence ne crée JAMAIS d'alerte", () => {
    const out = buildAttentionSignals(facts(), TODAY);
    expect(out.signaux.some((s) => s.level === "check" || s.level === "watch")).toBe(false);
  });
});

describe("séance prévue non faite", () => {
  test("prévue dans le passé, rien de fait depuis → check", () => {
    const out = buildAttentionSignals(
      facts({ seancePrevue: seance("2026-07-24"), datesSeancesFaites: ["2026-07-20"] }),
      TODAY,
    );
    expect(out.statut).toBe("check");
    expect(codes(out)).toContain("seance_prevue_non_faite");
  });

  // ── Seuil de retard (RETARD_SEANCE_JOURS_CHECK) ────────────────────────────
  // Le niveau HAUT ne doit jamais reposer sur un décalage d'un jour : en club
  // amateur, générer lundi et s'entraîner mercredi est le cas ordinaire. Ces
  // quatre cas figent la frontière et le "pourquoi" affiché, qui doit toujours
  // dire le NOMBRE RÉEL de jours.
  describe("seuil de retard", () => {
    const signal = (plannedKey: string) => {
      const out = buildAttentionSignals(
        facts({ seancePrevue: seance(plannedKey), datesSeancesFaites: ["2026-07-01"] }),
        TODAY,
      );
      return { out, s: out.signaux.find((x) => x.code === "seance_prevue_non_faite") ?? null };
    };

    test("le seuil est exporté et vaut 2 jours", () => {
      expect(RETARD_SEANCE_JOURS_CHECK).toBe(2);
    });

    test("J+0 (prévue aujourd'hui) → aucun signal de retard", () => {
      const { s } = signal(TODAY);
      expect(s).toBeNull();
    });

    test("J+1 → à surveiller, jamais à vérifier", () => {
      const { s } = signal("2026-07-26");
      expect(s?.level).toBe("watch");
      expect(s?.pourquoi).toContain("1 jour");
    });

    test("J+2 → à vérifier", () => {
      const { s } = signal("2026-07-25");
      expect(s?.level).toBe("check");
      expect(s?.pourquoi).toContain("2 jours");
    });

    test("J+5 → à vérifier, avec le nombre de jours réel", () => {
      const { s } = signal("2026-07-22");
      expect(s?.level).toBe("check");
      expect(s?.pourquoi).toContain("5 jours");
    });

    test("un seul jour de retard ne suffit pas à faire passer le joueur en 'check'", () => {
      const out = buildAttentionSignals(
        facts({
          seancePrevue: seance("2026-07-26"),
          datesSeancesFaites: ["2026-07-25"],
          derniereActivite: activite("2026-07-25", 2),
        }),
        TODAY,
      );
      expect(codes(out)).toContain("seance_prevue_non_faite");
      expect(out.statut).toBe("watch");
    });
  });

  test("prévue dans le passé MAIS faite depuis → aucun signal de ce type", () => {
    const out = buildAttentionSignals(
      facts({
        seancePrevue: seance("2026-07-24"),
        datesSeancesFaites: ["2026-07-25"],
        derniereActivite: activite("2026-07-25", 2),
      }),
      TODAY,
    );
    expect(codes(out)).not.toContain("seance_prevue_non_faite");
    expect(out.statut).toBe("normal");
  });

  test("prévue aujourd'hui ou demain → rien à signaler", () => {
    const out = buildAttentionSignals(
      facts({
        seancePrevue: seance("2026-07-28"),
        datesSeancesFaites: ["2026-07-26"],
        derniereActivite: activite("2026-07-26", 1),
      }),
      TODAY,
    );
    expect(codes(out)).not.toContain("seance_prevue_non_faite");
  });

  test("programme existant mais aucune séance jamais terminée → watch", () => {
    const out = buildAttentionSignals(facts({ seancePrevue: seance("2026-07-28") }), TODAY);
    expect(codes(out)).toContain("jamais_de_seance");
    expect(out.statut).toBe("watch");
  });
});

describe("inactivité", () => {
  test("5 à 9 jours → watch", () => {
    for (const jours of [5, 7, 9]) {
      const out = buildAttentionSignals(
        facts({
          derniereActivite: activite("2026-07-20", jours),
          datesSeancesFaites: ["2026-07-20"],
        }),
        TODAY,
      );
      expect(out.statut).toBe("watch");
      expect(codes(out)).toContain("inactif");
    }
  });

  test("10 jours ou plus, alors qu'une activité existait → check", () => {
    const out = buildAttentionSignals(
      facts({
        derniereActivite: activite("2026-07-15", 12),
        datesSeancesFaites: ["2026-07-15"],
      }),
      TODAY,
    );
    expect(out.statut).toBe("check");
    const signal = out.signaux.find((s) => s.code === "inactif");
    expect(signal?.titre).toBe("Sans séance depuis 12 jours");
    expect(signal?.source).toBe("calcule");
  });

  test("4 jours → rien", () => {
    const out = buildAttentionSignals(
      facts({ derniereActivite: activite("2026-07-23", 4), datesSeancesFaites: ["2026-07-23"] }),
      TODAY,
    );
    expect(codes(out)).not.toContain("inactif");
    expect(out.statut).toBe("normal");
  });
});

describe("exécution réelle", () => {
  const exec = (o: Partial<NonNullable<CoachPlayerFacts["execution"]>>) => ({
    pourcentage: null,
    statut: null,
    statutLibelle: null,
    fait: null,
    adapte: null,
    saute: null,
    remplace: null,
    remplaceEquivalent: null,
    remplacePartiel: null,
    total: null,
    raisons: [],
    ...o,
  });

  const base = {
    seanceFaite: seance("2026-07-26"),
    derniereActivite: activite("2026-07-26", 1),
    datesSeancesFaites: ["2026-07-26"],
  };

  test("séance interrompue → check", () => {
    const out = buildAttentionSignals(
      facts({ ...base, execution: exec({ statut: "interrompue" }) }),
      TODAY,
    );
    expect(out.statut).toBe("check");
    expect(codes(out)).toContain("seance_interrompue");
  });

  test("séance partielle → watch", () => {
    const out = buildAttentionSignals(
      facts({ ...base, execution: exec({ statut: "partielle", pourcentage: 60 }) }),
      TODAY,
    );
    expect(out.statut).toBe("watch");
    expect(out.signaux.find((s) => s.code === "seance_partielle")?.pourquoi).toContain("60 %");
  });

  test("3 exercices sautés → check, 2 → watch, 0 → rien", () => {
    expect(
      buildAttentionSignals(facts({ ...base, execution: exec({ saute: 3 }) }), TODAY).statut,
    ).toBe("check");
    expect(
      buildAttentionSignals(facts({ ...base, execution: exec({ saute: 2 }) }), TODAY).statut,
    ).toBe("watch");
    const zero = buildAttentionSignals(facts({ ...base, execution: exec({ saute: 0 }) }), TODAY);
    expect(codes(zero)).not.toContain("exercices_sautes");
  });

  test("2 exercices adaptés → watch, 1 → rien", () => {
    expect(
      buildAttentionSignals(facts({ ...base, execution: exec({ adapte: 2 }) }), TODAY).statut,
    ).toBe("watch");
    const un = buildAttentionSignals(facts({ ...base, execution: exec({ adapte: 1 }) }), TODAY);
    expect(codes(un)).not.toContain("exercices_adaptes");
  });

  test("les signaux d'exécution portent la source 'execution'", () => {
    const out = buildAttentionSignals(
      facts({ ...base, execution: exec({ statut: "partielle", saute: 1 }) }),
      TODAY,
    );
    for (const code of ["seance_partielle", "exercices_sautes"] as CoachSignalCode[]) {
      expect(out.signaux.find((s) => s.code === code)?.source).toBe("execution");
    }
  });
});

describe("retour après coupure", () => {
  test("reprise récente après 14 jours de trou → watch", () => {
    const out = buildAttentionSignals(
      facts({
        datesSeancesFaites: ["2026-07-26", "2026-07-05"],
        derniereActivite: activite("2026-07-26", 1),
      }),
      TODAY,
    );
    expect(codes(out)).toContain("retour_apres_coupure");
    expect(out.statut).toBe("watch");
  });

  test("trou trop court → pas de signal", () => {
    const out = buildAttentionSignals(
      facts({
        datesSeancesFaites: ["2026-07-26", "2026-07-20"],
        derniereActivite: activite("2026-07-26", 1),
      }),
      TODAY,
    );
    expect(codes(out)).not.toContain("retour_apres_coupure");
  });

  test("une seule date connue → on ne conclut rien", () => {
    const out = buildAttentionSignals(
      facts({ datesSeancesFaites: ["2026-07-26"], derniereActivite: activite("2026-07-26", 1) }),
      TODAY,
    );
    expect(codes(out)).not.toContain("retour_apres_coupure");
  });
});

describe("profil et moteur", () => {
  test("profil incomplet → watch, source 'declare'", () => {
    const out = buildAttentionSignals(facts({ profilComplet: false }), TODAY);
    expect(out.statut).toBe("watch");
    expect(out.signaux.find((s) => s.code === "profil_incomplet")?.source).toBe("declare");
  });

  test("ajustement moteur = information, jamais une alerte", () => {
    const out = buildAttentionSignals(
      facts({
        ajustementsMoteur: ["Volume réduit"],
        seancePrevue: seance("2026-07-28"),
        datesSeancesFaites: ["2026-07-26"],
        derniereActivite: activite("2026-07-26", 1),
      }),
      TODAY,
    );
    const signal = out.signaux.find((s) => s.code === "seance_ajustee_moteur");
    expect(signal?.level).toBe("normal");
    expect(signal?.source).toBe("moteur");
    expect(signal?.titre).toBe("Séance ajustée par FKS");
    expect(out.statut).toBe("normal");
  });
});

describe("statut global", () => {
  test("un empilement de 'watch' ne remonte JAMAIS en 'check'", () => {
    const out = buildAttentionSignals(
      facts({
        profilComplet: false,
        derniereActivite: activite("2026-07-20", 7),
        datesSeancesFaites: ["2026-07-20", "2026-06-25"],
        seanceFaite: seance("2026-07-20"),
        execution: {
          pourcentage: 55,
          statut: "partielle",
          statutLibelle: "Séance réalisée en partie",
          fait: 5,
          adapte: 3,
          saute: 2,
          remplace: 1,
          remplaceEquivalent: 0,
          remplacePartiel: 1,
          total: 11,
          raisons: ["Autre raison"],
        },
      }),
      TODAY,
    );
    expect(out.signaux.filter((s) => s.level === "watch").length).toBeGreaterThanOrEqual(4);
    expect(out.signaux.some((s) => s.level === "check")).toBe(false);
    expect(out.statut).toBe("watch");
  });

  test("un seul fait 'check' suffit à passer en 'check'", () => {
    const out = buildAttentionSignals(
      facts({
        seancePrevue: seance("2026-07-20"),
        datesSeancesFaites: ["2026-07-10"],
        derniereActivite: activite("2026-07-10", 17),
      }),
      TODAY,
    );
    expect(out.statut).toBe("check");
  });

  test("les signaux sont triés du plus urgent au moins urgent", () => {
    const out = buildAttentionSignals(
      facts({
        profilComplet: false,
        seancePrevue: seance("2026-07-24"),
        datesSeancesFaites: ["2026-07-10"],
        derniereActivite: activite("2026-07-10", 17),
      }),
      TODAY,
    );
    expect(out.signaux[0].level).toBe("check");
    expect(out.signaux[out.signaux.length - 1].level).toBe("watch");
  });

  test("chaque signal explique POURQUOI et d'où il vient", () => {
    const out = buildAttentionSignals(
      facts({
        profilComplet: false,
        seancePrevue: seance("2026-07-24"),
        derniereActivite: activite("2026-07-10", 17),
        datesSeancesFaites: ["2026-07-10"],
      }),
      TODAY,
    );
    for (const signal of out.signaux) {
      expect(signal.titre.trim().length).toBeGreaterThan(0);
      expect(signal.pourquoi.trim().length).toBeGreaterThan(0);
      expect(["declare", "execution", "moteur", "calcule", "absent"]).toContain(signal.source);
    }
  });

  test("aucun jargon technique dans les textes affichés", () => {
    const out = buildAttentionSignals(
      facts({
        profilComplet: false,
        seancePrevue: seance("2026-07-24"),
        derniereActivite: activite("2026-07-10", 17),
        datesSeancesFaites: ["2026-07-10"],
        ajustementsMoteur: ["Volume réduit"],
      }),
      TODAY,
    );
    const texte = out.signaux.map((s) => `${s.titre} ${s.pourquoi}`).join(" ").toLowerCase();
    for (const mot of ["tsb", "atl", "ctl", "rpe", "token", "score", "risque"]) {
      expect(texte).not.toContain(mot);
    }
  });
});

describe("intégration avec le modèle de lecture", () => {
  test("une projection minimale donne un statut 'unknown' exploitable", () => {
    const view = makeView({}, TODAY);
    expect(view.statut).toBe("unknown");
    expect(view.signaux.map((s) => s.code)).toEqual(["aucune_donnee"]);
  });
});

// ─── Honnêteté du statut : « parmi les données disponibles » ─────────────────
describe("données partielles (nuance de libellé, PAS un niveau de plus)", () => {
  /** Joueur dont on sait TOUT : exécution, assiduité, séance prévue, profil complet. */
  const completsSansSouci = (): Partial<CoachPlayerFacts> => ({
    profilComplet: true,
    seancePrevue: seance("2026-07-28"),
    seanceFaite: seance("2026-07-26"),
    derniereActivite: activite("2026-07-26", 1),
    datesSeancesFaites: ["2026-07-26"],
    assiduite: {
      faitesSur7j: 1,
      faitesSur14j: 1,
      jours: [{ dateKey: "2026-07-26", fait: true }],
    },
    execution: {
      pourcentage: 100,
      statut: "complete",
      statutLibelle: "Séance réalisée en entier",
      fait: 10,
      adapte: 0,
      saute: 0,
      remplace: 0,
      remplaceEquivalent: 0,
      remplacePartiel: 0,
      total: 10,
      raisons: [],
    },
  });

  test("tout est connu → statut normal SANS drapeau", () => {
    const out = buildAttentionSignals(facts(completsSansSouci()), TODAY);
    expect(out.statut).toBe("normal");
    expect(out.donneesPartielles).toBe(false);
  });

  test("exécution absente → drapeau levé, statut INCHANGÉ", () => {
    const out = buildAttentionSignals(facts({ ...completsSansSouci(), execution: null }), TODAY);
    expect(out.statut).toBe("normal");
    expect(out.donneesPartielles).toBe(true);
  });

  test("fenêtre d'activité absente → drapeau levé", () => {
    const out = buildAttentionSignals(facts({ ...completsSansSouci(), assiduite: null }), TODAY);
    expect(out.statut).toBe("normal");
    expect(out.donneesPartielles).toBe(true);
  });

  test("aucune séance prévue connue → drapeau levé", () => {
    const out = buildAttentionSignals(facts({ ...completsSansSouci(), seancePrevue: null }), TODAY);
    expect(out.donneesPartielles).toBe(true);
  });

  test("profil incomplet → drapeau levé", () => {
    const out = buildAttentionSignals(facts({ ...completsSansSouci(), profilComplet: false }), TODAY);
    expect(out.donneesPartielles).toBe(true);
  });

  test("aucune donnée du tout → drapeau levé, statut 'unknown' (pas un 5e niveau)", () => {
    const out = buildAttentionSignals(facts(), TODAY);
    expect(out.statut).toBe("unknown");
    expect(out.donneesPartielles).toBe(true);
  });

  test("le drapeau ne crée AUCUN niveau supplémentaire", () => {
    const partiel = buildAttentionSignals(facts({ ...completsSansSouci(), execution: null }), TODAY);
    const complet = buildAttentionSignals(facts(completsSansSouci()), TODAY);
    expect(["normal", "watch", "check", "unknown"]).toContain(partiel.statut);
    expect(partiel.statut).toBe(complet.statut);
    expect(partiel.signaux.map((s) => s.code)).toEqual(complet.signaux.map((s) => s.code));
  });

  test("le drapeau remonte jusqu'au modèle de lecture (toCoachPlayerView)", () => {
    expect(makeView({}, TODAY).donneesPartielles).toBe(true);
  });

  test("aDesDonneesManquantes est la MÊME règle que le drapeau", () => {
    const f = facts({ ...completsSansSouci(), assiduite: null });
    expect(aDesDonneesManquantes(f)).toBe(buildAttentionSignals(f, TODAY).donneesPartielles);
  });
});
