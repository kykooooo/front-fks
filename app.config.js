const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson.expo ?? {};
  const extra = { ...(base.extra ?? {}) };

  const backendUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    extra.BACKEND_URL ||
    "";
  const backendApiKey =
    process.env.EXPO_PUBLIC_BACKEND_API_KEY ||
    process.env.BACKEND_API_KEY ||
    extra.BACKEND_API_KEY ||
    "";

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
      ...extra,
      BACKEND_URL: backendUrl,
      BACKEND_API_KEY: backendApiKey,
    },
    // Preserve runtimeVersion and updates from app.json
    runtimeVersion: base.runtimeVersion,
    updates: base.updates,
  };
};
