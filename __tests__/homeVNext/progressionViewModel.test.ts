// __tests__/homeVNext/progressionViewModel.test.ts
// =============================================================================
// PROTOTYPE Home vNext — VARIANTE 2 : tests de LOGIQUE PURE de la carte progression
// =============================================================================
//
// Ces tests ne rendent aucun composant. Ils verifient que `buildProgressionViewModel`
// respecte la doctrine d'honnetete :
//
//   R1  aucun defaut artificiel   R5  pas de courbe sans vrais points
//   R2  chiffres reellement mesures   R6  "serie"/"streak" banni
//   R3  portee obligatoire        R7  pas de doublon avec "Ma semaine"
//   R4  AUCUN etat global (D1)    R8  un seul aplat par ecran
//
// NOTE D'EXECUTION : la config jest du depot ignore `.claude/worktrees/`
// (`testPathIgnorePatterns`) — depuis ce worktree, `npx jest` liste 0 test et
// sort en SUCCES. Lancer avec la config dediee :
//   npx jest --config prototype/home-vnext/jest.proto.config.js
// =============================================================================

import {
  buildProgressionViewModel,
  choisirChampRepere,
  choisirRepereTest,
  construireComparaisonsTests,
  PROGRESSION_MAPPING_CYCLES,
  PROGRESSION_ORDRE_DEPARTAGE,
  PROGRESSION_SEUILS,
  PROGRESSION_SEANCES_MIN_POUR_TENDANCE,
  PROGRESSION_POINTS_MIN_POUR_COURBE,
  PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE,
  PROGRESSION_TEST_PAR_CYCLE,
  PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP,
  type ProgressionCandidatRepere,
  type ProgressionFait,
  type ProgressionInput,
  type ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";
import { MICROCYCLES, type MicrocycleId } from "../../domain/microcycles";
import { CORE_FIELD_KEYS, FIELD_DEFS, type FieldKey } from "../../screens/tests/testConfig";
import { SEANCES_MIN_POUR_TENDANCE, POINTS_MIN_POUR_COURBE } from "../../screens/homeVNext/viewModel";
import {
  PROGRESSION_FIXTURES,
  PROGRESSION_FIXTURES_RENDU,
  getProgressionFixture,
  type ProgressionFixture,
} from "../../screens/homeVNext/fixtures";
import type { TestEntry } from "../../screens/tests/testConfig";
import { LIBELLES_ETAT_INTERDITS } from "./libellesEtatInterdits";

// -----------------------------------------------------------------------------
// Outils
// -----------------------------------------------------------------------------

/** Meme motif que le test du Home : ni le mot, ni la metrique (R6). */
const MOTIF_SERIE_INTERDIT = /(streak|s[eé]ries?\b|jours d'affil)/i;

/** Placeholders interdits par R1 : on omet le fait, on ne le remplace pas. */
const MOTIF_PLACEHOLDER_INTERDIT = /^(0|0 min|0 minutes?|--|—|-)$/;

function cloner(input: ProgressionInput): ProgressionInput {
  return JSON.parse(JSON.stringify(input)) as ProgressionInput;
}

function fixture(id: string): ProgressionFixture {
  const f = getProgressionFixture(id);
  if (!f) throw new Error(`fixture de progression introuvable : ${id}`);
  return f;
}

function vmDe(id: string): ProgressionViewModel {
  return buildProgressionViewModel(fixture(id).input);
}

/** Tous les faits affichables du ViewModel, quel que soit l'etat. */
function tousLesFaits(vm: ProgressionViewModel): ProgressionFait[] {
  if (vm.state === "collecting") return [...vm.faits];
  if (vm.state === "ready") return [vm.resume];
  return [];
}

const toutesLesFixtures = (): ProgressionFixture[] => [...PROGRESSION_FIXTURES_RENDU];

// `avecChargesCapturees` a ete SUPPRIME avec le champ qu'il servait a construire
// (`libelleEtatGlobal`). Basculer le booleen `chargesClubCapturees` se fait
// desormais par un simple `{ ...base, chargesClubCapturees: true }` — il n'y a
// plus de seconde forme d'entree a reconstruire, parce qu'il n'y a plus de
// libelle d'etat a porter (D1, §2 bis de progressionViewModel.ts).

/** Rejoue une entree en changeant le seul cycle actif. */
function avecCycle(base: ProgressionInput, microcycleGoal: MicrocycleId | null): ProgressionInput {
  return { ...cloner(base), microcycleGoal };
}

/** Le repere affiche, quel que soit l'etat (l'etat "empty" n'en porte pas). */
function repereDe(vm: ProgressionViewModel) {
  return vm.state === "empty" ? null : vm.repereTest;
}

// -----------------------------------------------------------------------------
// 1. Le contrat des fixtures
// -----------------------------------------------------------------------------

describe("Progression — contrat des fixtures", () => {
  it("expose les 6 cas de demonstration demandes, tous marques fictifs", () => {
    expect(PROGRESSION_FIXTURES).toHaveLength(6);
    const ids = PROGRESSION_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual([
      "nouveau-joueur",
      "deux-seances-tendance-indisponible",
      "tendance-disponible",
      "test-physique-ameliore",
      "test-physique-en-recul",
      "aucune-comparaison-de-test",
    ]);
    for (const f of PROGRESSION_FIXTURES_RENDU) {
      expect(f.__fictif).toBe(true);
      expect(f.titre.trim().length).toBeGreaterThan(0);
      expect(f.resume.trim().length).toBeGreaterThan(0);
    }
  });

  it("chaque fixture atterrit dans l'etat attendu", () => {
    expect(vmDe("nouveau-joueur").state).toBe("empty");
    expect(vmDe("deux-seances-tendance-indisponible").state).toBe("collecting");
    expect(vmDe("tendance-disponible").state).toBe("ready");
    expect(vmDe("test-physique-ameliore").state).toBe("ready");
    // "collecting" et non "ready" : un ecart de test peut exister AVANT qu'une
    // tendance soit calculable — passer une batterie ne demande aucune seance FKS.
    expect(vmDe("test-physique-en-recul").state).toBe("collecting");
    expect(vmDe("aucune-comparaison-de-test").state).toBe("ready");
    expect(vmDe("donnee-manquante").state).toBe("collecting");
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — fonction pure : deux appels donnent le meme resultat",
    (_id, f) => {
      const a = buildProgressionViewModel(f.input);
      const b = buildProgressionViewModel(f.input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  );
});

// -----------------------------------------------------------------------------
// 2. Les trois etats
// -----------------------------------------------------------------------------

describe("Progression — etat 'empty'", () => {
  const vm = vmDe("nouveau-joueur");

  it("affiche le titre, les trois reperes numerotes et la mention honnete", () => {
    if (vm.state !== "empty") throw new Error("etat attendu : empty");
    expect(vm.titre).toBe("TA PROGRESSION DÉMARRE ICI");
    expect(vm.reperes.map((r) => r.numero)).toEqual([1, 2, 3]);
    expect(vm.reperes.map((r) => r.texte)).toEqual([
      "Termine ta première séance.",
      "Partage ton ressenti.",
      "Compare tes prochains tests.",
    ]);
    expect(vm.mention).toBe("0 séance terminée — tes premiers repères apparaîtront ici.");
  });

  it("n'a AUCUN graphique et AUCUN deuxieme aplat", () => {
    expect(vm.courbe).toBeNull();
    expect(vm.detail.affiche).toBe(false);
    expect(vm.detail.emphasis).toBe("lien_secondaire");
  });

  it("n'expose ni faits ni comparaison de tests : ces champs n'existent pas dans cet etat", () => {
    // Par construction : la variante "empty" du type ne porte pas ces champs,
    // le composant ne peut donc pas les afficher meme par erreur.
    expect("faits" in vm).toBe(false);
    expect("comparaisonsTests" in vm).toBe(false);
    expect("resume" in vm).toBe(false);
  });
});

describe("Progression — etat 'collecting'", () => {
  const vm = vmDe("deux-seances-tendance-indisponible");

  it("liste des faits reellement mesures, dans l'ordre attendu", () => {
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm.faits.map((f) => f.cle)).toEqual([
      "seances_terminees",
      "minutes_realisees",
      "ressentis_enregistres",
      "avant_tendance",
    ]);
    expect(vm.faits.map((f) => f.valeur)).toEqual(["2", "76 min", "2", "Encore 2 séances"]);
  });

  it("les 76 minutes sont la SOMME reelle des durees, pas une moyenne ni une estimation", () => {
    const f = fixture("deux-seances-tendance-indisponible");
    const somme = f.input.seancesTerminees.reduce((t, s) => t + (s.dureeMin ?? 0), 0);
    expect(somme).toBe(76);
    const fait = tousLesFaits(vm).find((x) => x.cle === "minutes_realisees");
    expect(fait?.valeur).toBe(`${somme} min`);
  });

  it("aucun graphique, aucun bouton de detail", () => {
    expect(vm.courbe).toBeNull();
    expect(vm.detail.affiche).toBe(false);
  });

  it("le dernier fait est CALCULE depuis le seuil, jamais code en dur", () => {
    const base = fixture("deux-seances-tendance-indisponible").input;

    // Avec une seule seance, il en manque une de plus.
    const uneSeule: ProgressionInput = {
      ...cloner(base),
      seancesTerminees: [base.seancesTerminees[0]],
    };
    const vm1 = buildProgressionViewModel(uneSeule);
    if (vm1.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm1.tendanceIndisponible.manque).toBe(PROGRESSION_SEANCES_MIN_POUR_TENDANCE - 1);
    expect(vm1.faits.find((f) => f.cle === "avant_tendance")?.valeur).toBe(
      `Encore ${PROGRESSION_SEANCES_MIN_POUR_TENDANCE - 1} séances`
    );

    // Et le pluriel suit le calcul, il n'est pas fige.
    const troisSeances: ProgressionInput = {
      ...cloner(base),
      seancesTerminees: [
        ...base.seancesTerminees,
        { id: "s3", dateKey: "2026-07-29", dureeMin: 30, ressentiEnregistre: true },
      ],
    };
    const vm3 = buildProgressionViewModel(troisSeances);
    if (vm3.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm3.tendanceIndisponible.manque).toBe(1);
    expect(vm3.faits.find((f) => f.cle === "avant_tendance")?.valeur).toBe("Encore 1 séance");
  });

  it("dit la VRAIE raison quand ce sont les jours enregistres qui bloquent, pas les seances", () => {
    const base = cloner(fixture("tendance-disponible").input);
    const input: ProgressionInput = {
      ...base,
      tendance: base.tendance ? { ...base.tendance, joursObserves: 1 } : null,
    };
    const vm2 = buildProgressionViewModel(input);
    if (vm2.state !== "collecting") throw new Error("etat attendu : collecting");
    // Le joueur a 7 seances : annoncer "Encore -3 seances" serait absurde.
    expect(vm2.tendanceIndisponible.raison).toBe("pas_assez_de_jours_observes");
    expect(vm2.tendanceIndisponible.manque).toBe(PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE - 1);
    expect(vm2.faits.find((f) => f.cle === "avant_tendance")?.valeur).toContain("jours enregistrés");
  });
});

describe("Progression — etat 'ready'", () => {
  const vm = vmDe("tendance-disponible");

  it("trace la courbe avec exactement les points fournis, et rien d'autre", () => {
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    const attendus = (fixture("tendance-disponible").input.tendance?.points ?? []).map((p) => p.value);
    expect(vm.courbe.points).toEqual(attendus);
    expect(vm.courbe.joursObserves).toBe(
      fixture("tendance-disponible").input.tendance?.joursObserves
    );
  });

  it("porte sa PORTEE exacte (R3) : jamais presentee comme l'etat physique global", () => {
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.courbe.portee.trim().length).toBeGreaterThan(0);
    expect(vm.courbe.portee).toContain("FKS");
    expect(vm.courbe.portee.toLowerCase()).toContain("club");
    expect(vm.courbe.periodeLabel).toBe("7 derniers jours");
  });

  it("affiche un resume complementaire reel", () => {
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.resume.cle).toBe("seances_terminees");
    expect(vm.resume.valeur).toBe("7");
  });

  it("affiche le lien de detail, en lien secondaire et jamais en aplat (R8)", () => {
    expect(vm.detail.affiche).toBe(true);
    // Le libelle NOMME sa destination. Il disait « Voir le détail » — mot pour
    // mot ce que porte deja le lien secondaire sous l'action du jour, qui ouvre
    // LA SEANCE. Deux cibles tactiles, le meme texte visible, deux destinations :
    // c'est le joueur qui lisait l'ecran qui ne pouvait pas s'en sortir.
    expect(vm.detail.label).toBe("Voir ma progression");
    expect(vm.detail.target).toBe("progression");
    expect(vm.detail.emphasis).toBe("lien_secondaire");
    expect(vm.detail.reserve).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3. R1 — aucun defaut artificiel
// -----------------------------------------------------------------------------

describe("Progression — R1 : un fait inconnu disparait, il n'est pas remplace", () => {
  it("sans aucune duree ni ressenti connus, les deux faits disparaissent", () => {
    const vm = vmDe("donnee-manquante");
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const cles = vm.faits.map((f) => f.cle);
    expect(cles).not.toContain("minutes_realisees");
    expect(cles).not.toContain("ressentis_enregistres");
    // Ce qui reste est vrai : 3 seances, et ce qui manque avant la tendance.
    expect(cles).toEqual(["seances_terminees", "avant_tendance"]);
    expect(vm.protoWarnings.some((w) => w.startsWith("R1 :"))).toBe(true);
  });

  it("une seule seance chronometree sur trois : le total ne couvre que celles-la, et le dit", () => {
    const base = cloner(fixture("donnee-manquante").input);
    const input: ProgressionInput = {
      ...base,
      seancesTerminees: [
        { ...base.seancesTerminees[0], dureeMin: 42 },
        base.seancesTerminees[1],
        base.seancesTerminees[2],
      ],
    };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const minutes = vm.faits.find((f) => f.cle === "minutes_realisees");
    expect(minutes?.valeur).toBe("42 min");
    // Le libelle porte la restriction : on n'affirme pas que c'est le total.
    expect(minutes?.libelle).toContain("1 séance chronométrée");
    expect(vm.protoWarnings.some((w) => w.startsWith("R2 :"))).toBe(true);
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — aucun fait n'affiche 0, '--' ou un tiret de remplissage",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      for (const fait of tousLesFaits(vm)) {
        expect(MOTIF_PLACEHOLDER_INTERDIT.test(fait.valeur.trim())).toBe(false);
      }
    }
  );

  it("zero ressenti n'est jamais affiche comme un fait", () => {
    const base = cloner(fixture("deux-seances-tendance-indisponible").input);
    const input: ProgressionInput = {
      ...base,
      seancesTerminees: base.seancesTerminees.map((s) => ({ ...s, ressentiEnregistre: false })),
    };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm.faits.map((f) => f.cle)).not.toContain("ressentis_enregistres");
  });
});

// -----------------------------------------------------------------------------
// 4. R4 / D1 — AUCUN etat physique global, quelle que soit l'entree
// -----------------------------------------------------------------------------
// CE QUE CETTE SECTION VERIFIAIT AVANT, ET POURQUOI ELLE A CHANGE DE SENS.
// Elle verifiait un verrou CONDITIONNEL : « pas d'etat global tant que les
// charges club sont inconnues », avec un test qui exigeait le retour de « En
// forme » des que `chargesClubCapturees` passait a `true`.
//
// Le fondateur a tranche autrement (D1, 2026-07-28) : le modele de charge part
// encore de valeurs initiales artificielles (ATL0/CTL0), donc aucun drapeau
// d'entree ne peut rendre ce libelle honnete aujourd'hui. Le champ d'entree
// `libelleEtatGlobal` et le champ de sortie `etatGlobal` ont ete SUPPRIMES du
// contrat. Les tests ci-dessous verifient donc l'absence, y compris sous
// falsification volontaire de l'entree.
// -----------------------------------------------------------------------------

describe("Progression — D1 : aucun jugement global ne peut sortir de cette carte", () => {
  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — le ViewModel ne porte aucun champ d'etat global",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      // Le type ne declare plus `etatGlobal` ; on verifie qu'aucune cle du genre
      // ne subsiste a l'execution (un champ oublie dans un `return` passerait le
      // compilateur en trop-plein d'objet litteral, pas ce test).
      expect(Object.keys(vm)).not.toContain("etatGlobal");
      expect(vm.protoWarnings.some((w) => w.startsWith("D1 "))).toBe(true);
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — aucun libelle de jugement global dans les champs affiches",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      // Les `protoWarnings` sont exclus : ils sont destines au visualiseur, et
      // c'est leur role de NOMMER les libelles interdits pour dire ce qui a ete
      // retire. Tout le reste est du texte d'ecran.
      const affichable = { ...vm, protoWarnings: [] };
      const corpus = JSON.stringify(affichable);
      for (const interdit of LIBELLES_ETAT_INTERDITS) {
        expect(corpus).not.toContain(interdit);
      }
    }
  );

  it("un libelle force par un cast n'a plus AUCUN chemin vers la sortie", () => {
    // Le compilateur refuse deja ce champ : il n'existe plus dans
    // `ProgressionInput`. Ce test prouve qu'a l'execution non plus rien ne passe
    // — un appelant JavaScript (le visualiseur du prototype en est un) ne peut
    // pas le faire ressortir par la porte de service.
    const base = cloner(fixture("tendance-disponible").input);
    const triche = {
      ...base,
      chargesClubCapturees: true,
      libelleEtatGlobal: "En forme",
    } as unknown as ProgressionInput;
    const vm = buildProgressionViewModel(triche);
    const affichable = { ...vm, protoWarnings: [] };
    expect(JSON.stringify(affichable)).not.toContain("En forme");
    expect(JSON.stringify(affichable)).not.toContain("Prêt à performer");
  });

  it("`chargesClubCapturees` ne pilote plus que la PORTEE de la courbe (R3)", () => {
    // Le booleen reste — ce n'est pas un jugement, c'est ce qui permet de dire
    // honnetement ce que la courbe contient. On verifie qu'il ne fait que ca.
    const base = cloner(fixture("tendance-disponible").input);
    const sansClub = buildProgressionViewModel({ ...base, chargesClubCapturees: false });
    const avecClub = buildProgressionViewModel({ ...base, chargesClubCapturees: true });
    if (sansClub.state !== "ready" || avecClub.state !== "ready") {
      throw new Error("etat attendu : ready");
    }
    expect(sansClub.courbe.portee).toContain("n'y sont pas comptés");
    expect(avecClub.courbe.portee).toContain("charges club");
    expect(avecClub.courbe.portee).not.toContain("n'y sont pas comptés");

    // Et RIEN d'autre ne bouge : les deux ViewModels sont identiques une fois la
    // portee mise de cote.
    const sansPortee = (vm: typeof sansClub) =>
      JSON.stringify({ ...vm, courbe: { ...vm.courbe, portee: "" } });
    expect(sansPortee(avecClub)).toBe(sansPortee(sansClub));
  });
});

// -----------------------------------------------------------------------------
// 5. R5 — aucune courbe sans vrais points
// -----------------------------------------------------------------------------

describe("Progression — R5 : la courbe repose sur de vrais points observes", () => {
  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — hors de l'etat 'ready', la courbe est structurellement nulle",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      if (vm.state !== "ready") expect(vm.courbe).toBeNull();
    }
  );

  it("assez de points mais trop peu de jours enregistres : aucune courbe", () => {
    const base = cloner(fixture("tendance-disponible").input);
    const input: ProgressionInput = {
      ...base,
      tendance: base.tendance
        ? { ...base.tendance, joursObserves: PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE - 1 }
        : null,
    };
    const vm = buildProgressionViewModel(input);
    expect(vm.state).toBe("collecting");
    expect(vm.courbe).toBeNull();
    expect(
      vm.protoWarnings.some((w) => w.includes("elle n'est PAS tracee"))
    ).toBe(true);
  });

  it("trop peu de points : aucune courbe, meme avec beaucoup de jours enregistres", () => {
    const base = cloner(fixture("tendance-disponible").input);
    const input: ProgressionInput = {
      ...base,
      tendance: base.tendance
        ? {
            points: base.tendance.points.slice(0, PROGRESSION_POINTS_MIN_POUR_COURBE - 1),
            joursObserves: 30,
          }
        : null,
    };
    const vm = buildProgressionViewModel(input);
    expect(vm.state).toBe("collecting");
    expect(vm.courbe).toBeNull();
  });

  it("aucune trajectoire fournie : aucune courbe, et on ne quantifie pas ce qu'on ignore", () => {
    const base = cloner(fixture("tendance-disponible").input);
    const input: ProgressionInput = { ...base, tendance: null };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm.courbe).toBeNull();
    expect(vm.tendanceIndisponible.raison).toBe("aucun_point_fourni");
    expect(vm.tendanceIndisponible.manque).toBeNull();
  });

  it("aucun point n'est fabrique pour boucher un trou", () => {
    const f = fixture("test-physique-ameliore");
    const vm = buildProgressionViewModel(f.input);
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.courbe.points).toHaveLength(f.input.tendance?.points.length ?? -1);
    expect(vm.courbe.points).toEqual(f.input.tendance?.points.map((p) => p.value));
  });
});

