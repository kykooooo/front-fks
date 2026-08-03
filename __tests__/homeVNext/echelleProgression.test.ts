// __tests__/homeVNext/echelleProgression.test.ts
// =============================================================================
// L'ACCUEIL ET LA PROGRESSION PARTAGENT UNE ECHELLE
// =============================================================================
//
// La page Progression est a UN TAP de l'accueil : le pied « Voir ma
// progression » y mene, et c'est le seul aller-retour que le joueur fait
// souvent. Deux epaisseurs de titre sur ce trajet, ca ne se voit sur aucune
// capture prise separement — ca se voit au premier enchainement.
//
// L'accueil rend l'echelle allegee retenue par le fondateur : ZERO role en 800,
// graisse maximale 700, hierarchie portee par la taille et la couleur plutot que
// par l'epaisseur. La refonte de la page Progression a repris sa couche de
// donnees sans toucher a sa typographie, et reconduisait sept roles en 800 plus
// un en 900.
//
// Ce test lit la SOURCE plutot que de monter l'ecran, pour la meme raison que
// `navigation/__tests__/homeVNextWiring.test.ts` : ce qu'on verifie n'est pas un
// comportement de rendu mais une propriete de la feuille de styles, et la monter
// demanderait la moitie des stores de l'app pour n'apprendre rien de plus.
//
// Ce qui est verifie N'EST PAS « la page est belle » — aucun test ne sait faire
// ca, et c'est la recette telephone qui tranche. C'est la seule chose
// verifiable : les deux ecrans ne peuvent pas repartir chacun de leur cote sans
// que quelqu'un le voie passer.
// =============================================================================

import { readFileSync } from "fs";
import { resolve } from "path";

import { ECHELLES } from "../../components/homeVNext/homeVNextTypo";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

/** Toutes les graisses ecrites en dur dans un fichier, dans l'ordre. */
function graisses(source: string): string[] {
  return Array.from(source.matchAll(/fontWeight:\s*"(\d{3})"/g)).map((m) => m[1]);
}

describe("l'echelle allegee de l'accueil plafonne bien a 700", () => {
  test("aucun palier de l'echelle allegee ne depasse 700", () => {
    // Le point de reference du test n'est pas recopie : il est LU dans l'echelle.
    // Si le fondateur relevait un jour le plafond, cette suite suivrait au lieu
    // de mentir.
    const poids = Object.values(ECHELLES.allegee).map((p) => Number(p.fontWeight));
    expect(Math.max(...poids)).toBe(700);
  });
});

describe("la page Progression tient la meme echelle", () => {
  const progression = lire("screens/ProgressScreen.tsx");

  test("aucune graisse 800 ni 900 n'y subsiste", () => {
    const lourdes = graisses(progression).filter((p) => Number(p) > 700);
    expect(lourdes).toEqual([]);
  });

  test("la page utilise bien encore des graisses : la regle n'a pas ete appliquee en tout aplatissant", () => {
    // Un ecran ou tout serait en 400 passerait le test precedent tout en etant
    // illisible. On verifie donc que la hierarchie existe toujours.
    const poids = new Set(graisses(progression));
    expect(poids.has("700")).toBe(true);
    expect(poids.size).toBeGreaterThan(1);
  });
});

describe("l'accueil vNext ne code aucune graisse en dur", () => {
  // Ses composants lisent leurs paliers via `useStylesEchelle` : c'est ce qui
  // permet a un seul fichier de decider de l'epaisseur de tout l'ecran. Si une
  // graisse reapparait en dur dans un composant, l'echelle cesse d'etre unique
  // et la page Progression n'a plus rien a rattraper.
  const composants = [
    "components/homeVNext/HomeVNextAction.tsx",
    "components/homeVNext/HomeVNextHeader.tsx",
    "components/homeVNext/HomeVNextForm.tsx",
    "components/homeVNext/HomeVNextWeek.tsx",
    "components/homeVNext/HomeVNextNote.tsx",
    "components/homeVNext/HomeVNextDemarrage.tsx",
    "components/homeVNext/HomeVNextDataNotice.tsx",
  ];

  test.each(composants)("%s n'ecrit aucun fontWeight en dur", (fichier) => {
    expect(graisses(lire(fichier))).toEqual([]);
  });
});
