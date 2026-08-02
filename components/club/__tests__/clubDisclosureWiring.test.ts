// components/club/__tests__/clubDisclosureWiring.test.ts
//
// LA DIVULGATION EST-ELLE VRAIMENT LÀ OÙ LE JOUEUR SAISIT SON CODE ?
//
// Le composant peut être parfait et n'être branché nulle part. Cette suite lit
// les DEUX écrans hôtes exigés (setup de profil, carte « Mon club » des
// réglages) et vérifie le branchement, plus une chose qu'un test de rendu ne
// dirait pas : que rien ne la conditionne.
//
// Méthode assumée : lecture de source. C'est le seul moyen de prouver
// l'ABSENCE d'une garde (`&&`, `? :`) sans monter tout l'écran avec Firebase,
// la navigation et les animations. Le rendu du composant lui-même, lui, est
// testé pour de vrai dans clubDataDisclosure.test.tsx.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const HOTES = [
  ["setup de profil", "screens/ProfileSetupScreen.tsx"],
  ["carte Mon club (réglages)", "components/settings/ClubManagementCard.tsx"],
] as const;

describe.each(HOTES)("%s", (_nom, chemin) => {
  const source = lire(chemin);

  test("importe le composant de divulgation", () => {
    expect(source).toMatch(/import\s*\{\s*ClubDataDisclosure\s*\}\s*from/);
  });

  test("le rend réellement", () => {
    expect(source).toContain("<ClubDataDisclosure");
  });

  test("ne le rend derrière AUCUNE condition", () => {
    // Une divulgation affichée « seulement si » n'est pas une divulgation.
    for (const garde of ["&& <ClubDataDisclosure", "? <ClubDataDisclosure", "&&<ClubDataDisclosure"]) {
      expect(source).not.toContain(garde);
    }
  });
});

describe("la divulgation ne peut rien bloquer", () => {
  test("l'étape de setup ne fait dépendre AUCUNE validation de la divulgation", () => {
    const source = lire("screens/ProfileSetupScreen.tsx");
    // On isole les fonctions de garde de l'écran (validation d'étape + save) :
    // aucune ne doit mentionner la divulgation, de près ou de loin.
    const gardes = source
      .split("\n")
      .filter((l) => /validateStep|canContinue|disabled=|handleSave|blocked/i.test(l))
      .join("\n");
    expect(gardes.toLowerCase()).not.toContain("disclosure");
  });

  test("la carte réglages l'affiche DANS LES DEUX cas : déjà en club, et pas encore", () => {
    // Le joueur déjà rattaché doit pouvoir relire ce que son club voit ; celui
    // qui hésite doit le savoir AVANT de taper son code.
    const source = lire("components/settings/ClubManagementCard.tsx");
    const occurrences = source.split("<ClubDataDisclosure").length - 1;
    expect(occurrences).toBe(2);
  });

  test("le bouton « Rejoindre » ne dépend que du code saisi", () => {
    const source = lire("components/settings/ClubManagementCard.tsx");
    expect(source).toContain("disabled={joining || !inputCode.trim()}");
  });
});
