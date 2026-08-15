// screens/__tests__/welcomeSkipSafeArea.test.ts
//
// LE LIEN « PASSER » RESTE-T-IL SOUS LA BARRE DE STATUT ?
//
// Défaut relevé par l'inventaire clubs (15/08, P0-1) : `skip` était en
// `position:"absolute", top: theme.spacing.sm` dans le conteneur paddé de
// <Screen>. Or le moteur de layout positionne un enfant absolute AVEC inset
// contre la border-box du parent — le paddingTop safe-area n'est JAMAIS ajouté.
// Résultat : « Passer » dessiné à ~8-32 px du bord physique, sous la
// batterie/le wifi sur iPhone à encoche, sous les icônes système en Android
// edge-to-edge. Le même écran compensait déjà le BAS à la main (insets.bottom
// sur bottomOverlay) ; seul « Passer » n'avait pas sa compensation.
//
// MÉTHODE (même limite que onboardingTactile.test.ts) : ces tests lisent la
// SOURCE. Ils prouvent que la compensation existe et que le motif fautif n'est
// pas revenu ; le rendu au pixel, seule la recette téléphone le dit.

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "WelcomeScreen.tsx"),
  "utf8"
);

describe("Welcome — le lien « Passer » compense la safe area", () => {
  test("le style dynamique du Pressable ajoute insets.top", () => {
    // La forme exacte importe peu, la présence de l'inset dans le calcul du
    // `top` importe : c'est elle qui sort « Passer » de la barre de statut.
    expect(source).toMatch(/top:\s*insets\.top\s*\+/);
  });

  test("la feuille de style ne repose plus un `top` fixe sur skip", () => {
    // Un `top:` statique dans le bloc skip réintroduirait le bug en silence
    // (le style dynamique et lui s'écraseraient selon l'ordre du tableau).
    const bloc = source.match(/skip:\s*\{[^}]*\}/);
    expect(bloc).not.toBeNull();
    expect(bloc![0]).not.toMatch(/\btop:/);
  });

  test("le bas garde sa propre compensation (le témoin qui a révélé le bug)", () => {
    expect(source).toContain("Math.max(insets.bottom, 20)");
  });
});