// -----------------------------------------------------------------------------
// 6. R7 — jamais le nombre que "Ma semaine" affiche deja
// -----------------------------------------------------------------------------

describe("Progression — R7 : la carte ne repete pas le compteur de 'Ma semaine'", () => {
  it("en 'ready', le resume change de fait quand le cumul egale le nombre de la semaine", () => {
    const base = cloner(fixture("tendance-disponible").input);
    const cumul = base.seancesTerminees.length; // 7
    const input: ProgressionInput = {
      ...base,
      semaineCourante: { blocAffiche: true, seancesAffichees: cumul },
    };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.resume.cle).not.toBe("seances_terminees");
    expect(vm.resume.valeur).not.toBe(String(cumul));
    expect(vm.protoWarnings.some((w) => w.startsWith("R7 :"))).toBe(true);
  });

  it("en 'collecting', le fait en doublon est retire de la liste", () => {
    const base = cloner(fixture("deux-seances-tendance-indisponible").input);
    const input: ProgressionInput = {
      ...base,
      semaineCourante: { blocAffiche: true, seancesAffichees: 2 },
    };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    // "2 seances terminees" ET "2 ressentis enregistres" affichent tous deux 2.
    expect(vm.faits.map((f) => f.cle)).toEqual(["minutes_realisees", "avant_tendance"]);
  });

  it("quand 'Ma semaine' n'est pas affiche, aucun fait n'est retire", () => {
    const base = cloner(fixture("deux-seances-tendance-indisponible").input);
    const input: ProgressionInput = {
      ...base,
      semaineCourante: { blocAffiche: false, seancesAffichees: 2 },
    };
    const vm = buildProgressionViewModel(input);
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(vm.faits.map((f) => f.cle)).toContain("seances_terminees");
    expect(vm.protoWarnings.some((w) => w.startsWith("R7 :"))).toBe(false);
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — aucun fait affiche n'est le nombre deja montre par 'Ma semaine'",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      if (!f.input.semaineCourante.blocAffiche) return;
      const deja = String(f.input.semaineCourante.seancesAffichees);
      for (const fait of tousLesFaits(vm)) {
        // `avant_tendance` est un reste a parcourir, pas un compteur d'etat :
        // son libelle le dit, il echappe volontairement au garde-fou.
        if (fait.cle === "avant_tendance") continue;
        expect(fait.valeur).not.toBe(deja);
      }
    }
  );
});

