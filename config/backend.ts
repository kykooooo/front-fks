import Constants from "expo-constants";

const extra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};
const envUrl =
  extra.BACKEND_URL ??
  extra.EXPO_PUBLIC_BACKEND_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL;

// En dev, Expo expose l'IP du Mac via hostUri (ex: "192.168.1.42:8081").
// On extrait l'IP pour pointer vers le backend local sur le port 3000.
const devHostIp = Constants.expoConfig?.hostUri?.split(":")[0];
const fallbackDev = devHostIp
  ? `http://${devHostIp}:3000`
  : "http://localhost:4000";
// envUrl wins if set (even in dev) — fallback to local IP only when no env var
const resolvedEnvUrl =
  typeof envUrl === "string" && envUrl.trim() ? envUrl.trim() : "";
export const BACKEND_URL = resolvedEnvUrl || (__DEV__ ? fallbackDev : "");

if (__DEV__) {
  console.log("[FKS] hostUri:", Constants.expoConfig?.hostUri);
  console.log("[FKS] envUrl:", envUrl, "| extra.BACKEND_URL:", extra.BACKEND_URL, "| process.env:", process.env.EXPO_PUBLIC_BACKEND_URL);
  console.log("[FKS] BACKEND_URL:", BACKEND_URL);
}
if (__DEV__ && !BACKEND_URL) {
  console.warn("[FKS] BACKEND_URL is not configured.");
}

// ⚠️ L'export `backendAuthHeaders()` et la constante `BACKEND_API_KEY` ont été
// retirés pour raisons de sécurité : la clé était embarquée dans le bundle JS
// (EXPO_PUBLIC_*) et donc extractible par n'importe qui qui télécharge l'app.
// Un attaquant pouvait l'utiliser pour bypass Firebase et brûler la quota OpenAI.
//
// L'auth backend se fait désormais uniquement via Firebase ID token :
//   const idToken = await auth.currentUser?.getIdToken();
//   headers: { Authorization: `Bearer ${idToken}` }
//
// Voir src/http/auth.ts côté backend (requireUserAuth).
