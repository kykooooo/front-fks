// __tests__/homeVNext/appariementVariante2.test.ts
// =============================================================================
// L'APPARIEMENT DE LA VARIANTE 2 NE DOIT PAS DERIVER EN SILENCE
// =============================================================================
//
// CE QUE CE FICHIER PROTEGE, ET POURQUOI IL EXISTE
// -----------------------------------------------------------------------------
// La carte progression a ete ecrite avec ses propres jeux de donnees, sans ecran
// d'accueil autour. Pour la REGARDER en place, le harnais du prototype la pose
// sur un ecran existant (`prototype/home-vnext/lib/appariementVariante2.js`).
//
// Cet assemblage a une condition qui n'est pas cosmetique : le bloc "Ma semaine"
// doit afficher EXACTEMENT le nombre que la carte a suppose
// (`semaineCourante.seancesAffichees`). C'est contre ce nombre que le garde-fou
// R7 de la carte s'est protege — la regle qui interdit a la carte de reafficher
// le compte que "Ma semaine" donne deja. Si l'ecran en affiche un autre, le
// garde-fou a ete calcule contre une valeur absente de l'ecran : il ne protege
// plus rien, et personne ne le voit.
//
// Ces tests verrouillent ca, plus la regle de conduite du harnais : tout ecart
// introduit par l'assemblage doit etre DECLARE. Un appariement qui deviendrait
// approximatif sans le dire ferait valider un ecran qui se contredit.
//
// Ce ne sont pas des tests de produit : ils portent sur l'outil de demonstration.
// Ils tournent avec les autres via `node prototype/home-vnext/verifier.js tests`.
// =============================================================================

import {
  HOME_VNEXT_FIXTURES_RENDU,
  PROGRESSION_FIXTURES_RENDU,
  type HomeVNextFixture,
  type ProgressionFixture,
} from "../../screens/homeVNext/fixtures";
import { buildHomeVNextViewModel } from "../../screens/homeVNext/viewModel";
import { buildProgressionViewModel } from "../../screens/homeVNext/progressionViewModel";

// Module CommonJS du harnais, volontairement sans aucun `require` interne : il
// est donc chargeable ici sans tirer babel, jsdom ni react-native-web.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appariement = require("../../prototype/home-vnext/lib/appariementVariante2");

type Appariement = {
  id: string;
  progression: string;
  hote: string;
  qualite: "exact" | "approximatif";
  ecart: string | null;
  pourquoiCetHote: string;
};

const APPARIEMENTS: readonly Appariement[] = appariement.APPARIEMENTS;
const GROUPES: readonly { titre: string; aide: string; etats: string[] }[] =
  appariement.GROUPES_VARIANTE2;

const homeParId = new Map<string, HomeVNextFixture>(
  HOME_VNEXT_FIXTURES_RENDU.map((f) => [f.id, f])
);
const progParId = new Map<string, ProgressionFixture>(
  PROGRESSION_FIXTURES_RENDU.map((f) => [f.id, f])
);

describe("appariement de la variante 2 — inventaire", () => {
  it("couvre exactement les cas de carte, une fois chacun", () => {
    const couverts = APPARIEMENTS.map((a) => a.progression).sort();
    const attendus = PROGRESSION_FIXTURES_RENDU.map((f) => f.id).sort();
    expect(couverts).toEqual(attendus);
  });

  it("ne reference que des cas de carte et des ecrans qui existent", () => {
    for (const a of APPARIEMENTS) {
      expect(progParId.get(a.progression)).toBeDefined();
      expect(homeParId.get(a.hote)).toBeDefined();
    }
  });

  it("donne a chaque etat un identifiant unique et prefixe", () => {
    const ids = APPARIEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Le prefixe n'est pas decoratif : deux cas de carte portent le meme
    // identifiant qu'une fixture Home (`nouveau-joueur`, `tendance-disponible`)
    // et le visualiseur indexe ses etats par identifiant.
    ids.forEach((id) => expect(id.startsWith("v2-")).toBe(true));
    const idsHome = new Set(HOME_VNEXT_FIXTURES_RENDU.map((f) => f.id));
    ids.forEach((id) => expect(idsHome.has(id)).toBe(false));
  });

  it("range chaque etat dans un groupe, et un seul", () => {
    const dansUnGroupe = GROUPES.flatMap((g) => g.etats).sort();
    const tous = APPARIEMENTS.map((a) => a.id).sort();
    expect(dansUnGroupe).toEqual(tous);
  });
});

