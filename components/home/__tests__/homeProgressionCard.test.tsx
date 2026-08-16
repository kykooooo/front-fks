// components/home/__tests__/homeProgressionCard.test.tsx
// =============================================================================
// LA CARTE « Ma progression » ENRICHIE DE L'ANCIEN HOME — TESTS DE RENDU
// =============================================================================
//
// Decision fondateur 15/08 (« Enrichir sur place ») : le contenu de la carte
// Progression de l'ancien Home vient du ViewModel canonique
// (`screens/homeVNext/progressionViewModel.ts`), rendu par
// `components/home/HomeProgressionCard.tsx` dans le cadre INCHANGE du
// HomeCarouselCard. Ces tests verifient ce que la carte affiche REELLEMENT,
// sur les memes fixtures que le test du ViewModel :
//
//   - les trois etats rendent le contenu du VM, verbatim (empty : titre +
//     3 reperes + mention ; collecting : faits + « encore N » ; ready :
//     resume + comparaison de test pre-formatee) ;
//   - AUCUNE courbe, dans aucun etat — la tendance vit dans HomeReadinessHero
//     juste au-dessus, une seconde serie serait contradictoire (R5 locale) ;
//   - ni « jours d'affilée », ni flamme, ni serie : la ligne streak de
//     l'ancienne carte a disparu (doublon de la stat « Série » de la ligne
//     stats, honnete via H3) ;
//   - le pied suit STRICTEMENT vm.detail : lien present ssi `affiche` (le
//     ViewModel decide, jamais la carte) ;
//   - aucun libelle d'etat global interdit (D1) ;
//   - regle d'or : numberOfLines sur chaque Text, minHeight jamais height,
//     et pas un pixel de la typo vNext (aucun import homeVNextTokens).
//
// NOTE D'EXECUTION : depuis un worktree, `npx jest` nu liste 0 test (piege
// testPathIgnorePatterns). Ce fichier s'execute avec la config dediee :
//   npx jest --config jest.worktree.config.js components/home/__tests__
// =============================================================================

import { readFileSync } from "fs";
import { resolve } from "path";

import React from "react";
import { Text, TouchableOpacity } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import HomeProgressionCard from "../HomeProgressionCard";
import {
  PROGRESSION_FIXTURES_RENDU,
  getProgressionFixture,
  type ProgressionFixture,
} from "../../../screens/homeVNext/fixtures";
import {
  buildProgressionViewModel,
  type ProgressionViewModel,
} from "../../../screens/homeVNext/progressionViewModel";
import { LIBELLES_ETAT_INTERDITS } from "../../../__tests__/homeVNext/libellesEtatInterdits";

// -----------------------------------------------------------------------------
// Outils (memes motifs que __tests__/homeVNext/HomeVNextProgression.test.tsx)
// -----------------------------------------------------------------------------

/**
 * Ni le mot, ni la metrique (R6) — etendu aux DEUX apostrophes : l'ancienne
 * carte ecrivait « jours d’affilée » avec l'apostrophe typographique.
 */
const MOTIF_SERIE_INTERDIT = /(streak|s[eé]ries?\b|jours d['’]affil)/i;

/** Placeholders interdits par R1 : on omet le fait, on ne le remplace pas. */
const MOTIF_PLACEHOLDER_INTERDIT = /^(0|0 min|0 minutes?|--|—|-)$/;

function fixture(id: string): ProgressionFixture {
  const f = getProgressionFixture(id);
  if (!f) throw new Error(`fixture de progression introuvable : ${id}`);
  return f;
}

function vmDe(id: string): ProgressionViewModel {
  return buildProgressionViewModel(fixture(id).input);
}

function monter(element: React.ReactElement) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(element);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

function monterCarte(vm: ProgressionViewModel, onVoirProgression: () => void = () => {}) {
  return monter(<HomeProgressionCard vm={vm} onVoirProgression={onVoirProgression} />);
}

/** Tous les textes affiches, dans l'ordre (chaque segment JSX separement). */
function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children as React.ReactNode).filter(
        (c): c is string => typeof c === "string"
      )
    );
}

/** Les memes, en un seul bloc — pour les motifs qui chassent une sous-chaine. */
function corpus(instance: ReactTestInstance): string {
  return textes(instance).join("\n");
}

/** Rejoue chaque fixture de demonstration a travers la carte. */
function surChaqueFixture(
  verifier: (vm: ProgressionViewModel, racine: ReactTestInstance, id: string) => void
) {
  for (const f of PROGRESSION_FIXTURES_RENDU) {
    const vm = buildProgressionViewModel(f.input);
    const rendu = monterCarte(vm);
    try {
      verifier(vm, rendu.root, f.id);
    } catch (e) {
      throw new Error(`fixture "${f.id}" : ${(e as Error).message}`);
    } finally {
      demonter(rendu);
    }
  }
}

