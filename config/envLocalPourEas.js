// config/envLocalPourEas.js
//
// Charge les variables EXPO_PUBLIC_* de .env.local dans process.env QUAND l'outil
// qui évalue app.config.js a demandé à Expo de ne PAS le faire.
//
// POURQUOI. Depuis eas-cli 18, `eas update` évalue `expo config --json` avec
// EXPO_NO_DOTENV=1 : app.config.js ne voit plus .env.local et écrit des
// chaînes vides dans `extra` (BACKEND_URL, BACKEND_API_KEY, FIREBASE_API_KEY,
// SENTRY_DSN, AMPLITUDE_API_KEY) — vérifié sur les manifestes des OTA du 17/09
// et du 19/09/2026 (panne « pas de connexion » du 22/09). Le bundle, lui, est
// exporté avec .env.local : le manifeste mentait pendant que le code disait vrai.
//
// CE QUE ÇA FAIT, ET RIEN D'AUTRE :
//   - seulement si EXPO_NO_DOTENV vaut "1" (sinon Expo charge lui-même) ;
//   - seulement si .env.local existe (jamais en build cloud, où il est absent) ;
//   - seulement les clés EXPO_PUBLIC_* (publiques par contrat ; un secret privé
//     du fichier n'entre jamais dans un manifeste) ;
//   - jamais par-dessus une variable déjà posée et non vide (les variables
//     d'environnement EAS gardent la main).
//
// Fichier en JavaScript : app.config.js est exécuté par Node sans TypeScript.

const fs = require("fs");
const path = require("path");

const PREFIXE_PUBLIC = "EXPO_PUBLIC_";

/**
 * @param {{ dossier: string, env?: NodeJS.ProcessEnv, existe?: (f: string) => boolean, lire?: (f: string) => string }} options
 * @returns {{ charge: boolean, raison?: string, posees: string[] }}
 */
function chargerEnvLocalSiEasLaSaute(options) {
  const env = options.env || process.env;
  const existe = options.existe || fs.existsSync;
  const lire = options.lire || ((f) => fs.readFileSync(f, "utf8"));

  if (env.EXPO_NO_DOTENV !== "1") return { charge: false, raison: "expo-charge-lui-meme", posees: [] };
  const fichier = path.join(options.dossier, ".env.local");
  if (!existe(fichier)) return { charge: false, raison: "fichier-absent", posees: [] };

  // `dotenv` est une dépendance d'Expo (@expo/env) : présente partout où Expo l'est.
  const { parse } = require("dotenv");
  const valeurs = parse(lire(fichier));
  const posees = [];
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (!cle.startsWith(PREFIXE_PUBLIC)) continue;
    const dejaLa = typeof env[cle] === "string" && env[cle].trim() !== "";
    if (dejaLa) continue;
    env[cle] = valeur;
    posees.push(cle);
  }
  return { charge: true, posees };
}

/** Retire les entrées vides ("") : un manifeste dit « absent », jamais « vide ». */
function sansValeursVides(objet) {
  const propre = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur === "" || valeur === undefined || valeur === null) continue;
    propre[cle] = valeur;
  }
  return propre;
}

module.exports = { chargerEnvLocalSiEasLaSaute, sansValeursVides };
