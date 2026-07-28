// __tests__/homeVNext/HomeVNextProgression.test.tsx
// =============================================================================
// VARIANTE 2 — TESTS DE RENDU DE LA CARTE "MA PROGRESSION"
// =============================================================================
//
// Le test de `progressionViewModel` verifie ce que la carte a le DROIT
// d'afficher. Celui-ci verifie ce qu'elle affiche REELLEMENT : il monte le vrai
// composant sur les 6 cas de demonstration et relit l'arbre produit.
//
// Les regles verifiees ne sont pas cosmetiques, ce sont les regles de la
// doctrine d'honnetete :
//   R1  aucun defaut artificiel  -> sur "donnee-manquante", 2 lignes de fait et
//                                   non 4, et pas un seul "0" ni "—" ;
//   R3  portee obligatoire       -> la portee est a l'ecran des qu'une courbe
//                                   l'est, et c'est un element d'accessibilite
//                                   a part entiere ;
//   R4  pas d'etat global        -> aucun libelle d'etat tant que les charges
//                                   club ne sont pas capturees ;
//   R5  courbe = vrais points    -> aucun trace hors de l'etat "ready" ;
//   R6  "serie" banni            -> ni le mot, ni la flamme, nulle part ;
//   R8  un seul aplat            -> la carte n'en pose aucun.
//
// Plus les deux regles propres a cette variante :
//   - la VARIANTE 1 RESTE INTACTE (aucune carte progression, "MA FORME"
//     toujours la, lien de sortie toujours la) ;
//   - UN SEUL element tactile dans la carte, jamais deux imbriques, et aucun du
//     tout quand le ViewModel n'autorise pas le pied.
//
// NOTE D'EXECUTION : la config jest du depot ignore `.claude/worktrees/`
// (`testPathIgnorePatterns`). Depuis ce worktree, `npx jest` liste 0 test et
// sort en SUCCES. Ce fichier s'execute avec la config dediee du prototype :
//   npx jest --config prototype/home-vnext/jest.proto.config.js
// =============================================================================

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import {
  HomeVNextProgression,
  libelleSansUniteRepetee,
} from "../../components/homeVNext/HomeVNextProgression";
import { MARQUEURS } from "../../components/homeVNext/homeVNextMarqueurs";
import { couleurs, TAILLE_TACTILE_MIN } from "../../components/homeVNext/homeVNextTokens";
import { HomeVNextScreen } from "../../screens/homeVNext/HomeVNextScreen";
import {
  HOME_VNEXT_FIXTURES_RENDU,
  PROGRESSION_FIXTURES_RENDU,
  getProgressionFixture,
  progressionInputDepuisHome,
} from "../../screens/homeVNext/fixtures";
import {
  buildProgressionViewModel,
  type ProgressionInput,
  type ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";
import { buildHomeVNextViewModel } from "../../screens/homeVNext/viewModel";
import type { TestEntry } from "../../screens/tests/testConfig";

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

/** Les 5 cas de demonstration + la preuve R1. */
const CAS = PROGRESSION_FIXTURES_RENDU;

// -----------------------------------------------------------------------------
// Outils
// -----------------------------------------------------------------------------

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

function monterCarte(vm: ProgressionViewModel) {
  return monter(<HomeVNextProgression progression={vm} />);
}

/** Tous les textes affiches, dans l'ordre. */
function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children).filter((c): c is string => typeof c === "string")
    );
}

/**
 * Noeuds NATIFS portant un marqueur. On filtre sur `typeof n.type === "string"`
 * pour ne compter que les elements reellement rendus : `findAll` remonte aussi
 * les composants composites, ce qui compterait chaque marqueur deux fois.
 */
function noeuds(instance: ReactTestInstance, marqueur: string): ReactTestInstance[] {
  return instance.findAll(
    (n) => typeof n.type === "string" && (n.props as { testID?: string }).testID === marqueur
  );
}

/**
 * Tous les elements REELLEMENT tactiles. On ne cherche pas `Pressable` par son
 * type : RN l'exporte enveloppe dans un `memo(forwardRef(...))` que
 * `findAllByType` ne retrouve pas.
 */
function elementsTactiles(instance: ReactTestInstance): ReactTestInstance[] {
  return instance.findAll(
    (n) =>
      typeof n.type === "string" &&
      typeof (n.props as { onStartShouldSetResponder?: unknown }).onStartShouldSetResponder ===
        "function"
  );
}

