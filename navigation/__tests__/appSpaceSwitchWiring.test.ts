// navigation/__tests__/appSpaceSwitchWiring.test.ts
//
// LE SÉLECTEUR EST BRANCHÉ AU BON ENDROIT — et à UN SEUL endroit.
//
// MÉTHODE ASSUMÉE : lecture de source, comme `rootNavigatorSpaceWiring.test.ts`
// et `clubManagementOwner.test.ts`. Monter `RootNavigator` pour de vrai
// demanderait de simuler Firebase Auth, trois abonnements Firestore et deux
// navigateurs entiers pour vérifier une seule chose : que la racine est le SEUL
// émetteur, et que les écrans se contentent de relayer. Les DÉCISIONS, elles,
// sont testées pour de vrai ailleurs (domain/__tests__/appSpace.test.ts,
// hooks/__tests__/useAppSpace.test.tsx, components/__tests__/appSpaceSwitch.test.tsx).
//
// Ce que ces tests protègent :
//  1. UN SEUL ÉMETTEUR. Si un écran se mettait à publier lui-même, on
//     retrouverait deux états qui se croient tous les deux vrais — exactement la
//     divergence que ce périmètre s'interdit.
//  2. LA CONDITION VIENT DU SERVEUR. Ce que la racine publie est dérivé de
//     l'appartenance (`peutChoisirEspace`), jamais de la préférence locale.
//  3. LE SÉLECTEUR EXISTE DANS LES DEUX ESPACES. Un entraîneur-joueur enfermé
//     dans l'un des deux sans porte de sortie serait le défaut d'origine, à
//     l'envers.
//  4. AUCUN ÉCRAN N'OUVRE UN SECOND ABONNEMENT à l'appartenance.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const navigateur = lire("navigation/RootNavigator.tsx");
const selecteur = lire("components/AppSpaceSwitch.tsx");
const reglagesJoueur = lire("screens/SettingsScreen.tsx");
const semaineCoach = lire("screens/coach/CoachWeekScreen.tsx");

describe("UN SEUL émetteur : la racine", () => {
  test("`RootNavigator` publie l'état du sélecteur", () => {
    expect(navigateur).toContain("publishAppSpaceSwitch");
    expect(navigateur).toContain("peutChoisir: peutChoisirEspace");
    expect(navigateur).toContain("choisir: choisirEspace");
  });

  test("personne d'autre ne publie — hors le portillon lui-même et ses tests", () => {
    const emetteurs: string[] = [];
    const parcourir = (rel: string) => {
      for (const entree of readdirSync(resolve(racine, rel), { withFileTypes: true })) {
        const chemin = `${rel}/${entree.name}`;
        if (entree.isDirectory()) {
          if (["node_modules", ".git", ".claude", "functions", "android", "ios"].includes(entree.name)) {
            continue;
          }
          parcourir(chemin);
          continue;
        }
        if (!/\.tsx?$/.test(entree.name)) continue;
        if (chemin.includes("__tests__")) continue;
        if (chemin.endsWith("state/appSpaceGate.ts")) continue;
        if (readFileSync(resolve(racine, chemin), "utf8").includes("publishAppSpaceSwitch(")) {
          emetteurs.push(chemin);
        }
      }
    };
    for (const dossier of ["navigation", "screens", "components", "hooks", "state", "domain"]) {
      parcourir(dossier);
    }
    expect(emetteurs).toEqual(["navigation/RootNavigator.tsx"]);
  });
});

describe("la condition d'affichage vient du serveur", () => {
  test("`peutChoisirEspace` est dérivé de l'appartenance, pas de la préférence", () => {
    const hook = lire("hooks/useAppSpace.ts");
    expect(hook).toContain("peutChoisirEspace: espaces.coach && espaces.joueur");
    // `espaces` vient de la dérivation pure, qui ne connaît que l'appartenance.
    expect(hook).toContain("const espaces = espacesDisponibles(lecture)");
  });

  test("le sélecteur rend `null` sans droit aux deux espaces, sans autre condition", () => {
    expect(selecteur).toContain("if (!peutChoisir) return null;");
  });

  test("le sélecteur n'ouvre AUCUN abonnement Firestore : il relaie", () => {
    expect(selecteur).not.toContain("onSnapshot");
    expect(selecteur).not.toContain("firebase/firestore");
    expect(selecteur).toContain("onAppSpaceSwitchChange");
  });
});

describe("le sélecteur est présent dans les DEUX espaces", () => {
  test("espace joueur : réglages", () => {
    expect(reglagesJoueur).toContain("AppSpaceSwitch");
    expect(reglagesJoueur).toContain('variant="joueur"');
  });

  test("espace coach : onglet Semaine", () => {
    expect(semaineCoach).toContain("AppSpaceSwitch");
    expect(semaineCoach).toContain('variant="coach"');
  });
});
