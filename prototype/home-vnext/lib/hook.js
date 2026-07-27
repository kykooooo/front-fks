// prototype/home-vnext/lib/hook.js
// =============================================================================
// HOOK REQUIRE MAISON
// =============================================================================
// Deux roles, et deux seulement :
//   1. transpiler a la volee les .ts / .tsx du depot (babel, avec cache disque) ;
//   2. detourner la RESOLUTION de certains modules vers des stubs.
//
// AUCUN fichier du depot n'est modifie. On n'ecrit rien dans `screens/`,
// `components/`, `state/`, `services/`. Le detournement se fait cote Node, au
// moment ou un `require` est resolu.
//
// Herite du harnais d'audit (scratchpad, juillet 2026), avec trois differences :
//   - les racines viennent de `paths.js` (plus de chemin machine en dur) ;
//   - le cache de transpilation vit dans le dossier temporaire du systeme ;
//   - stubs supplementaires (@react-navigation/elements, reanimated, gesture
//     handler) parce que l'ecran vNext est ecrit par un autre agent et peut
//     importer des paquets que le Home actuel n'utilise pas.
// =============================================================================
"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Module = require("module");
const babel = require("@babel/core");

const { APP_ROOT, HARNESS_ROOT, STUBS, CACHE_DIR, ensureDirs } = require("./paths");

ensureDirs();

// ---------------------------------------------------------------------------
// 1. Alias par NOM DE PAQUET (correspondance exacte)
// ---------------------------------------------------------------------------
const PKG_EXACT = {
  // Le coeur du harnais : tout `react-native` devient `react-native-web`.
  "react-native": require.resolve("react-native-web"),

  // Natifs remplaces par des stubs (voir prototype/home-vnext/lib/stubs/).
  "@expo/vector-icons": path.join(STUBS, "vector-icons.js"),
  "react-native-safe-area-context": path.join(STUBS, "safe-area-context.js"),
  "@react-navigation/native": path.join(STUBS, "navigation-native.js"),
  "@react-navigation/elements": path.join(STUBS, "navigation-elements.js"),
  "@react-navigation/bottom-tabs": path.join(STUBS, "noop.js"),
  "@react-navigation/native-stack": path.join(STUBS, "noop.js"),
  "@react-native-async-storage/async-storage": path.join(STUBS, "async-storage.js"),
  "expo-haptics": path.join(STUBS, "expo-haptics.js"),
  "expo-blur": path.join(STUBS, "expo-blur.js"),
  "expo-linear-gradient": path.join(STUBS, "expo-linear-gradient.js"),
  "expo-image": path.join(STUBS, "expo-image.js"),
  "expo-notifications": path.join(STUBS, "noop.js"),
  "@react-native-community/netinfo": path.join(STUBS, "netinfo.js"),
  "react-native-svg": path.join(STUBS, "svg.js"),
  "react-native-gesture-handler": path.join(STUBS, "gesture-handler.js"),
  "react-native-reanimated": path.join(STUBS, "reanimated.js"),
  "expo-constants": path.join(STUBS, "noop.js"),
  "expo-device": path.join(STUBS, "noop.js"),
  "expo-file-system": path.join(STUBS, "noop.js"),
  "expo-secure-store": path.join(STUBS, "noop.js"),
  "expo-av": path.join(STUBS, "noop.js"),
  "expo-audio": path.join(STUBS, "noop.js"),
  "@sentry/react-native": path.join(STUBS, "noop.js"),
  "sentry-expo": path.join(STUBS, "noop.js"),
  "@amplitude/analytics-react-native": path.join(STUBS, "noop.js"),
};

// Alias par PREFIXE (sous-chemins d'un paquet).
const PKG_PREFIX = [
  ["@expo/vector-icons", path.join(STUBS, "vector-icons.js")],
  ["react-native-reanimated/", path.join(STUBS, "reanimated.js")],
  ["react-native-gesture-handler/", path.join(STUBS, "gesture-handler.js")],
  ["react-native/", path.join(STUBS, "noop.js")],
  ["firebase/", path.join(STUBS, "firebase-sdk.js")],
  ["@firebase/", path.join(STUBS, "firebase-sdk.js")],
  ["@react-native-firebase/", path.join(STUBS, "firebase-sdk.js")],
];

// ---------------------------------------------------------------------------
// 2. Alias par CHEMIN ABSOLU (fichier du depot -> stub)
// ---------------------------------------------------------------------------
// On resout d'abord normalement, puis on compare le chemin absolu : ca capte
// aussi bien `../state/stores/useLoadStore` que `../../state/stores/...`.
// ---------------------------------------------------------------------------
const inApp = (p) => path.normalize(path.join(APP_ROOT, p)).toLowerCase();