/**
 * Le noeud qui porte reellement le `onPress` d'un marqueur.
 *
 * Le marqueur `testID` existe en double dans l'arbre : sur le composite
 * `Pressable` ET sur le `View` natif qu'il rend. Seul le composite porte
 * `onPress` — le natif, lui, ne recoit que les gestionnaires de responder. On
 * cherche donc le premier des deux qui expose reellement l'action.
 */
function pressableDeMarqueur(
  instance: ReactTestInstance,
  marqueur: string
): ReactTestInstance | null {
  const trouves = instance.findAll(
    (n) =>
      (n.props as { testID?: string }).testID === marqueur &&
      typeof (n.props as { onPress?: unknown }).onPress === "function"
  );
  return trouves[0] ?? null;
}

/** Toutes les couleurs de fond posees dans l'arbre. */
function fonds(node: unknown): string[] {
  const trouves: string[] = [];
  const visiter = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const style = StyleSheet.flatten(n.props?.style);
    const bg = (style as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (typeof bg === "string") trouves.push(bg.toUpperCase());
    (n.children ?? []).forEach(visiter);
  };
  visiter(node);
  return trouves;
}

/** Un `Text` imbrique dans un autre `Text` herite de son `numberOfLines`. */
function estFragmentImbrique(node: ReactTestInstance): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.type === Text) return true;
    parent = parent.parent;
  }
  return false;
}

const TITRES_DU_SOCLE = new Set(["MA SEMAINE", "MA FORME", "MA PROGRESSION"]);

// =============================================================================

describe("HomeVNextProgression — les 6 cas se rendent", () => {
  it.each(CAS.map((f) => [f.id, f] as const))("%s se rend sans erreur", (_id, fixture) => {
    const rendu = monterCarte(buildProgressionViewModel(fixture.input));
    expect(rendu.toJSON()).toBeTruthy();
    expect(noeuds(rendu.root, MARQUEURS.progression)).toHaveLength(1);
    demonter(rendu);
  });

  it.each(CAS.map((f) => [f.id, f] as const))(
    "%s borne tous ses textes sauf le titre de section",
    (_id, fixture) => {
      const rendu = monterCarte(buildProgressionViewModel(fixture.input));
      for (const t of rendu.root.findAllByType(Text)) {
        const contenu = React.Children.toArray(t.props.children).filter(
          (c): c is string => typeof c === "string"
        );
        if (contenu.length === 0) continue;
        // `components/ui/SectionHeader` ne prend pas de `numberOfLines` et le
        // prototype n'a pas le droit de le modifier.
        if (contenu.some((c) => TITRES_DU_SOCLE.has(c))) continue;
        if (t.props.numberOfLines === undefined && estFragmentImbrique(t)) continue;
        expect(typeof t.props.numberOfLines).toBe("number");
      }
      demonter(rendu);
    }
  );
});

// =============================================================================

describe("R1 — aucun defaut artificiel", () => {
  it("fait DISPARAITRE les faits inconnus au lieu d'afficher 0 ou un tiret", () => {
    const fixture = getProgressionFixture("donnee-manquante");
    expect(fixture).not.toBeNull();
    const vm = buildProgressionViewModel(fixture!.input);
    const rendu = monterCarte(vm);

    // 3 seances terminees, aucune duree, aucun ressenti -> 2 lignes seulement :
    // le cumul de seances et ce qui manque avant la tendance.
    expect(noeuds(rendu.root, MARQUEURS.progressionFait)).toHaveLength(2);

    const corpus = textes(rendu.root).join(" ");
    expect(corpus).toContain("Encore 1 séance");
    expect(corpus).not.toMatch(/minutes? r[ée]alis/i);
    expect(corpus).not.toMatch(/ressenti/i);
    // Ni zero de remplissage, ni placeholder.
    expect(corpus).not.toMatch(/\b0\s*min\b/i);
    expect(corpus).not.toContain("—");
    expect(corpus).not.toContain("--");
    demonter(rendu);
  });

  it("rend exactement une ligne par fait fourni par le ViewModel", () => {
    for (const fixture of CAS) {
      const vm = buildProgressionViewModel(fixture.input);
      const attendu =
        vm.state === "collecting" ? vm.faits.length : vm.state === "ready" ? 1 : 0;
      const rendu = monterCarte(vm);
      expect(noeuds(rendu.root, MARQUEURS.progressionFait)).toHaveLength(attendu);
      demonter(rendu);
    }
  });

  it("n'ecrit jamais deux fois la meme phrase sur ce qui manque", () => {
    // En "collecting", le dernier fait dit deja "Avant d'afficher une tendance /
    // Encore 2 seances". `tendanceIndisponible.explication` dit exactement la
    // meme chose : la carte ne doit pas la rendre en plus.
    const fixture = getProgressionFixture("deux-seances-tendance-indisponible");
    const vm = buildProgressionViewModel(fixture!.input);
    expect(vm.state).toBe("collecting");
    const rendu = monterCarte(vm);
    const lignes = textes(rendu.root);
    if (vm.state === "collecting") {
      expect(lignes).not.toContain(vm.tendanceIndisponible.explication);
    }
    demonter(rendu);
  });
});

