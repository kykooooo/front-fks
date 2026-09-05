// services/reservationClub.ts
//
// UN RÉESSAI NE DOIT PAS CRÉER UN DEUXIÈME CLUB.
//
// La création enchaîne trois écritures Firestore :
//   1. clubs/{clubId}
//   2. clubs/{clubId}/members/{uid}   (accessRole: "owner")
//   3. users/{uid}.clubId
// Les règles EXIGENT cet ordre (l'appartenance propriétaire doit exister avant
// que `users/{uid}.clubId` soit accepté — firestore.rules:429-434), et
// interdisent donc de les grouper : dans un `writeBatch`, chaque opération est
// évaluée contre l'état ANTÉRIEUR au batch, l'appartenance créée dans le même
// batch reste invisible, la 3ᵉ écriture est refusée, et le batch étant
// tout-ou-rien plus personne ne peut créer de club (erratum 2 de l'audit).
//
// Sans atomicité possible côté client, la seule réponse honnête est
// l'IDEMPOTENCE : on RÉSERVE un identifiant avant la première écriture, on le
// garde sur le disque, et chaque réessai réécrit LE MÊME club (`setDoc … merge`)
// au lieu d'en fabriquer un nouveau. Avant, une 4G capricieuse à 15 s laissait
// un club orphelin par appui (audit d'inscription 2026-09, P1-03).
//
// La réservation est libérée au succès. Elle ne donne aucun droit : un
// identifiant n'est pas un club, et les règles refusent tout ce qui n'est pas
// écrit par le propriétaire désigné.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storage";

/**
 * L'identifiant réservé pour ce compte : celui déjà en attente s'il existe,
 * sinon un neuf, immédiatement persisté.
 *
 * `genererId` est injecté (et non importé) pour que le test n'ait pas à monter
 * Firestore : c'est `nouvelIdentifiantClub` (repositories/clubsRepo) en vrai.
 *
 * Si le disque est illisible ou en panne, on rend quand même un identifiant :
 * la création doit pouvoir aboutir. On perd alors l'idempotence pour ce
 * réessai-là — pas la fonctionnalité.
 */
export async function reserverIdClub(uid: string, genererId: () => string): Promise<string> {
  const cle = STORAGE_KEYS.CLUB_CREATION_ID(uid);
  try {
    const dejaReserve = await AsyncStorage.getItem(cle);
    if (dejaReserve && dejaReserve.trim()) return dejaReserve.trim();
  } catch {
    // Illisible : on continue, un identifiant neuf vaut mieux qu'un échec.
  }
  const neuf = genererId();
  try {
    await AsyncStorage.setItem(cle, neuf);
  } catch {
    // Non persisté : le prochain réessai en tirera un autre. Assumé, et rare.
  }
  return neuf;
}

/** Libère la réservation : le club existe, l'identifiant a servi. */
export async function libererIdClub(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CLUB_CREATION_ID(uid));
  } catch {
    // Sans effet sur l'utilisateur : au pire une clé morte de 20 caractères.
  }
}
