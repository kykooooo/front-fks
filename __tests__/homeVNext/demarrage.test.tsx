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
// =============================================================================

import fs from "fs";
import path from "path";

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

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
// 7. L'ECRAN QUE L'APP MONTE VRAIMENT — variante 2
// -----------------------------------------------------------------------------
// POURQUOI CETTE SECTION EXISTE, ET CE QU'ELLE REPARE.
//
// Tout ce qui precede monte `<HomeVNextScreen vm={...} />` SANS `variante` :
// l'ecran retombe donc sur "v1". Or le conteneur ne monte jamais ca. Il passe
// `variante="v2"` ET une carte progression (HomeVNextContainer.tsx), et c'est le
// SEUL montage qui atteint un telephone.
//
// Consequence, constatee en recette le 04/08 sur un compte neuf : tous les
// verrous V-A ci-dessus etaient verts pendant que l'ecran reel n'affichait
// AUCUN bloc de demarrage. Ils prouvaient une configuration que l'application
// ne produit jamais. Un test qui garde un ecran fantome ne garde rien.
//
// Les tests ci-dessous montent l'ecran exactement comme le conteneur, et le
// dernier d'entre eux verifie que cette phrase reste vraie.
// -----------------------------------------------------------------------------

/**
 * Le profil EXACT de la recette telephone : compte neuf (zero seance terminee)
 * sur lequel un cycle a deja ete choisi — l'ecran capture affichait « Vitesse &
 * detente · Seance 1 sur 12 ».
 *
 * Ce detail n'est pas decoratif : c'est le cas ou le bloc V-A perd sa ligne
 * « pourquoi ce cycle » (viewModel.ts §5.8 bis, un cycle tourne deja), donc
 * celui ou il a le moins de contenu. S'il tient ici, il tient partout.
 */
const PROFIL_RECETTE: Partial<HomeVNextInput> = {
  microcycleGoal: "explosivite",
  microcycleSessionIndex: 0,
};

const entreeRecette = (): HomeVNextInput => ({ ...NOUVEAU().input, ...PROFIL_RECETTE });

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

/** Tous les textes rendus, aplatis — pour prouver qu'une phrase N'EST PAS la. */
const textesRendus = (racine: ReturnType<typeof rendre>): string[] =>
  racine
    .findAllByType(Text, { deep: true })
    .flatMap((n) => React.Children.toArray(n.props.children))
    .filter((c): c is string => typeof c === "string");

