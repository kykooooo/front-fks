// screens/__tests__/coachClubConfirmation.test.ts
//
// LA CRÉATION D'UN CLUB PASSE-T-ELLE PAR UNE CONFIRMATION ?
//
// P1-07 inventaire clubs (15/08) : un joueur pouvait créer un club et
// basculer TOUT son compte en espace coach sans garde-fou — bascule
// irréversible sans le support. Décision Kyllian 15/08 : confirmation
// obligatoire, copy explicite, deux boutons, pas de « oui » par défaut.
// Tests-source (même méthode/limite que onboardingTactile.test.ts).

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "CoachOnboardingScreen.tsx"),
  "utf8"
);

describe("CoachOnboarding — confirmation obligatoire avant création", () => {
  test("la copy actée est affichée telle quelle", () => {
    expect(source).toContain(
      "Tu crées un espace ENTRAÎNEUR pour gérer des joueurs. Cette action est définitive sur ce compte."
    );
  });

  test("deux boutons explicites, « Annuler » en choix mis en avant", () => {
    expect(source).toMatch(/text: "Annuler", style: "cancel"/);
    expect(source).toMatch(/text: "Créer mon espace entraîneur", onPress:/);
  });

  test("createClubAsCoach n'est appelable QUE depuis la confirmation", () => {
    // L'appel réseau vit dans doCreate, et la seule invocation de doCreate est
    // le bouton de confirmation de l'Alert.
    const appels = source.match(/createClubAsCoach\(\{/g) ?? [];
    expect(appels).toHaveLength(1);
    expect(source).toMatch(/const doCreate = async \(uid: string\)/);
    const blocDoCreate = source.slice(source.indexOf("const doCreate"));
    expect(blocDoCreate).toMatch(/createClubAsCoach\(\{/);
    const invocations = source.match(/[^t] doCreate\(|void doCreate\(/g) ?? [];
    // `uid` et non plus `user.uid` : la confirmation est ouverte par
    // `ouvrirConfirmation(uid)`, qui vérifie d'abord que ce compte n'a pas
    // déjà un club (R4 de la contre-vérification du 05/09).
    expect(source).toMatch(/onPress: \(\) => void doCreate\(uid\)/);
    expect(invocations).toHaveLength(1); // l'unique invocation = le bouton
  });
});
