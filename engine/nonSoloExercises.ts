// engine/nonSoloExercises.ts
//
// Ids d'exercices que l'app (100 % joueur seul) ne doit jamais servir nus :
// leur fiche canonique du catalogue V2 backend déclare
// participation.soloEligible=false / minPlayers>=2 (snapshot du 11/08/2026 —
// le front n'embarque pas le catalogue, toute mise à jour se fait fiche V2
// en main, jamais l'inverse ; le filet de tests engine/__tests__/
// nonSoloVerrou.test.ts casse si cette liste diverge des surfaces réelles).
//
// Zéro import ici : exerciseBank.ts et videoLibraryConfig.ts doivent pouvoir
// consommer ces constantes sans cycle (même découpage que catalogSafety.ts
// côté backend).

/**
 * Fiches PARTENAIRE (minPlayers=2). Rédigées dans BASE_EXERCISE_BANK, sauf
 * rsa_reaction_sprint_10m (id backend sans fiche rédigée).
 */
export const NON_SOLO_PARTENAIRE_IDS = [
  "rsa_reaction_sprint_10m", // V2 protocols-tests : « RSA sprints 10 m sur signal externe »
  "str_eccentric_nordic_3s", // V2 force : « Nordic excentrique 3 s (partenaire) »
  "str_nordic", // alias V2 → nordic_curl_partner
  "str_nordic_hamstring_eccentric", // alias V2 → nordic_curl_partner
  "str_razor_curl", // V2 force
] as const;

/**
 * Jeux réduits COLLECTIFS (V2 : minPlayers 4 → 12, requiresCoach=true,
 * équipement avec ballon). Décision Kyllian 11/08/2026 : MASQUÉS, double
 * motif indépendant — ballon par nature (doctrine zéro ballon) ET non
 * faisables seul. Ici = masquage MINIMAL d'affichage (assemblage
 * d'EXERCISE_BANK) ; la purge structurelle des fiches à la source
 * appartient au chantier fix/bibliotheque-precision — ne pas étendre ce
 * masquage, le merge ne doit pas faire le travail deux fois.
 */
export const NON_SOLO_GROUPE_IDS = [
  "rsa_ssg_2v2", // V2 : minPlayers=4
  "rsa_ssg_3v2", // V2 : minPlayers=5
  "rsa_ssg_3v3", // V2 : minPlayers=6
  "rsa_ssg_4v3", // V2 : minPlayers=7
  "rsa_ssg_4v4", // V2 : minPlayers=8
  "rsa_ssg_5v5", // V2 : minPlayers=10
  "rsa_ssg_6v6", // V2 : minPlayers=12
] as const;

export const NON_SOLO_EXERCISE_IDS: ReadonlySet<string> = new Set<string>([
  ...NON_SOLO_PARTENAIRE_IDS,
  ...NON_SOLO_GROUPE_IDS,
]);

export function estExerciceNonSolo(id: string | null | undefined): boolean {
  return !!id && NON_SOLO_EXERCISE_IDS.has(String(id));
}
