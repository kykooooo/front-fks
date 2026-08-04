// domain/__tests__/resumeCanoniqueUnicite.test.ts
// =============================================================================
// UNE SEULE IMPLEMENTATION PAR METRIQUE — VERIFIE SUR LA SOURCE, PAS SUR LA FOI
// =============================================================================
//
// POURQUOI CE TEST EXISTE
// -----------------------------------------------------------------------------
// `domain/resumeCanonique.ts` n'a de valeur que si elle est la SEULE a compter
// les seances FKS d'une semaine. Or la mise en commun a d'abord ete faite en
// enumerant « les deux consommateurs existants » — il y en avait trois. Le
// troisieme (`screens/RoutineScreen.tsx`, ecran ROUTE dans `RootNavigator`)
// recalculait le filtre en local et pouvait donc afficher un chiffre different
// de celui du Home, sur la meme semaine, a un tap d'intervalle.
//
// Un commentaire ne protege pas de ca : la prochaine copie sera ecrite par
// quelqu'un qui n'aura pas lu le commentaire. Ce test lit donc la SOURCE.
//
// CE QU'IL VERIFIE, EXACTEMENT
// -----------------------------------------------------------------------------
//   1. Chaque consommateur connu delegue bien a `compterSeancesFksSurJours`.
//   2. Aucun fichier de `screens/`, `hooks/` ou `components/` ne refait le
//      filtre a la main — la forme exacte qui existait en triple : un test de
//      completude combine a une appartenance a la fenetre de semaine.
// =============================================================================

import fs from "fs";
import path from "path";

const RACINE = path.resolve(__dirname, "..", "..");

function lire(relatif: string): string {
  return fs.readFileSync(path.join(RACINE, relatif), "utf8");
}

/**
 * Les consommateurs connus du comptage hebdomadaire.
 *
 * `hooks/trackingProgress/buildTrackingProgress.ts` en faisait partie et n'y est
 * plus : il ne compte plus de semaine du tout. Son bloc « regularite hebdo »
 * (numerateur a lundi fixe, cible `targetFksSessionsPerWeek`) etait le
 * TROISIEME compteur hebdomadaire de l'app ; il a ete supprime, pas
 * re-delegue — le compteur vit desormais au Home, seul. Son absence de cette
 * liste est donc le comportement attendu, et le test « aucun ecran ni hook ne
 * refait le filtre a la main » ci-dessous continue de le surveiller comme
 * n'importe quel autre fichier.
 */
const CONSOMMATEURS = [
  "hooks/home/useWeekSummary.ts",
  "hooks/home/homeVNextAdapter.ts",
  "screens/RoutineScreen.tsx",
];

describe("le comptage hebdo des seances FKS n'a qu'une implementation", () => {
  it.each(CONSOMMATEURS)("%s delegue au resume canonique", (relatif) => {
    expect(lire(relatif)).toContain("compterSeancesFksSurJours");
  });

  it("aucun ecran ni hook ne refait le filtre a la main", () => {
    const dossiers = ["screens", "hooks", "components"];
    const fautifs: string[] = [];

    const parcourir = (dossier: string) => {
      for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
        const complet = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (entree.name === "__tests__" || entree.name === "node_modules") continue;
          parcourir(complet);
          continue;
        }
        if (!/\.tsx?$/.test(entree.name)) continue;

        const contenu = fs.readFileSync(complet, "utf8");
        // La forme exacte du filtre duplique : « la seance est terminee » ET
        // « son jour est dans la fenetre de semaine », dans le meme fichier,
        // sans passer par la fonction canonique.
        //
        // LES DEUX FACONS D'ECRIRE « TERMINEE ». La sentinelle ne connaissait
        // que la forme HISTORIQUE (`s.completed` a la main). Or ce lot vient de
        // generaliser le predicat canonique partout : un doublon ecrit demain le
        // serait naturellement avec `estSeanceFksTerminee`, c'est-a-dire dans la
        // forme que la sentinelle ne voyait pas. Elle verrouillait donc la
        // faute d'hier, pas la faute. Verifie sans faux positif : les trois
        // fichiers qui portent une fenetre de semaine delegent tous au
        // canonique, et le garde ci-dessous les exclut.
        const testeLaCompletude =
          /\bs(?:ession)?\??\.completed\b/.test(contenu) || /\bestSeanceFksTerminee\s*\(/.test(contenu);
        const testeLaFenetre = /week(?:Key)?Set\.has\(/.test(contenu);
        if (testeLaCompletude && testeLaFenetre && !contenu.includes("compterSeancesFksSurJours")) {
          fautifs.push(path.relative(RACINE, complet).replace(/\\/g, "/"));
        }
      }
    };

    for (const d of dossiers) parcourir(path.join(RACINE, d));

    expect(fautifs).toEqual([]);
  });
});