// =============================================================================

describe("R5 — aucune courbe sans vrais points", () => {
  it.each(CAS.map((f) => [f.id, f] as const))(
    "%s ne trace une courbe que dans l'etat ready",
    (_id, fixture) => {
      const vm = buildProgressionViewModel(fixture.input);
      const rendu = monterCarte(vm);
      expect(noeuds(rendu.root, MARQUEURS.courbe)).toHaveLength(vm.state === "ready" ? 1 : 0);
      demonter(rendu);
    }
  );
});

// =============================================================================

describe("R3 — la portee est a l'ecran des qu'une courbe l'est", () => {
  it.each(CAS.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const vm = buildProgressionViewModel(fixture.input);
    const rendu = monterCarte(vm);
    const portees = noeuds(rendu.root, MARQUEURS.progressionPortee);
    expect(portees).toHaveLength(vm.state === "ready" ? 1 : 0);
    if (vm.state === "ready") {
      // Le texte exact du ViewModel, pas une paraphrase de la vue.
      expect(textes(rendu.root)).toContain(vm.courbe.portee);
      // Element d'accessibilite A PART : c'est tout l'argument contre la carte
      // entierement pressable. S'il etait absorbe dans un conteneur
      // `accessible`, R3 serait perdue pour les lecteurs d'ecran.
      expect(portees[0]!.props.accessibilityElementsHidden).toBeFalsy();
      expect(portees[0]!.props.importantForAccessibility).not.toBe("no-hide-descendants");
    }
    demonter(rendu);
  });
});

// =============================================================================

describe("R4 — aucun etat physique global tant que les charges club ne sont pas capturees", () => {
  it.each(CAS.map((f) => [f.id, f] as const))("%s n'affirme aucun etat", (_id, fixture) => {
    const vm = buildProgressionViewModel(fixture.input);
    expect(vm.etatGlobal.connu).toBe(false);
    const rendu = monterCarte(vm);
    const corpus = textes(rendu.root).join(" ");
    for (const interdit of ["En forme", "Prêt à performer", "Pret a performer", "Frais", "Fatigué"]) {
      expect(corpus).not.toContain(interdit);
    }
    demonter(rendu);
  });

  it("affiche le libelle UNIQUEMENT quand les charges club sont capturees", () => {
    const base = getProgressionFixture("tendance-disponible")!.input;
    const avecCharges: ProgressionInput = {
      chargesClubCapturees: true,
      libelleEtatGlobal: "Bien récupéré",
      seancesTerminees: base.seancesTerminees,
      testsTerrain: base.testsTerrain,
      tendance: base.tendance,
      semaineCourante: base.semaineCourante,
    };
    const vm = buildProgressionViewModel(avecCharges);
    expect(vm.etatGlobal.connu).toBe(true);

    const rendu = monterCarte(vm);
    expect(textes(rendu.root)).toContain("Bien récupéré");
    if (vm.state === "ready") {
      // La portee change aussi : les charges club y sont desormais comptees.
      expect(vm.courbe.portee).toContain("charges club");
    }
    demonter(rendu);
  });
});

// =============================================================================

describe("R6 — ni serie, ni streak, ni flamme", () => {
  it.each(CAS.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const rendu = monterCarte(buildProgressionViewModel(fixture.input));
    const corpus = textes(rendu.root).join(" ");
    // "séance" contient "séan", pas "série" : le motif ne peut pas faire de faux
    // positif sur le vocabulaire legitime de la carte.
    expect(corpus).not.toMatch(/s[ée]rie/i);
    expect(corpus).not.toMatch(/streak|flamme|d'affil/i);
    expect(corpus).not.toMatch(/\b(ATL|CTL|TSB)\b/);
    demonter(rendu);
  });
});

