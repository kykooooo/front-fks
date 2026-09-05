// services/coachIntent.ts
//
// L'INTENTION COACH, ET CE QU'ELLE N'EST PAS.
//
// Déclarée par un geste explicite (« Tu es coach ? » sur l'accueil, la
// connexion ou l'inscription), elle sert à UNE chose : choisir l'écran
// d'ARRIVÉE quand le profil n'est pas encore rempli — création de club plutôt
// que questionnaire joueur. Elle n'accorde AUCUN droit et n'ouvre AUCUN espace :
// l'espace coach reste dérivé de l'appartenance `clubs/{clubId}/members/{uid}`,
// que les règles Firestore interdisent à tout client d'écrire
// (cf. domain/appSpace.ts). La falsifier ne peut ouvrir aucun écran coach —
// seulement afficher un formulaire de création de club que le serveur refusera
// si la personne n'y a pas droit.
//
// POURQUOI SUR LE DISQUE ET PLUS EN MÉMOIRE (audit inscription 2026-09) :
//   . en `useState`, elle mourait avec l'app. Le coach qui tuait l'app entre
//     l'inscription et la création du club retombait sur les 4 étapes du
//     questionnaire joueur ;
//   . et il ne pouvait pas la reposer : l'écran d'accueil, seul endroit qui la
//     proposait, est INATTEIGNABLE dès le deuxième lancement (`WELCOME_DONE`).
//
// Elle est effacée quand elle a servi (le compte a un club), quand la personne
// renonce (« Je suis joueur finalement »), à la déconnexion, et avec le compte
// (services/accountDeletionHelpers.localAccountKeysToPurge).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storage";

const VALEUR_POSEE = "true";

/** Pose l'intention. Idempotent. Ne lève jamais : un stockage en panne ne doit
 *  pas casser une inscription — au pire, l'intention ne survit pas à l'app. */
export async function poserIntentionCoach(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.COACH_INTENT, VALEUR_POSEE);
  } catch {
    // Silencieux VOLONTAIREMENT : l'appelant a déjà l'état en mémoire pour la
    // traversée en cours ; seule la survie à un redémarrage est perdue.
  }
}

/** Lit l'intention. Toute panne de lecture vaut « pas d'intention » : on ne
 *  pose jamais quelqu'un sur la création de club par accident. */
export async function lireIntentionCoach(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.COACH_INTENT)) === VALEUR_POSEE;
  } catch {
    return false;
  }
}

/** Efface l'intention. Ne lève jamais. */
export async function effacerIntentionCoach(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.COACH_INTENT);
  } catch {
    // Idem : rien à faire d'utile ici, et surtout rien qui doive interrompre
    // une déconnexion ou une suppression de compte.
  }
}
