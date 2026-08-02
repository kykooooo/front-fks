// navigation/__tests__/rootNavigatorSpaceWiring.test.ts
//
// LA NAVIGATION CHOISIT-ELLE VRAIMENT L'ESPACE SUR L'AUTORITÉ SERVEUR ?
//
// La dérivation peut être parfaite et n'être branchée nulle part. Cette suite
// lit la source du navigateur et vérifie trois choses qu'un test de rendu ne
// dirait pas — monter RootNavigator demanderait Firebase, la navigation et
// l'intégralité des écrans :
//
//  1. l'espace vient de `useAppSpace` (donc de l'appartenance au club) ;
//  2. `users/{uid}.role` — le champ que l'utilisateur écrit lui-même — n'est
//     PLUS lu pour router quoi que ce soit. C'est la faille fermée par ce lot :
//     les règles Firestore autorisent chacun à écrire tout son document
//     `users/{uid}`, donc à s'y déclarer coach ;
//  3. tant que l'appartenance n'est pas lue, on affiche l'écran de chargement —
//     jamais l'espace joueur « en attendant », qui clignoterait devant un coach
//     à chaque démarrage à froid.
//
// Méthode assumée : lecture de source, comme components/club/__tests__/
// clubDisclosureWiring.test.ts. Le comportement, lui, est testé pour de vrai
// dans hooks/__tests__/useAppSpace.test.tsx et domain/__tests__/appSpace.test.ts.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const navigateur = lire("navigation/RootNavigator.tsx");

describe("RootNavigator — l'espace est dérivé, pas déclaré", () => {
  test("appelle useAppSpace avec le compte et le club", () => {
    expect(navigateur).toMatch(/import\s*\{\s*useAppSpace\s*\}\s*from/);
    expect(navigateur).toContain("useAppSpace({ uid: user?.uid ?? null, clubId })");
  });

  test("route l'espace coach sur la dérivation, jamais sur un rôle applicatif", () => {
    expect(navigateur).toContain('appSpace.space === "coach"');
    // L'ancien aiguillage, mot pour mot. S'il revient, ce test tombe.
    // (On vise l'AIGUILLAGE `if (role === "coach")`, pas la phrase qui raconte
    // dans un commentaire pourquoi il a disparu.)
    expect(navigateur).not.toContain('if (role === "coach")');
  });

  test("ne lit plus `users/{uid}.role`", () => {
    // Le document users reste lu (profil complété, clubId) — mais plus son rôle.
    expect(navigateur).toContain("data?.profileCompleted");
    expect(navigateur).toContain("data?.clubId");
    expect(navigateur).not.toMatch(/data\?\.role/);
    expect(navigateur).not.toMatch(/setRole\(/);
  });

  test("attend la lecture de l'appartenance avant d'afficher un espace", () => {
    expect(navigateur).toContain('appSpace.decision === "en-attente"');
    // L'attente doit être décidée AVANT le choix de l'espace, sinon elle ne sert
    // à rien : l'espace joueur serait rendu pendant que la réponse arrive.
    expect(navigateur.indexOf('appSpace.decision === "en-attente"')).toBeLessThan(
      navigateur.indexOf('appSpace.space === "coach"'),
    );
  });
});

describe("plus personne n'écrit `users/{uid}.role`", () => {
  test("la création de club n'écrit que le pointeur de club", () => {
    const repo = lire("repositories/clubsRepo.ts");
    // On isole l'écriture du document users faite par createClubAsCoach.
    const bloc = repo.slice(repo.indexOf("export async function createClubAsCoach"));
    expect(bloc).toContain("clubId: club.id");
    expect(bloc).not.toMatch(/role:\s*"coach"/);
  });

  test("aucun écrivain de `users/{uid}.role` ne subsiste côté application", () => {
    for (const chemin of [
      "repositories/clubsRepo.ts",
      "screens/CoachOnboardingScreen.tsx",
      "components/settings/ClubManagementCard.tsx",
    ]) {
      expect(lire(chemin)).not.toMatch(/role:\s*"coach"/);
    }
  });
});
