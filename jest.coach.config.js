// jest.coach.config.js
//
// POURQUOI ce fichier existe.
// Le bloc `jest` de package.json ignore `/.claude/worktrees/` (modulePathIgnorePatterns
// ET testPathIgnorePatterns). C'est voulu quand on lance la suite depuis le dépôt
// principal : sans ça, chaque worktree ferait doublon (mêmes tests, plusieurs copies).
// Effet de bord PIÉGEUX : lancé DEPUIS un worktree, `npx jest` voit son propre rootDir
// sous `.claude/worktrees/` → il collecte 0 test et sort en SUCCÈS. Une suite "verte"
// obtenue ainsi ne prouve strictement rien.
//
// Ce fichier rejoue la MÊME configuration, sans cette exclusion : c'est la seule
// manière de mesurer réellement les tests front depuis un worktree.
//   npx jest --config jest.coach.config.js
//
// NB nommage : la branche "boucle de suivi joueur" apporte son propre
// `jest.worktree.config.js`. Nom distinct ici = zéro conflit au merge.
//
// Restent ignorés (comme dans package.json) : node_modules, firestore-tests/
// (émulateur Firestore, config dédiée) et functions/ (Cloud Functions, ts-jest).

module.exports = {
  rootDir: __dirname,
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  modulePathIgnorePatterns: ["<rootDir>/functions/"],
  testPathIgnorePatterns: ["/node_modules/", "/firestore-tests/", "/functions/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
};