// -----------------------------------------------------------------------------
// 1. Les trois etats rendent le contenu du VM, verbatim
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — les trois etats", () => {
  test("empty : titre en ligne de tete + 3 reperes + mention honnete, sans lien", () => {
    const vm = vmDe("nouveau-joueur");
    if (vm.state !== "empty") throw new Error("etat attendu : empty");
    const rendu = monterCarte(vm);
    const t = textes(rendu.root);

    // Le titre du VM REMPLACE « Lance ta première séance ».
    expect(t).toContain(vm.titre);
    for (const repere of vm.reperes) {
      expect(t).toContain(repere.texte);
    }
    expect(t).toContain(vm.mention);
    // Pas de lien : detail.affiche est false dans cet etat.
    expect(vm.detail.affiche).toBe(false);
    expect(rendu.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    demonter(rendu);
  });

  test("collecting : chaque fait reel (valeur + libelle), l'explication « encore N », pas le fait avant_tendance", () => {
    const vm = vmDe("deux-seances-tendance-indisponible");
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const rendu = monterCarte(vm);
    const t = textes(rendu.root);

    const faitsRendus = vm.faits.filter((f) => f.cle !== "avant_tendance");
    expect(faitsRendus.length).toBeGreaterThan(0);
    for (const fait of faitsRendus) {
      expect(t).toContain(fait.valeur);
      expect(t).toContain(fait.libelle);
    }
    // L'explication complete vient du VM (calculee depuis les seuils).
    expect(t).toContain(vm.tendanceIndisponible.explication);
    // Le fait avant_tendance n'est PAS rendu en ligne de fait : son libelle
    // n'apparait dans aucun segment (l'explication, elle, porte la phrase
    // complete — c'est un autre texte).
    const avant = vm.faits.find((f) => f.cle === "avant_tendance");
    if (avant) {
      expect(t).not.toContain(avant.libelle);
    }
    // Pas de lien en collecting (verdict du VM, inchange par le lot L5).
    expect(vm.detail.affiche).toBe(false);
    expect(rendu.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    demonter(rendu);
  });

  test("collecting : le repere de test existe dans le VM mais n'est PAS rendu (perimetre : faits + encore-N)", () => {
    const vm = vmDe("test-physique-en-recul");
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    if (!vm.repereTest) throw new Error("fixture attendue AVEC repereTest");
    const rendu = monterCarte(vm);
    const bloc = corpus(rendu.root);

    expect(bloc).not.toContain(vm.repereTest.comparaison.label);
    expect(bloc).not.toContain(vm.repereTest.comparaison.avantAffiche);
    expect(bloc).not.toContain(vm.repereTest.comparaison.ecartAffiche);
    demonter(rendu);
  });

  test("collecting R1 : « donnee-manquante » ne fabrique aucun placeholder (ni 0, ni tiret)", () => {
    const vm = vmDe("donnee-manquante");
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const rendu = monterCarte(vm);
    for (const segment of textes(rendu.root)) {
      expect(segment.trim()).not.toMatch(MOTIF_PLACEHOLDER_INTERDIT);
    }
    demonter(rendu);
  });

  test("ready : le resume (fait cumul R7) + la comparaison de test, champs pre-formates du VM", () => {
    const vm = vmDe("test-physique-ameliore");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    if (!vm.repereTest) throw new Error("fixture attendue AVEC repereTest");
    const rendu = monterCarte(vm);
    const t = textes(rendu.root);

    expect(t).toContain(vm.resume.valeur);
    expect(t).toContain(vm.resume.libelle);
    // La comparaison : label + avant/apres/ecart tels que le VM les a formates
    // (couleurs neutres, aucun jugement — le sens n'est pas re-derive ici).
    expect(t).toContain(vm.repereTest.comparaison.label);
    expect(t).toContain(vm.repereTest.comparaison.avantAffiche);
    expect(t).toContain(vm.repereTest.comparaison.apresAffiche);
    expect(t).toContain(vm.repereTest.comparaison.ecartAffiche);
    demonter(rendu);
  });

  test("ready sans repere : le resume seul, aucune ligne de test inventee", () => {
    const vm = vmDe("aucune-comparaison-de-test");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.repereTest).toBeNull();
    const rendu = monterCarte(vm);
    const t = textes(rendu.root);

    expect(t).toContain(vm.resume.valeur);
    expect(t).toContain(vm.resume.libelle);
    // Rien d'autre que resume + lien : exactement 4 segments de texte
    // (valeur, libelle, libelle du lien, fleche du lien) — aucune ligne de
    // comparaison fabriquee sans repere.
    expect(t).toHaveLength(4);
    expect(t).toContain(vm.detail.label as string);
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// 2. Jamais de courbe — la tendance vit dans HomeReadinessHero, au-dessus
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — aucune courbe, dans aucun etat", () => {
  test("aucun noeud SVG, et les textes de vm.courbe (portee, periode) restent hors ecran", () => {
    surChaqueFixture((vm, racine) => {
      const svg = racine.findAll((n) => typeof n.type === "string" && /svg/i.test(n.type));
      expect(svg).toHaveLength(0);
      if (vm.state === "ready") {
        const bloc = corpus(racine);
        expect(bloc).not.toContain(vm.courbe.periodeLabel);
        expect(bloc).not.toContain(vm.courbe.portee);
      }
    });
  });
});

// -----------------------------------------------------------------------------
// 3. La ligne serie a disparu : ni le mot, ni la flamme
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — plus de serie", () => {
  test("aucun texte serie/streak/« jours d'affilée », aucune icone flame, jamais « Lance ta première séance »", () => {
    surChaqueFixture((vm, racine) => {
      const bloc = corpus(racine);
      expect(bloc).not.toMatch(MOTIF_SERIE_INTERDIT);
      expect(bloc).not.toMatch(/Lance ta premi[eè]re s[eé]ance/i);
      const flammes = racine.findAll(
        (n) => (n.props as { name?: unknown }).name === "flame"
      );
      expect(flammes).toHaveLength(0);
    });
  });
});

