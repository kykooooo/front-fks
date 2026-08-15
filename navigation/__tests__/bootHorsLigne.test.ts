// navigation/__tests__/bootHorsLigne.test.ts
//
// UN BOOT HORS LIGNE MONTRE-T-IL ENCORE LE QUESTIONNAIRE VIERGE ?
//
// P1-06 inventaire clubs (15/08, sémantique Firestore exécutée contre hôte
// injoignable) : au démarrage à froid hors réseau d'un compte DÉJÀ configuré,
// le premier snapshot du profil est un cache vide (fromCache=true,
// exists=false, ~50 ms à ~10 s selon le réseau). L'ancien listener concluait
// « pas de profil » → questionnaire de profil VIERGE affiché à un joueur
// configuré, avec toast d'erreur — il croyait son compte effacé.
//
// Tests-source (le listener vit dans un composant intestable sans Firebase ;
// la sémantique fromCache, elle, a été prouvée par exécution à l'inventaire).

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "RootNavigator.tsx"),
  "utf8"
);

describe("RootNavigator — le cache vide hors-ligne ne conclut rien", () => {
  test("le garde fromCache && !exists est posé AVANT toute conclusion", () => {
    const garde = source.indexOf("snap.metadata.fromCache && !snap.exists()");
    const conclusion = source.indexOf("setProfileCompleted(!!data?.profileCompleted)");
    expect(garde).toBeGreaterThan(-1);
    expect(conclusion).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(conclusion);
  });

  test("dans ce cas, initializing reste vrai (return avant setInitializing)", () => {
    const bloc = source.slice(
      source.indexOf("snap.metadata.fromCache && !snap.exists()"),
      source.indexOf("setProfilIllisibleHorsLigne(false)")
    );
    expect(bloc).toContain("setProfilIllisibleHorsLigne(true)");
    expect(bloc).toContain("return;");
    expect(bloc).not.toContain("setInitializing");
  });

  test("l'attente hors-ligne est étiquetée honnêtement", () => {
    expect(source).toContain(
      "Hors connexion — ton profil ne peut pas être chargé. L'app reprendra dès que le réseau revient."
    );
  });

  test("un vrai snapshot (serveur ou cache non vide) réarme le flag", () => {
    expect(source).toContain("setProfilIllisibleHorsLigne(false)");
  });
});
