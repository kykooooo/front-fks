import Constants from "expo-constants";

const extra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};
const envUrl =
  extra.BACKEND_URL ??
  extra.EXPO_PUBLIC_BACKEND_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL;
const envApiKey =
  extra.BACKEND_API_KEY ??
  extra.EXPO_PUBLIC_BACKEND_API_KEY ??
  process.env.EXPO_PUBLIC_BACKEND_API_KEY;

// En dev, Expo expose l'IP du Mac via hostUri (ex: "192.168.1.42:8081").
// On extrait l'IP pour pointer vers le backend local sur le port 3000.
const devHostIp = Constants.expoConfig?.hostUri?.split(":")[0];
const fallbackDev = devHostIp
  ? `http://${devHostIp}:3000`
  : "http://localhost:4000";
// envUrl wins if set (even in dev) — fallback to local IP only when no env var
const resolvedEnvUrl =
  typeof envUrl === "string" && envUrl.trim() ? envUrl.trim() : "";
const resolvedEnvApiKey =
  typeof envApiKey === "string" && envApiKey.trim() ? envApiKey.trim() : "";
export const BACKEND_URL = resolvedEnvUrl || (__DEV__ ? fallbackDev : "");
export const BACKEND_API_KEY = resolvedEnvApiKey;

if (__DEV__) {
  console.log("[FKS] hostUri:", Constants.expoConfig?.hostUri);
  console.log("[FKS] envUrl:", envUrl, "| extra.BACKEND_URL:", extra.BACKEND_URL, "| process.env:", process.env.EXPO_PUBLIC_BACKEND_URL);
  console.log("[FKS] BACKEND_URL:", BACKEND_URL);
}
if (__DEV__ && !BACKEND_URL) {
  console.warn("[FKS] BACKEND_URL is not configured.");
}

// Transition TestFlight : le backend accepte encore `x-fks-api-key` si Firebase
// Admin n'est pas configure cote Render. A retirer quand Firebase Admin est
// garanti en production et FKS_ENFORCE_FIREBASE_AUTH=true.
