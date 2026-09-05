// screens/newSession/gardeCategorieAge.ts
//
// SANS CATÉGORIE D'ÂGE, LE MOTEUR NE POSE AUCUN PLAFOND — DONC ON NE GÉNÈRE PAS.
//
// `getAgeCategoryCaps(null)` rend `null` côté backend, et l'orchestrateur
// n'applique alors RIEN : ni familles d'exercices interdites, ni volume, ni
// contacts pliométriques, ni sprint, ni durée. L'audience retombe sur
// « amateur ». Ce n'est pas « un dosage par défaut » : c'est zéro protection,
// pour un joueur qui peut avoir 14 ans (erratum 4 de l'audit d'inscription).
//
// UNE SEULE IMPLÉMENTATION DE LA RÈGLE, parce qu'elle est posée à DEUX endroits
// de l'écran de génération et que les deux doivent dire la même chose :
//   . à l'affichage, sur le contexte chargé à l'ouverture (`aiContext`) ;
//   . juste avant l'appel payant, sur le contexte FRAÎCHEMENT reconstruit.
// La seconde est neuve (R5 de la contre-vérification du 05/09) : la première
// échouait OUVERTE. Elle lit `aiContext`, qui vaut `null` tant que le chargeur
// d'ouverture n'a pas tourné — ce qui arrive dès qu'il n'y a pas de cycle actif
// ou que la lecture a échoué. `categorieAgeManquante` valait alors `false`, et
// la génération partait avec `age_category: null`.

/** Le seul message joueur de cette règle, aux deux endroits où elle s'applique. */
export const TOAST_CATEGORIE_MANQUANTE = {
  type: "warn",
  title: "Il manque ta catégorie",
  message: "Complète ton profil pour des séances adaptées à ta catégorie.",
} as const;

/**
 * « Ce contexte porte-t-il une catégorie d'âge utilisable ? »
 *
 * Répond sur ce qu'on A, jamais sur ce qu'on n'a pas encore lu : un contexte
 * absent (`null`/`undefined`) rend `true` ici parce que l'appelant qui passe un
 * contexte VIENT de le construire — ne pas l'avoir est alors un fait, pas une
 * attente. L'appelant qui, lui, ne sait pas encore (chargement en cours) ne
 * doit pas appeler cette fonction sans le tester d'abord (`!!aiContext && …`).
 *
 * Une chaîne vide ou blanche ne vaut pas une catégorie : le moteur ne saurait
 * qu'en faire, et l'envoyer serait annoncer une protection qui n'existe pas.
 */
export function categorieAgeAbsente(contexte: unknown): boolean {
  const profil = (contexte as { profile?: { age_category?: unknown } } | null | undefined)?.profile;
  const valeur = profil?.age_category;
  return typeof valeur !== "string" || valeur.trim().length === 0;
}
