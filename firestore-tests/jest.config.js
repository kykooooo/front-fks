// firestore-tests/jest.config.js
//
// Runner Jest DÉDIÉ aux tests Firestore Rules — totalement séparé du preset
// jest-expo (React Native) utilisé par `yarn test`. Environnement Node pur,
// transform ts-jest via le tsconfig dédié. Aucun setup RN, aucun mock Expo.
//
// Lancé par `yarn test:rules`, qui l'enveloppe dans `firebase emulators:exec`
// (démarre puis arrête l'émulateur Firestore, propage l'exit code).
const path = require("path");

module.exports = {
  rootDir: __dirname,
  roots: ["<rootDir>"],
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: path.join(__dirname, "tsconfig.json") }],
  },
  // testRegex (suffixe ancré) plutôt que testMatch : robuste aux chemins Windows
  // à séparateurs mixtes du worktree (.claude\worktrees\…) qui cassent les globs.
  testRegex: "\\.test\\.ts$",
  testTimeout: 20000,
  // DÉTERMINISME OBLIGATOIRE : toutes les suites partagent UN seul émulateur
  // Firestore. En parallèle, le `clearFirestore()`/`seed()` d'un worker écraserait
  // les données d'un autre → faux échecs intermittents. On sérialise les suites.
  maxWorkers: 1,
};
