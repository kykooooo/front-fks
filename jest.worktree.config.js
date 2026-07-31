// jest.worktree.config.js
// Config jest ad hoc pour lancer des tests DEPUIS un worktree.
//
// Piege connu (voir CLAUDE.md / ARCHITECTURE_BOUCLE.md "Compatibilite / migration") :
// le bloc "jest" de package.json a testPathIgnorePatterns / modulePathIgnorePatterns
// contenant "/.claude/worktrees/". Ce sont des regex appliquees au chemin ABSOLU des
// fichiers ; comme ce worktree vit lui-meme sous .claude/worktrees/<nom>, TOUT fichier
// de test ici matche ce pattern et se retrouve exclu -- meme les tests du worktree
// courant. Ce fichier reprend le preset jest-expo + setupFiles de package.json, sans
// ces deux exclusions, pour permettre `npx jest --config jest.worktree.config.js`
// depuis un worktree.
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/firestore-tests/", "/functions/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
};
