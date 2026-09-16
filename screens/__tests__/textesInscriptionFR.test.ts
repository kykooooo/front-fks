// screens/__tests__/textesInscriptionFR.test.ts
//
// CE QUE LE JOUEUR LIT, DU PREMIER ÉCRAN À LA PREMIÈRE SÉANCE.
//
// Sentinelle de langue et de jargon sur les six écrans du parcours d'inscription.
// Deux fuites possibles, toutes deux constatées ailleurs dans le produit :
//  . un message technique en anglais qui remonte tel quel (« Missing or
//    insufficient permissions ») ;
//  . un code interne affiché à un joueur (« RF1 », « token:… », un code Firebase
//    brut) — le bug P0 du 01/09 tenait exactement à ça.
//
// Le test lit les CHAÎNES AFFICHÉES (titres et messages de toast, textes de
// carte), pas le code autour : un identifiant de variable en anglais n'est pas
// un texte joueur.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

// Les écrans et messages de l'espace club/coach (création de club, entrée
// coach, messages de rattachement) sont partis avec lui (2026-09).
const ECRANS = [
  "screens/WelcomeScreen.tsx",
  "screens/LoginScreen.tsx",
  "screens/RegisterScreen.tsx",
  "screens/ProfileSetupScreen.tsx",
];

/** Les valeurs `title:` / `message:` des toasts, telles qu'elles s'affichent. */
function textesDeToast(source: string): string[] {
  const trouves = source.match(/(?:title|message):\s*"([^"]{4,})"/g) ?? [];
  return trouves.map((t) => t.replace(/^(?:title|message):\s*"/, "").replace(/"$/, ""));
}

describe("aucun code interne ne fuit vers le joueur", () => {
  test("ni RF1, ni token:, ni code Firebase brut dans un texte affiché", () => {
    for (const chemin of ECRANS) {
      for (const texte of textesDeToast(lire(chemin))) {
        expect(texte).not.toMatch(/\bRF1\b/);
        expect(texte).not.toMatch(/token:/);
        expect(texte).not.toMatch(/auth\/[a-z-]+/);
        expect(texte).not.toMatch(/functions\/[a-z-]+/);
        expect(texte).not.toMatch(/permission-denied|Missing or insufficient/i);
      }
    }
  });

  test("aucun mot anglais courant d'erreur dans un texte affiché", () => {
    // Liste volontairement courte et sans faux positif français : chacun de ces
    // mots a déjà été vu remonter d'un SDK dans une interface francophone.
    const anglicismes =
      /\b(error|failed|failure|invalid|unavailable|unauthorized|forbidden|not found|please|try again|loading|success)\b/i;
    for (const chemin of ECRANS) {
      for (const texte of textesDeToast(lire(chemin))) {
        expect(texte).not.toMatch(anglicismes);
      }
    }
  });
});

describe("les textes décidés sont bien là, mot pour mot", () => {
  const attendus: Array<[string, string]> = [
    ["screens/ProfileSetupScreen.tsx", "Profil enregistré"],
    ["screens/RegisterScreen.tsx", "Configure ton profil et lance ta première séance."],
    [
      "screens/NewSessionScreen.tsx",
      "Complète ton profil pour des séances adaptées à ta catégorie.",
    ],
  ];

  test.each(attendus)("%s contient « %s »", (chemin, texte) => {
    expect(lire(chemin)).toContain(texte);
  });

  // L'ESPACE CLUB / COACH EST RETIRÉ DU PARCOURS (2026-09) : aucun écran de
  // l'inscription ne parle plus de code club, de rôle ou de rattachement.
  const interdits: Array<[string, string]> = [
    ["screens/WelcomeScreen.tsx", "Je suis coach"],
    ["screens/LoginScreen.tsx", "Tu es coach"],
    ["screens/RegisterScreen.tsx", "Tu es coach"],
    ["screens/RegisterScreen.tsx", "Rejoins ton club"],
    ["screens/ProfileSetupScreen.tsx", "Code club"],
    ["screens/ProfileSetupScreen.tsx", "Crée ton club"],
    ["screens/ProfileScreen.tsx", "Mon club"],
    ["screens/SettingsScreen.tsx", "Passer en espace coach"],
  ];

  test.each(interdits)("%s ne contient plus « %s »", (chemin, texte) => {
    expect(lire(chemin)).not.toContain(texte);
  });
});

describe("conventions du projet sur ces écrans", () => {
  test("les notifications passent par showToast, jamais par Alert.alert", () => {
    for (const chemin of ECRANS) {
      expect(lire(chemin)).not.toContain("Alert.alert(");
    }
  });

  test("les haptics passent par le hook central, jamais par expo-haptics", () => {
    for (const chemin of ECRANS) {
      expect(lire(chemin)).not.toContain("expo-haptics");
    }
  });
});