const FILE_ALIAS = {
  // Acces reseau / production : coupes net.
  [inApp("services/firebase.ts")]: path.join(STUBS, "firebase.js"),
  [inApp("services/analytics.ts")]: path.join(STUBS, "analytics.js"),
  [inApp("services/monitoring.ts")]: path.join(STUBS, "noop.js"),
  [inApp("services/notifications.ts")]: path.join(STUBS, "noop.js"),
  [inApp("services/aiContext.ts")]: path.join(STUBS, "noop.js"),

  // Stores : remplaces par un etat fictif pilote par le scenario.
  [inApp("state/stores/useLoadStore.ts")]: path.join(STUBS, "store-load.js"),
  [inApp("state/stores/useSessionsStore.ts")]: path.join(STUBS, "store-sessions.js"),
  [inApp("state/stores/useExternalStore.ts")]: path.join(STUBS, "store-external.js"),
  [inApp("state/stores/useSyncStore.ts")]: path.join(STUBS, "store-sync.js"),
  [inApp("state/stores/useDebugStore.ts")]: path.join(STUBS, "store-debug.js"),
  [inApp("state/stores/useFeedbackStore.ts")]: path.join(STUBS, "store-feedback.js"),
  [inApp("state/settingsStore.ts")]: path.join(STUBS, "store-settings.js"),
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string") {
    if (PKG_EXACT[request]) return PKG_EXACT[request];
    for (const [prefix, target] of PKG_PREFIX) {
      if (request === prefix || request.startsWith(prefix)) return target;
    }
  }
  const resolved = origResolve.call(this, request, parent, isMain, options);
  const key = path.normalize(resolved).toLowerCase();
  if (FILE_ALIAS[key]) return FILE_ALIAS[key];
  return resolved;
};

// ---------------------------------------------------------------------------
// 3. Transpilation TS / TSX / JSX
// ---------------------------------------------------------------------------
// On n'utilise PAS babel-preset-expo : il tire toute la chaine Metro et des
// transformations inutiles ici. `@babel/preset-typescript` + `@babel/preset-react`
// suffisent, et sont deja presents dans node_modules (deps transitives).
// ---------------------------------------------------------------------------
const CACHE_VERSION = "vnext-1";
const memCache = new Map();

function shouldTransform(filename) {
  if (filename.includes(`${path.sep}node_modules${path.sep}`)) return false;
  const lower = filename.toLowerCase();
  return (
    lower.startsWith(APP_ROOT.toLowerCase()) || lower.startsWith(HARNESS_ROOT.toLowerCase())
  );
}

function compile(code, filename) {
  const isTSX = filename.endsWith(".tsx") || filename.endsWith(".jsx");
  const res = babel.transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: "inline",
    compact: false,
    presets: [
      [
        require.resolve("@babel/preset-typescript"),
        { isTSX, allExtensions: true, allowDeclareFields: true },
      ],
      [require.resolve("@babel/preset-react"), { runtime: "automatic" }],
    ],
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  return res.code;
}

function loadTransformed(module_, filename) {
  const src = fs.readFileSync(filename, "utf8");
  if (!shouldTransform(filename)) return module_._compile(src, filename);

  const stat = fs.statSync(filename);
  const hash = crypto
    .createHash("md5")
    .update(`${filename}|${stat.mtimeMs}|${stat.size}|${CACHE_VERSION}`)
    .digest("hex");

  let out = memCache.get(hash);
  if (out == null) {
    const cacheFile = path.join(CACHE_DIR, `${hash}.js`);
    if (fs.existsSync(cacheFile)) {
      out = fs.readFileSync(cacheFile, "utf8");
    } else {
      out = compile(src, filename);
      fs.writeFileSync(cacheFile, out);
    }
    memCache.set(hash, out);
  }
  return module_._compile(out, filename);
}

for (const ext of [".ts", ".tsx", ".jsx", ".js"]) {
  const prev = require.extensions[ext];
  require.extensions[ext] = function (module_, filename) {
    if (shouldTransform(filename)) return loadTransformed(module_, filename);
    if (prev) return prev(module_, filename);
    return loadTransformed(module_, filename);
  };
}

// ---------------------------------------------------------------------------
// 4. Globals attendus par le code React Native
// ---------------------------------------------------------------------------
global.__DEV__ = false;
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

module.exports = { APP_ROOT, HARNESS_ROOT, STUBS };
