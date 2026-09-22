import Constants from "expo-constants";

const extra: Record<string, unknown> = Constants.expoConfig?.extra ?? {};

/**
 * Première valeur NON VIDE parmi les candidates, nettoyée ; sinon "".
 *
 * POURQUOI PAS `??` (panne du 22/09/2026) : depuis eas-cli 18, `eas update`
 * évalue app.config.js SANS charger .env.local (EXPO_NO_DOTENV=1), donc le
 * manifeste OTA porte `extra.BACKEND_URL = ""` — une chaîne VIDE, que `??` ne
 * saute pas. Le bundle, lui, embarque la vraie adresse : `expo export` remplace
 * `process.env.EXPO_PUBLIC_*` par sa valeur au moment de l'export. L'ancienne
 * chaîne `extra ?? … ?? process.env` s'arrêtait donc sur "" : adresse vide en
 * production, `fetch("/api/fks/generate")` en « Network request failed »
 * instantané, et « tu n'es pas connecté à internet » à chaque génération.
 *
 * ORDRE : le bundle d'abord (même règle que config/firebaseConfig.ts, qui n'a
 * jamais cassé), le manifeste ensuite. Verrou : config/__tests__/backendUrlResolution.
 */
function premiereValeurNonVide(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

const resolvedEnvUrl = premiereValeurNonVide(
  process.env.EXPO_PUBLIC_BACKEND_URL,
  extra.BACKEND_URL,
  extra.EXPO_PUBLIC_BACKEND_URL
);
const resolvedEnvKey = premiereValeurNonVide(
  process.env.EXPO_PUBLIC_BACKEND_API_KEY,
  extra.BACKEND_API_KEY,
  extra.EXPO_PUBLIC_BACKEND_API_KEY
);

// En dev, Expo expose l'IP du Mac via hostUri (ex: "192.168.1.42:8081").
// On extrait l'IP pour pointer vers le backend local sur le port 3000.
const devHostIp = Constants.expoConfig?.hostUri?.split(":")[0];
const fallbackDev = devHostIp
  ? `http://${devHostIp}:3000`
  : "http://localhost:4000";
// L'adresse résolue gagne si elle existe (même en dev) — repli sur l'IP locale
// seulement quand aucune source n'en fournit.
export const BACKEND_URL = resolvedEnvUrl || (__DEV__ ? fallbackDev : "");
export const BACKEND_API_KEY = resolvedEnvKey;

if (__DEV__) {
  console.log("[FKS] hostUri:", Constants.expoConfig?.hostUri);
  console.log("[FKS] process.env:", process.env.EXPO_PUBLIC_BACKEND_URL, "| extra.BACKEND_URL:", extra.BACKEND_URL);
  console.log("[FKS] BACKEND_URL:", BACKEND_URL);
}
if (__DEV__ && !BACKEND_URL) {
  console.warn("[FKS] BACKEND_URL is not configured.");
}
if (__DEV__ && !BACKEND_API_KEY) {
  console.warn("[FKS] BACKEND_API_KEY is not configured.");
}

export const backendAuthHeaders = (): Record<string, string> =>
  BACKEND_API_KEY ? { "x-fks-api-key": BACKEND_API_KEY } : {};