describe("appariement de la variante 2 — coherence avec l'ecran d'accueil", () => {
  // LA condition qui rend l'assemblage honnete.
  it.each(APPARIEMENTS.map((a) => [a.id, a] as const))(
    "%s : « Ma semaine » affiche le nombre que la carte a suppose (R7)",
    (_id, a) => {
      const home = homeParId.get(a.hote)!;
      const prog = progParId.get(a.progression)!;
      const semaine = buildHomeVNextViewModel(home.input).week;
      const suppose = prog.input.semaineCourante;

      expect(semaine !== null).toBe(suppose.blocAffiche);
      if (suppose.blocAffiche) {
        expect(semaine!.doneCount).toBe(suppose.seancesAffichees);
      }
    }
  );

  it.each(APPARIEMENTS.map((a) => [a.id, a] as const))(
    "%s : la qualite declaree est celle que l'audit calcule",
    (_id, a) => {
      const home = homeParId.get(a.hote)!;
      const prog = progParId.get(a.progression)!;
      const audit = appariement.auditerCoherence({
        homeVm: buildHomeVNextViewModel(home.input),
        progVm: buildProgressionViewModel(prog.input),
        progressionInput: prog.input,
      });
      expect(audit.qualiteCalculee).toBe(a.qualite);
    }
  );

  it.each(APPARIEMENTS.map((a) => [a.id, a] as const))(
    "%s : un ecart existe si et seulement s'il est ecrit",
    (_id, a) => {
      if (a.qualite === "exact") {
        expect(a.ecart).toBeNull();
      } else {
        expect(typeof a.ecart).toBe("string");
        expect((a.ecart as string).length).toBeGreaterThan(80);
      }
      // L'ecran d'accueil n'est jamais choisi sans raison ecrite : c'est la
      // premiere question que le fondateur pose devant un ecran assemble.
      expect(a.pourquoiCetHote.length).toBeGreaterThan(40);
    }
  );

  it("aucune divergence ne se produit SUR l'ecran de la variante 2", () => {
    // Depuis que l'ecran absorbe le bloc « Ma forme » et le lien de sortie, une
    // contradiction entre les deux jeux de donnees ne peut plus s'afficher sur
    // l'ecran lui-meme — elle n'apparait qu'en comparant les deux colonnes.
    // Si ce test tombe, c'est qu'un ecran de demonstration se contredit tout
    // seul : ce n'est plus un ecart d'assemblage, c'est un ecran a ne pas
    // montrer.
    for (const a of APPARIEMENTS) {
      const home = homeParId.get(a.hote)!;
      const prog = progParId.get(a.progression)!;
      const audit = appariement.auditerCoherence({
        homeVm: buildHomeVNextViewModel(home.input),
        progVm: buildProgressionViewModel(prog.input),
        progressionInput: prog.input,
      });
      expect({ id: a.id, surEcran: audit.divergencesEcran }).toEqual({
        id: a.id,
        surEcran: 0,
      });
    }
  });
});

describe("appariement de la variante 2 — l'ecran ne se contredit pas lui-meme", () => {
  // ---------------------------------------------------------------------------
  // 1. LA PASTILLE D'ETAT DU JOUR
  // ---------------------------------------------------------------------------
  // Le harnais doit construire le ViewModel du Home AVEC les options de la
  // variante 2. Sans elles, l'ecran rendu annoncerait « En forme » a 200 px
  // au-dessus d'une carte qui ecrit « tes entraînements club n'y sont pas
  // comptés » — le defaut que ces options corrigent.
  // ---------------------------------------------------------------------------
  it("le harnais construit le Home avec les options de la variante 2", () => {
    expect(appariement.OPTIONS_VM_VARIANTE2).toEqual({ variante: "v2" });
  });

  it.each(APPARIEMENTS.map((a) => [a.id, a] as const))(
    "%s : aucune pastille d'etat global sur l'ecran de la variante 2",
    (_id, a) => {
      const home = homeParId.get(a.hote)!;
      const prog = progParId.get(a.progression)!;
      const homeVm = buildHomeVNextViewModel(home.input, appariement.OPTIONS_VM_VARIANTE2);
      const progVm = buildProgressionViewModel(prog.input);

      // Les deux blocs qui pourraient annoncer un etat physique global se
      // taisent, et pour la MEME raison : les charges club ne sont pas captures.
      expect(homeVm.header.stateChip).toBeNull();
      expect(progVm.etatGlobal.connu).toBe(false);
    }
  );

  // ---------------------------------------------------------------------------
  // 2. DEUX CIBLES TACTILES NE PORTENT JAMAIS LE MEME TEXTE VISIBLE
  // ---------------------------------------------------------------------------
  // Trouve en REGARDANT une capture : sur une journee ordinaire, « Voir le
  // detail » apparaissait deux fois — sous l'action du jour (qui ouvre la seance)
  // et au pied de la carte (qui ouvre la progression). Les libelles vocaux
  // differaient, donc un lecteur d'ecran s'en sortait ; un joueur qui LIT
  // l'ecran, non.
  //
  // Ce test raisonne sur les CONTRATS, donc il tombe avant meme qu'une page soit
  // generee. `verifier-variante2.js` (controle d3) refait la meme verification
  // sur le texte reellement rendu des 60 pages.
  // ---------------------------------------------------------------------------

  /**
   * Le texte VISIBLE de chaque cible tactile d'un ecran de variante 2, dans
   * l'ordre de lecture. Lu dans les composants, pas suppose :
   *   - l'action du jour n'est tapable que si elle est un aplat ; l'accuse de
   *     reception (« journee faite ») n'est pas un bouton (HomeVNextAction.tsx) ;
   *   - le lien secondaire l'est toujours quand il existe ;
   *   - le lien de sortie flottant n'est PAS rendu en variante 2 (l'ecran ne
   *     le pose que pour la variante 1) ;
   *   - le pied de la carte l'est si le ViewModel l'autorise.
   */
  function textesTactilesV2(
    homeVm: ReturnType<typeof buildHomeVNextViewModel>,
    progVm: ReturnType<typeof buildProgressionViewModel>
  ): { texte: string; ou: string }[] {
    const cibles: { texte: string; ou: string }[] = [];
    if (homeVm.action.emphasis === "aplat") {
      cibles.push({ texte: homeVm.action.label, ou: "action du jour" });
    }
    if (homeVm.action.secondary) {
      cibles.push({ texte: homeVm.action.secondary.label, ou: "lien sous l'action" });
    }
    if (progVm.detail.affiche && progVm.detail.label) {
      cibles.push({ texte: progVm.detail.label, ou: "pied de la carte" });
    }
    return cibles;
  }

  it.each(APPARIEMENTS.map((a) => [a.id, a] as const))(
    "%s : deux cibles tactiles ne portent pas le meme texte visible",
    (_id, a) => {
      const home = homeParId.get(a.hote)!;
      const prog = progParId.get(a.progression)!;
      const cibles = textesTactilesV2(
        buildHomeVNextViewModel(home.input, appariement.OPTIONS_VM_VARIANTE2),
        buildProgressionViewModel(prog.input)
      );
      const parTexte = new Map<string, string[]>();
      for (const c of cibles) {
        const cle = c.texte.trim().toLowerCase();
        parTexte.set(cle, (parTexte.get(cle) ?? []).concat(c.ou));
      }
      const doubles = [...parTexte.entries()].filter(([, ou]) => ou.length > 1);
      expect(doubles).toEqual([]);
    }
  );

  it("le pied de la carte nomme sa destination, comme le lien de sortie de la variante 1", () => {
    // Meme destination, memes mots : les deux variantes ne different que par la
    // PLACE du lien, ce qui est exactement ce que le fondateur compare.
    const home = homeParId.get("tendance-disponible")!;
    const prog = progParId.get("tendance-disponible")!;
    const v1 = buildHomeVNextViewModel(home.input);
    const carte = buildProgressionViewModel(prog.input);
    expect(carte.detail.affiche).toBe(true);
    expect(carte.detail.label).toBe(v1.exit?.label);
    expect(carte.detail.target).toBe(v1.exit?.target);
  });
});

