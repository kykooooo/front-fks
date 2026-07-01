// functions/jest.integration.config.js
// Tests d'INTÉGRATION contre l'émulateur Firestore (Admin SDK). Lancés via
// `firebase emulators:exec --only firestore` (qui pose FIRESTORE_EMULATOR_HOST).
// Projet demo local uniquement — aucun credential de production.
const path = require("path");

module.exports = {
  rootDir: __dirname,
  roots: ["<rootDir>/tests/integration"],
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: path.join(__dirname, "tsconfig.test.json") }],
  },
  testRegex: "\\.test\\.ts$",
  testTimeout: 30000,
};