// -----------------------------------------------------------------------------
// 7. La comparaison de tests
// -----------------------------------------------------------------------------

describe("Progression — comparaison de tests", () => {
  it("comparaison POSSIBLE : deux batteries a deux dates, ecarts reellement mesures", () => {
    const vm = vmDe("test-physique-ameliore");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    if (!vm.comparaisonsTests.possible) throw new Error("comparaison attendue possible");
    const parChamp = Object.fromEntries(
      vm.comparaisonsTests.comparaisons.map((c) => [c.champ, c])
    );
    expect(Object.keys(parChamp).sort()).toEqual(["broadJumpCm", "sprint10s", "test505_s"]);

    // Plus grand = mieux.
    expect(parChamp.broadJumpCm.plusPetitEstMieux).toBe(false);
    expect(parChamp.broadJumpCm.ecart).toBe(9);
    expect(parChamp.broadJumpCm.ecartAffiche).toBe("+9 cm");
    expect(parChamp.broadJumpCm.sens).toBe("amelioration");

    // Plus PETIT = mieux : un ecart negatif est une amelioration.
    expect(parChamp.sprint10s.plusPetitEstMieux).toBe(true);
    expect(parChamp.sprint10s.ecart).toBeLessThan(0);
    expect(parChamp.sprint10s.ecartAffiche).toBe("-0.07 s");
    expect(parChamp.sprint10s.sens).toBe("amelioration");

    expect(parChamp.test505_s.sens).toBe("amelioration");
  });

  it("un champ present dans une seule batterie n'est PAS compare", () => {
    const vm = vmDe("test-physique-ameliore");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    if (!vm.comparaisonsTests.possible) throw new Error("comparaison attendue possible");
    expect(vm.comparaisonsTests.comparaisons.map((c) => c.champ)).not.toContain(
      "endurance6min_m"
    );
  });

  it("comparaison IMPOSSIBLE : deux valeurs du meme jour ne sont pas une progression", () => {
    const vm = vmDe("aucune-comparaison-de-test");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.comparaisonsTests.possible).toBe(false);
    if (vm.comparaisonsTests.possible) throw new Error("impossible");
    expect(vm.comparaisonsTests.raison).toBe("aucune_paire_comparable");
    expect(vm.comparaisonsTests.explication.trim().length).toBeGreaterThan(0);
    expect(vm.repereTest).toBeNull();
    // La fixture porte bien deux valeurs du meme champ, le meme jour.
    const memeChamp = fixture("aucune-comparaison-de-test").input.testsTerrain.filter(
      (e) => typeof e.endurance6min_m === "number"
    );
    expect(memeChamp).toHaveLength(PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP);
    // Et deux champs n'ont qu'UNE SEULE mesure : rien a comparer, par definition.
    for (const champ of ["broadJumpCm", "sprint10s"] as const) {
      const mesures = fixture("aucune-comparaison-de-test").input.testsTerrain.filter(
        (e) => typeof e[champ] === "number"
      );
      expect(mesures).toHaveLength(1);
    }
  });

  it("aucun test enregistre / un seul test enregistre : deux raisons distinctes", () => {
    expect(construireComparaisonsTests([])).toMatchObject({
      possible: false,
      raison: "aucun_test_enregistre",
    });
    expect(
      construireComparaisonsTests([{ ts: Date.UTC(2026, 6, 20, 10), broadJumpCm: 210 }])
    ).toMatchObject({ possible: false, raison: "un_seul_test_enregistre" });
  });

  it("une valeur identique n'est PAS une regression", () => {
    const tests: TestEntry[] = [
      { ts: Date.UTC(2026, 5, 1, 10), broadJumpCm: 220 },
      { ts: Date.UTC(2026, 6, 1, 10), broadJumpCm: 220 },
    ];
    const etat = construireComparaisonsTests(tests);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    expect(etat.comparaisons[0].sens).toBe("identique");
    expect(etat.comparaisons[0].ecart).toBe(0);
    expect(etat.comparaisons[0].ecartAffiche).toBe("0 cm");
  });

  it("une vraie regression est nommee comme telle, dans les deux sens de lowerIsBetter", () => {
    const recul: TestEntry[] = [
      { ts: Date.UTC(2026, 5, 1, 10), broadJumpCm: 225, sprint10s: 1.75 },
      { ts: Date.UTC(2026, 6, 1, 10), broadJumpCm: 218, sprint10s: 1.82 },
    ];
    const etat = construireComparaisonsTests(recul);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    const parChamp = Object.fromEntries(etat.comparaisons.map((c) => [c.champ, c]));
    expect(parChamp.broadJumpCm.sens).toBe("regression");
    expect(parChamp.sprint10s.sens).toBe("regression");
  });

  it("le 1 km est lu en mm:ss, et son ecart reste en secondes", () => {
    const tests: TestEntry[] = [
      { ts: Date.UTC(2026, 5, 1, 10), run1km_s: 252 },
      { ts: Date.UTC(2026, 6, 1, 10), run1km_s: 240 },
    ];
    const etat = construireComparaisonsTests(tests);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    const c = etat.comparaisons[0];
    expect(c.avantAffiche).toBe("4:12");
    expect(c.apresAffiche).toBe("4:00");
    expect(c.ecartAffiche).toBe("-12 s");
    expect(c.sens).toBe("amelioration");
  });

  it("a defaut d'objectif de cycle, c'est la mesure la plus RECENTE, jamais la plus flatteuse", () => {
    const tests: TestEntry[] = [
      { ts: Date.UTC(2026, 6, 20, 10), sprint10s: 1.95 }, // recent, et c'est un recul
      { ts: Date.UTC(2026, 5, 1, 10), broadJumpCm: 240 }, // enorme progres, mais ancien
      { ts: Date.UTC(2026, 4, 1, 10), broadJumpCm: 200, sprint10s: 1.9 },
    ];
    const etat = construireComparaisonsTests(tests);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    // Cycle Fondation : aucun test associe (decision documentee), donc la regle 1
    // ne mord pas et la regle 2 doit trancher seule.
    const base = avecCycle(fixture("tendance-disponible").input, "fondation");
    const vm = buildProgressionViewModel({ ...base, testsTerrain: tests });
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.repereTest?.regle).toBe("mesure_la_plus_recente");
    expect(vm.repereTest?.comparaison.champ).toBe("sprint10s");
    expect(vm.repereTest?.comparaison.sens).toBe("regression");
  });

  it("signale les comparaisons que la page Progression ne saurait pas afficher", () => {
    const vm = vmDe("test-physique-ameliore");
    expect(
      vm.protoWarnings.some((w) => w.includes("TEST_FIELDS") && w.includes("Test 505"))
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // CE QUI EST REELLEMENT MONTRE, PAS SEULEMENT CE QUI EST CALCULE
  // ---------------------------------------------------------------------------
  // La carte n'affiche QU'UN repere. Une regle juste peut donc rester invisible.
  // Ces tests portent sur la DEMONSTRATION : ils verifient que les deux sens de
  // `lowerIsBetter` — et un RECUL — atteignent reellement l'ecran.
  //
  // L'iteration precedente obtenait ce resultat en fabriquant des horodatages
  // par exercice. C'est corrige : les fixtures sont au format reel (une batterie
  // = une entree, un `ts`), et c'est la REGLE de selection qui designe le repere.
  // ---------------------------------------------------------------------------

  it("« Test physique ameliore » MONTRE le chrono qui baisse, parce que le cycle le vise", () => {
    const vm = vmDe("test-physique-ameliore");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    const r = vm.repereTest;
    expect(r).not.toBeNull();
    expect(r!.regle).toBe("objectif_du_cycle");
    expect(r!.comparaison.champ).toBe("sprint10s");
    // Un ecart NEGATIF, presente comme un PROGRES : le cas qui distingue une app
    // qui a compris le sport d'une app qui aligne des soustractions.
    expect(r!.comparaison.plusPetitEstMieux).toBe(true);
    expect(r!.comparaison.ecart).toBeLessThan(0);
    expect(r!.comparaison.ecartAffiche).toBe("-0.07 s");
    expect(r!.comparaison.sens).toBe("amelioration");
    // Le saut en longueur reste calcule — il n'est simplement plus celui que la
    // carte met en avant.
    if (!vm.comparaisonsTests.possible) throw new Error("comparaisons attendues possibles");
    expect(vm.comparaisonsTests.comparaisons.map((x) => x.champ)).toContain("broadJumpCm");
  });

  it("« Test physique ameliore » : sans la regle 1, c'est le 505 qui sortirait — la regle mord donc vraiment", () => {
    const base = fixture("test-physique-ameliore").input;
    // Meme donnee, cycle sans test associe : la regle 2 prend la mesure la plus
    // recente, et le 505 a bien ete enregistre APRES la batterie.
    const vm = buildProgressionViewModel(avecCycle(base, "fondation"));
    expect(repereDe(vm)?.comparaison.champ).toBe("test505_s");
    expect(repereDe(vm)?.regle).toBe("mesure_la_plus_recente");
  });

  it("« Tendance disponible » MONTRE l'autre sens : plus grand = mieux, designe par le cycle Force", () => {
    const vm = vmDe("tendance-disponible");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    const r = vm.repereTest;
    expect(r).not.toBeNull();
    expect(r!.regle).toBe("objectif_du_cycle");
    expect(r!.comparaison.champ).toBe("broadJumpCm");
    expect(r!.comparaison.plusPetitEstMieux).toBe(false);
    expect(r!.comparaison.ecart).toBeGreaterThan(0);
    expect(r!.comparaison.sens).toBe("amelioration");
  });

  it("« Test physique en recul » MONTRE le recul, alors que deux ameliorations etaient disponibles", () => {
    const vm = vmDe("test-physique-en-recul");
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const r = vm.repereTest;
    expect(r).not.toBeNull();
    // Cycle Fondation : aucun test associe -> regle 2, egalite parfaite (une
    // batterie = un horodatage) -> regle 3.
    expect(r!.regle).toBe("mesure_la_plus_recente");
    expect(r!.departageApplique).toBe(true);
    expect(r!.comparaison.champ).toBe("sprint10s");
    expect(r!.comparaison.sens).toBe("regression");
    expect(r!.comparaison.ecart).toBeGreaterThan(0);
    // La preuve que rien n'a ete choisi pour flatter : deux ameliorations
    // existaient dans la meme batterie et n'ont pas ete preferees.
    if (!vm.comparaisonsTests.possible) throw new Error("comparaisons attendues possibles");
    const ameliorations = vm.comparaisonsTests.comparaisons.filter(
      (c) => c.sens === "amelioration"
    );
    expect(ameliorations.map((c) => c.champ).sort()).toEqual(["broadJumpCm", "endurance6min_m"]);
  });

  it("les DEUX sens de lowerIsBetter, ET un recul, sont affiches dans les cas de demonstration", () => {
    const affiches = toutesLesFixtures()
      .map((f) => repereDe(buildProgressionViewModel(f.input))?.comparaison ?? null)
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    expect(affiches.some((c) => c.plusPetitEstMieux && c.ecart < 0 && c.sens === "amelioration")).toBe(
      true
    );
    expect(affiches.some((c) => !c.plusPetitEstMieux && c.ecart > 0 && c.sens === "amelioration")).toBe(
      true
    );
    expect(affiches.some((c) => c.sens === "regression")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 7 bis. LE FORMAT REEL DES ENTREES DE TESTS
// -----------------------------------------------------------------------------
// Les fixtures doivent avoir la forme EXACTE de ce que `screens/TestsScreen.tsx`
// ecrit. Sinon la demonstration montre un produit qui n'existe pas — la faute
// commise a l'iteration precedente, reparee ici.
// -----------------------------------------------------------------------------

describe("Progression — les fixtures respectent le format reel d'une entree de test", () => {
  const CLES_HORS_CHAMPS = new Set(["ts", "playlist", "notes"]);
  const estChampSocle = (k: string): boolean =>
    (CORE_FIELD_KEYS as readonly string[]).includes(k);

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — une batterie = UNE entree et UN horodatage ; un test optionnel est enregistre seul",
    (_id, f) => {
      for (const entree of f.input.testsTerrain) {
        const champs = Object.keys(entree).filter((k) => !CLES_HORS_CHAMPS.has(k));
        const socle = champs.filter(estChampSocle);
        const optionnels = champs.filter((k) => !estChampSocle(k));

        // `save` n'ecrit QUE des cles connues de FIELD_DEFS (TestsScreen:245-249).
        for (const champ of champs) {
          expect(FIELD_DEFS.map((d) => d.key as string)).toContain(champ);
        }

        if (optionnels.length > 0) {
          // Flux "un seul test" : exactement un champ, jamais melange au socle,
          // et jamais de notes (TestsScreen:212 + :250).
          expect({ id: _id, optionnels }).toEqual({ id: _id, optionnels: [optionnels[0]] });
          expect(socle).toHaveLength(0);
          expect(entree.notes).toBeUndefined();
        } else {
          // Flux batterie : 1 a 3 champs du socle, tous dans la MEME entree.
          expect(socle.length).toBeGreaterThanOrEqual(1);
          expect(socle.length).toBeLessThanOrEqual(CORE_FIELD_KEYS.length);
        }
      }
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — horodatages valides, distincts par enregistrement, et ordre decroissant",
    (_id, f) => {
      const ts = f.input.testsTerrain.map((e) => e.ts);
      for (const t of ts) {
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThan(0);
      }
      // Deux ENREGISTREMENTS distincts ne peuvent pas tomber sur la meme
      // milliseconde ; en revanche les champs d'une meme entree partagent le sien.
      expect(new Set(ts).size).toBe(ts.length);
      // `useTestsStorage` trie desc (:56) et `save` empile en tete (:253).
      expect([...ts].sort((a, b) => b - a)).toEqual(ts);
    }
  );

  it("la provenance `playlist` est un cycle canonique, et elle ne selectionne RIEN", () => {
    for (const f of toutesLesFixtures()) {
      for (const entree of f.input.testsTerrain) {
        if (entree.playlist === undefined) continue;
        expect(Object.keys(MICROCYCLES)).toContain(entree.playlist);
      }
      // Rejouer la meme fixture avec TOUTES les provenances reecrites ne change
      // pas le repere : `playlist` est un tag d'historique, pas un selecteur.
      const brouille: ProgressionInput = {
        ...cloner(f.input),
        testsTerrain: f.input.testsTerrain.map((e) => ({ ...e, playlist: "saison" as const })),
      };
      expect(repereDe(buildProgressionViewModel(brouille))?.comparaison.champ ?? null).toBe(
        repereDe(buildProgressionViewModel(f.input))?.comparaison.champ ?? null
      );
    }
  });
});

// -----------------------------------------------------------------------------
// 8. R8 + la decision du pied "Voir ma progression"
// -----------------------------------------------------------------------------

describe("Progression — le pied 'Voir ma progression'", () => {
  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — jamais un aplat, et un motif toujours renseigne",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      expect(vm.detail.emphasis).toBe("lien_secondaire");
      expect(vm.detail.motif.trim().length).toBeGreaterThan(0);
      if (vm.detail.affiche) {
        expect(vm.detail.label).toBe("Voir ma progression");
        expect(vm.detail.target).toBe("progression");
        expect(vm.detail.reserve).not.toBeNull();
      } else {
        expect(vm.detail.label).toBeNull();
        expect(vm.detail.target).toBeNull();
        expect(vm.detail.reserve).toBeNull();
      }
    }
  );

  it("verdict par etat : absent en 'empty' et 'collecting', present en 'ready'", () => {
    expect(vmDe("nouveau-joueur").detail.affiche).toBe(false);
    expect(vmDe("deux-seances-tendance-indisponible").detail.affiche).toBe(false);
    expect(vmDe("donnee-manquante").detail.affiche).toBe(false);
    expect(vmDe("tendance-disponible").detail.affiche).toBe(true);
    expect(vmDe("test-physique-ameliore").detail.affiche).toBe(true);
    expect(vmDe("aucune-comparaison-de-test").detail.affiche).toBe(true);
  });

  it("quand on y envoie le joueur, la reserve sur la destination est enregistree", () => {
    const vm = vmDe("tendance-disponible");
    expect(vm.detail.reserve).toContain("ATL0/CTL0");
    expect(vm.protoWarnings.some((w) => w.startsWith("Reserve sur la destination"))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 9. R6 — le vocabulaire banni
// -----------------------------------------------------------------------------

describe("Progression — R6 : ni le mot, ni la metrique", () => {
  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — aucune occurrence de 'serie' / 'streak' / 'jours d'affilee'",
    (_id, f) => {
      const vm = buildProgressionViewModel(f.input);
      expect(MOTIF_SERIE_INTERDIT.test(JSON.stringify(vm))).toBe(false);
    }
  );

  it("aucun champ du ViewModel ne compte des jours consecutifs", () => {
    const vm = vmDe("tendance-disponible");
    const cles = JSON.stringify(vm).toLowerCase();
    expect(cles).not.toContain("consecutif");
    expect(cles).not.toContain("record");
  });
});

// -----------------------------------------------------------------------------
// 10. Les seuils sont exposes, pas caches
// -----------------------------------------------------------------------------

describe("Progression — seuils d'affichage", () => {
  it("les quatre seuils sont exportes avec leur valeur et leur role", () => {
    expect(PROGRESSION_SEUILS).toHaveLength(4);
    const parNom = Object.fromEntries(PROGRESSION_SEUILS.map((s) => [s.nom, s.valeur]));
    expect(parNom.PROGRESSION_SEANCES_MIN_POUR_TENDANCE).toBe(
      PROGRESSION_SEANCES_MIN_POUR_TENDANCE
    );
    expect(parNom.PROGRESSION_POINTS_MIN_POUR_COURBE).toBe(PROGRESSION_POINTS_MIN_POUR_COURBE);
    expect(parNom.PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE).toBe(
      PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE
    );
    expect(parNom.PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP).toBe(
      PROGRESSION_TESTS_MIN_JOURS_PAR_CHAMP
    );
    for (const s of PROGRESSION_SEUILS) {
      expect(s.role.trim().length).toBeGreaterThan(0);
    }
  });

  it("les seuils de tendance sont les MEMES que ceux du bloc 'Ma forme' du Home", () => {
    // Deux seuils differents sur le meme ecran produiraient une carte qui dit
    // "pas encore de tendance" a cote d'un bloc qui en affiche une.
    expect(PROGRESSION_SEANCES_MIN_POUR_TENDANCE).toBe(SEANCES_MIN_POUR_TENDANCE);
    expect(PROGRESSION_POINTS_MIN_POUR_COURBE).toBe(POINTS_MIN_POUR_COURBE);
  });
});

// -----------------------------------------------------------------------------
// 11. LA REGLE DE SELECTION DU REPERE DE TEST (§5 bis du ViewModel)
// -----------------------------------------------------------------------------
// Trois regles, dans l'ordre :
//   1. le test que vise l'objectif du cycle actif ;
//   2. sinon, la mesure comparable la plus recente ;
//   3. a egalite d'horodatage, l'ordre de departage fige.
//
// Et une interdiction qui prime sur tout : la selection ne regarde JAMAIS le
// resultat. Les tests de la section "aveugle au resultat" echouent si quelqu'un
// introduit un jour un tri par "meilleure progression".
// -----------------------------------------------------------------------------

/** Deux batteries completes a deux dates. `ecarts` decide de ce que valent les tests. */
function deuxBatteries(ecarts: {
  broadJumpCm: number;
  sprint10s: number;
  endurance6min_m: number;
}): TestEntry[] {
  const avant = { broadJumpCm: 220, sprint10s: 1.82, endurance6min_m: 1350 };
  return [
    {
      ts: Date.UTC(2026, 6, 20, 10, 0),
      broadJumpCm: avant.broadJumpCm + ecarts.broadJumpCm,
      sprint10s: Number((avant.sprint10s + ecarts.sprint10s).toFixed(2)),
      endurance6min_m: avant.endurance6min_m + ecarts.endurance6min_m,
    },
    { ts: Date.UTC(2026, 5, 20, 10, 0), ...avant },
  ];
}

describe("Regle du repere — 1. l'objectif du cycle actif", () => {
  it("le mapping couvre les 5 cycles, chacun avec son fondement ecrit", () => {
    const cycles = Object.keys(MICROCYCLES) as MicrocycleId[];
    expect(PROGRESSION_MAPPING_CYCLES.map((l) => l.cycle)).toEqual(cycles);
    for (const ligne of PROGRESSION_MAPPING_CYCLES) {
      expect(ligne.libelleCycle).toBe(MICROCYCLES[ligne.cycle].label);
      // Un fondement ecrit, meme (et surtout) quand la reponse est "aucun test".
      expect(ligne.fondement.trim().length).toBeGreaterThan(40);
      if (ligne.champ !== null) {
        // Le repere se prend dans le SOCLE : les 3 tests que tout le monde passe.
        expect(CORE_FIELD_KEYS as readonly string[]).toContain(ligne.champ);
      }
    }
  });

  it("les cycles sans correspondance evidente tombent sur la regle 2, ils ne sont pas forces", () => {
    expect(PROGRESSION_TEST_PAR_CYCLE.fondation.champ).toBeNull();
    expect(PROGRESSION_TEST_PAR_CYCLE.saison.champ).toBeNull();
    // Et leur ligne dit pourquoi.
    expect(PROGRESSION_TEST_PAR_CYCLE.fondation.fondement).toMatch(/aucune correspondance/i);
    expect(PROGRESSION_TEST_PAR_CYCLE.saison.fondement).toMatch(/aucune correspondance/i);
  });

  it("Force -> saut en longueur, Endurance -> 6 min, Explosivite -> sprint 10 m", () => {
    expect(PROGRESSION_TEST_PAR_CYCLE.force.champ).toBe("broadJumpCm");
    expect(PROGRESSION_TEST_PAR_CYCLE.endurance.champ).toBe("endurance6min_m");
    expect(PROGRESSION_TEST_PAR_CYCLE.explosivite.champ).toBe("sprint10s");
  });

  it("la regle 1 passe AVANT la mesure la plus recente", () => {
    // Le 505 est enregistre apres la batterie : c'est lui, le plus recent.
    const tests: TestEntry[] = [
      { ts: Date.UTC(2026, 6, 20, 11, 0), test505_s: 2.44 },
      { ts: Date.UTC(2026, 6, 20, 10, 0), broadJumpCm: 231, sprint10s: 1.79, endurance6min_m: 1410 },
      { ts: Date.UTC(2026, 5, 20, 11, 0), test505_s: 2.51 },
      { ts: Date.UTC(2026, 5, 20, 10, 0), broadJumpCm: 224, sprint10s: 1.84, endurance6min_m: 1360 },
    ];
    const etat = construireComparaisonsTests(tests);
    for (const [cycle, attendu] of [
      ["force", "broadJumpCm"],
      ["endurance", "endurance6min_m"],
      ["explosivite", "sprint10s"],
    ] as const) {
      const r = choisirRepereTest(etat, cycle);
      expect({ cycle, champ: r?.comparaison.champ, regle: r?.regle }).toEqual({
        cycle,
        champ: attendu,
        regle: "objectif_du_cycle",
      });
    }
    // Sans cycle actif, ou sur un cycle sans test associe : la regle 2 reprend.
    expect(choisirRepereTest(etat, null)?.comparaison.champ).toBe("test505_s");
    expect(choisirRepereTest(etat, "fondation")?.comparaison.champ).toBe("test505_s");
  });

  it("la regle 1 ne mord pas si le test du cycle n'a pas de comparaison possible", () => {
    // Cycle Endurance, mais le 6 min n'a qu'une seule mesure.
    const tests: TestEntry[] = [
      { ts: Date.UTC(2026, 6, 20, 10, 0), broadJumpCm: 231, sprint10s: 1.79, endurance6min_m: 1410 },
      { ts: Date.UTC(2026, 5, 20, 10, 0), broadJumpCm: 224, sprint10s: 1.84 },
    ];
    const r = choisirRepereTest(construireComparaisonsTests(tests), "endurance");
    expect(r?.regle).toBe("mesure_la_plus_recente");
    expect(r?.comparaison.champ).toBe("sprint10s"); // regle 3 : egalite, ordre fige
  });
});

describe("Regle du repere — 2. la mesure la plus recente", () => {
  it("prend le `ts` le plus grand, sans egard pour l'ordre du tableau", () => {
    const candidats: ProgressionCandidatRepere[] = [
      { champ: "broadJumpCm", apresTs: 100 },
      { champ: "run1km_s", apresTs: 900 },
      { champ: "sprint10s", apresTs: 500 },
    ];
    expect(choisirChampRepere(candidats, null)).toEqual({
      champ: "run1km_s",
      regle: "mesure_la_plus_recente",
      departageApplique: false,
    });
    // Le meme ensemble dans un autre ordre donne le meme resultat.
    expect(choisirChampRepere([...candidats].reverse(), null)?.champ).toBe("run1km_s");
  });

  it("aucun candidat = aucun repere (jamais un repere invente)", () => {
    expect(choisirChampRepere([], null)).toBeNull();
    expect(choisirChampRepere([], "explosivite")).toBeNull();
    expect(
      choisirRepereTest(
        { possible: false, raison: "aucun_test_enregistre", explication: "x" },
        "explosivite"
      )
    ).toBeNull();
  });
});

describe("Regle du repere — 3. le departage a egalite", () => {
  it("l'ordre de departage est complet, sans doublon, et couvre les 17 champs", () => {
    expect(PROGRESSION_ORDRE_DEPARTAGE).toHaveLength(FIELD_DEFS.length);
    expect(new Set(PROGRESSION_ORDRE_DEPARTAGE).size).toBe(FIELD_DEFS.length);
    for (const def of FIELD_DEFS) {
      expect(PROGRESSION_ORDRE_DEPARTAGE).toContain(def.key);
    }
  });

  it("le socle passe avant les tests optionnels, et le sprint 10 m ouvre la marche", () => {
    // Rang 1 : le seul test que `CORE_FIELD_WHY` classe lui-meme
    // ("la qualite n1 en foot", testConfig.ts:301).
    expect(PROGRESSION_ORDRE_DEPARTAGE[0]).toBe("sprint10s");
    const rangs = PROGRESSION_ORDRE_DEPARTAGE.reduce<Record<string, number>>((acc, k, i) => {
      acc[k] = i;
      return acc;
    }, {});
    const pireDuSocle = Math.max(...CORE_FIELD_KEYS.map((k) => rangs[k]));
    const meilleurOptionnel = Math.min(
      ...FIELD_DEFS.map((d) => d.key as FieldKey)
        .filter((k) => !(CORE_FIELD_KEYS as readonly string[]).includes(k))
        .map((k) => rangs[k])
    );
    expect(pireDuSocle).toBeLessThan(meilleurOptionnel);
    // Le reste du socle garde l'ordre documente de CORE_FIELD_KEYS.
    expect(rangs.broadJumpCm).toBeLessThan(rangs.endurance6min_m);
  });

  it("une batterie met TOUS ses tests a egalite : le departage sert au quotidien", () => {
    const tests = deuxBatteries({ broadJumpCm: +9, sprint10s: -0.05, endurance6min_m: +40 });
    const etat = construireComparaisonsTests(tests);
    if (!etat.possible) throw new Error("comparaison attendue possible");
    expect(new Set(etat.comparaisons.map((c) => c.apresTs)).size).toBe(1);
    const r = choisirRepereTest(etat, null);
    expect(r?.departageApplique).toBe(true);
    expect(r?.comparaison.champ).toBe("sprint10s");
  });

  it("le departage est STABLE : le meme ensemble donne le meme repere, quel que soit l'ordre", () => {
    const candidats: ProgressionCandidatRepere[] = [
      { champ: "endurance6min_m", apresTs: 42 },
      { champ: "broadJumpCm", apresTs: 42 },
      { champ: "sprint10s", apresTs: 42 },
      { champ: "cmjCm", apresTs: 42 },
    ];
    const permutations = [
      candidats,
      [...candidats].reverse(),
      [candidats[2], candidats[0], candidats[3], candidats[1]],
      [candidats[3], candidats[1], candidats[2], candidats[0]],
    ];
    for (const p of permutations) {
      expect(choisirChampRepere(p, null)).toEqual({
        champ: "sprint10s",
        regle: "mesure_la_plus_recente",
        departageApplique: true,
      });
    }
  });
});

describe("Regle du repere — AVEUGLE AU RESULTAT (R9)", () => {
  // Le garde-fou central du fondateur : la selection ne doit JAMAIS dependre de
  // l'amplitude positive du resultat. Ces tests echouent si quelqu'un introduit
  // un tri par "meilleure progression".

  it("le meme jeu de dates designe le MEME repere, que les ecarts soient bons ou mauvais", () => {
    const scenarios = [
      { nom: "tout progresse", broadJumpCm: +12, sprint10s: -0.09, endurance6min_m: +80 },
      { nom: "tout recule", broadJumpCm: -12, sprint10s: +0.09, endurance6min_m: -80 },
      { nom: "seul le sprint recule", broadJumpCm: +12, sprint10s: +0.09, endurance6min_m: +80 },
      { nom: "seul le sprint progresse", broadJumpCm: -12, sprint10s: -0.09, endurance6min_m: -80 },
      { nom: "rien ne bouge", broadJumpCm: 0, sprint10s: 0, endurance6min_m: 0 },
      { nom: "saut spectaculaire", broadJumpCm: +60, sprint10s: +0.01, endurance6min_m: +2 },
    ];
    for (const s of scenarios) {
      const etat = construireComparaisonsTests(deuxBatteries(s));
      // Regle 2 + 3 : toujours le sprint, quel que soit ce que valent les chiffres.
      expect({ nom: s.nom, champ: choisirRepereTest(etat, null)?.comparaison.champ }).toEqual({
        nom: s.nom,
        champ: "sprint10s",
      });
      // Regle 1 : toujours le test du cycle, meme quand il est le pire des trois.
      expect({ nom: s.nom, champ: choisirRepereTest(etat, "force")?.comparaison.champ }).toEqual({
        nom: s.nom,
        champ: "broadJumpCm",
      });
    }
  });

  it("un repere en RECUL s'affiche : il n'est ni masque, ni remplace par un meilleur", () => {
    const etat = construireComparaisonsTests(
      deuxBatteries({ broadJumpCm: -6, sprint10s: +0.08, endurance6min_m: +90 })
    );
    const r = choisirRepereTest(etat, "explosivite");
    expect(r?.comparaison.champ).toBe("sprint10s");
    expect(r?.comparaison.sens).toBe("regression");
    // Une amelioration franche existait a cote et n'a pas ete preferee.
    if (!etat.possible) throw new Error("comparaisons attendues possibles");
    expect(etat.comparaisons.find((c) => c.champ === "endurance6min_m")?.sens).toBe("amelioration");
  });

  it("la selection ne recoit PAS le resultat : sa signature ne porte que champ + horodatage", () => {
    // Preuve de type, verifiee a l'execution : un candidat n'a que deux cles.
    const candidat: ProgressionCandidatRepere = { champ: "sprint10s", apresTs: 1 };
    expect(Object.keys(candidat).sort()).toEqual(["apresTs", "champ"]);
    // Et la fonction se contente de ces deux cles-la : appelee avec une liste
    // depouillee de tout le reste, elle rend exactement le meme verdict que via
    // `choisirRepereTest` sur les comparaisons completes.
    const etat = construireComparaisonsTests(
      deuxBatteries({ broadJumpCm: +30, sprint10s: +0.2, endurance6min_m: -100 })
    );
    if (!etat.possible) throw new Error("comparaisons attendues possibles");
    const depouille = etat.comparaisons.map((c) => ({ champ: c.champ, apresTs: c.apresTs }));
    expect(choisirChampRepere(depouille, "explosivite")?.champ).toBe(
      choisirRepereTest(etat, "explosivite")?.comparaison.champ
    );
  });

  it("le code de la selection ne mentionne aucun terme de resultat (garde anti-cherry-picking)", () => {
    // Filet supplementaire : si un jour quelqu'un fait entrer l'ecart dans la
    // decision, il devra l'ecrire — et ce test le verra.
    const source = choisirChampRepere
      .toString()
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const interdit of [
      "ecart",
      "sens",
      "amelioration",
      "regression",
      "plusPetitEstMieux",
      "avantAffiche",
      "apresAffiche",
    ]) {
      expect({ interdit, present: new RegExp(`\\b${interdit}\\b`).test(source) }).toEqual({
        interdit,
        present: false,
      });
    }
  });
});

describe("Regle du repere — ce que le ViewModel en expose", () => {
  it("chaque fixture qui affiche un repere dit AUSSI par quelle regle", () => {
    for (const f of toutesLesFixtures()) {
      const r = repereDe(buildProgressionViewModel(f.input));
      if (r === null) continue;
      expect(["objectif_du_cycle", "mesure_la_plus_recente"]).toContain(r.regle);
      expect(r.motif.trim().length).toBeGreaterThan(0);
      expect(typeof r.departageApplique).toBe("boolean");
      // La regle 1 designe UN champ : elle ne peut pas avoir eu besoin d'un departage.
      if (r.regle === "objectif_du_cycle") expect(r.departageApplique).toBe(false);
    }
  });

  it("le repere affiche est toujours l'une des comparaisons calculees", () => {
    for (const f of toutesLesFixtures()) {
      const vm = buildProgressionViewModel(f.input);
      const r = repereDe(vm);
      if (r === null) continue;
      if (vm.state === "empty" || !vm.comparaisonsTests.possible) {
        throw new Error("un repere sans comparaisons possibles");
      }
      expect(vm.comparaisonsTests.comparaisons).toContain(r.comparaison);
    }
  });

  it("le mapping est signale comme une decision produit a valider", () => {
    const vm = vmDe("test-physique-ameliore");
    expect(
      vm.protoWarnings.some(
        (w) => w.includes("PROGRESSION_TEST_PAR_CYCLE") && w.includes("valider par le fondateur")
      )
    ).toBe(true);
  });
});