describe("appariement de la variante 2 — le sac de props", () => {
  it("passe exactement le contrat de l'ecran, sans synonyme devine", () => {
    const props = appariement.propsVariante2({ homeVm: null, progVm: null, nav: null });
    // `HomeVNextScreen` declare une union discriminee :
    //   { variante?: "v1" } | { variante: "v2"; progression: ProgressionViewModel }
    // Le harnais doit passer CE contrat. Un sac de synonymes ferait passer un
    // changement de contrat inapercu, alors que la detection du harnais le
    // signale avec la marche a suivre.
    expect(props.variante).toBe("v2");
    expect(Object.keys(props).sort()).toEqual(
      ["navigation", "onAction", "onExit", "onSecondaryAction", "progression", "route", "variante", "vm"].sort()
    );
  });
});

describe("appariement de la variante 2 — la mesure du rendu", () => {
  // La detection ne doit jamais dire « la carte est la » sur un rendu qui ne la
  // porte pas : c'est le seul garde-fou entre le fondateur et un ecran de
  // variante 1 affiche sous l'etiquette « Progression integree ».
  it("ne detecte pas la carte dans un rendu qui ne la porte pas", () => {
    const prog = progParId.get("tendance-disponible")!;
    const progVm = buildProgressionViewModel(prog.input);
    const home = homeParId.get("tendance-disponible")!;
    const homeVm = buildHomeVNextViewModel(home.input);

    const sansCarte = '<div data-testid="home-vnext-semaine">MA SEMAINE</div>';
    expect(appariement.mesurerVariante2(sansCarte, homeVm, progVm, null).carteDetectee).toBe(false);

    const avecCarte = '<div data-testid="home-vnext-progression">TA PROGRESSION</div>';
    expect(appariement.mesurerVariante2(avecCarte, homeVm, progVm, null).carteDetectee).toBe(true);
  });

  it("retrouve une phrase du contrat malgre apostrophes, accents et entites", () => {
    // Le ViewModel ecrit des apostrophes typographiques et des accents ; le HTML
    // rendu peut porter des entites et des espaces insecables. Sans
    // normalisation, la verification serait inoperante — et silencieusement.
    const phrase = "Encore 2 séances avant d’afficher une tendance.";
    const rendu = "<span>Encore 2 s&eacute;ances avant d&#39;afficher une tendance.</span>";
    expect(appariement.normaliser(phrase)).toBe(
      appariement.texteDe(rendu.replace(/&eacute;/g, "é"))
    );
  });
});
