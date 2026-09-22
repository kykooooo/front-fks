// utils/valeurConfig.ts
//
// LA lecture d'une valeur de configuration publique (EXPO_PUBLIC_*) : une seule
// implémentation, partagée par config/backend.ts et services/analytics.ts.
//
// POURQUOI PAS `??` : depuis eas-cli 18, `eas update` évalue app.config.js sans
// charger .env.local (EXPO_NO_DOTENV=1), donc le manifeste OTA porte des
// chaînes VIDES (`extra.BACKEND_URL = ""`), que `??` ne saute pas. Le bundle,
// lui, embarque les vraies valeurs (`process.env.EXPO_PUBLIC_*` est remplacé à
// l'export). Panne du 22/09/2026 : adresse du backend vide en production.
//
// RÈGLE : le bundle d'abord, le manifeste ensuite ; une chaîne vide compte
// comme absente ; sans source, "" — jamais une valeur inventée.
//
// ⚠️ À L'APPEL, écrire `process.env.EXPO_PUBLIC_XXX` en toutes lettres : c'est
// cette expression exacte que l'export remplace par sa valeur.

export function premiereValeurNonVide(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}
