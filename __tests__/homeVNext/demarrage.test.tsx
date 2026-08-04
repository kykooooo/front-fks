// __tests__/homeVNext/demarrage.test.tsx
// =============================================================================
// LES VARIANTES DE DEMARRAGE — V-A « Premiere mission » / V-B « Anticipation »
// =============================================================================
//
// Ce fichier tient trois promesses, et la premiere est la plus importante :
//
//  1. LE VERROU DE CHAMPS. Le ViewModel du nouveau joueur ne peut gagner AUCUN
//     champ sans que ce fichier echoue. C'est la garantie mecanique de la seule
//     regle qui compte ici : « aucune donnee inventee ». Un futur contributeur
//     qui ajouterait `streak`, `badge`, `pourcentage` ou n'importe quel champ
//     flatteur casse le test — il ne peut pas l'ajouter en silence.
//
//  2. LA DERIVATION. Chaque etat « fait » d'un premier pas est recalcule ICI a
//     partir de l'entree, et compare a ce que le selecteur a produit. Un pas ne
//     peut donc pas etre coche par une valeur ecrite a la main.
//
//  3. LA NON-REGRESSION. Sans l'option, le ViewModel des 15 etats est
//     RIGOUREUSEMENT celui d'avant — `demarrage` mis a part, qui vaut `null`.
//
//  4. LA SECTION 7 NE TESTE PLUS CE QU'ELLE TESTAIT. Le 04/08, elle prouvait
//     que le bloc V-A atteignait l'ecran (commit 4264174). Plus tard le meme
//     jour, decision Kyllian : l'ecran d'un compte neuf reste l'ecran normal,
//     le bloc passe derriere `HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION`
//     (OFF). La section 7 verifie maintenant l'inverse — et le fait en
//     relisant la config reelle, jamais en ecrivant "A" ou "OFF" a la main
//     (c'est exactement la faute du matin, qu'un test qui invente sa propre
//     config ne peut pas attraper).
// =============================================================================

import fs from "fs";
import path from "path";

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { HOME_FEATURES } from "../../config/homeFeatures";
import {
  buildHomeVNextViewModel,
  DEMARRAGE_VARIANTES,
  SEANCES_MIN_POUR_TENDANCE,
  SEANCES_POUR_SORTIR_DU_DEMARRAGE,
  type DemarrageVarianteId,
  type HomeVNextInput,
  type HomeVNextViewModel,
} from "../../screens/homeVNext/viewModel";
import { buildProgressionViewModel } from "../../screens/homeVNext/progressionViewModel";
import {
  HOME_VNEXT_FIXTURES_RENDU,
  getHomeVNextFixture,
  progressionInputDepuisHome,
} from "../../screens/homeVNext/fixtures";
import { HomeVNextScreen } from "../../screens/homeVNext/HomeVNextScreen";
import { MARQUEURS } from "../../components/homeVNext/homeVNextMarqueurs";
import { espacement } from "../../components/homeVNext/homeVNextTokens";

// `<Screen>` lit les insets de la safe area : sans ce mock, le montage leve.
// Meme mock que `HomeVNextScreen.test.tsx` — une seule facon de monter l'ecran.
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

const NOUVEAU = () => {
  const f = getHomeVNextFixture("nouveau-joueur");
  if (!f) throw new Error("Fixture « nouveau-joueur » introuvable.");
  return f;
};

const vmDemarrage = (variante: DemarrageVarianteId, patch: Partial<HomeVNextInput> = {}) =>
  buildHomeVNextViewModel({ ...NOUVEAU().input, ...patch }, { demarrage: variante });

// -----------------------------------------------------------------------------
// 1. LE VERROU DE CHAMPS — aucune donnee inventee ne peut apparaitre
// -----------------------------------------------------------------------------

/**
 * TOUT ce que le ViewModel du nouveau joueur a le droit de contenir, chemin par
 * chemin. Ecrit A LA MAIN, jamais derive du resultat : un instantane genere a
 * partir de la sortie validerait n'importe quel ajout futur, ce qui est
 * exactement l'inverse du but.
 *
 * Convention : `[]` designe l'element d'un tableau, quel que soit son indice.
 */
