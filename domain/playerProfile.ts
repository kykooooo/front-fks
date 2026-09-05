// domain/playerProfile.ts
//
// « CE PROFIL PEUT-IL FAIRE TOURNER LE MOTEUR ? » — une seule implémentation.
//
// POURQUOI CE FICHIER EXISTE. `users/{uid}.profileCompleted` veut dire DEUX
// choses depuis la création de l'espace coach : « le questionnaire joueur est
// rempli » ET « ce coach est installé ». `createClubAsCoach` le pose à `true`
// sans écrire le moindre champ joueur (repositories/clubsRepo). Conséquence
// mesurée par l'audit d'inscription du 05/09 (P1-04) : un coach qui active
// « Je m'entraîne aussi » bascule dans l'app joueur avec `position`,
// `ageCategory` et `level` ABSENTS, sans jamais voir le questionnaire — et le
// moteur dose alors sans aucun plafond d'âge (`getAgeCategoryCaps(null)` rend
// `null` côté backend : ni familles interdites, ni volume, ni contacts plyo, ni
// sprint, ni durée).
//
// CE QU'ON EXIGE, ET RIEN DE PLUS. Les trois champs qui changent le DOSAGE :
//   . `ageCategory` — les plafonds d'âge ;
//   . `position`    — l'orientation des blocs ;
//   . `level`       — l'intensité de départ.
// Prénom et pied fort sont demandés par le questionnaire (`validateStep`) mais
// ne changent aucun calcul : les exiger ici ramènerait au setup des comptes
// parfaitement fonctionnels, pour un champ d'affichage.
//
// TOLÉRANT SUR LA VALEUR, STRICT SUR LA PRÉSENCE : une catégorie héritée que le
// sélecteur ne propose plus (U13) reste une catégorie — le questionnaire, lui,
// la refusera au premier passage. Ici on ne juge pas la valeur, on constate
// qu'elle existe. Juger deux fois, à deux endroits, c'est se contredire un jour.

/** Les champs de `users/{uid}` dont dépend le dosage d'une séance. */
export const CHAMPS_PROFIL_JOUEUR = ["ageCategory", "position", "level"] as const;

const renseigne = (valeur: unknown): boolean =>
  typeof valeur === "string" && valeur.trim().length > 0;

/**
 * `true` quand les trois champs de dosage sont présents.
 *
 * Un document absent / illisible rend `false` : c'est l'appelant qui décide
 * s'il SAIT (instantané serveur) ou s'il attend (cache hors ligne). Ne jamais
 * appeler cette fonction sur un instantané dont on ignore s'il est vide parce
 * que le profil est vide, ou parce qu'il n'a pas encore été lu.
 */
export function isPlayerProfileComplete(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  const profil = data as Record<string, unknown>;
  return CHAMPS_PROFIL_JOUEUR.every((champ) => renseigne(profil[champ]));
}
