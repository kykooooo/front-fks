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

const ECRANS = [
  "screens/WelcomeScreen.tsx",
  "screens/LoginScreen.tsx",
  "screens/RegisterScreen.tsx",
  "screens/ProfileSetupScreen.tsx",
  "screens/CoachOnboardingScreen.tsx",
  "components/auth/CoachEntryLink.tsx",
  "domain/clubJoinMessages.ts",
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
    ["components/auth/CoachEntryLink.tsx", "Tu es coach ?"],
    ["screens/ProfileSetupScreen.tsx", "Ton profil est enregistré."],
    ["domain/clubJoinMessages.ts", "Le code club n'a pas été reconnu."],
    ["domain/clubJoinMessages.ts", "Impossible de vérifier le code pour l'instant."],
    ["screens/ProfileSetupScreen.tsx", "Réessayer le code"],
    ["screens/ProfileSetupScreen.tsx", "Plus tard"],
    ["screens/ProfileScreen.tsx", "Aucun club — rejoindre avec un code"],
    ["domain/clubJoinMessages.ts", "En attente de validation du coach."],
    [
      "screens/NewSessionScreen.tsx",
      "Complète ton profil pour des séances adaptées à ta catégorie.",
    ],
    ["screens/CoachOnboardingScreen.tsx", "La création a peut-être abouti, on vérifie"],
    [
      "navigation/RootNavigator.tsx",
      "Ton compte est un compte joueur. Pour créer un club, utilise un autre compte.",
    ],
  ];

  test.each(attendus)("%s contient « %s »", (chemin, texte) => {
    expect(lire(chemin)).toContain(texte);
  });
});

describe("conventions du projet sur ces écrans", () => {
  test("les notifications passent par showToast, jamais par Alert.alert", () => {
    for (const chemin of ECRANS) {
      const source = lire(chemin);
      if (chemin.endsWith("CoachOnboardingScreen.tsx")) {
        // SEULE exception assumée : la CONFIRMATION avant création de club
        // (décision Kyllian 15/08) — un choix bloquant à deux boutons, ce
        // qu'un toast ne sait pas faire.
        const alertes = source.match(/Alert\.alert\(/g) ?? [];
        expect(alertes).toHaveLength(1);
        continue;
      }
      expect(source).not.toContain("Alert.alert(");
    }
  });

  test("les haptics passent par le hook central, jamais par expo-haptics", () => {
    for (const chemin of ECRANS) {
      expect(lire(chemin)).not.toContain("expo-haptics");
    }
  });
});
