// services/reservationClub.ts
//
// UN RÉESSAI NE DOIT PAS CRÉER UN DEUXIÈME CLUB — NI SE FAIRE REFUSER.
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
// ─── POURQUOI L'IDENTIFIANT SEUL NE SUFFISAIT PAS (R2, 05/09) ───────────────
// Le lot A réservait l'identifiant et réécrivait le même club à chaque
// réessai. Ça ferme bien le club en double — mais ça ouvre pire. Réécrire
// `clubs/{clubId}` sur un document QUI EXISTE DÉJÀ n'est plus une création :
// c'est une UPDATE, et `firestore.rules:783` exige alors `isClubOwner(clubId)`,
// c'est-à-dire `myAccessRole() == "owner"` (`:79-83`) — donc une appartenance
// propriétaire déjà écrite. Dans l'entrelacement que produit EXACTEMENT un
// timeout — écriture 1 passée, écriture 2 pas passée —, chaque réessai se
// faisait donc refuser en `permission-denied`, la réservation n'était jamais
// libérée, et le coach restait BLOQUÉ À VIE sur son compte. Avant le lot, il
// finissait au moins par entrer, avec un club en double.
//
// La réservation porte donc la PROGRESSION : la dernière écriture réussie. Un
// réessai REPREND à la suivante — il ne réécrit pas le club s'il est déjà
// écrit, ni l'appartenance si elle l'est. C'est ce qui rend la reprise
// possible sans jamais repasser par une écriture que les règles refuseraient.
//
// La réservation est libérée au succès. Elle ne donne aucun droit : un
// identifiant n'est pas un club, et les règles refusent tout ce qui n'est pas
// écrit par le propriétaire désigné.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storage";

/**
 * DERNIÈRE ÉCRITURE RÉUSSIE, et donc là où un réessai reprend.
 *
 *  - 0 : rien d'écrit — la création part du début ;
 *  - 1 : `clubs/{clubId}` est écrit ;
 *  - 2 : l'appartenance propriétaire est écrite ;
 *  - 3 : `users/{uid}.clubId` est écrit — c'est fini, la réservation tombe.
 */
export type EtapeCreationClub = 0 | 1 | 2 | 3;

export type ReservationClub = {
  clubId: string;
  etape: EtapeCreationClub;
};

const ETAPES_VALIDES: readonly EtapeCreationClub[] = [0, 1, 2, 3];

function lireEtape(valeur: unknown): EtapeCreationClub {
  return ETAPES_VALIDES.includes(valeur as EtapeCreationClub) ? (valeur as EtapeCreationClub) : 0;
}

/**
 * Décode ce qui est sur le disque.
 *
 * TOLÈRE LA FORME HISTORIQUE : le lot A n'y écrivait qu'un identifiant nu. Une
 * installation qui a une création en cours au moment de la mise à jour la
 * relit comme « identifiant réservé, aucune écriture confirmée » — le réessai
 * repart du début, ce qui est exactement ce que faisait le lot A. On ne perd
 * rien, on ne suppose rien.
 */
function decoder(brut: string | null): ReservationClub | null {
  const texte = String(brut ?? "").trim();
  if (!texte) return null;
  if (!texte.startsWith("{")) return { clubId: texte, etape: 0 };
  try {
    const objet = JSON.parse(texte) as { clubId?: unknown; etape?: unknown };
    const clubId = typeof objet.clubId === "string" ? objet.clubId.trim() : "";
    if (!clubId) return null;
    return { clubId, etape: lireEtape(objet.etape) };
  } catch {
    // Illisible : on ne devine pas un identifiant. Un neuf sera tiré.
    return null;
  }
}

async function ecrire(uid: string, reservation: ReservationClub): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_CREATION_ID(uid), JSON.stringify(reservation));
  } catch {
    // Non persisté : le prochain réessai repartira de zéro avec un autre
    // identifiant. Assumé, et rare — mieux qu'une création qui n'aboutit pas.
  }
}

/**
 * La réservation de ce compte : celle en attente s'il y en a une, sinon une
 * neuve à l'étape 0, immédiatement persistée.
 *
 * `genererId` est injecté (et non importé) pour que le test n'ait pas à monter
 * Firestore : c'est `nouvelIdentifiantClub` (repositories/clubsRepo) en vrai.
 *
 * Si le disque est illisible ou en panne, on rend quand même une réservation :
 * la création doit pouvoir aboutir. On perd alors l'idempotence pour ce
 * réessai-là — pas la fonctionnalité.
 */
export async function reserverIdClub(
  uid: string,
  genererId: () => string,
): Promise<ReservationClub> {
  try {
    const existante = decoder(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID(uid)));
    if (existante) return existante;
  } catch {
    // Illisible : on continue, une réservation neuve vaut mieux qu'un échec.
  }
  const neuve: ReservationClub = { clubId: genererId(), etape: 0 };
  await ecrire(uid, neuve);
  return neuve;
}

/**
 * Note qu'une écriture est passée. Appelé APRÈS chaque écriture réussie, pour
 * qu'un réessai sache où reprendre — y compris après que l'app a été tuée.
 *
 * Jamais en arrière : une note plus ancienne que ce qu'on sait déjà ne peut
 * pas faire régresser la progression (et donc pas faire réécrire un document
 * que les règles refuseraient de laisser réécrire).
 */
export async function enregistrerEtapeClub(
  uid: string,
  clubId: string,
  etape: EtapeCreationClub,
): Promise<void> {
  try {
    const existante = decoder(await AsyncStorage.getItem(STORAGE_KEYS.CLUB_CREATION_ID(uid)));
    // Une note qui parle d'un AUTRE club n'a rien à dire sur celui-ci.
    if (existante && existante.clubId !== clubId) return;
    const atteinte = Math.max(existante?.etape ?? 0, etape) as EtapeCreationClub;
    await ecrire(uid, { clubId, etape: atteinte });
  } catch {
    // Idem : une progression non notée coûte un réessai depuis le début.
  }
}

/**
 * JETTE LA RÉSERVATION ET EN POSE UNE NEUVE.
 *
 * Réservé au cas où une écriture est refusée alors qu'elle ne devrait pas
 * l'être : notre idée de la progression ne correspond alors plus à l'état réel
 * du serveur, et s'entêter sur le même identifiant ne peut que refaire refuser.
 * On repart proprement plutôt que d'enfermer le coach.
 */
export async function remplacerReservationClub(
  uid: string,
  genererId: () => string,
): Promise<ReservationClub> {
  const neuve: ReservationClub = { clubId: genererId(), etape: 0 };
  await ecrire(uid, neuve);
  return neuve;
}

/** Libère la réservation : le club existe, l'identifiant a servi. */
export async function libererIdClub(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CLUB_CREATION_ID(uid));
  } catch {
    // Sans effet sur l'utilisateur : au pire une clé morte de 20 caractères.
  }
}

/**
 * « Le serveur a-t-il refusé cette écriture ? »
 *
 * Firestore rend `permission-denied` (parfois préfixé) quand les règles
 * refusent. C'est le seul code qui doit faire jeter la réservation : tout le
 * reste (réseau, indisponibilité, délai de garde) est une panne passagère, où
 * REPRENDRE est précisément la bonne chose à faire.
 */
export function estRefusPermission(erreur: unknown): boolean {
  const brut = (erreur as { code?: unknown } | null)?.code;
  if (typeof brut !== "string") return false;
  return brut.replace(/^(firestore|functions)\//, "") === "permission-denied";
}
