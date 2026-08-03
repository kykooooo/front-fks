// navigation/__tests__/homeVNextWiring.test.ts
//
// LE NOUVEL ACCUEIL EST-IL BRANCHE, ET L'EST-IL SANS RIEN CASSER D'AUTRE ?
//
// Meme methode que `rootNavigatorSpaceWiring.test.ts` : lecture de source.
// Monter `RootNavigator` demanderait Firebase, la navigation et la totalite des
// ecrans. Ce qu'on verifie ici n'est de toute facon pas un comportement de
// rendu, mais trois proprietes STRUCTURELLES que seule la source dit :
//
//   1. l'accueil vNext est reellement monte, et derriere un interrupteur ;
//   2. il n'a PAS pris un nouveau nom de route — la faute deja payee dans ce
//      fichier avec `ProfileSetup` / `ProfileSetupGate` ;
//   3. l'ancien accueil est toujours la, donc le repli est reel et pas une
//      promesse de commentaire.
//
// Le comportement, lui, est teste ailleurs : `hooks/home/__tests__/
// homeVNextNavigation.test.ts` (ou mene chaque action) et
// `__tests__/homeVNext/HomeVNextScreen.test.tsx` (ce que l'ecran rend).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const navigateur = lire("navigation/RootNavigator.tsx");
const flag = lire("config/homeFeatures.ts");

describe("RootNavigator — l'accueil vNext est monte derriere un interrupteur", () => {
  test("le conteneur vNext est importe et rendu", () => {
    expect(navigateur).toMatch(/import\s*\{\s*HomeVNextContainer\s*\}\s*from/);
    expect(navigateur).toContain("<HomeVNextContainer />");
  });

  test("le choix passe par HOME_FEATURES.VNEXT, et par rien d'autre", () => {
    expect(navigateur).toMatch(/import\s*\{\s*HOME_FEATURES\s*\}\s*from/);
    expect(navigateur).toContain("HOME_FEATURES.VNEXT ? <HomeVNextContainer /> : <HomeScreen />");
  });

  test("l'ancien accueil reste importe : le repli est reel", () => {
    // Si cet import disparait sans que le flag disparaisse aussi, l'interrupteur
    // devient decoratif — bascule a `false` et l'app ne compile plus.
    expect(navigateur).toMatch(/import\s+HomeScreen\s+from/);
    expect(navigateur).toContain("<HomeScreen />");
  });
});

describe("Le branchement n'a introduit AUCUNE nouvelle route", () => {
  test("il n'existe pas de route nommee HomeVNext", () => {
    // Deux routes pour un meme ecran, c'est deux etats de navigation a
    // restaurer. Le fichier porte deja la cicatrice de cette faute
    // (`ProfileSetup` / `ProfileSetupGate`) : on ne la refait pas.
    expect(navigateur).not.toContain('name="HomeVNext"');
    expect(navigateur).not.toMatch(/HomeVNext\s*:\s*undefined/);
  });

  test("l'onglet d'accueil s'appelle toujours Home", () => {
    expect(navigateur).toContain('<Tab.Screen name="Home"');
    expect(navigateur).toContain('PLAYER_TAB_ORDER: Array<keyof TabParamList> = ["Home", "NewSession", "Profile"]');
  });

  test("l'accueil reste dans le SwipeTabsWrapper de son onglet", () => {
    // Le swipe entre onglets est une mecanique de `PLAYER_TAB_ORDER` : sortir
    // l'accueil du wrapper le rendrait seul a ne pas repondre au geste.
    expect(navigateur).toContain('<SwipeTabsWrapper currentTab="Home" tabOrder={tabOrder}>');
  });
});

describe("L'interrupteur lui-meme", () => {
  test("HOME_FEATURES n'expose que VNEXT, et c'est un booleen", () => {
    expect(flag).toMatch(/VNEXT:\s*(true|false)\s*,/);
    // Un flag qui accepte une chaine ou un objet devient une seconde
    // configuration a lire. Celui-ci ne peut valoir que deux choses.
    expect(flag).toMatch(/readonly VNEXT:\s*boolean/);
  });

  test("le flag ne lit ni environnement ni store — il est statique", () => {
    // Un flag resolu a l'execution ne se teste pas et ne se lit pas dans un
    // diff. Celui-ci se change en editant une ligne, et ca se voit.
    expect(flag).not.toMatch(/process\.env/);
    expect(flag).not.toMatch(/AsyncStorage|useSettingsStore|import\s+\{/);
  });
});

describe("Le conteneur ne s'arroge aucune decision", () => {
  const conteneur = lire("screens/homeVNext/HomeVNextContainer.tsx");

  test("il fige la variante v2 — decision fermee, pas option d'appelant", () => {
    expect(conteneur).toContain('variante="v2"');
  });

  test("il ne surcharge ni reduceMotion ni l'echelle typographique", () => {
    // Passer `reduceMotion` couperait le joueur de son reglage d'accessibilite
    // reel, que `HomeVNextPresentation` lit via `hooks/useReduceMotion`.
    expect(conteneur).not.toMatch(/reduceMotion=\{/);
    expect(conteneur).not.toMatch(/echelle=\{/);
  });

  test("il ne passe pas de largeur de courbe : onLayout mesure dans l'app", () => {
    expect(conteneur).not.toMatch(/largeurCourbe=\{/);
  });

  test("il ne fabrique aucun libelle", () => {
    // Le seul texte autorise dans ce fichier vit dans les commentaires. Un
    // libelle affiche depuis le conteneur echapperait a tous les tests du
    // ViewModel, y compris a la liste des etats interdits.
    const sansCommentaires = conteneur
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(sansCommentaires).not.toMatch(/<Text/);
  });
});
