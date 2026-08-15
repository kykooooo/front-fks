// screens/__tests__/onboardingTactile.test.ts
//
// LES TAPS ARRIVENT-ILS JUSQU'AUX COMMANDES, ET RÉPONDENT-ELLES AU DOIGT ?
//
// Deux défauts distincts, tous deux relevés au téléphone (recette 03/08,
// « il devrait y avoir du tactile partout ») :
//
//  1. LE TAP AVALÉ. Un `TouchableWithoutFeedback` posé pour fermer le clavier
//     enveloppait tout l'écran. Il installe un responder sur TOUS ses
//     descendants : sur cette combinaison (RN 0.81 / new arch), les taps sont
//     captés par le wrapper au lieu d'atteindre les champs et les boutons. C'est
//     mot pour mot la régression corrigée sur l'inscription et la connexion par
//     b708fe9 — elle vivait encore sur les deux écrans d'onboarding ;
//  2. LE TAP MUET. Une commande qui ne vibre pas dans une app où toutes les
//     autres vibrent se lit comme une commande morte.
//
// MÉTHODE, ET SA LIMITE ÉCRITE NOIR SUR BLANC : ces tests lisent la SOURCE. Ils
// prouvent que le motif fautif a disparu et que le hook haptique est appelé ;
// ils ne prouvent PAS qu'un pouce atteint la cible sur un vrai téléphone — cela,
// seule la recette de Kyllian le dit. Monter ces écrans pour de bon demanderait
// Firebase (getDoc de prefill), la navigation et les stores : le rendu ne dirait
// donc rien de plus sur le responder natif, qui n'existe pas en test.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const ECRANS = {
  "setup joueur": "screens/ProfileSetupScreen.tsx",
  "création de club": "screens/CoachOnboardingScreen.tsx",
} as const;

describe("plus aucun wrapper n'avale les taps", () => {
  test.each(Object.entries(ECRANS))(
    "%s : aucun TouchableWithoutFeedback n'enveloppe le contenu",
    (_nom, chemin) => {
      const source = lire(chemin);
      expect(source).not.toContain("<TouchableWithoutFeedback");
      // L'import mort part avec (sinon il revient au premier copier-coller).
      expect(source).not.toMatch(/^\s*TouchableWithoutFeedback,?$/m);
    }
  );

  test.each(Object.entries(ECRANS))(
    "%s : le clavier se ferme par glissement, sans responder parasite",
    (_nom, chemin) => {
      expect(lire(chemin)).toContain('keyboardDismissMode');
      expect(lire(chemin)).toContain('"on-drag"');
    }
  );

  test("le setup joueur garde `keyboardShouldPersistTaps=handled`", () => {
    // Sans lui, le premier tap sur un chip ne servirait qu'à fermer le clavier :
    // il faudrait taper deux fois. C'est la moitié du correctif, l'autre étant
    // la suppression du wrapper.
    expect(lire(ECRANS["setup joueur"])).toContain('keyboardShouldPersistTaps="handled"');
  });

  test("les écrans déjà corrigés le restent (inscription, connexion)", () => {
    // Garde-fou de non-régression sur b708fe9 : ces deux-là sont hors de ce lot,
    // mais c'est le même motif et il est revenu une fois.
    for (const chemin of ["screens/RegisterScreen.tsx", "screens/LoginScreen.tsx"]) {
      expect(lire(chemin)).not.toContain("<TouchableWithoutFeedback");
      expect(lire(chemin)).toContain('keyboardDismissMode="on-drag"');
    }
  });
});

