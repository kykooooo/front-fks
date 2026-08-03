// screens/__tests__/progressScreenRefonte.test.ts
//
// LA PAGE PROGRESSION N'A PLUS LE DROIT DE FABRIQUER DE CHIFFRE.
//
// Cette suite lit la source. Ce n'est pas un pis-aller : ce qu'elle verifie
// n'est pas ce que l'ecran RESSEMBLE, c'est CE QU'IL NE PEUT PLUS FAIRE. Les
// defauts corriges ici etaient tous des sources de donnees, pas des rendus —
// une amorce ATL0/CTL0, un `tsb` initialise a `CTL0 - ATL0`, un compte de jours
// qui melangeait les charges club auto-injectees aux faits reels. Un test de
// rendu passerait sur des fixtures choisies sans jamais dire que la mauvaise
// source est revenue.
//
// Meme methode que `navigation/__tests__/rootNavigatorSpaceWiring.test.ts` et
// `components/club/__tests__/clubDisclosureWiring.test.ts`.
//
// Le COMPORTEMENT, lui, est teste pour de vrai ailleurs, sur les modules purs
// que cet ecran consomme desormais :
//   - `__tests__/homeVNext/progressionViewModel.test.ts` (les trois etats, la
//     regle de repere, les comparaisons de tests) ;
//   - `hooks/home/__tests__/homeVNextAdapter.test.ts` (la purge des amorces,
//     les jours reellement observes).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const ecran = lire("screens/ProgressScreen.tsx");
/** La source sans commentaires : un mot interdit dans une explication n'est pas une faute. */
const code = ecran.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("La page part du resume canonique, et de rien d'autre", () => {
  test("elle consomme le meme selecteur que la carte de l'accueil", () => {
    expect(ecran).toMatch(/import\s*\{\s*useProgressionViewModel\s*\}\s*from/);
    expect(code).toContain("useProgressionViewModel()");
  });

  test("elle traite les TROIS etats du contrat", () => {
    // Si un etat cesse d'etre traite, il devient une page blanche silencieuse.
    expect(code).toContain('progression.state === "empty"');
    expect(code).toContain('progression.state === "collecting"');
    expect(code).toContain('progression.state === "ready"');
  });

  test("la courbe n'est lue que dans l'etat qui en porte une", () => {
    expect(code).toContain('progression.state === "ready" ? progression.courbe : null');
  });

  test("la portee de la mesure est imprimee sous la courbe", () => {
    // Champ NON nullable du contrat : une courbe sans portee est impossible a
    // construire. Encore faut-il que l'ecran l'affiche.
    expect(code).toContain("courbe.portee");
  });
});

describe("Les amorces ATL0/CTL0 ne peuvent plus revenir", () => {
  test("l'ecran ne calcule plus aucune serie de charge", () => {
    // C'etait la faute centrale : 45 jours de chauffe partant de deux
    // constantes, affiches comme la trajectoire du joueur.
    expect(code).not.toContain("updateTrainingLoad");
    expect(code).not.toContain("TRAINING_DEFAULTS");
    expect(code).not.toContain("ATL0");
    expect(code).not.toContain("CTL0");
  });

  test("l'ecran ne lit plus le TSB du store", () => {
    // `useLoadStore.tsb` est initialise a `CTL0 - ATL0` — le « TSB initial =
    // +3 ». Purger la courbe en gardant ce libelle au-dessus aurait deplace le
    // mensonge, pas supprime.
    expect(code).not.toContain("useLoadStore");
    expect(code).not.toContain("getFootballLabel");
  });

  test("l'ecran ne lit plus dailyApplied", () => {
    // `dailyApplied` est un Record<jour, number> ou l'auto et le reel sont deja
    // additionnes : indecomposable, donc inutilisable pour dire au joueur ce
    // que LUI a fait.
    expect(code).not.toContain("dailyApplied");
  });
});

