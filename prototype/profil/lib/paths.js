// prototype/profil/lib/paths.js
// Racines du harnais du Profil. Tout est deduit de __dirname : aucun chemin
// machine en dur, le harnais suit le worktree ou il est commite.
"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");

/** prototype/profil/lib -> prototype/profil */
const HARNESS_ROOT = path.resolve(__dirname, "..");
/** prototype/profil -> racine du worktree (le depot front-fks) */
const APP_ROOT = path.resolve(HARNESS_ROOT, "..", "..");
/** Dossier de sortie des pages generees. */
const OUT_ROOT = path.join(HARNESS_ROOT, "out");
/** Stubs de modules natifs. */
const STUBS = path.join(__dirname, "stubs");

/**
 * Cache de transpilation. Volontairement HORS du depot : le harnais ne doit pas
 * salir le worktree avec des fichiers generes que `.gitignore` (fichier interdit
 * de modification) ne couvre pas.
 */
const CACHE_DIR = path.join(os.tmpdir(), "fks-profil-harness-cache");

function ensureDirs() {
  for (const dir of [OUT_ROOT, CACHE_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/** Chemin absolu d'un fichier du depot. */
const app = (...parts) => path.join(APP_ROOT, ...parts);

module.exports = { HARNESS_ROOT, APP_ROOT, OUT_ROOT, STUBS, CACHE_DIR, ensureDirs, app };