// =============================================================================

describe("R8 — la carte ne pose aucun aplat colore", () => {
  it.each(CAS.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const rendu = monterCarte(buildProgressionViewModel(fixture.input));
    const orange = fonds(rendu.toJSON()).filter((c) => c === couleurs.action.toUpperCase());
    expect(orange).toHaveLength(0);
    demonter(rendu);
  });
});

// =============================================================================

describe("Accessibilite — un seul element tactile, jamais imbrique", () => {
  it.each(CAS.map((f) => [f.id, f] as const))(
    "%s : le nombre d'elements tactiles suit le verdict du ViewModel",
    (_id, fixture) => {
      const vm = buildProgressionViewModel(fixture.input);
      const rendu = monterCarte(vm);
      const tactiles = elementsTactiles(rendu.root);

      // Le ViewModel decide, la vue obeit : pas de pied en "empty" ni en
      // "collecting", donc AUCUN element tactile dans ces etats.
      expect(tactiles).toHaveLength(vm.detail.affiche ? 1 : 0);
      expect(noeuds(rendu.root, MARQUEURS.progressionDetail)).toHaveLength(
        vm.detail.affiche ? 1 : 0
      );

      for (const p of tactiles) {
        expect(p.props.disabled).toBeFalsy();
        expect(["button", "link"]).toContain(p.props.accessibilityRole);
        // Libelle EXPLICITE : hors contexte, un lien doit dire ce qu'il ouvre.
        // On verifie la CONDITION (la destination est nommee), pas une forme
        // particuliere : le libelle visible « Voir ma progression » se suffit a
        // lui-meme et n'a plus a etre prefixe du titre de la carte — le prefixer
        // dirait « Ma progression, Voir ma progression ».
        expect(String(p.props.accessibilityLabel)).toMatch(/ma progression/i);
        expect(String(p.props.accessibilityLabel).length).toBeGreaterThan(8);
        // Et le begaiement, justement, ne doit pas revenir.
        expect(String(p.props.accessibilityLabel).match(/progression/gi)).toHaveLength(1);
        const style = StyleSheet.flatten(p.props.style) as { minHeight?: number };
        expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
      }
      demonter(rendu);
    }
  );

  it("ne rend jamais un tactile a l'interieur d'un autre tactile", () => {
    // C'est LE piege de la carte entierement pressable : une carte tapable qui
    // contient un pied tapable produit une double annonce et une cible ambigue.
    //
    // On ne remonte que les ancetres NATIFS : `ReactTestInstance.parent` traverse
    // aussi les composants composites, et le composite `View` juste au-dessus
    // d'un `Pressable` porte les memes props que le noeud natif qu'il rend — il
    // se compterait donc lui-meme.
    for (const fixture of CAS) {
      const rendu = monterCarte(buildProgressionViewModel(fixture.input));
      for (const p of elementsTactiles(rendu.root)) {
        let parent = p.parent;
        while (parent) {
          if (typeof parent.type === "string") {
            const props = parent.props as { onStartShouldSetResponder?: unknown };
            expect(typeof props.onStartShouldSetResponder).not.toBe("function");
          }
          parent = parent.parent;
        }
      }
      demonter(rendu);
    }
  });

  it("laisse les faits parcourables un par un", () => {
    // Contre-preuve de la carte entierement pressable : chaque fait est un noeud
    // d'accessibilite distinct, avec son propre libelle.
    const vm = buildProgressionViewModel(
      getProgressionFixture("deux-seances-tendance-indisponible")!.input
    );
    const rendu = monterCarte(vm);
    const lignes = noeuds(rendu.root, MARQUEURS.progressionFait);
    expect(lignes.length).toBeGreaterThan(1);
    for (const ligne of lignes) {
      expect(ligne.props.accessible).toBe(true);
      expect(String(ligne.props.accessibilityLabel)).toMatch(/.+ : .+/);
    }
    demonter(rendu);
  });
});

// =============================================================================