describe("Les streaks sont partis, et les etats non prouves avec eux", () => {
  test("plus aucune definition de streak dans l'ecran", () => {
    expect(code).not.toMatch(/streak/i);
  });

  test("plus de cycles deduits d'une division", () => {
    // `Math.floor(seances / 12)` etait un proxy, documente comme tel faute de
    // compteur de cycles persiste. Un proxy affiche comme un fait reste un
    // chiffre invente.
    expect(code).not.toMatch(/estimatedCycles|cyclesEstimes/);
    expect(code).not.toMatch(/length\s*\/\s*12/);
  });

  test("les accomplissements restants comptent tous la meme chose", () => {
    // Trois paliers, un seul compteur : impossible qu'un palier verrouille
    // contredise le cumul affiche en haut de page.
    expect(code).toContain("construireAccomplissements(seancesTerminees.length)");
    const paliers = code.match(/seuil:\s*\d+/g) ?? [];
    expect(paliers).toEqual(["seuil: 1", "seuil: 10", "seuil: 50"]);
  });
});

describe("Les faits que la page calcule encore passent par les predicats canoniques", () => {
  test("les seances terminees sont filtrees par estSeanceFksTerminee", () => {
    // Le MEME predicat que le cumul du resume, que le compteur hebdo de
    // l'accueil et que la courbe. Un `s.completed` ecrit a la main ici et les
    // trois comptes divergent sans que rien ne le signale.
    expect(ecran).toMatch(/import\s*\{[^}]*estSeanceFksTerminee[^}]*\}\s*from\s*"\.\.\/domain\/resumeCanonique"/);
    expect(code).toContain("estSeanceFksTerminee");
    expect(code).not.toMatch(/\(s:\s*any\)\s*=>\s*s\?\.completed/);
  });

  test("le calendrier exclut les charges club auto-injectees", () => {
    expect(code).toContain("estChargeExterneManuelle");
  });

  test("les jours du calendrier sont des jours LOCAUX", () => {
    // `toDateKey` est la seule conversion autorisee dans le depot. Une date nue
    // parsee en UTC glisse d'un jour en fuseau negatif.
    expect(code).toContain("toDateKey");
    expect(code).not.toContain("toISOString().slice(0, 10)");
  });
});

describe("La lecture brute des tests est morte", () => {
  test("l'ecran n'appelle plus readTestsRaw ni ne parse du JSON a la main", () => {
    // C'etait le contournement de toute la normalisation : entrees sans
    // horodatage valide, playlists non canonicalisees, aucun tri. Les
    // comparaisons viennent maintenant du selecteur, qui lit la source validee.
    expect(code).not.toContain("readTestsRaw");
    expect(code).not.toContain("JSON.parse");
    expect(code).not.toContain("TEST_FIELDS");
    expect(code).not.toContain("computeTestComparisons");
  });

  test("le sens d'une comparaison a trois valeurs, pas deux", () => {
    // Un ecart exactement nul tombait dans « pas ameliore » : rouge, fleche
    // vers le bas. Une valeur identique n'est pas une regression.
    expect(code).toContain('c.sens === "amelioration"');
    expect(code).toContain('c.sens === "regression"');
    expect(code).not.toMatch(/\bimproved\b/);
  });
});

describe("Le socle visuel et les regles d'or tiennent", () => {
  test("un seul <Screen>, aucune safe area a la main, aucune StatusBar locale", () => {
    expect(code).toContain("<Screen scroll");
    expect(code).not.toContain("SafeAreaView");
    expect(code).not.toContain("StatusBar");
  });

  test("les styles de texte reservent leur place en minHeight", () => {
    // Regle d'or : sur un bloc de TEXTE, `height` fige la boite et coupe le
    // contenu des que le joueur agrandit sa police. `minHeight` la laisse
    // grandir. (Les cercles decoratifs — pastilles, icones — gardent bien un
    // `height` fixe : ce sont des formes, pas des phrases.)
    const stylesDeTexte = [
      "texteReprise",
      "titreSection",
      "sousTitre",
      "texteRepere",
      "libelleFait",
      "mention",
      "portee",
      "periode",
      "libelleTest",
      "texteLegende",
      "libelleStat",
      "libelleAccomplissement",
    ];
    for (const nom of stylesDeTexte) {
      const bloc = code.match(new RegExp(`${nom}:\\s*\\{[^}]*\\}`));
      expect(bloc).not.toBeNull();
      expect(bloc?.[0]).toContain("minHeight:");
      expect(bloc?.[0]).not.toMatch(/[^n]height:\s*\d/);
    }
  });

  test("Ton suivi reste rendue sur cette page", () => {
    // La section de la boucle de suivi n'est pas remplacee par le resume : elle
    // est EMPILEE dessous. Les deux comptent des choses differentes, et leurs
    // libelles portent la difference.
    expect(code).toContain("<TonSuiviSection />");
  });
});