const CHAMPS_AUTORISES: readonly string[] = [
  "dataState",
  "dataNotice",
  "header",
  "header.greeting",
  "header.dateLabel",
  "header.stateChip",
  "action",
  "action.kind",
  "action.target",
  "action.emphasis",
  "action.label",
  "action.sublabel",
  "action.secondary",
  "why",
  "cycle",
  "week",
  // `form` n'est pas `null` sur l'ecran ACTUEL du nouveau joueur : c'est la
  // carte « Ta tendance se construit », celle que les deux variantes absorbent.
  "form",
  "form.kind",
  "form.reason",
  "form.title",
  "form.message",
  "form.completedCount",
  "form.requiredCount",
  "note",
  "exit",
  "protoWarnings",
  "protoWarnings.[]",
  // --- le bloc de demarrage, et rien de plus -------------------------------
  "demarrage",
  "demarrage.kind",
  "demarrage.titre",
  // V-A
  "demarrage.premiersPas",
  "demarrage.premiersPas.[]",
  "demarrage.premiersPas.[].id",
  "demarrage.premiersPas.[].label",
  "demarrage.premiersPas.[].detail",
  "demarrage.premiersPas.[].fait",
  "demarrage.premiersPas.[].source",
  "demarrage.pourquoiCeCycle",
  "demarrage.pourquoiCeCycle.text",
  "demarrage.pourquoiCeCycle.cycleLabel",
  "demarrage.pourquoiCeCycle.source",
  // V-B
  "demarrage.apercus",
  "demarrage.apercus.[]",
  "demarrage.apercus.[].titre",
  "demarrage.apercus.[].message",
  "demarrage.apercus.[].seuil",
  "demarrage.apercus.[].seuilNom",
];

/**
 * Tous les chemins reellement presents dans une valeur, DEDOUBLONNES et tries.
 *
 * Deux elements d'un meme tableau produisent le meme chemin (`…[].label`) :
 * sans dedoublonnage, le message d'echec repeterait trois fois la meme faute et
 * on lirait moins bien ce qui a ete ajoute.
 */
function cheminsDe(valeur: unknown): string[] {
  const vus = new Set<string>();
  const parcourir = (v: unknown, prefixe: string): void => {
    if (Array.isArray(v)) {
      const chemin = `${prefixe}.[]`;
      vus.add(chemin);
      v.forEach((e) => parcourir(e, chemin));
      return;
    }
    if (v !== null && typeof v === "object") {
      for (const [cle, sous] of Object.entries(v as Record<string, unknown>)) {
        const chemin = prefixe ? `${prefixe}.${cle}` : cle;
        vus.add(chemin);
        parcourir(sous, chemin);
      }
    }
  };
  parcourir(valeur, "");
  return [...vus].sort();
}

describe("Demarrage — le ViewModel du nouveau joueur ne peut pas gagner un champ", () => {
  const cas: { titre: string; vm: () => HomeVNextViewModel }[] = [
    { titre: "sans variante (ecran actuel)", vm: () => buildHomeVNextViewModel(NOUVEAU().input) },
    { titre: "V-A", vm: () => vmDemarrage("A") },
    { titre: "V-B", vm: () => vmDemarrage("B") },
  ];

  for (const c of cas) {
    it(`aucun champ inconnu — ${c.titre}`, () => {
      const inconnus = cheminsDe(c.vm()).filter(
        (chemin) => CHAMPS_AUTORISES.indexOf(chemin) === -1
      );
      // Le message d'echec nomme le coupable : un futur contributeur voit
      // immediatement CE QU'IL a ajoute, et doit venir le justifier ici.
      expect(inconnus).toEqual([]);
    });
  }

  it("le verrou detecte reellement un champ ajoute (il ne mesure pas le vide)", () => {
    const vm = vmDemarrage("A") as HomeVNextViewModel & { streak?: number };
    // Exactement le genre de champ flatteur qu'on ajoute « pour donner de la
    // presence » : un compteur de serie, qui n'existe dans aucune source.
    const falsifie = { ...vm, streak: 3 };
    expect(cheminsDe(falsifie).filter((c) => CHAMPS_AUTORISES.indexOf(c) === -1)).toEqual([
      "streak",
    ]);
  });

  it("le verrou couvre aussi les champs imbriques dans un premier pas", () => {
    const vm = vmDemarrage("A");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") {
      throw new Error("V-A doit produire un bloc premiere_mission.");
    }
    const falsifie = {
      ...vm,
      demarrage: {
        ...vm.demarrage,
        premiersPas: vm.demarrage.premiersPas.map((p) => ({ ...p, pourcentage: 33 })),
      },
    };
    expect(cheminsDe(falsifie).filter((c) => CHAMPS_AUTORISES.indexOf(c) === -1)).toEqual([
      "demarrage.premiersPas.[].pourcentage",
    ]);
  });
});