describe("Comparaison de test terrain", () => {
  it("dit le sens par un MOT, jamais par une fleche, et ne peint rien en rouge", () => {
    const vm = buildProgressionViewModel(getProgressionFixture("test-physique-ameliore")!.input);
    const rendu = monterCarte(vm);
    expect(noeuds(rendu.root, MARQUEURS.progressionTest)).toHaveLength(1);
    const corpus = textes(rendu.root).join(" ");
    expect(corpus).toContain("en progrès");
    demonter(rendu);
  });

  it("rend la comparaison que le ViewModel a choisie, sans en changer un chiffre", () => {
    const vm = buildProgressionViewModel(getProgressionFixture("test-physique-ameliore")!.input);
    const comparaison = vm.state === "ready" ? vm.derniereComparaisonTest : null;
    expect(comparaison).not.toBeNull();

    const rendu = monterCarte(vm);
    const corpus = textes(rendu.root).join(" ");
    // Aucune valeur, aucun ecart n'est recalcule par la vue.
    expect(corpus).toContain(comparaison!.avantAffiche);
    expect(corpus).toContain(comparaison!.apresAffiche);
    expect(corpus).toContain(comparaison!.ecartAffiche);
    // Le libelle est celui du ViewModel, moins l'unite entre parentheses — qui
    // est deja imprimee sur les trois valeurs ci-dessus.
    expect(corpus).toContain(
      libelleSansUniteRepetee(comparaison!.label, comparaison!.unite)
    );
    demonter(rendu);
  });

  it("ne retire l'unite du libelle QUE lorsqu'elle y est reellement dupliquee", () => {
    // Les 17 libelles de FIELD_DEFS passent par cette fonction. Les trois cas
    // limites, verifies un par un :
    expect(libelleSansUniteRepetee("Saut en longueur (cm)", "cm")).toBe("Saut en longueur");
    expect(libelleSansUniteRepetee("Sprint 10 m (s)", "s")).toBe("Sprint 10 m");
    // "1 km" a pour unite canonique "s" mais ne porte aucune parenthese.
    expect(libelleSansUniteRepetee("1 km", "s")).toBe("1 km");
    // Les repetitions n'ont pas d'unite : rien a retirer.
    expect(libelleSansUniteRepetee("Goblet squat reps", "")).toBe("Goblet squat reps");
    // Une parenthese qui n'est PAS l'unite reste en place.
    expect(libelleSansUniteRepetee("Test 505 (aller-retour)", "s")).toBe(
      "Test 505 (aller-retour)"
    );
  });

  it("garde l'unite lisible sur les valeurs apres l'avoir retiree du libelle", () => {
    const vm = buildProgressionViewModel(getProgressionFixture("test-physique-ameliore")!.input);
    const comparaison = vm.state === "ready" ? vm.derniereComparaisonTest : null;
    expect(comparaison!.unite).not.toBe("");
    const rendu = monterCarte(vm);
    const corpus = textes(rendu.root).join(" ");
    // L'unite reste lue trois fois : avant, apres, ecart. Rien n'est cache.
    const occurrences = corpus.split(comparaison!.unite).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(3);
    demonter(rendu);
  });

  it("annonce une amelioration meme quand l'ecart affiche est negatif", () => {
    // Sprint 10 m : 1.85 s -> 1.78 s. L'ecart est NEGATIF et pourtant c'est un
    // progres. C'est exactement ce que `screens/ProgressScreen.tsx` (:645-647)
    // rend a l'envers avec une fleche.
    //
    // Ce test montait autrefois une entree fabriquee ici, parce qu'aucun cas de
    // demonstration n'AFFICHAIT ce sens : les mesures d'une meme batterie
    // partageaient un horodatage, et le departage donnait toujours le saut en
    // longueur. Depuis que les fixtures portent l'heure reelle de chaque
    // exercice, le cas est visible a l'ecran — donc le test se fait sur la
    // fixture elle-meme, celle que le fondateur regarde.
    const vm = buildProgressionViewModel(getProgressionFixture("test-physique-ameliore")!.input);
    const comparaison = vm.state === "ready" ? vm.derniereComparaisonTest : null;
    expect(comparaison).not.toBeNull();
    expect(comparaison!.champ).toBe("sprint10s");
    expect(comparaison!.sens).toBe("amelioration");
    expect(comparaison!.ecart).toBeLessThan(0);

    const rendu = monterCarte(vm);
    const bloc = noeuds(rendu.root, MARQUEURS.progressionTest)[0]!;
    // L'annonce vocale dit "puis", jamais la fleche : le caractere "→" reste
    // purement visuel.
    expect(String(bloc.props.accessibilityLabel)).toContain(" puis ");
    expect(String(bloc.props.accessibilityLabel)).not.toContain("→");
    expect(String(bloc.props.accessibilityLabel)).toContain("en progrès");
    // Le mot dit le sens, le signe ne le dit pas : "-0.07 s" est un progres.
    expect(textes(rendu.root)).toContain("en progrès");
    expect(textes(rendu.root)).toContain(comparaison!.ecartAffiche);
    demonter(rendu);
  });

  it("dit \"en retrait\" sans rouge quand la mesure a baisse", () => {
    const base = getProgressionFixture("tendance-disponible")!.input;
    const enRetrait: readonly TestEntry[] = [
      { ts: Date.UTC(2026, 5, 15, 10), playlist: "fondation", broadJumpCm: 227 },
      { ts: Date.UTC(2026, 6, 24, 10), playlist: "fondation", broadJumpCm: 218 },
    ];
    const vm = buildProgressionViewModel({
      chargesClubCapturees: false,
      seancesTerminees: base.seancesTerminees,
      testsTerrain: enRetrait,
      tendance: base.tendance,
      semaineCourante: base.semaineCourante,
    });
    const comparaison = vm.state === "ready" ? vm.derniereComparaisonTest : null;
    expect(comparaison?.sens).toBe("regression");

    const rendu = monterCarte(vm);
    const corpus = textes(rendu.root).join(" ");
    expect(corpus).toContain("en retrait");
    // L'ecart reste imprime avec son signe exact : rien n'est arrange.
    expect(corpus).toContain(comparaison!.ecartAffiche);
    // Pas de rouge en page d'accueil : deux mesures ne sont pas un verdict.
    const rouges = fonds(rendu.toJSON()).filter((c) => c === "#DC2626");
    expect(rouges).toHaveLength(0);
    demonter(rendu);
  });

  it("explique l'absence de comparaison en \"ready\", et se tait en \"collecting\"", () => {
    // En "ready" la carte est riche : une ligne honnete "pas encore de
    // comparaison" informe. En "collecting" elle ferait un deuxieme "pas encore"
    // a la suite du premier — la carte vide que la variante 2 doit supprimer.
    //
    // Les deux fixtures sont choisies pour que la condition soit REELLEMENT
    // remplie des deux cotes : un `if` qui ne se declenche pas ferait un test
    // vert qui ne prouve rien.
    const pret = buildProgressionViewModel(
      getProgressionFixture("aucune-comparaison-de-test")!.input
    );
    if (pret.state !== "ready") throw new Error("etat attendu : ready");
    expect(pret.comparaisonsTests.possible).toBe(false);
    const renduPret = monterCarte(pret);
    if (!pret.comparaisonsTests.possible) {
      expect(textes(renduPret.root)).toContain(pret.comparaisonsTests.explication);
    }
    demonter(renduPret);

    const enCours = buildProgressionViewModel(getProgressionFixture("donnee-manquante")!.input);
    if (enCours.state !== "collecting") throw new Error("etat attendu : collecting");
    expect(enCours.comparaisonsTests.possible).toBe(false);
    const renduEnCours = monterCarte(enCours);
    if (!enCours.comparaisonsTests.possible) {
      expect(textes(renduEnCours.root)).not.toContain(enCours.comparaisonsTests.explication);
    }
    demonter(renduEnCours);
  });

  it("montre une comparaison dans l'etat \"collecting\" quand elle existe vraiment", () => {
    // Branche de rendu qu'AUCUN des six cas de demonstration n'exerce : un ecart
    // mesure peut exister AVANT qu'une tendance soit calculable — deux tests
    // terrain espaces de deux mois chez un joueur qui n'a que deux seances FKS.
    // L'entree est donc fabriquee ICI, et c'est assume : ajouter ce contenu a la
    // fixture « Deux seances » aurait allonge la carte la plus longue des six et
    // fausse le tableau de hauteurs que le fondateur doit arbitrer.
    const base = getProgressionFixture("deux-seances-tendance-indisponible")!.input;
    const testsEspaces: readonly TestEntry[] = [
      { ts: Date.UTC(2026, 4, 16, 10, 15), playlist: "fondation", broadJumpCm: 205 },
      { ts: Date.UTC(2026, 6, 26, 10, 20), playlist: "fondation", broadJumpCm: 214 },
    ];
    const vm = buildProgressionViewModel({
      chargesClubCapturees: false,
      seancesTerminees: base.seancesTerminees,
      testsTerrain: testsEspaces,
      tendance: base.tendance,
      semaineCourante: base.semaineCourante,
    });
    if (vm.state !== "collecting") throw new Error("etat attendu : collecting");
    const c = vm.derniereComparaisonTest;
    expect(c).not.toBeNull();

    const rendu = monterCarte(vm);
    expect(noeuds(rendu.root, MARQUEURS.progressionTest)).toHaveLength(1);
    const corpus = textes(rendu.root).join(" ");
    expect(corpus).toContain(c!.ecartAffiche);
    expect(corpus).toContain("en progrès");
    // Et toujours aucun element tactile dans cet etat : la carte informe, elle
    // n'envoie pas sur une page qui mentirait.
    expect(noeuds(rendu.root, MARQUEURS.progressionDetail)).toHaveLength(0);
    demonter(rendu);
  });
});

