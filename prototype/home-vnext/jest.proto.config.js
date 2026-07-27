// prototype/home-vnext/jest.proto.config.js
// =============================================================================
// TESTS DU PROTOTYPE — CONFIGURATION DEDIEE
// =============================================================================
// Pourquoi ce fichier existe :
//
// La configuration jest du depot (bloc `jest` de `package.json`) contient
//   "testPathIgnorePatterns": [... "/.claude/worktrees/" ...]
//   "modulePathIgnorePatterns": [... "<rootDir>/.claude/worktrees/" ...]
// Depuis un worktree, `npx jest` liste donc ZERO test et sort en SUCCES. Un
// piege connu : on croit que tout passe alors que rien n'a tourne.
//
// Cette configuration reprend exactement la meme chaine (preset `jest-expo`,
// meme `setupFiles`, meme `transformIgnorePatterns`) mais :
//   - pose `rootDir` sur la racine du worktree ;
//   - ne filtre plus les worktrees ;
//   - ne ramasse QUE `__tests__/homeVNext/`.
//
//   node prototype/home-vnext/verifier.js tests
//   ou : npx jest --config prototype/home-vnext/jest.proto.config.js
// =============================================================================
"use strict";

const path = require("path");

/**
 * Racine du worktree (deux niveaux au-dessus de ce fichier).
 *
 * Les separateurs sont forces en `/` : sur Windows, `path.resolve` renvoie des
 * antislashs, et `<rootDir>` se retrouve alors injecte tel quel dans les motifs
 * `testMatch`. Or ces motifs sont des globs — un antislash y est un caractere
 * d'echappement, pas un separateur. Resultat mesure avant correction :
 * « 360 files checked, 0 matches » alors que les fichiers existent.
 */
const RACINE = path.resolve(__dirname, "../..").replace(/\\/g, "/");

module.exports = {
  rootDir: RACINE,
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  // Le seul perimetre : les tests du prototype.
  //
  // `testRegex` et NON `testMatch` : sur Windows, les chemins de fichiers
  // arrivent avec des antislashs alors qu'un glob `testMatch` attend des
  // slashs — jest annoncait « 360 files checked, 0 matches » sur des fichiers
  // qui existent. Une expression reguliere qui accepte les deux separateurs
  // n'a pas ce probleme.
  testRegex: "__tests__[\\\\/]homeVNext[\\\\/].*\\.test\\.tsx?$",
  testPathIgnorePatterns: ["/node_modules/"],
  // Identique au depot : sans ca, les paquets Expo/RN livres en ESM ne sont pas
  // transpiles et les tests plantent a l'import.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
};