// -----------------------------------------------------------------------------
// 2. LA DERIVATION — un pas coche l'est parce que la donnee le dit
// -----------------------------------------------------------------------------

describe("V-A — chaque premier pas est derive d'un etat verifiable", () => {
  it("les trois pas sont la, dans l'ordre, et aucun n'est tapable", () => {
    const vm = vmDemarrage("A");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") {
      throw new Error("V-A doit produire un bloc premiere_mission.");
    }
    expect(vm.demarrage.premiersPas.map((p) => p.id)).toEqual([
      "profil",
      "test_terrain",
      "premiere_seance",
    ]);
    for (const pas of vm.demarrage.premiersPas) {
      // Le contrat n'a aucun champ de destination : on verifie qu'il n'en est
      // pas apparu un sous un autre nom.
      expect(Object.keys(pas).sort()).toEqual(["detail", "fait", "id", "label", "source"]);
      expect(pas.source.trim().length).toBeGreaterThan(0);
    }
  });

  it("« profil » suit mainObjective, et rien d'autre", () => {
    const base = NOUVEAU().input;
    const avec = vmDemarrage("A");
    const sans = vmDemarrage("A", {
      demarrage: { ...base.demarrage!, mainObjective: null },
    });
    const pasDe = (vm: HomeVNextViewModel) => {
      if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
      return vm.demarrage.premiersPas.find((p) => p.id === "profil")!;
    };
    expect(pasDe(avec).fait).toBe(true);
    expect(pasDe(sans).fait).toBe(false);
  });

  it("« tests terrain » suit le nombre d'entrees de tests, et jamais l'affiche", () => {
    const base = NOUVEAU().input;
    const pasDe = (n: number) => {
      const vm = vmDemarrage("A", { demarrage: { ...base.demarrage!, testEntryCount: n } });
      if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
      return vm.demarrage.premiersPas.find((p) => p.id === "test_terrain")!;
    };
    expect(pasDe(0).fait).toBe(false);
    expect(pasDe(1).fait).toBe(true);
    expect(pasDe(9).fait).toBe(true);
    // Le compte ne doit JAMAIS ressortir comme un chiffre affichable.
    expect(pasDe(9).detail).not.toMatch(/\d/);
    expect(pasDe(9).label).not.toMatch(/\d/);
  });

  it("« premiere seance » suit completedSessions, et cite le seuil de tendance", () => {
    const vm = vmDemarrage("A");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    const pas = vm.demarrage.premiersPas.find((p) => p.id === "premiere_seance")!;
    expect(pas.fait).toBe(false);
    // Le chiffre affiche est la CONSTANTE, pas un nombre choisi pour la phrase.
    expect(pas.detail).toContain(String(SEANCES_MIN_POUR_TENDANCE));
  });
});

describe("V-A — « pourquoi ce cycle » ne sort que d'un objectif reellement declare", () => {
  it("la phrase nomme le cycle rendu par recommendMicrocycle", () => {
    const vm = vmDemarrage("A");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    const pourquoi = vm.demarrage.pourquoiCeCycle;
    expect(pourquoi).not.toBeNull();
    // L'objectif de la fixture est « Gagner en vitesse / explosivite » -> le
    // cycle Explosivite, dont le libelle joueur est « Vitesse & détente ».
    expect(pourquoi!.cycleLabel).toBe("Vitesse & détente");
    expect(pourquoi!.text).toContain(pourquoi!.cycleLabel);
    expect(pourquoi!.source).toBe("objectif_declare");
  });

  it("sans objectif declare : la ligne disparait, et le prototype dit pourquoi", () => {
    const base = NOUVEAU().input;
    const vm = vmDemarrage("A", { demarrage: { ...base.demarrage!, mainObjective: null } });
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    expect(vm.demarrage.pourquoiCeCycle).toBeNull();
    expect(vm.protoWarnings.join(" ")).toContain("aucun objectif declare");
  });

  it("avec un cycle deja actif : la ligne disparait (deux verites, une de trop)", () => {
    const vm = vmDemarrage("A", { microcycleGoal: "force" });
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    expect(vm.demarrage.pourquoiCeCycle).toBeNull();
    expect(vm.protoWarnings.join(" ")).toContain("un cycle est deja actif");
  });

  it("les tests terrain pesent quand ils existent, et c'est dit dans la source", () => {
    const base = NOUVEAU().input;
    const vm = vmDemarrage("A", {
      demarrage: { ...base.demarrage!, testEntryCount: 2, lastTestPlaylist: "endurance" },
    });
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    expect(vm.demarrage.pourquoiCeCycle!.source).toBe("objectif_declare_et_tests");
  });
});

