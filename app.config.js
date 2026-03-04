// app.config.js — Gestion des secrets via variables d'environnement
//
// Les variables EXPO_PUBLIC_* sont chargées automatiquement depuis .env.local
// par Expo CLI (SDK 49+). Ne jamais commiter .env.local dans git.
//
// Pour les builds EAS (cloud) :
//   eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_API_KEY --value "..."
//   eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "..."
//   eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."

const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson.expo ?? {};
  const extra = { ...(base.extra ?? {}) };

  // Secrets — lus depuis .env.local (dev) ou EAS secrets (cloud builds)
  // Ne pas utiliser de fallback sur app.json pour les secrets
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";
  const backendApiKey = process.env.EXPO_PUBLIC_BACKEND_API_KEY || process.env.BACKEND_API_KEY || "";
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
      // Identifiants publics (non secrets)
      SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? extra.SENTRY_DSN ?? "",
      AMPLITUDE_API_KEY: extra.AMPLITUDE_API_KEY ?? "",
      eas: extra.eas,
      // Secrets via env vars
      BACKEND_URL: backendUrl,
      BACKEND_API_KEY: backendApiKey,
      FIREBASE_API_KEY: firebaseApiKey,
    },
    plugins: [
      ...(base.plugins ?? []),
      "expo-secure-store",
    ],
    // Preserve runtimeVersion and updates from app.json
    runtimeVersion: base.runtimeVersion,
    updates: base.updates,
  };
};