describe("couverture haptique — tout ce qui se tape répond au doigt", () => {
  test.each(Object.entries(ECRANS))(
    "%s : passe par le hook central, jamais par expo-haptics",
    (_nom, chemin) => {
      const source = lire(chemin);
      expect(source).toContain("useHaptics()");
      expect(source).not.toContain("expo-haptics");
    }
  );

  test("setup joueur : les DEUX briques de sélection vibrent (donc tous les choix)", () => {
    // `Choice` et `Chip` rendent la totalité des choix du parcours : poste,
    // catégorie, niveau, pied fort, objectif, séances/semaine, jours
    // d'entraînement club, jours de match, accès salle, et la question de reprise
    // (`selfReportedGapDays`). Prouver que ces deux briques appellent le hook
    // couvre donc les ~40 cibles d'un coup — et empêche qu'une nouvelle option
    // arrive sans retour au doigt.
    const source = lire(ECRANS["setup joueur"]);
    for (const brique of ["const Choice = (", "const Chip = ("]) {
      const bloc = source.slice(source.indexOf(brique));
      expect(bloc.slice(0, 700)).toContain("hapticSelect()");
    }
    expect(source).toContain("const hapticSelect = () => {");
    const definition = source.slice(source.indexOf("const hapticSelect = () => {"));
    expect(definition.slice(0, 120)).toContain("haptics.impactLight()");
  });

  test("setup joueur : la question de reprise passe bien par ces briques", () => {
    // Elle est optionnelle et arrivée après coup (boucle de suivi, lot 6) : on
    // vérifie qu'elle n'a pas été câblée à la main, hors de la brique commune.
    const source = lire(ECRANS["setup joueur"]);
    const bloc = source.slice(source.indexOf("SELF_REPORTED_GAP_OPTIONS.map"));
    expect(bloc.slice(0, 400)).toContain("<Chip");
  });

  test("setup joueur : les commandes hors briques vibrent aussi", () => {
    const source = lire(ECRANS["setup joueur"]);
    // Chacune ouvre ou ferme quelque chose de plein écran ; aucune n'avait de
    // retour au doigt avant ce lot (sauf le lien coach, déjà couvert).
    const commandes: Array<[string, string]> = [
      ["cycle (Gérer / Choisir)", 'navigation.navigate("CycleModal"'],
      ["politique de confidentialité", "setPrivacyVisible(true)"],
      // Ancré sur le libellé du BOUTON de fermeture : le premier
      // `setPrivacyVisible(false)` de la source est l'`onRequestClose` de la
      // modale (bouton retour matériel Android). Celui-là n'a volontairement pas
      // de retour haptique — ce n'est pas un tap sur l'écran.
      ["fermeture de la modale", 'accessibilityLabel="Fermer"'],
      ["lien coach", 'navigation.navigate("CoachOnboarding")'],
    ];
    for (const [nom, ancre] of commandes) {
      const index = source.indexOf(ancre);
      expect([nom, index > -1]).toEqual([nom, true]);
      // Le retour haptique est déclenché DANS le même gestionnaire, juste avant
      // l'action (fenêtre courte : ~un bloc de props JSX en amont).
      const amont = source.slice(Math.max(0, index - 400), index);
      expect([nom, /hapticSelect\(\)|haptics\.impact/.test(amont)]).toEqual([nom, true]);
    }
  });

  test("création de club : le geste de sortie vibre, et le bouton principal aussi", () => {
    const source = lire(ECRANS["création de club"]);
    const bloc = source.slice(source.indexOf("const handleSortie = () => {"));
    expect(bloc.slice(0, 200)).toContain("haptics.impactLight()");
    // Le bouton « Créer mon club » passe par <Button>, qui porte son propre
    // impactLight (components/ui/Button.tsx) — on le vérifie plutôt que de le
    // dupliquer ici.
    expect(source).toContain("<Button");
    expect(lire("components/ui/Button.tsx")).toContain("haptics.impactLight()");
  });

  test("création de club : la déconnexion et l'échec de création restent audibles", () => {
    // `handleCreate` n'est plus async : depuis la confirmation obligatoire
    // (décision 15/08), il ouvre l'Alert et c'est `doCreate` qui porte l'appel
    // réseau — et donc les haptics succès/échec.
    const source = lire(ECRANS["création de club"]);
    for (const handler of ["const handleLogout = async", "const handleCreate = ", "const doCreate = async"]) {
      expect(source.indexOf(handler)).toBeGreaterThanOrEqual(0);
      const bloc = source.slice(source.indexOf(handler));
      expect(bloc.slice(0, 1200)).toMatch(/haptics\.(impactLight|success|error)\(\)/);
    }
  });
});

describe("cibles tactiles — la zone tapable dépasse le pixel du glyphe", () => {
  test("création de club : les deux commandes d'en-tête ont un hitSlop", () => {
    // Deux icônes 18-20px dans une barre : sans hitSlop, la cible réelle est très
    // en-dessous des 44pt recommandés.
    const source = lire(ECRANS["création de club"]);
    const entete = source.slice(source.indexOf("styles.headerRow"), source.indexOf("styles.header}"));
    expect((entete.match(/hitSlop=/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