// -----------------------------------------------------------------------------
// 3. V-B — chaque promesse est adossee a un seuil exporte
// -----------------------------------------------------------------------------

describe("V-B — l'ecran annonce ce qui viendra, jamais un chiffre en attente", () => {
  it("chaque apercu porte le seuil qui le declenchera vraiment", () => {
    const vm = vmDemarrage("B");
    if (vm.demarrage === null || vm.demarrage.kind !== "anticipation") throw new Error("V-B attendue");
    const parTitre = Object.fromEntries(vm.demarrage.apercus.map((a) => [a.titre, a]));
    expect(Object.keys(parTitre)).toEqual(["MA SEMAINE", "MA FORME", "MA PROGRESSION"]);
    expect(parTitre["MA SEMAINE"].seuil).toBe(SEANCES_POUR_SORTIR_DU_DEMARRAGE);
    expect(parTitre["MA FORME"].seuil).toBe(SEANCES_MIN_POUR_TENDANCE);
    expect(parTitre["MA PROGRESSION"].seuil).toBe(SEANCES_MIN_POUR_TENDANCE);
    // Le seuil cite dans la phrase est CELUI-LA, pas un autre nombre.
    for (const a of vm.demarrage.apercus) {
      expect(a.message).toContain(
        a.titre === "MA SEMAINE" ? "première séance" : String(a.seuil)
      );
      expect(a.seuilNom.trim().length).toBeGreaterThan(0);
    }
  });

  it("aucun objectif hebdo declare : « Ma semaine » n'est pas promise", () => {
    const vm = vmDemarrage("B", { weeklyGoalDeclared: null });
    if (vm.demarrage === null || vm.demarrage.kind !== "anticipation") throw new Error("V-B attendue");
    expect(vm.demarrage.apercus.map((a) => a.titre)).toEqual(["MA FORME", "MA PROGRESSION"]);
  });

  it("l'objectif hebdo affiche est celui que le joueur a declare", () => {
    const vm = vmDemarrage("B", { weeklyGoalDeclared: 4 });
    if (vm.demarrage === null || vm.demarrage.kind !== "anticipation") throw new Error("V-B attendue");
    expect(vm.demarrage.apercus[0].message).toContain("4 séances");
  });
});

// -----------------------------------------------------------------------------
// 4. LES GARDE-FOUS DU BLOC
// -----------------------------------------------------------------------------

describe("Demarrage — le bloc refuse de se construire quand il n'a pas de quoi", () => {
  it("sans l'entree `demarrage`, rien n'est devine", () => {
    const sansEntree: HomeVNextInput = { ...NOUVEAU().input };
    delete sansEntree.demarrage;
    const vm = buildHomeVNextViewModel(sansEntree, { demarrage: "A" });
    expect(vm.demarrage).toBeNull();
    // Et "MA FORME" reste : rien n'a ete absorbe puisque rien n'a ete construit.
    expect(vm.form).not.toBeNull();
    expect(vm.protoWarnings.join(" ")).toContain("`input.demarrage` est absent");
  });

  it("des la premiere seance terminee, le bloc disparait tout seul", () => {
    const vm = buildHomeVNextViewModel(
      {
        ...NOUVEAU().input,
        completedSessions: [
          { id: "s1", dateKey: "2026-07-29", title: "Appuis", durationMin: 40, perceivedEffort: 6 },
        ],
        daysSinceLastSession: 1,
      },
      { demarrage: "A" }
    );
    expect(vm.demarrage).toBeNull();
    expect(vm.protoWarnings.join(" ")).toContain("SEANCES_POUR_SORTIR_DU_DEMARRAGE");
  });

  it("le bloc absorbe MA FORME — les deux disaient la meme chose", () => {
    expect(buildHomeVNextViewModel(NOUVEAU().input).form).not.toBeNull();
    expect(vmDemarrage("A").form).toBeNull();
    expect(vmDemarrage("B").form).toBeNull();
  });

  it("les deux variantes sont declarees pour le visualiseur", () => {
    expect(DEMARRAGE_VARIANTES.map((v) => v.id)).toEqual(["A", "B"]);
    for (const v of DEMARRAGE_VARIANTES) {
      expect(v.titre.trim().length).toBeGreaterThan(0);
      expect(v.resume.trim().length).toBeGreaterThan(0);
    }
  });
});

