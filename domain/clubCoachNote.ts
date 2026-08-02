// domain/clubCoachNote.ts
//
// NOTE PRIVÉE DU COACH — le contrat du concept, et rien d'autre.
//
// CE QUE C'EST. Un pense-bête d'encadrement. Le coach y écrit ce qu'il veut,
// pour lui et son staff. Ce n'est PAS une consigne d'entraînement : elle ne
// modifie aucune séance, elle n'est jamais envoyée au backend de génération,
// elle n'apparaît dans aucun document lisible par un joueur.
//
// POURQUOI CE FICHIER EXISTE. Jusqu'ici, la note vivait dans
// `clubs/{clubId}/weekContexts/{weekKey}.note`, un document que TOUT membre du
// club peut lire (cf. firestore.rules). L'écran joueur ne l'affichait pas — et
// ne rien afficher n'est PAS une protection : la donnée était bien sur le
// téléphone de chaque joueur, et elle repartait dans le contexte envoyé au
// backend de génération. Le coach, lui, voyait un champ présenté comme une note
// de travail. La séparation est donc de STOCKAGE, pas d'affichage : la note vit
// désormais dans `clubs/{clubId}/coachNotes/{weekKey}`, une collection dont les
// règles Firestore refusent la lecture à tout joueur (get ET list).
//
// CE QUI NE SE FAIT JAMAIS. Convertir une note privée en directive, même par
// suggestion, même « intelligemment ». Une note historique reste une note
// privée : c'est le coach qui décide, jamais le code.

/**
 * Longueur maximale d'une note privée. Reprise à l'identique de l'ancien champ
 * (200) : le geste du coach ne change pas, seul l'endroit où la note atterrit
 * change. Un plafond différent aurait tronqué des notes existantes au premier
 * enregistrement.
 */
export const COACH_PRIVATE_NOTE_MAX = 200;

/** Nom de la collection coach-only. Recopié tel quel dans firestore.rules. */
export const COACH_NOTES_COLLECTION = "coachNotes";

/**
 * Libellé affiché dans l'écran coach, au mot près.
 *
 * Il dit DEUX choses, et les deux comptent : qui peut lire (l'encadrement
 * autorisé, pas les joueurs), et ce que la note ne fait pas (elle ne touche pas
 * aux séances). Sans la seconde phrase, un coach pourrait croire qu'écrire
 * « jambes lourdes » allège la semaine — ce serait faux.
 */
export const COACH_PRIVATE_NOTE_LABEL =
  "Note privée — visible uniquement par l'encadrement autorisé. Cette note ne modifie pas les séances.";

/** Note privée telle qu'on la manipule côté app. */
export type ClubCoachNote = {
  weekKey: string;
  note: string;
};

/**
 * Borne une note saisie : trim + troncature. Renvoie "" pour tout ce qui n'est
 * pas une chaîne exploitable (jamais `null`/`undefined` en sortie, pour que
 * l'appelant n'ait pas à distinguer « vide » de « absent » à l'affichage).
 */
export function clampCoachPrivateNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, COACH_PRIVATE_NOTE_MAX);
}

/**
 * Lit un document `coachNotes/{weekKey}` brut. Renvoie `null` si rien
 * d'exploitable — on n'invente jamais de note.
 */
export function parseCoachPrivateNote(
  raw: Record<string, unknown> | null | undefined,
  weekKey: string,
): ClubCoachNote | null {
  if (!raw || typeof raw !== "object") return null;
  const note = clampCoachPrivateNote((raw as { note?: unknown }).note);
  if (!note) return null;
  return { weekKey, note };
}
