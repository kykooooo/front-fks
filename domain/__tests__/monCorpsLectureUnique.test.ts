// domain/__tests__/monCorpsLectureUnique.test.ts
// =============================================================================
// UNE SEULE LECTURE DES GENES DECLAREES — VERIFIEE SUR LA SOURCE, PAS SUR LA FOI
// =============================================================================
//
// POURQUOI CE TEST EXISTE
// -----------------------------------------------------------------------------
// Le defaut qu'on vient de reparer n'etait pas un bug d'algorithme : c'etait
// QUATRE lecteurs de la meme donnee, avec DEUX fenetres differentes
// (DESIGN_MON_CORPS.md §1.4). La generation considerait une gene active 7 jours,
// le conseil du Home un seul jour. Un joueur pouvait donc recevoir une seance
// bridee par une gene dont l'app ne lui parlait plus.
//
// Un commentaire ne protege pas de ca : le cinquieme lecteur sera ecrit par
// quelqu'un qui n'aura pas lu le commentaire. Ce test lit donc la SOURCE, sur
// le modele de `domain/__tests__/resumeCanoniqueUnicite.test.ts`.
//
// CE QU'IL VERIFIE, EXACTEMENT
// -----------------------------------------------------------------------------
//   1. `useBodyStore` n'est importe que par une liste FERMEE de fichiers.
//   2. Plus personne ne lit `dayStates[...].feedback.injury`, hors de la
//      reprise historique (qui existe pour ca) et du store lui-meme.
//   3. `collectActivePainConstraints` n'est appelee que par le selecteur unique.
// =============================================================================

import fs from "fs";
import path from "path";

const RACINE = path.resolve(__dirname, "..", "..");

/** Fichiers du depot (hors tests, node_modules et dossiers d'outillage). */
function fichiersSources(): string[] {
  const ignores = new Set(["node_modules", ".git", ".expo", "android", "ios", "coverage", "dist", "docs"]);
  const trouves: string[] = [];

  const parcourir = (dossier: string) => {
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (ignores.has(entree.name) || entree.name === "__tests__") continue;
        parcourir(complet);
        continue;
      }
      if (!/\.tsx?$/.test(entree.name)) continue;
      trouves.push(complet);
    }
  };

  parcourir(RACINE);
  return trouves;
}

const relatif = (complet: string) => path.relative(RACINE, complet).replace(/\\/g, "/");

/**
 * Le CODE, sans les commentaires.
 *
 * Sans ce filtre, la sentinelle attraperait les fichiers qui se contentent
 * d'EXPLIQUER la règle (« avant, ce hook lisait dayStates[...].feedback.injury »).
 * Interdire d'écrire ce commentaire-là reviendrait à interdire d'expliquer
 * pourquoi la règle existe — exactement ce qu'on veut garder.
 */
function codeSeul(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((ligne) => {
      const t = ligne.trimStart();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

const lireCode = (complet: string) => codeSeul(fs.readFileSync(complet, "utf8"));

/**
 * Les SEULS fichiers autorises a toucher `useBodyStore`.
 *
 * - le store lui-meme ;
 * - le selecteur unique, porte d'entree de tout le reste de l'app ;
 * - la reprise historique, qui doit ecrire dedans ;
 * - `resetUser`, qui doit le vider au changement de compte (donnee de sante) ;
 * - les hooks de l'ecran dedie, seuls a avoir besoin de la liste brute
 *   (afficher, ajouter, changer un statut).
 *
 * Ajouter une ligne ici est une DECISION, pas une formalite : chaque entree est
 * un endroit de plus ou la meme donnee peut se mettre a diverger.
 */
const AUTORISES_STORE = [
  "state/stores/useBodyStore.ts",
  "state/selectors/blessures.ts",
  "state/migration/migrateInjuries.ts",
  "state/orchestrators/resetUser.ts",
  "hooks/monCorps/useMonCorpsViewModel.ts",
  "hooks/monCorps/monCorpsActions.ts",
];

/**
 * Les seuls fichiers autorises a lire l'ANCIEN champ `feedback.injury`.
 * La reprise historique existe precisement pour le lire une derniere fois ;
 * le store et le type le declarent encore parce que des `dayStates` en
 * contiennent. Personne d'autre.
 */
const AUTORISES_ANCIEN_CHAMP = [
  "state/migration/migrateInjuries.ts",
  "state/stores/useFeedbackStore.ts",
  "domain/types.ts",
];

/** Seul le selecteur unique traduit les genes en contraintes backend. */
const AUTORISES_CONTRAINTES = [
  "services/aiContextHelpers.ts", // la definition elle-meme
  "state/selectors/blessures.ts",
];

describe("« Mon corps » n'a qu'une seule lecture", () => {
  const sources = fichiersSources();

  it("aucun fichier hors liste n'importe useBodyStore", () => {
    const fautifs = sources
      .filter((f) => /useBodyStore/.test(lireCode(f)))
      .map(relatif)
      .filter((f) => !AUTORISES_STORE.includes(f));

    expect(fautifs).toEqual([]);
  });

  it("plus personne ne lit dayStates[...].feedback.injury hors de la reprise historique", () => {
    const fautifs = sources
      .filter((f) => /\.feedback\??\.injury\b|\binjury:\s*prevDayState/.test(lireCode(f)))
      .map(relatif)
      .filter((f) => !AUTORISES_ANCIEN_CHAMP.includes(f));

    expect(fautifs).toEqual([]);
  });

  it("collectActivePainConstraints n'est appelée que par le sélecteur unique", () => {
    const fautifs = sources
      .filter((f) => /collectActivePainConstraints/.test(lireCode(f)))
      .map(relatif)
      .filter((f) => !AUTORISES_CONTRAINTES.includes(f));

    expect(fautifs).toEqual([]);
  });

  it("le sélecteur unique existe et délègue bien à la fonction pure", () => {
    const source = fs.readFileSync(path.join(RACINE, "state/selectors/blessures.ts"), "utf8");
    expect(source).toContain("collectActivePainConstraints");
    expect(source).toContain("useBodyStore");
  });

  it("le store « Mon corps » n'écrit jamais dans Firestore", () => {
    const source = fs.readFileSync(path.join(RACINE, "state/stores/useBodyStore.ts"), "utf8");
    for (const interdit of ["firebase/firestore", "setDoc", "updateDoc", "addDoc", "onSnapshot"]) {
      expect(source).not.toContain(interdit);
    }
  });
});