// -----------------------------------------------------------------------------
// 5. NON-REGRESSION — les 14 autres etats ne bougent pas d'un champ
// -----------------------------------------------------------------------------

describe("Demarrage — zero diff sur tout ce qui n'est pas un compte neuf", () => {
  for (const variante of ["A", "B"] as const) {
    it(`option « ${variante} » : aucun etat deja valide ne change`, () => {
      for (const f of HOME_VNEXT_FIXTURES_RENDU) {
        if (f.id === "nouveau-joueur") continue;
        const avant = buildHomeVNextViewModel(f.input);
        const apres = buildHomeVNextViewModel(f.input, { demarrage: variante });
        // Tout est identique, hors les avertissements de prototype (qui gagnent
        // la ligne « variante demandee sur un compte non neuf ») et le champ
        // `demarrage`, qui vaut `null` des deux cotes.
        expect({ ...apres, protoWarnings: avant.protoWarnings }).toEqual(avant);
        expect(apres.demarrage).toBeNull();
      }
    });
  }

  it("sans option, le ViewModel du nouveau joueur est celui d'avant", () => {
    const vm = buildHomeVNextViewModel(NOUVEAU().input);
    expect(vm.demarrage).toBeNull();
    expect(vm.form).not.toBeNull();
    expect(vm.protoWarnings).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 6. L'ECRAN — ce qui est rendu, et surtout ce qui ne l'est pas
// -----------------------------------------------------------------------------

const rendre = (vm: HomeVNextViewModel) => {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<HomeVNextScreen vm={vm} largeurCourbe={311} />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return (rendu as TestRenderer.ReactTestRenderer).root;
};

/**
 * Compte les noeuds NATIFS portant un `testID` donne.
 *
 * Le filtre `typeof n.type === "string"` n'est pas cosmetique : sans lui, un
 * marqueur pose sur un composant compose est compte DEUX FOIS (le composant et
 * le noeud natif qu'il rend), et un test « il y en a exactement un » deviendrait
 * un test « il y en a exactement deux » — qui ne prouve plus rien.
 */
const compter = (racine: ReturnType<typeof rendre>, marqueur: string) =>
  racine.findAll((n) => typeof n.type === "string" && n.props?.testID === marqueur, {
    deep: true,
  }).length;

describe("Demarrage — l'ecran rendu", () => {
  it("V-A pose autant de lignes que le ViewModel a de pas, et pas une de plus", () => {
    const vm = vmDemarrage("A");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    const racine = rendre(vm);
    expect(compter(racine, MARQUEURS.demarrage)).toBe(1);
    expect(compter(racine, MARQUEURS.demarragePas)).toBe(vm.demarrage.premiersPas.length);
    // Une coche par pas REELLEMENT fait : la vue ne peut pas en cocher un de
    // plus, ni en oublier un.
    expect(compter(racine, MARQUEURS.demarragePasFait)).toBe(
      vm.demarrage.premiersPas.filter((p) => p.fait).length
    );
    expect(compter(racine, MARQUEURS.demarragePourquoiCycle)).toBe(1);
  });

  it("V-B pose autant de lignes que le ViewModel a d'apercus", () => {
    const vm = vmDemarrage("B");
    if (vm.demarrage === null || vm.demarrage.kind !== "anticipation") throw new Error("V-B attendue");
    const racine = rendre(vm);
    expect(compter(racine, MARQUEURS.demarrageApercu)).toBe(vm.demarrage.apercus.length);
    // Aucun pas, aucune coche : V-B ne raconte pas une checklist.
    expect(compter(racine, MARQUEURS.demarragePas)).toBe(0);
  });

  it("une seule action principale, un seul aplat — dans les trois etats", () => {
    for (const vm of [buildHomeVNextViewModel(NOUVEAU().input), vmDemarrage("A"), vmDemarrage("B")]) {
      const racine = rendre(vm);
      expect(compter(racine, MARQUEURS.actionPrincipale)).toBe(1);
      expect(
        racine.findAll(
          (n) => typeof n.type === "string" && n.props?.nativeID === MARQUEURS.aplat,
          { deep: true }
        ).length
      ).toBe(1);
    }
  });

  it("le traitement hero n'existe que dans les variantes de demarrage", () => {
    expect(compter(rendre(buildHomeVNextViewModel(NOUVEAU().input)), MARQUEURS.actionHero)).toBe(0);
    expect(compter(rendre(vmDemarrage("A")), MARQUEURS.actionHero)).toBe(1);
    expect(compter(rendre(vmDemarrage("B")), MARQUEURS.actionHero)).toBe(1);
    // Et il ne peut pas apparaitre sur un ecran qui a de vraies donnees.
    const plein = getHomeVNextFixture("tendance-disponible")!;
    expect(
      compter(rendre(buildHomeVNextViewModel(plein.input, { demarrage: "A" })), MARQUEURS.actionHero)
    ).toBe(0);
  });

  it("la carte MA FORME a bien disparu au profit du bloc de demarrage", () => {
    expect(compter(rendre(buildHomeVNextViewModel(NOUVEAU().input)), MARQUEURS.formeInsuffisante)).toBe(1);
    expect(compter(rendre(vmDemarrage("A")), MARQUEURS.formeInsuffisante)).toBe(0);
    expect(compter(rendre(vmDemarrage("B")), MARQUEURS.formeInsuffisante)).toBe(0);
  });

  it("aucune ligne du bloc n'est tapable", () => {
    for (const variante of ["A", "B"] as const) {
      const racine = rendre(vmDemarrage(variante));
      const bloc = racine.find(
        (n) => n.props && n.props.testID === MARQUEURS.demarrage
      );
      const tactiles = bloc.findAll(
        (n) =>
          Boolean(n.props) &&
          (typeof n.props.onPress === "function" ||
            n.props.accessibilityRole === "button" ||
            n.props.accessibilityRole === "link"),
        { deep: true }
      );
      expect(tactiles).toEqual([]);
    }
  });

  it("tout texte du bloc est borne par numberOfLines", () => {
    for (const variante of ["A", "B"] as const) {
      const racine = rendre(vmDemarrage(variante));
      const bloc = racine.find((n) => n.props && n.props.testID === MARQUEURS.demarrage);
      const textesNonBornes = bloc
        .findAllByType(Text, { deep: true })
        .filter((n) => n.props.numberOfLines == null);
      expect(textesNonBornes).toEqual([]);
    }
  });

  it("aucun texte du bloc ne desactive l'agrandissement systeme", () => {
    for (const variante of ["A", "B"] as const) {
      const racine = rendre(vmDemarrage(variante));
      const bloc = racine.find((n) => n.props && n.props.testID === MARQUEURS.demarrage);
      const brides = bloc
        .findAllByType(Text, { deep: true })
        .filter((n) => n.props.allowFontScaling === false);
      expect(brides).toEqual([]);
    }
  });
});

// -----------------------------------------------------------------------------
// 7. L'ECRAN QUE L'APP MONTE VRAIMENT — variante 2, drapeau de demarrage
// -----------------------------------------------------------------------------
// CE QUE CETTE SECTION PROUVAIT LE MATIN DU 04/08 (commit 4264174) : que le
// bloc V-A, une fois construit par le ViewModel, atteignait vraiment l'ecran
// — pas seulement en configuration "v1" isolee, jamais montee par l'app.
//
// CE QU'ELLE PROUVE MAINTENANT, DECISION KYLLIAN PRISE LE MEME JOUR : que ce
// meme bloc N'ATTEINT PLUS l'ecran, parce que l'ecran d'un compte neuf reste
// l'ecran NORMAL des le jour 1. `HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION`
// (config/homeFeatures.ts) est OFF ; la checklist 3 etapes de la carte
// Progression VIDE (deja la, `progressionViewModel.ts` §6.7) devient le seul
// message de demarrage.
//
// LA MEME LECON, APPLIQUEE DANS LES DEUX SENS. La faute du matin etait de
// monter l'ecran en "v1", une config que le conteneur ne produit pas.
// Ecrire ici `{ demarrage: undefined }` en dur commettrait la faute inverse :
// un test qui invente sa propre config plutot que de lire celle du
// conteneur ne prouve plus rien le jour ou quelqu'un modifie
// `useHomeVNextViewModel.ts` sans toucher ce fichier. `demarrageDeLaProd()`
// ci-dessous lit donc le VRAI drapeau, et le test de fin de section relit le
// VRAI fichier pour verifier qu'il le lit bien de la meme facon.
// -----------------------------------------------------------------------------

/**
 * Le profil EXACT de la recette telephone : compte neuf (zero seance terminee)
 * sur lequel un cycle a deja ete choisi — l'ecran capture affichait « Vitesse &
 * detente · Seance 1 sur 12 ».
 *
 * Ce detail n'est pas decoratif : c'est le cas ou le bloc V-A, s'il etait
 * actif, perdrait sa ligne « pourquoi ce cycle » (viewModel.ts §5.8 bis, un
 * cycle tourne deja) — donc celui ou il a le moins de contenu. S'il tenait
 * ici, il tenait partout ; et c'est le meme profil qui doit produire l'ecran
 * normal maintenant que le drapeau est OFF.
 */
const PROFIL_RECETTE: Partial<HomeVNextInput> = {
  microcycleGoal: "explosivite",
  microcycleSessionIndex: 0,
};

const entreeRecette = (): HomeVNextInput => ({ ...NOUVEAU().input, ...PROFIL_RECETTE });

/**
 * L'option de demarrage EXACTEMENT comme la calcule la production
 * (`hooks/home/useHomeVNextViewModel.ts`). N'ECRIS JAMAIS `"A"` ou
 * `undefined` en dur a la place de cet appel dans cette section : ce serait
 * rejouer, a l'envers, la config fantome du 04/08.
 */
const demarrageDeLaProd = (): DemarrageVarianteId | undefined =>
  HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION ? "A" : undefined;

/** Le montage du conteneur, et rien d'autre : variante 2 + carte progression. */
const rendreCommeLApp = (vm: HomeVNextViewModel, input: HomeVNextInput) => {
  const progression = buildProgressionViewModel(progressionInputDepuisHome(input));
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(
      <HomeVNextScreen vm={vm} variante="v2" progression={progression} largeurCourbe={311} />
    );
  });
  if (!rendu) throw new Error("rendu impossible");
  return (rendu as TestRenderer.ReactTestRenderer).root;
};

/** Tous les textes rendus, aplatis — pour prouver qu'une phrase EST ou N'EST PAS la. */
const textesRendus = (racine: ReturnType<typeof rendre>): string[] =>
  racine
    .findAllByType(Text, { deep: true })
    .flatMap((n) => React.Children.toArray(n.props.children as React.ReactNode))
    .filter((c): c is string => typeof c === "string");

describe("Demarrage — le montage reel de l'application", () => {
  it("verrou de la decision Kyllian (04/08) : le bloc V-A est desactive en production", () => {
    // Si cette ligne echoue, tout le reste de la section teste la mauvaise
    // chose : relire config/homeFeatures.ts avant de toucher au reste.
    expect(HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION).toBe(false);
  });

  it("zero seance + cycle actif, config reelle : aucun bloc de demarrage ne se construit", () => {
    const vm = buildHomeVNextViewModel(entreeRecette(), {
      variante: "v2",
      demarrage: demarrageDeLaProd(),
    });

    expect(vm.demarrage).toBeNull();
    // "MA FORME" n'a donc rien absorbe : elle existe toujours cote ViewModel,
    // meme si l'ecran (variante 2, plus bas) la remplace par la carte
    // progression pour l'affichage.
    expect(vm.form).not.toBeNull();
  });

  it("le bloc « Premiere mission » n'est PAS rendu : l'ecran reste celui de tout le monde", () => {
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { variante: "v2", demarrage: demarrageDeLaProd() });
    const racine = rendreCommeLApp(vm, input);

    // Le coeur de la decision du 04/08, prise quelques heures apres le
    // correctif du matin : le bloc V-A ne doit RIEN afficher, et le bouton du
    // jour ne prend pas le traitement hero qui n'allait qu'avec lui.
    expect(compter(racine, MARQUEURS.demarrage)).toBe(0);
    expect(compter(racine, MARQUEURS.actionHero)).toBe(0);
    // La carte progression, elle, est bien la — c'est desormais elle qui
    // porte le message de demarrage.
    expect(compter(racine, MARQUEURS.progression)).toBe(1);
  });

  it("la carte Progression vide EST le message de demarrage unique", () => {
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { variante: "v2", demarrage: demarrageDeLaProd() });
    const racine = rendreCommeLApp(vm, input);

    // Plus de bloc V-A pour porter ces trois phrases : c'est desormais
    // exclusivement la carte Progression (etat "empty",
    // progressionViewModel.ts §6.7) qui les affiche. Si elles disparaissent
    // d'ici, l'ecran d'un compte neuf n'a plus AUCUN message de demarrage —
    // ni invente, ni honnete : rien.
    const textes = textesRendus(racine);
    for (const repere of [
      "Termine ta première séance.",
      "Partage ton ressenti.",
      "Compare tes prochains tests.",
    ]) {
      expect(textes).toContain(repere);
    }
  });

  it("des la premiere seance terminee, la carte progression reste en place (rien ne change ici)", () => {
    const plein = getHomeVNextFixture("tendance-disponible")!;
    const vm = buildHomeVNextViewModel(plein.input, {
      variante: "v2",
      demarrage: demarrageDeLaProd(),
    });
    expect(vm.demarrage).toBeNull();

    const racine = rendreCommeLApp(vm, plein.input);
    expect(compter(racine, MARQUEURS.demarrage)).toBe(0);
    expect(compter(racine, MARQUEURS.progression)).toBe(1);
  });

  it("aucun intervalle extensible (f568d83) ne se glisse sur l'ecran normal", () => {
    // La respiration n'existe QUE quand `vm.demarrage !== null`
    // (HomeVNextScreen.tsx). Le drapeau etant OFF, plus aucun montage reel
    // ne peut l'activer — le code reste, tenu par le meme interrupteur que
    // le bloc lui-meme, pas retire separement.
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { variante: "v2", demarrage: demarrageDeLaProd() });
    const racine = rendreCommeLApp(vm, input);
    expect(compter(racine, MARQUEURS.respirationDemarrage)).toBe(0);
  });

  it("le mecanisme V-A + hero + respiration n'a pas ete demonte, seulement debranche", () => {
    // Ce test-ci NE LIT PAS le drapeau : il force "A" pour prouver que la
    // machinerie tient toujours debout. C'est la garantie concrete derriere
    // le commentaire de config/homeFeatures.ts (« conserve pour un futur
    // onboarding sans cycle actif »). S'il casse, la conservation du code
    // est un mensonge.
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { variante: "v2", demarrage: "A" });
    const racine = rendreCommeLApp(vm, input);
    expect(compter(racine, MARQUEURS.demarrage)).toBe(1);
    expect(compter(racine, MARQUEURS.actionHero)).toBe(1);

    // La respiration (f568d83) tient encore, plafond compris : deux
    // intervalles exactement, `flexGrow` a 1, plafond au jeton.
    const respirations = racine.findAll(
      (n) => typeof n.type === "string" && n.props?.testID === MARQUEURS.respirationDemarrage,
      { deep: true }
    );
    expect(respirations).toHaveLength(2);
    for (const r of respirations) {
      const style = StyleSheet.flatten(r.props.style) as { flexGrow?: number; maxHeight?: number };
      expect(style.flexGrow).toBe(1);
      expect(style.maxHeight).toBe(espacement.respirationDemarrageMax);
    }
  });

  it("le montage teste ci-dessus est bien celui du conteneur, drapeau compris", () => {
    // LE TEST QUI EMPECHE CETTE SECTION DE REDEVENIR UN ECRAN FANTOME — dans
    // un sens ou dans l'autre. Si le conteneur cesse de monter la variante 2,
    // ou si quelqu'un fige a nouveau `demarrage: "A"` en dur (exactement la
    // regression du 04/08, permanente cette fois), ce test le signale.
    const sourceContainer = fs.readFileSync(
      path.join(__dirname, "..", "..", "screens", "homeVNext", "HomeVNextContainer.tsx"),
      "utf8"
    );
    expect(sourceContainer).toContain('variante="v2"');
    expect(sourceContainer).toContain("progression={progression}");

    const sourceHook = fs.readFileSync(
      path.join(__dirname, "..", "..", "hooks", "home", "useHomeVNextViewModel.ts"),
      "utf8"
    );
    expect(sourceHook).toContain("HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION");
    expect(sourceHook).not.toContain('demarrage: "A"');
  });
});
