// domain/mainObjective.ts
//
// UNE VALEUR PERSISTÉE NE PORTE PAS D'ACCENT — ET ON NE MIGRE PERSONNE.
//
// `users/{uid}.mainObjective` est écrit par le questionnaire et relu partout
// (recommandation de cycle, contexte IA, affichage du profil). La convention du
// projet est explicite : jamais d'accents dans une valeur persistée (allowlists
// sans accents côté Cloud Functions, comparaisons par sous-chaîne). Un objectif
// sur quatre la violait depuis toujours — « Mieux encaisser les entraînements et
// les matchs », avec son î — à trois lignes du commentaire qui l'interdit
// (P2-05 de l'audit d'inscription du 05/09).
//
// LE CORRECTIF NE TOUCHE AUCUN PROFIL EXISTANT. On écrit désormais la forme
// sans accent ; à la LECTURE, l'ancienne forme est reconnue et ramenée sur la
// nouvelle. Aucune migration de masse : elle demanderait d'écrire dans les
// documents de tous les joueurs pour un champ dont plus rien ne dépend
// caractère par caractère (`recommendMicrocycle` cherche « encaisser », qui est
// identique dans les deux formes).

/** Valeur canonique, celle qu'on ÉCRIT depuis le 05/09. */
export const OBJECTIF_ENCAISSER = "Mieux encaisser les entrainements et les matchs";

/** Forme historique, accentuée. Toujours en base pour les profils antérieurs. */
export const OBJECTIF_ENCAISSER_LEGACY = "Mieux encaisser les entraînements et les matchs";

/**
 * Ramène une valeur lue en base sur sa forme canonique.
 *
 * N'invente rien : une valeur inconnue est rendue telle quelle (l'app ne doit
 * pas effacer un objectif qu'elle ne reconnaît pas), `null`/vide reste `null`.
 */
export function normalizeMainObjective(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const brut = value.trim();
  if (!brut) return null;
  return brut === OBJECTIF_ENCAISSER_LEGACY ? OBJECTIF_ENCAISSER : brut;
}
