// components/modal/__tests__/dismissControl.test.ts
//
// UN DISMISS ANNULÉ REND-IL LE MODAL À L'UTILISATEUR ?
//
// Défaut relevé par l'inventaire clubs (15/08, P0-2) : sur le feedback
// post-séance, swipe vers le bas → la feuille glisse ENTIÈREMENT hors écran
// (translateY = screenHeight) → l'alerte de confirmation s'ouvre → « Rester »
// ne remettait RIEN en place : translateY restait à screenHeight et le verrou
// anti double-dismiss (dismissingRef) restait posé — fond flouté vide, croix
// et Valider hors écran, backdrop neutralisé. Seule issue sur iPhone : tuer
// l'app.
//
// Le correctif est un contrat à trois maillons ; ces tests lisent la SOURCE
// pour vérifier que chaque maillon existe et reste câblé (même méthode et même
// limite que onboardingTactile.test.ts : le geste réel, seule la recette
// téléphone le prouve).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("maillon 1 — useSwipeToDismiss sait ramener la feuille", () => {
  const source = lire("components/modal/useSwipeToDismiss.ts");

  test("expose un reset qui ré-anime translateY vers 0", () => {
    expect(source).toMatch(/const reset = useCallback/);
    expect(source).toMatch(/reset[\s\S]{0,200}?translateY\.value = withTiming\(0/);
    expect(source).toMatch(/return \{ gesture, animatedStyle, reset \}/);
  });
});

describe("maillon 2 — ModalContainer rend la commande cancelDismiss", () => {
  const source = lire("components/modal/ModalContainer.tsx");

  test("cancelDismiss réarme le verrou ET ramène la feuille", () => {
    const bloc = source.match(/cancelDismiss: \(\) => \{[\s\S]*?\}/);
    expect(bloc).not.toBeNull();
    expect(bloc![0]).toContain("dismissingRef.current = false");
    expect(bloc![0]).toContain("resetSwipe()");
  });

  test("le type ModalDismissControl est exporté (contrat consommateur)", () => {
    expect(source).toMatch(/export type ModalDismissControl/);
  });
});

describe("maillon 3 — le Feedback câble « Rester » sur cancelDismiss", () => {
  const source = lire("screens/FeedbackScreen.tsx");

  test("le bouton Rester rétablit le modal", () => {
    expect(source).toMatch(
      /text: 'Rester', style: 'cancel', onPress: stayInFeedback/
    );
    expect(source).toMatch(/dismissControl\.current\?\.cancelDismiss\(\)/);
  });

  test("la fermeture Android hors dialogue passe par la même issue", () => {
    // Sans onDismiss, un tap hors de l'alerte sur Android laisse l'écran mort
    // par une autre porte que « Rester ».
    expect(source).toMatch(/cancelable: true, onDismiss: stayInFeedback/);
  });

  test("la commande est passée au ModalContainer", () => {
    expect(source).toMatch(/dismissControl=\{dismissControl\}/);
  });
});