// =============================================================================

describe("Mise en page — rien qui puisse deborder a 320 px", () => {
  /**
   * Largeurs en pixels tolerees, et leur origine. Ce sont des elements a TAILLE
   * INTRINSEQUE (une pastille, une marque), pas des largeurs de mise en page :
   * ils ne peuvent rien pousser hors de l'ecran.
   *   3  -> la marque bleue de `components/ui/SectionHeader`
   *   22 -> la pastille numerotee des reperes
   */
  const LARGEURS_INTRINSEQUES = new Set([3, 22]);

  function largeursEnPixels(node: unknown): number[] {
    const trouvees: number[] = [];
    const visiter = (n: any) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        n.forEach(visiter);
        return;
      }
      const style = StyleSheet.flatten(n.props?.style) as { width?: unknown } | undefined;
      if (typeof style?.width === "number") trouvees.push(style.width);
      (n.children ?? []).forEach(visiter);
    };
    visiter(node);
    return trouvees;
  }

  it("ne pose aucune largeur fixe en pixels hors des elements a taille intrinseque", () => {
    // Perimetre : les etats SANS courbe. Le trace, lui, calcule des largeurs en
    // pixels par construction (une hypotenuse ne s'exprime pas en pourcentage),
    // et ce code appartient a la variante 1, deja validee.
    const sansCourbe = CAS.filter((f) => buildProgressionViewModel(f.input).state !== "ready");
    expect(sansCourbe.length).toBeGreaterThan(0);

    for (const fixture of sansCourbe) {
      const rendu = monterCarte(buildProgressionViewModel(fixture.input));
      for (const largeur of largeursEnPixels(rendu.toJSON())) {
        expect(LARGEURS_INTRINSEQUES.has(largeur)).toBe(true);
      }
      demonter(rendu);
    }
  });

  it("plafonne la colonne des valeurs en pourcentage, jamais en pixels", () => {
    // Certaines valeurs sont des phrases ("Encore 2 jours enregistrés"). Sans
    // plafond relatif, elles ecraseraient leur libelle sur un petit ecran.
    const vm = buildProgressionViewModel(
      getProgressionFixture("deux-seances-tendance-indisponible")!.input
    );
    const rendu = monterCarte(vm);
    const valeurs = noeuds(rendu.root, MARQUEURS.progressionFait).flatMap((ligne) =>
      ligne.findAllByType(Text)
    );
    const plafonds = valeurs
      .map((t) => (StyleSheet.flatten(t.props.style) as { maxWidth?: unknown }).maxWidth)
      .filter((m) => m !== undefined);
    expect(plafonds.length).toBeGreaterThan(0);
    for (const plafond of plafonds) expect(typeof plafond).toBe("string");
    demonter(rendu);
  });
});

