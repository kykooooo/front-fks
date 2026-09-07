// components/coach/__tests__/coachTutoiement.test.ts
//
// UNE SEULE VOIX DANS L'ESPACE COACH : LE TUTOIEMENT.
//
// POURQUOI C'EST UN TEST ET PAS UNE CONSIGNE. Toute l'app tutoie — l'espace
// joueur comme l'espace coach — sauf quelques phrases oubliées, écrites à des
// mois d'intervalle, qui vouvoyaient : « Générez un code d'invitation »,
// « ouvrez « Sans donnée récente » », « Vous ne verrez plus son suivi »,
// « sans rien faire de votre côté », « Tirez vers le bas pour réessayer ». Un
// entraîneur qui lit deux voix dans le même écran ne se dit pas « incohérence
// de copie » : il se dit que l'app est faite de morceaux. Une relecture ne
// suffit pas à tenir ça dans le temps, un test si.
//
// CE QUE CE TEST LIT, ET CE QU'IL IGNORE. Il lit la SOURCE des fichiers qui
// produisent du texte coach (écrans, composants, vues du domaine, hooks), et
// il en retire d'abord les commentaires : un commentaire qui CITE l'ancienne
// phrase pour expliquer pourquoi elle a été corrigée est utile, il ne doit pas
// faire échouer la sentinelle. Ne reste donc que ce qui peut atteindre l'œil du
// coach.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..", "..");

/** Dossiers dont la source peut porter du texte affiché au coach. */
const DOSSIERS = [
  ["screens", "coach"],
  ["components", "coach"],
  ["domain", "coachView"],
  ["hooks", "coach"],
];

/**
 * Source d'un fichier, commentaires retirés.
 * Le `//` précédé de « : » est épargné (les URL), et les blocs sont enlevés
 * d'abord pour ne pas laisser traîner leurs lignes intérieures.
 *
 * ⚠️ `split(/\r?\n/)` et pas `split("\n")` : ces fichiers sont en CRLF. Un `\r`
 * resté en fin de ligne est un terminateur de ligne pour `.` comme pour `$`, et
 * la suppression des commentaires ne s'appliquait alors À AUCUNE ligne — la
 * sentinelle aurait signalé des commentaires en croyant lire de la copie.
 */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .map((ligne) => ligne.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function fichiersCoach(): Array<{ chemin: string; source: string }> {
  const out: Array<{ chemin: string; source: string }> = [];
  for (const segments of DOSSIERS) {
    const dossier = resolve(racine, ...segments);
    for (const nom of readdirSync(dossier)) {
      if (!nom.endsWith(".ts") && !nom.endsWith(".tsx")) continue;
      out.push({
        chemin: `${segments.join("/")}/${nom}`,
        source: sansCommentaires(readFileSync(resolve(dossier, nom), "utf8")),
      });
    }
  }
  return out;
}

const FICHIERS = fichiersCoach();

/**
 * Les formes interdites. Les pronoms d'abord ; puis les impératifs de politesse
 * réellement trouvés dans l'espace coach — liste FERMÉE, pour ne pas rejeter
 * « assez », « chez » ou un identifiant qui finirait par « ez ».
 */
const INTERDITS: Array<{ nom: string; motif: RegExp }> = [
  { nom: "vous", motif: /\bvous\b/i },
  { nom: "votre", motif: /\bvotre\b/i },
  { nom: "vos", motif: /\bvos\b/i },
  { nom: "Générez", motif: /\bgénérez\b/i },
  { nom: "partagez", motif: /\bpartagez\b/i },
  { nom: "ouvrez", motif: /\bouvrez\b/i },
  { nom: "tirez", motif: /\btirez\b/i },
  { nom: "vérifiez", motif: /\bvérifiez\b/i },
  { nom: "réessayez", motif: /\bréessayez\b/i },
  { nom: "créez", motif: /\bcréez\b/i },
];

describe("Espace coach — une seule voix, le tutoiement", () => {
  test("les fichiers scrutés existent bel et bien (le test ne mesure pas le vide)", () => {
    expect(FICHIERS.length).toBeGreaterThan(30);
  });

  // CONTRE-ÉPREUVE. Un nettoyeur de commentaires trop gourmand rendrait la
  // sentinelle verte en ne lisant plus rien. On vérifie donc qu'après nettoyage
  // il reste bien de la COPIE — et que les commentaires, eux, sont partis.
  test("après nettoyage il reste la copie, et plus les commentaires qui la citent", () => {
    const etatsVides = FICHIERS.find((f) => f.chemin === "components/coach/CoachEmptyState.tsx");
    expect(etatsVides).toBeDefined();
    expect(etatsVides?.source).toContain("Génère un code d'invitation, partage-le");
    expect(etatsVides?.source).not.toContain("écran QUI PORTE le code");
  });

  test.each(INTERDITS)("aucun texte coach n'emploie « $nom »", ({ motif }) => {
    const fautifs = FICHIERS.filter((f) => motif.test(f.source)).map((f) => f.chemin);
    expect(fautifs).toEqual([]);
  });
});
