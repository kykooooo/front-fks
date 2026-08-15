// screens/newSession/__tests__/jourOffDevOnly.test.ts
//
// « JOUR OFF (+1j) » EST-IL BIEN RÉSERVÉ AU DEV ?
//
// P1-10 inventaire clubs (15/08) : ce bouton est un outil d'horloge dev —
// chaque tap avance lastLoadDayKey et décaye ATL/CTL SANS retour visuel.
// Corruption transitoire (rebuildLoad écrase au prochain boot/sync) mais le
// graphe TSB du Profil et le contexte envoyé au backend la voient pendant la
// session. Dans le binaire des clubs, il ne doit JAMAIS se rendre.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

test.each([
  ["screens/newSession/ui/GenerationActions.tsx"],
  ["screens/newSession/ui/CurrentSessionCard.tsx"],
])("%s : le bouton Jour OFF est gaté __DEV__", (rel) => {
  const source = lire(rel);
  // lastIndexOf : la première occurrence peut être le commentaire qui explique
  // le gate — c'est le BOUTON (le <Text>, toujours après) qui nous intéresse.
  const idx = source.lastIndexOf("Jour OFF (+1j)");
  expect(idx).toBeGreaterThan(-1);
  // Le gate doit précéder le bouton dans le même bloc de rendu (fenêtre
  // courte : un __DEV__ ailleurs dans le fichier ne compte pas).
  const avant = source.slice(Math.max(0, idx - 600), idx);
  expect(avant).toContain("__DEV__ ?");
});