// -----------------------------------------------------------------------------
// 4. Le pied suit vm.detail, strictement
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — le pied est decide par le ViewModel", () => {
  test("lien present ssi detail.affiche, avec le libelle exact du VM", () => {
    surChaqueFixture((vm, racine) => {
      const liens = racine.findAllByType(TouchableOpacity);
      if (vm.detail.affiche) {
        expect(liens).toHaveLength(1);
        expect(textes(racine)).toContain(vm.detail.label as string);
      } else {
        expect(liens).toHaveLength(0);
        expect(corpus(racine)).not.toContain("Voir ma progression");
      }
    });
  });

  test("le tap du lien appelle onVoirProgression (cablage goToProgression)", () => {
    const vm = vmDe("tendance-disponible");
    if (vm.state !== "ready") throw new Error("etat attendu : ready");
    expect(vm.detail.affiche).toBe(true);
    const onVoir = jest.fn();
    const rendu = monterCarte(vm, onVoir);
    const [lien] = rendu.root.findAllByType(TouchableOpacity);
    act(() => {
      (lien.props as { onPress: () => void }).onPress();
    });
    expect(onVoir).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });
});

// -----------------------------------------------------------------------------
// 5. Aucun libelle d'etat global interdit (D1)
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — libelles interdits", () => {
  test("aucun jugement global ne sort de la carte, quel que soit l'etat", () => {
    surChaqueFixture((_vm, racine) => {
      const bloc = corpus(racine);
      for (const libelle of LIBELLES_ETAT_INTERDITS) {
        expect(bloc).not.toContain(libelle);
      }
    });
  });
});

// -----------------------------------------------------------------------------
// 6. Regle d'or + typo de l'ancien Home
// -----------------------------------------------------------------------------

describe("HomeProgressionCard — regle d'or et typo A", () => {
  const source = readFileSync(resolve(__dirname, "../HomeProgressionCard.tsx"), "utf8");

  test("minHeight jamais height (les gabarits ne coupent pas le texte)", () => {
    // `minHeight:` et `lineHeight:` ont une lettre devant le h — seuls les
    // `height:` nus sont interdits.
    expect(source).not.toMatch(/(?<![a-zA-Z])height\s*:/);
  });

  test("typo de l'ancien Home uniquement : aucun import des tokens vNext", () => {
    // Le mot apparait dans le commentaire d'en-tete de la carte (qui documente
    // precisement cette interdiction) : on ne chasse que les IMPORTS.
    expect(source).not.toMatch(/from\s+["'][^"']*homeVNextTokens/);
  });

  test("chaque Text rendu porte numberOfLines (le contenu du VM ne deborde jamais du cadre)", () => {
    surChaqueFixture((_vm, racine) => {
      const noeudsTexte = racine.findAllByType(Text);
      expect(noeudsTexte.length).toBeGreaterThan(0);
      for (const noeud of noeudsTexte) {
        const lignes = (noeud.props as { numberOfLines?: unknown }).numberOfLines;
        expect(typeof lignes).toBe("number");
        expect(lignes as number).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// -----------------------------------------------------------------------------
// 7. La greffe dans l'ancien Home (source de screens/HomeScreen.tsx)
// -----------------------------------------------------------------------------

describe("HomeScreen — la carte enrichie est bien greffee sur place", () => {
  const home = readFileSync(resolve(__dirname, "../../../screens/HomeScreen.tsx"), "utf8");

  test("le cadre et la position n'ont pas bouge : HomeProgressionCard vit DANS le HomeCarouselCard Progression", () => {
    expect(home).toMatch(/import HomeProgressionCard from "\.\.\/components\/home\/HomeProgressionCard"/);
    expect(home).toMatch(
      /<HomeCarouselCard title="Progression" subtitle="Régularité & forme">\s*<HomeProgressionCard vm=\{progression\} onVoirProgression=\{goToProgression\} \/>/
    );
  });

  test("seule `progression` est consommee du pipeline vNext (jamais vm.demarrage)", () => {
    expect(home).toMatch(/const\s*\{\s*progression\s*\}\s*=\s*useHomeVNextViewModel\(\)/);
    expect(home).not.toMatch(/vm\.demarrage/);
  });

  test("l'ancienne ligne serie et son texte d'usine ont disparu de l'ecran", () => {
    expect(home).not.toMatch(/jours d['’]affil/i);
    expect(home).not.toMatch(/Lance ta premi[eè]re s[eé]ance/i);
  });
});
