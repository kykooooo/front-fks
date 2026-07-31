// screens/newSession/__tests__/aucuneSeanceDeSecours.test.ts
//
// VERROU ARCHITECTURAL.
//
// L'app fabriquait une fausse séance quand la génération échouait
// (échauffement + footing Z2 20 min + mobilité, en dur, sans rien savoir du
// matériel, des douleurs ni du cycle du joueur). Elle la persistait et
// l'affichait comme une prescription FKS.
//
// Ce test échoue si ce chemin réapparaît, sous n'importe quelle forme :
// fichier ressuscité, import depuis la production, fabrique de séance en dur.
// Un commentaire "ne pas utiliser" ne protège rien — ce test, si.

import fs from "fs";
import path from "path";

const RACINE = path.resolve(__dirname, "..", "..", "..");

/** Dossiers de code de production, hors tests. */
const DOSSIERS_PRODUCTION = [
  "components",
  "config",
  "constants",
  "domain",
  "engine",
  "hooks",
  "navigation",
  "repositories",
  "schemas",
  "screens",
  "services",
  "shared",
  "state",
  "utils",
];

// Un commentaire "ne pas utiliser" ne protège rien — un § de doc qui BÉNIT
// (même en exemple positif) la fabrique de séance de secours ne protège pas
// plus. `docs/` est scanné comme du code : si un jour une doc réintroduit
// buildFallbackSession/fallback_safe/Footing Z2 comme une bonne pratique, la
// CI casse. (Un rappel HISTORIQUE de la faute corrigée reste possible tant
// qu'il ne cite pas les identifiants littéraux bannis ci-dessous — voir
// docs/CONTRAT_ERREUR_FRONT.md et docs/AUDIT-FRONT-P0.0.md pour le style à suivre.)
const DOSSIERS_DOC = ["docs"];

const FICHIERS_RACINE = ["App.tsx"];

const EXTENSIONS = [".ts", ".tsx"];
const EXTENSIONS_DOC = [".md"];

const DOSSIERS_IGNORES = new Set(["__tests__", "__mocks__", "node_modules"]);

function listerFichiersProduction(): string[] {
  const resultat: string[] = [];

  const parcourir = (dossier: string, extensions: string[]) => {
    let entrees: fs.Dirent[];
    try {
      entrees = fs.readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entree of entrees) {
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (DOSSIERS_IGNORES.has(entree.name) || entree.name.startsWith(".")) continue;
        parcourir(chemin, extensions);
        continue;
      }
      if (!extensions.includes(path.extname(entree.name))) continue;
      if (entree.name.includes(".test.")) continue;
      resultat.push(chemin);
    }
  };

  for (const dossier of DOSSIERS_PRODUCTION) parcourir(path.join(RACINE, dossier), EXTENSIONS);
  for (const dossier of DOSSIERS_DOC) parcourir(path.join(RACINE, dossier), EXTENSIONS_DOC);
  for (const fichier of FICHIERS_RACINE) {
    const chemin = path.join(RACINE, fichier);
    if (fs.existsSync(chemin)) resultat.push(chemin);
  }
  return resultat;
}

const relatif = (chemin: string) => path.relative(RACINE, chemin).split(path.sep).join("/");

const FICHIERS = listerFichiersProduction();
const CONTENUS = FICHIERS.map((chemin) => ({
  chemin: relatif(chemin),
  texte: fs.readFileSync(chemin, "utf8"),
}));

describe("verrou : aucune seance de secours fabriquee cote app", () => {
  test("le perimetre scanne n'est pas vide (garde-fou du test lui-meme)", () => {
    expect(FICHIERS.length).toBeGreaterThan(100);
    expect(CONTENUS.some((f) => f.chemin === "screens/NewSessionScreen.tsx")).toBe(true);
  });

  test("le fichier screens/newSession/fallback.ts n'existe plus", () => {
    expect(fs.existsSync(path.join(RACINE, "screens", "newSession", "fallback.ts"))).toBe(false);
    expect(fs.existsSync(path.join(RACINE, "screens", "newSession", "fallback.tsx"))).toBe(false);
  });

  test("aucun fichier de production n'importe un module fallback de generation", () => {
    const motif = /(?:from|require\()\s*["'][^"']*newSession\/fallback["']|(?:from|require\()\s*["']\.\/fallback["']/;
    const coupables = CONTENUS.filter((f) => motif.test(f.texte)).map((f) => f.chemin);
    expect(coupables).toEqual([]);
  });

  test("la fabrique buildFallbackSession n'existe nulle part en production", () => {
    const coupables = CONTENUS.filter((f) => f.texte.includes("buildFallbackSession")).map(
      (f) => f.chemin
    );
    expect(coupables).toEqual([]);
  });

  test("le marqueur fallback_safe n'existe que pour RECONNAITRE les anciennes seances", () => {
    // Seule utils/sessionHelpers.ts a le droit de connaître ce marqueur, et
    // uniquement pour refuser ces séances — jamais pour en produire.
    const AUTORISES = new Set(["utils/sessionHelpers.ts"]);
    const coupables = CONTENUS.filter(
      (f) => f.texte.includes("fallback_safe") && !AUTORISES.has(f.chemin)
    ).map((f) => f.chemin);
    expect(coupables).toEqual([]);
  });

  test("aucune prescription en dur de l'ancienne seance de secours ne subsiste", () => {
    const TERMES = ["Footing Z2", "Fallback FKS", "Fallback local suite"];
    const coupables = CONTENUS.filter((f) => TERMES.some((t) => f.texte.includes(t))).map(
      (f) => f.chemin
    );
    expect(coupables).toEqual([]);
  });

  test("le catch de generation n'ecrit plus rien", () => {
    const ecran = CONTENUS.find((f) => f.chemin === "screens/NewSessionScreen.tsx");
    expect(ecran).toBeDefined();
    const catchGeneration = ecran!.texte.slice(
      ecran!.texte.indexOf("} catch (err: any) {"),
      ecran!.texte.indexOf("} finally {", ecran!.texte.indexOf("} catch (err: any) {"))
    );
    expect(catchGeneration.length).toBeGreaterThan(0);
    for (const ecriture of ["pushSession(", "persistPlanned(", "setLastAiSessionV2(", "processV2("]) {
      expect(catchGeneration).not.toContain(ecriture);
    }
    // Et aucune navigation vers l'écran de séance depuis le chemin d'erreur.
    expect(catchGeneration).not.toContain('nav.navigate("SessionPreview"');
    expect(catchGeneration).not.toContain('nav.navigate("SessionLive"');
  });
});
