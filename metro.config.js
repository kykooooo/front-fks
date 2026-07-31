// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// --- Web boot fix (garde-fou web-only, aucun impact iOS/Android) ---
// Sur `platform=web`, Metro n'a pas la condition d'export "react-native" et
// resout donc `zustand`/`zustand/middleware` vers leur build ESM
// (esm/*.mjs), qui contient un `import.meta` brut. Le bundle web est servi
// via une balise <script> classique (pas type="module"), donc `import.meta`
// provoque une SyntaxError qui tue tout le script avant le premier rendu
// (page blanche, aucune erreur visible). Sur iOS/Android, la condition
// "react-native" du package.json de zustand force deja le build CJS : ce
// garde-fou ne change donc rien au natif.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform, ...rest) => {
  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    return context.resolveRequest(
      { ...context, isESMImport: false, unstable_conditionNames: ['require', 'default'] },
      moduleName,
      platform
    );
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform, ...rest);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
