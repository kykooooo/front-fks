// functions/jest.config.js
// Tests UNITAIRES (projecteur pur + labels + DTO). Environnement Node pur, aucune
// dépendance Firestore/émulateur. Les tests d'intégration émulateur sont exclus ici
// (voir jest.integration.config.js).
const path = require("path");

module.exports = {
  rootDir: __dirname,
  roots: ["<rootDir>/tests"],
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: path.join(__dirname, "tsconfig.test.json") }],
  },
  // testRegex ancré (robuste aux séparateurs Windows du worktree), comme firestore-tests.
  testRegex: "\\.test\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", "/integration/"],
  testTimeout: 15000,
};
