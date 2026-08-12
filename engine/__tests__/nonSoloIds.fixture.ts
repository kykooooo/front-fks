// engine/__tests__/nonSoloIds.fixture.ts
//
// Fixture de TESTS — la liste des ids non-solo vit désormais dans le code
// d'app (engine/nonSoloExercises.ts, consommée par la garde solo, la
// bibliothèque et le payload) : ce fichier la ré-exporte pour les tests et
// n'ajoute QUE ce qui reste test-only (sentinelle backend-only + marqueur).
// Règle inchangée : si un test qui lit ces listes casse, la surface
// d'exposition front a bougé — relire la fiche V2 AVANT de toucher aux ids.

import {
  NON_SOLO_GROUPE_IDS,
  NON_SOLO_PARTENAIRE_IDS,
} from "../nonSoloExercises";

export const NON_SOLO_PARTENAIRE_IDS_FRONT = NON_SOLO_PARTENAIRE_IDS;
export const NON_SOLO_GROUPE_IDS_FRONT = NON_SOLO_GROUPE_IDS;

/** Les 12 ids non-solo avec existence front (banque et/ou liste backend). */
export const NON_SOLO_IDS_FRONT = [
  ...NON_SOLO_PARTENAIRE_IDS,
  ...NON_SOLO_GROUPE_IDS,
] as const;

/**
 * Ids V2 non-solo SANS existence front (fiches backend-only). Sentinelle :
 * si l'un d'eux apparaît dans la banque, les instructions ou la liste
 * backend, une fiche à 2+ vient d'entrer côté front sans passer par le
 * filet — le test d'inventaire doit casser.
 */
export const NON_SOLO_IDS_BACKEND_ONLY = [
  "nordic_curl_partner",
  "fks_scan_and_go",
  "fks_shuffle_close",
  "fks_controlled_contact_reaccel",
] as const;

/** Marqueur « à deux » attendu sur toute fiche partenaire visible à l'écran. */
export const MARQUEUR_A_DEUX = /partenaire|à deux|a deux|à 2\b|a 2\b/i;
