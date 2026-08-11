// engine/__tests__/nonSoloIds.fixture.ts
//
// Fixture de TESTS uniquement — n'est importée par aucun code d'app.
//
// FILET « JOUEUR SEUL » : l'app est 100 % joueur solo, mais la vérité
// partenaire/solo vit dans le catalogue V2 BACKEND
// (fks/src/catalog/data/*.json + aliases.json, champ
// participation.{soloEligible,minPlayers}) — le front n'embarque pas cette
// donnée. Ce fichier fige donc un SNAPSHOT, relu le 11/08/2026 sur la branche
// backend readiness3 (14 fiches soloEligible=false sur 376).
//
// Règle de mise à jour : si un test qui lit cette fixture casse, la surface
// d'exposition front des exercices à 2+ a BOUGÉ. Relire la fiche V2 AVANT de
// toucher au snapshot — jamais l'inverse.

/**
 * Fiches PARTENAIRE (minPlayers=2) connues du front : présentes dans
 * BACKEND_EXERCISE_IDS (liste allowed_exercises envoyée au backend) et dans
 * la banque bibliothèque (rédigées, sauf rsa_reaction_sprint_10m : stub).
 */
export const NON_SOLO_PARTENAIRE_IDS_FRONT = [
  "rsa_reaction_sprint_10m", // V2 protocols-tests : minPlayers=2 (« RSA sprints 10 m sur signal externe »)
  "str_eccentric_nordic_3s", // V2 force : minPlayers=2 (« Nordic excentrique 3 s (partenaire) »)
  "str_nordic", // alias V2 → nordic_curl_partner (minPlayers=2)
  "str_nordic_hamstring_eccentric", // alias V2 → nordic_curl_partner (minPlayers=2)
  "str_razor_curl", // V2 force : minPlayers=2
] as const;

/**
 * Jeux réduits COLLECTIFS (V2 : minPlayers 4 → 12, requiresCoach=true,
 * equipment avec football) connus du front : les 7 sont dans
 * BACKEND_EXERCISE_IDS, donc stub-és en bibliothèque par
 * buildExerciseFromBackendId (engine/exerciseBank.ts:921) — sans fiche
 * rédigée, mal catégorisés (« Renforcement », « Sans matériel »).
 */
export const NON_SOLO_GROUPE_IDS_FRONT = [
  "rsa_ssg_2v2", // V2 : minPlayers=4
  "rsa_ssg_3v2", // V2 : minPlayers=5
  "rsa_ssg_3v3", // V2 : minPlayers=6
  "rsa_ssg_4v3", // V2 : minPlayers=7
  "rsa_ssg_4v4", // V2 : minPlayers=8
  "rsa_ssg_5v5", // V2 : minPlayers=10
  "rsa_ssg_6v6", // V2 : minPlayers=12
] as const;

/** Les 12 ids non-solo avec existence front (banque et/ou liste backend). */
export const NON_SOLO_IDS_FRONT = [
  ...NON_SOLO_PARTENAIRE_IDS_FRONT,
  ...NON_SOLO_GROUPE_IDS_FRONT,
] as const;

/**
 * Ids V2 non-solo SANS existence front aujourd'hui (fiches backend-only).
 * Sentinelle : si l'un d'eux apparaît dans la banque, les instructions ou la
 * liste backend, une fiche à 2+ vient d'entrer côté front sans passer par ce
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
