// app.config.js — Gestion des secrets via variables d'environnement
//
// Les variables EXPO_PUBLIC_* sont chargées automatiquement depuis .env.local
// par Expo CLI (SDK 49+). Ne jamais commiter .env.local dans git.
//
// ⚠️ IMPORTANT — Les variables EXPO_PUBLIC_* sont embarquées dans le bundle JS
// du client et donc EXTRACTIBLES (`strings app.ipa` suffit). Elles ne sont pas
// des secrets. N'y mettre que des identifiants publics ou des URLs.
// La clé backend `FKS_API_KEY` a été retirée : l'auth se fait désormais
// uniquement via Firebase ID token (Authorization: Bearer <idToken>).
//
// Pour les builds EAS (cloud) :
//   eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "..."
//   eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."

const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson.expo ?? {};
  const extra = { ...(base.extra ?? {}) };

  // Identifiants publics (URL backend, clé Firebase web API).
  // Ne jamais ajouter ici de secret backend ou de clé OpenAI.
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";
  const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "";

  return {
    ...base,
    ios: {
      ...(base.ios ?? {}),
      bundleIdentifier:
        process.env.IOS_BUNDLE_ID ||
        base.ios?.bundleIdentifier ||
        "com.fks.app",
      buildNumber: base.ios?.buildNumber ?? "1",
      infoPlist: {
        ...(base.ios?.infoPlist ?? {}),
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    extra: {
      SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? extra.SENTRY_DSN ?? "",
      AMPLITUDE_API_KEY: extra.AMPLITUDE_API_KEY ?? "",
      eas: extra.eas,
      BACKEND_URL: backendUrl,
      FIREBASE_API_KEY: firebaseApiKey,
      // BACKEND_API_KEY volontairement absent : auth backend = Firebase Bearer uniquement.
    },
    plugins: [
      ...(base.plugins ?? []),
      "expo-secure-store",
      "@sentry/react-native/expo",
    ],
    // Preserve runtimeVersion and updates from app.json
    runtimeVersion: base.runtimeVersion,
    updates: base.updates,
  };
};
