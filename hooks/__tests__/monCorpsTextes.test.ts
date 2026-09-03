// hooks/__tests__/monCorpsTextes.test.ts
//
// LES TEXTES VUS PAR LE JOUEUR, VERIFIES SUR LA SOURCE.
//
// Trois choses qu'aucune relecture ne garantit dans six mois :
//   1. l'ecran ne dit jamais « RF1 » / « RF2 » — ce sont des noms de regles
//      backend, pas du francais ;
//   2. il n'affiche jamais un NOMBRE DE JOURS (« ta gene date de 9 jours ») :
//      la relance pose une question, elle ne recite pas un decompte ;
//   3. la phrase « reste sur ton telephone » n'apparait QUE la ou elle est
//      VRAIE — le detail des genes — et jamais a cote du curseur douleur du
//      feedback, qui, lui, part bien sur nos serveurs (erratum 3 du design).

import fs from "fs";
import path from "path";

import {
  AVERTISSEMENT_ZONE_AUTRE,
  LIBELLE_GRAVITE,
  LIBELLE_ZONE,
  LIGNE_STOCKAGE_LOCAL,
} from "../../domain/monCorps/zones";
import { PRIVACY_POLICY } from "../../utils/legalContent";

const RACINE = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => fs.readFileSync(path.join(RACINE, rel), "utf8");

/**
 * Le CODE, sans les commentaires — même filtre que la sentinelle de lecture
 * unique. Un commentaire qui EXPLIQUE ce qu'on refuse d'écrire à l'écran
 * (« ne jamais écrire : ta gêne date de 9 jours ») ne doit pas être compté
 * comme une faute : c'est la trace de la décision.
 */
const codeSeul = (rel: string) =>
  lire(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");

const FICHIERS_JOUEUR = [
  "screens/MonCorpsScreen.tsx",
  "components/monCorps/MonCorpsHubCard.tsx",
  "screens/feedback/components/MonCorpsPrompt.tsx",
  "domain/monCorps/zones.ts",
];

describe("les textes de « Mon corps » parlent français, pas backend", () => {
  it.each(FICHIERS_JOUEUR)("%s ne contient aucun jargon de règle backend", (rel) => {
    const source = lire(rel);
    for (const jargon of ["RF1", "RF2", "RF3", "RF4", "safety_no_session", "injury_max_severity"]) {
      expect(source).not.toContain(jargon);
    }
  });

  it("l'échelle de gravité dit ce que ça empêche, pas « modérée »", () => {
    expect(LIBELLE_GRAVITE[1]).toBe("Gêne légère — je peux jouer");
    expect(LIBELLE_GRAVITE[2]).toBe("Douleur nette — je m'adapte");
    expect(LIBELLE_GRAVITE[3]).toBe("Blessure — je ne peux pas jouer");
  });

  it("aucun nombre de jours n'est affiché au joueur", () => {
    // On cherche la forme « N jour(s) » écrite en dur ou interpolée.
    for (const rel of FICHIERS_JOUEUR) {
      const source = codeSeul(rel);
      expect(source).not.toMatch(/\{[^}]*\}\s*jours?/);
      expect(source).not.toMatch(/\bdate de \d+ jours?/);
    }
  });

  it("« autre » est annoncée pour ce qu'elle est : non filtrable", () => {
    expect(AVERTISSEMENT_ZONE_AUTRE).toContain("pas écarter d'exercice");
  });

  it("« aine / adducteurs » est bien proposée au joueur", () => {
    expect(LIBELLE_ZONE.aine).toBe("Aine / adducteurs");
  });
});

describe("la phrase « reste sur ton téléphone » n'est écrite que là où elle est vraie", () => {
  it("elle est sur l'écran « Mon corps »", () => {
    expect(LIGNE_STOCKAGE_LOCAL).toContain("restent sur ton téléphone");
    expect(lire("screens/MonCorpsScreen.tsx")).toContain("LIGNE_STOCKAGE_LOCAL");
  });

  it("elle n'apparaît nulle part dans le feedback (le score de douleur, lui, est synchronisé)", () => {
    for (const rel of [
      "screens/FeedbackScreen.tsx",
      "screens/feedback/components/PainInjuryRow.tsx",
      "screens/feedback/components/MonCorpsPrompt.tsx",
    ]) {
      expect(lire(rel)).not.toContain("reste sur ton téléphone");
      expect(lire(rel)).not.toContain("restent sur ton téléphone");
    }
  });

  it("la politique de confidentialité fait la distinction, sans promesse globale fausse", () => {
    const section = PRIVACY_POLICY.find((s) => s.title === "Où vivent tes données de santé");
    expect(section).toBeTruthy();
    const texte = (section?.body ?? []).join(" ");
    // Ce qui PART : la douleur par séance.
    expect(texte).toContain("sur nos serveurs");
    // Ce qui RESTE : le détail des gênes.
    expect(texte).toContain("reste stocké sur ton appareil");
    // Ce qui ne doit JAMAIS être promis en bloc.
    expect(texte).not.toContain("Toutes tes données de santé restent");
  });

  // La politique in-app (`utils/legalContent.ts`) et la page publique
  // App Store (`docs/appstore/privacy.html`) doivent dire la MÊME chose sur
  // les données de santé (P3, round 2) : un joueur qui compare les deux
  // avant d'installer ne doit jamais lire deux versions de la vérité.
  it("docs/appstore/privacy.html porte la même honnêteté que la politique in-app", () => {
    const html = lire("docs/appstore/privacy.html");
    expect(html).toContain("Où vivent tes données de santé");
    expect(html).toContain("sur nos serveurs");
    expect(html).toContain("reste stocké sur ton appareil");
    expect(html).toContain("Rien de tout cela n'est transmis à ton club ni à ton coach");
    expect(html).not.toContain("Toutes tes données de santé restent");
  });
});