describe("Demarrage — le montage reel de l'application", () => {
  it("zero seance + cycle actif : l'etat est bien « premiere mission »", () => {
    const vm = buildHomeVNextViewModel(entreeRecette(), { demarrage: "A" });

    expect(vm.demarrage).not.toBeNull();
    expect(vm.demarrage?.kind).toBe("premiere_mission");
    if (vm.demarrage === null || vm.demarrage.kind !== "premiere_mission") throw new Error("V-A attendue");
    expect(vm.demarrage.premiersPas).toHaveLength(3);
    // Un cycle tourne deja : recommander un cycle a cote serait deux verites
    // qui s'affrontent. La ligne est retiree A LA SOURCE, pas par l'ecran.
    expect(vm.demarrage.pourquoiCeCycle).toBeNull();
    // Et le bloc a bien absorbe « MA FORME » : une seule facon de le dire.
    expect(vm.form).toBeNull();
  });

  it("le bloc « Premiere mission » est REELLEMENT rendu par le montage de l'app", () => {
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { demarrage: "A" });
    const racine = rendreCommeLApp(vm, input);

    // Le coeur de la regression du 04/08 : le ViewModel construisait le bloc,
    // l'ecran ne le rendait pas.
    expect(compter(racine, MARQUEURS.demarrage)).toBe(1);
    expect(compter(racine, MARQUEURS.demarragePas)).toBe(3);
    // Le traitement hero et le bloc vont ENSEMBLE : un CTA agrandi sans le bloc
    // qui le justifie, c'est exactement ce que la capture montrait.
    expect(compter(racine, MARQUEURS.actionHero)).toBe(1);
  });

  it("un seul message de demarrage a l'ecran — la carte progression ne redit pas la meme chose", () => {
    const input = entreeRecette();
    const vm = buildHomeVNextViewModel(input, { demarrage: "A" });
    const racine = rendreCommeLApp(vm, input);

    // La carte progression a un etat « vide » dont les trois reperes disent mot
    // pour mot ce que disent les trois premiers pas. Les deux ensemble, c'est la
    // redite que le fondateur a vue sur son telephone.
    expect(compter(racine, MARQUEURS.demarrage)).toBe(1);
    expect(compter(racine, MARQUEURS.progression)).toBe(0);

    const textes = textesRendus(racine);
    for (const redite of [
      "Termine ta première séance.",
      "Partage ton ressenti.",
      "Compare tes prochains tests.",
    ]) {
      expect(textes).not.toContain(redite);
    }
  });

  it("des la premiere seance terminee, la carte progression reprend sa place", () => {
    // Le bloc de demarrage ne masque pas la carte : il l'occupe TANT QU'IL
    // EXISTE. Sans ce test, on pourrait « corriger » en supprimant la carte.
    const plein = getHomeVNextFixture("tendance-disponible")!;
    const vm = buildHomeVNextViewModel(plein.input, { demarrage: "A" });
    expect(vm.demarrage).toBeNull();

    const racine = rendreCommeLApp(vm, plein.input);
    expect(compter(racine, MARQUEURS.demarrage)).toBe(0);
    expect(compter(racine, MARQUEURS.progression)).toBe(1);
  });

  it("aucun element du bloc n'est tapable, en variante 2 aussi", () => {
    const input = entreeRecette();
    const racine = rendreCommeLApp(buildHomeVNextViewModel(input, { demarrage: "A" }), input);
    const bloc = racine.find((n) => n.props && n.props.testID === MARQUEURS.demarrage);
    const tactiles = bloc.findAll(
      (n) =>
        Boolean(n.props) &&
        (typeof n.props.onPress === "function" ||
          n.props.accessibilityRole === "button" ||
          n.props.accessibilityRole === "link"),
      { deep: true }
    );
    expect(tactiles).toEqual([]);
  });

  it("l'ecran de demarrage respire avec la hauteur — et son plafond tient", () => {
    const input = entreeRecette();
    const racine = rendreCommeLApp(buildHomeVNextViewModel(input, { demarrage: "A" }), input);

    // Deux intervalles, pas trois : la respiration se glisse ENTRE les blocs
    // existants. Un troisieme en fin d'ecran ne ferait que deplacer du vide.
    const respirations = racine.findAll(
      (n) => typeof n.type === "string" && n.props?.testID === MARQUEURS.respirationDemarrage,
      { deep: true }
    );
    expect(respirations).toHaveLength(2);

    // LE PLAFOND. Sans lui, une tablette etalerait trois blocs sur 1000 px.
    for (const r of respirations) {
      const style = StyleSheet.flatten(r.props.style) as { flexGrow?: number; maxHeight?: number };
      expect(style.flexGrow).toBe(1);
      expect(style.maxHeight).toBe(espacement.respirationDemarrageMax);
    }

    // Et rien n'a ete AJOUTE a l'ecran : un intervalle ne porte aucun texte.
    for (const r of respirations) {
      expect(r.findAllByType(Text, { deep: true })).toEqual([]);
    }
  });

  it("hors demarrage, aucun intervalle extensible n'existe", () => {
    // La respiration appartient au seul ecran qui en a besoin. Sur un ecran
    // plein, elle ecarterait des blocs qui ont deja de quoi remplir la hauteur.
    const plein = getHomeVNextFixture("tendance-disponible")!;
    const racine = rendreCommeLApp(buildHomeVNextViewModel(plein.input), plein.input);
    expect(compter(racine, MARQUEURS.respirationDemarrage)).toBe(0);
  });

  it("le montage teste ci-dessus est bien celui du conteneur", () => {
    // LE TEST QUI EMPECHE CETTE SECTION DE REDEVENIR UN ECRAN FANTOME. Si le
    // conteneur cesse un jour de monter la variante 2, les tests ci-dessus
    // garderaient une configuration morte sans que rien ne le signale.
    const source = fs.readFileSync(
      path.join(__dirname, "..", "..", "screens", "homeVNext", "HomeVNextContainer.tsx"),
      "utf8"
    );
    expect(source).toContain('variante="v2"');
    expect(source).toContain("progression={progression}");
  });
});
