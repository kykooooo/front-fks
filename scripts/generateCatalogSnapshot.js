// scripts/generateCatalogSnapshot.js
//
// Régénère assets/exercise-catalog-v2.json (snapshot bundlé du catalogue V2)
// depuis le repo BACKEND, via buildPublicExerciseCatalog() — la même fonction
// qui sert GET /api/fks/catalog/exercises. Le snapshot ne contient donc que
// les fiches PUBLIÉES (published) + les alias pointant vers elles : tant que
// rien n'est publié côté backend, le manifeste est vide — c'est voulu (la
// compat des IDs legacy vit dans HISTORICAL_EXERCISE_ALIASES).
//
// Usage (depuis la racine du repo front ou d'un worktree) :
//   node scripts/generateCatalogSnapshot.js
//   FKS_BACKEND_DIR="D:/autre/chemin/fks" node scripts/generateCatalogSnapshot.js
//
// À relancer à CHAQUE évolution du catalogue backend (publication de fiches,
// alias, réalignement) avant un build/OTA : le snapshot est l'état hors-ligne
// de référence de l'app.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendDir =
  process.env.FKS_BACKEND_DIR ?? path.resolve("C:/Users/Gamer/fks");
const outPath = path.join(__dirname, "..", "assets", "exercise-catalog-v2.json");

if (!fs.existsSync(path.join(backendDir, "src/catalog/exerciseCatalog.ts"))) {
  console.error(
    `Backend introuvable dans "${backendDir}" — passe FKS_BACKEND_DIR=<chemin du repo fks>.`
  );
  process.exit(1);
}

// Programme éphémère exécuté DANS le repo backend (ts-node y est installé) :
// un `-e` inline se fait manger les accolades par le shell Windows, on passe
// donc par un fichier temporaire.
const os = require("node:os");
const tmpFile = path.join(os.tmpdir(), `fks-catalog-snapshot-${process.pid}.ts`);
fs.writeFileSync(
  tmpFile,
  'import { buildPublicExerciseCatalog } from "./src/catalog/exerciseCatalog";\n' +
    "process.stdout.write(JSON.stringify(buildPublicExerciseCatalog(), null, 2));\n"
);
// ts-node résout l'import relatif depuis --cwd-mode ? Non : on copie le fichier
// dans le repo backend le temps de l'exécution (import relatif stable).
const runnerPath = path.join(backendDir, `.catalog-snapshot-runner-${process.pid}.ts`);
fs.copyFileSync(tmpFile, runnerPath);
let stdout;
try {
  stdout = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["ts-node", "--transpile-only", runnerPath],
    { cwd: backendDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true }
  );
} finally {
  fs.rmSync(runnerPath, { force: true });
  fs.rmSync(tmpFile, { force: true });
}

// Sanity : le flux doit être un manifeste valide avant d'écraser l'asset.
const manifest = JSON.parse(stdout);
for (const key of ["schemaVersion", "catalogVersion", "contentHash", "exercises", "aliases"]) {
  if (!(key in manifest)) {
    console.error(`Manifeste invalide (clé manquante: ${key}) — asset non modifié.`);
    process.exit(1);
  }
}

const backendSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: backendDir,
  encoding: "utf8",
}).trim();

fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `✅ Snapshot régénéré depuis fks@${backendSha} : ${manifest.exercises.length} fiche(s) publiée(s), ` +
    `${Object.keys(manifest.aliases).length} alias, hash ${manifest.contentHash.slice(0, 12)}…`
);
