// functions/src/config.ts
// Constantes de déploiement + chemins Firestore. Une seule source de vérité pour
// la région : la changer ici suffit si la région de la base impose autre chose.

/**
 * Région des Cloud Functions v2.
 *
 * Alignée sur l'emplacement RÉEL de la base Firestore, confirmé en lecture seule
 * par Codex : `fks-apps/(default)` = **europe-west4**. Un trigger Firestore v2
 * doit être co-localisé avec la base ; cette constante est l'unique source de
 * vérité (verrouillée par un test).
 */
export const REGION = "europe-west4";

/** Instances minimales : 0 = scale-to-zero (aucun coût au repos). */
export const MIN_INSTANCES = 0;

/**
 * Nombre max de séances récentes relues par sous-collection.
 *
 * Passé de 8 à 20 avec la projection v2. POURQUOI : `activity.doneDateKeys` doit
 * couvrir ~14 jours de séances FAITES pour que le coach puisse lire sa semaine et
 * la précédente. Avec 8 documents, un joueur qui s'entraîne 5 fois par semaine ne
 * remontait qu'à ~10 jours, et la fenêtre était tronquée sans que rien ne le dise
 * — pire qu'une absence de donnée : une absence qui ressemble à un fait.
 * 20 documents = marge confortable pour 14 dates distinctes, coût de lecture
 * négligeable (2 requêtes bornées par reconstruction).
 *
 * La sélection planned/completed reste identique côté front (elle ne dépend que
 * du document le plus récent). Une séance SANS champ `date` n'est pas renvoyée
 * par la requête `orderBy("date")` — limite connue et assumée (tous les chemins
 * d'écriture actuels posent `date`).
 */
export const SESSION_FETCH_LIMIT = 20;

/** Chemins Firestore (centralisés pour éviter les fautes de frappe). */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  userSessions: (uid: string) => `users/${uid}/sessions`,
  userPlannedSessions: (uid: string) => `users/${uid}/plannedSessions`,
  member: (clubId: string, uid: string) => `clubs/${clubId}/members/${uid}`,
  members: (clubId: string) => `clubs/${clubId}/members`,
  playerSummary: (clubId: string, uid: string) => `clubs/${clubId}/playerSummaries/${uid}`,
  clubs: () => `clubs`,
} as const;
