// screens/newSession/__tests__/gardeCategorieAge.test.ts
//
// LA GARDE D'ÂGE ÉCHOUAIT OUVERTE (R5 de la contre-vérification du 05/09).
//
// La garde du lot A lit `categorieAgeManquante`, dérivé de `aiContext` — le
// contexte chargé à l'OUVERTURE de l'écran. Or ce chargement est conditionné à
// un cycle actif (`useAiContextLoader(..., Boolean(cycleId) && !cycleCompleted)`)
// et peut échouer : `aiContext` reste alors `null`, `categorieAgeManquante`
// vaut `false`, et la génération partait avec `age_category: null`.
//
// Côté moteur, `age_category: null` ne veut pas dire « dosage par défaut » :
// `getAgeCategoryCaps(null)` rend `null` et l'orchestrateur n'applique AUCUN
// plafond — ni familles interdites, ni volume, ni contacts pliométriques, ni
// sprint, ni durée (erratum 4 de l'audit). Zéro protection, pour un joueur qui
// peut avoir 14 ans.
//
// La règle vit désormais à un seul endroit, et elle est rejouée sur le contexte
// FRAÎCHEMENT construit, juste avant l'appel payant.

import { readFileSync } from "fs";
import { resolve } from "path";

import { categorieAgeAbsente, TOAST_CATEGORIE_MANQUANTE } from "../gardeCategorieAge";

describe("categorieAgeAbsente — ce qui compte comme une catégorie", () => {
  test("une vraie catégorie passe", () => {
    expect(categorieAgeAbsente({ profile: { age_category: "U17" } })).toBe(false);
    expect(categorieAgeAbsente({ profile: { age_category: "Senior" } })).toBe(false);
  });

  test("absente sous toutes ses formes : c'est le cas qui bloque", () => {
    expect(categorieAgeAbsente({ profile: { age_category: null } })).toBe(true);
    expect(categorieAgeAbsente({ profile: {} })).toBe(true);
    expect(categorieAgeAbsente({})).toBe(true);
    expect(categorieAgeAbsente(null)).toBe(true);
    expect(categorieAgeAbsente(undefined)).toBe(true);
  });

  test("une chaîne vide ou blanche n'est pas une catégorie", () => {
    // L'envoyer annoncerait au moteur une protection qui n'existe pas.
    expect(categorieAgeAbsente({ profile: { age_category: "" } })).toBe(true);
    expect(categorieAgeAbsente({ profile: { age_category: "   " } })).toBe(true);
  });

  test("une valeur qui n'est pas du texte non plus", () => {
    expect(categorieAgeAbsente({ profile: { age_category: 17 } })).toBe(true);
    expect(categorieAgeAbsente({ profile: { age_category: true } })).toBe(true);
  });
});

describe("l'écran de génération rejoue la garde sur le contexte FRAIS", () => {
  const source = readFileSync(
    resolve(__dirname, "..", "..", "NewSessionScreen.tsx"),
    "utf8",
  );

  test("le contexte affiché et le contexte payant appliquent LA MÊME règle", () => {
    // Une seule implémentation : deux copies finiraient par diverger, et
    // celle qui garde l'appel payant est justement celle qu'on ne voit pas.
    expect(source).toContain(
      "const categorieAgeManquante = !!aiContext && categorieAgeAbsente(aiContext);",
    );
    expect(source).toContain("if (categorieAgeAbsente(ctx)) {");
  });

  test("la garde fraîche tombe APRÈS la construction du contexte et AVANT l'appel", () => {
    const iContexte = source.indexOf("const ctx = await buildAIPromptContext();");
    const iGarde = source.indexOf("if (categorieAgeAbsente(ctx)) {");
    const iPrepare = source.indexOf("prepareBackendContext(");
    expect(iContexte).toBeGreaterThan(-1);
    expect(iGarde).toBeGreaterThan(iContexte);
    expect(iGarde).toBeLessThan(iPrepare);
    // Et rien de payant ne se glisse entre les deux.
    const entreDeux = source.slice(iContexte, iGarde);
    expect(entreDeux).not.toContain("fetchV2(");
    expect(entreDeux).not.toContain("prepareBackendContext(");
  });

  test("elle rend la main : aucun appel backend ne suit", () => {
    const bloc = source.slice(source.indexOf("if (categorieAgeAbsente(ctx)) {"));
    const corps = bloc.slice(0, bloc.indexOf("\n      }"));
    expect(corps).toContain("TOAST_CATEGORIE_MANQUANTE");
    expect(corps).toContain('nav.navigate("ProfileSetup")');
    expect(corps).toContain("return;");
  });

  test("le message joueur est celui décidé, écrit une seule fois", () => {
    expect(TOAST_CATEGORIE_MANQUANTE.title).toBe("Il manque ta catégorie");
    expect(TOAST_CATEGORIE_MANQUANTE.message).toBe(
      "Complète ton profil pour des séances adaptées à ta catégorie.",
    );
    // Plus aucune copie littérale dans l'écran.
    expect(source).not.toContain('title: "Il manque ta catégorie"');
  });
});