// =============================================================================

describe("Etat vide — compact, utile, sans graphique ni action concurrente", () => {
  it("rend les 3 reperes numerotes, la mention, et rien d'autre", () => {
    const vm = buildProgressionViewModel(getProgressionFixture("nouveau-joueur")!.input);
    expect(vm.state).toBe("empty");
    const rendu = monterCarte(vm);

    if (vm.state === "empty") {
      const lues = textes(rendu.root);
      expect(lues).toContain(vm.titre);
      expect(lues).toContain(vm.mention);
      for (const repere of vm.reperes) expect(lues).toContain(repere.texte);
    }
    // Aucun graphique, aucun fait, aucun pied : rien a mesurer, rien d'affiche.
    expect(noeuds(rendu.root, MARQUEURS.courbe)).toHaveLength(0);
    expect(noeuds(rendu.root, MARQUEURS.progressionFait)).toHaveLength(0);
    expect(elementsTactiles(rendu.root)).toHaveLength(0);
    demonter(rendu);
  });
});

// =============================================================================

describe("Les deux variantes de l'ecran", () => {
  const ECRANS = HOME_VNEXT_FIXTURES_RENDU;

  it.each(ECRANS.map((f) => [f.id, f] as const))(
    "%s : la variante 1 reste intacte",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(<HomeVNextScreen vm={vm} />);

      // Aucune carte progression, et "MA FORME" toujours en place.
      expect(noeuds(rendu.root, MARQUEURS.progression)).toHaveLength(0);
      expect(noeuds(rendu.root, MARQUEURS.progressionDetail)).toHaveLength(0);
      if (vm.dataState !== "hydrating") {
        expect(textes(rendu.root)).toContain("MA FORME");
      }
      // Le lien de sortie flottant reste celui de la variante 1.
      expect(noeuds(rendu.root, MARQUEURS.lienSortie)).toHaveLength(vm.exit ? 1 : 0);
      demonter(rendu);
    }
  );

  it.each(ECRANS.map((f) => [f.id, f] as const))(
    "%s : la variante 2 remplace la carte forme ET le lien flottant",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const progression = buildProgressionViewModel(progressionInputDepuisHome(fixture.input));
      const rendu = monter(
        <HomeVNextScreen vm={vm} variante="v2" progression={progression} />
      );

      if (vm.dataState === "hydrating") {
        // Le squelette prime : rien ne s'affiche tant que les stores n'ont pas
        // repondu, carte progression comprise.
        expect(noeuds(rendu.root, MARQUEURS.progression)).toHaveLength(0);
      } else {
        expect(noeuds(rendu.root, MARQUEURS.progression)).toHaveLength(1);
        // Une seule des deux cartes de tendance : sinon l'ecran dessinerait deux
        // fois la meme serie de points.
        expect(textes(rendu.root)).not.toContain("MA FORME");
        expect(textes(rendu.root)).toContain("MA PROGRESSION");
      }
      // Plus AUCUN lien flottant : c'est toute la demande du fondateur.
      expect(noeuds(rendu.root, MARQUEURS.lienSortie)).toHaveLength(0);
      demonter(rendu);
    }
  );

  it.each(ECRANS.map((f) => [f.id, f] as const))(
    "%s : la variante 2 ne trace jamais deux courbes",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const progression = buildProgressionViewModel(progressionInputDepuisHome(fixture.input));
      const rendu = monter(
        <HomeVNextScreen vm={vm} variante="v2" progression={progression} />
      );
      expect(noeuds(rendu.root, MARQUEURS.courbe).length).toBeLessThanOrEqual(1);
      demonter(rendu);
    }
  );

  it.each(ECRANS.map((f) => [f.id, f] as const))(
    "%s : la variante 2 garde un seul aplat colore",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const progression = buildProgressionViewModel(progressionInputDepuisHome(fixture.input));
      const rendu = monter(
        <HomeVNextScreen vm={vm} variante="v2" progression={progression} />
      );
      const orange = fonds(rendu.toJSON()).filter((c) => c === couleurs.action.toUpperCase());
      expect(orange).toHaveLength(vm.action.emphasis === "aplat" ? 1 : 0);
      demonter(rendu);
    }
  );

  it("appelle onExit depuis le pied de la carte, avec la bonne destination", () => {
    const fixture = HOME_VNEXT_FIXTURES_RENDU.find((f) => f.id === "tendance-disponible");
    expect(fixture).toBeDefined();
    const vm = buildHomeVNextViewModel(fixture!.input);
    const progression = buildProgressionViewModel(progressionInputDepuisHome(fixture!.input));
    expect(progression.detail.affiche).toBe(true);

    const vus: string[] = [];
    const rendu = monter(
      <HomeVNextScreen
        vm={vm}
        variante="v2"
        progression={progression}
        onExit={(target) => vus.push(target)}
      />
    );
    const pied = pressableDeMarqueur(rendu.root, MARQUEURS.progressionDetail);
    expect(pied).not.toBeNull();
    act(() => {
      (pied!.props as { onPress: () => void }).onPress();
    });
    expect(vus).toEqual(["progression"]);
    demonter(rendu);
  });
});
