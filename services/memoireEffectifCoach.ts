// services/memoireEffectifCoach.ts
//
// LA DERNIÈRE TAILLE D'EFFECTIF CONNUE, ET CE QU'ELLE SERT À FAIRE.
//
// Elle sert à UNE chose : permettre au portillon d'atterrissage
// (navigation/CoachTabs) de choisir l'onglet d'ouverture SANS attendre une
// lecture d'effectif. Rien d'autre. Elle n'est affichée nulle part, aucun écran
// ne la lit, aucun compteur ne s'en sert — un chiffre montré au coach vient
// toujours de `useCoachRoster`, jamais d'ici.
//
// POURQUOI ELLE EXISTE (contre-vérification du 07/09).
// Le portillon décide selon que le club a des joueurs ou non. Cette réponse
// coûte une requête sur `members` PLUS une par joueur : sur un effectif de 25,
// c'est 26 lectures, et le coach regardait un squelette pendant tout ce temps —
// y compris le cas MAJORITAIRE, celui d'un club plein, où l'onglet ouvert est
// de toute façon l'onglet historique. La mémoire supprime cette attente dès la
// deuxième ouverture.
//
// CE QU'ELLE N'EST PAS, ET C'EST LE POINT IMPORTANT.
// Ce n'est PAS une seconde source de vérité sur l'effectif. Elle ne fabrique
// aucun chiffre : elle RECOPIE `useCoachRoster().memberCount` — la seule
// implémentation — au moment où une lecture aboutit, et elle ne sait rien faire
// d'autre. Une valeur fausse ne peut donc pas afficher un faux effectif : au
// pire, elle ouvre l'espace coach sur l'un des deux onglets qu'il ouvre déjà,
// et la première lecture réelle la corrige.
//
// LE CLUB EST DANS LA VALEUR, PAS DANS LA CLÉ.
// La clé porte l'uid (`STORAGE_KEYS.COACH_ROSTER_SIZE`), la valeur porte le
// club. Deux raisons, et la seconde est celle qui a tranché :
//   . une valeur qui ne parle pas du club courant est INUTILISABLE, jamais
//     « périmée mais appliquée quand même » — c'est le même couple indissociable
//     que `useAppSpacePreference` (une valeur sans son compte ne dit pas de qui
//     elle parle) ;
//   . une clé par club serait impossible à purger : `localAccountKeysToPurge`
//     est une fonction PURE qui liste des noms de clés, elle ne peut pas
//     énumérer les clubs qu'un compte a traversés.
//
// Elle ne lève JAMAIS. Un stockage en panne vaut « rien de mémorisé » : le
// portillon retombe alors sur son comportement d'avant (attendre la lecture),
// ce qui est lent mais juste.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../constants/storage";

/** Ce qui est écrit sur le disque. Le club est indissociable du nombre. */
type EffectifMemorise = { clubId: string; memberCount: number };

/** Lecture défensive : tout ce qui n'est pas exactement cette forme vaut rien. */
function parse(brut: string | null): EffectifMemorise | null {
  if (!brut) return null;
  let data: unknown;
  try {
    data = JSON.parse(brut);
  } catch {
    return null;
  }
  if (data === null || typeof data !== "object") return null;
  const { clubId, memberCount } = data as { clubId?: unknown; memberCount?: unknown };
  if (typeof clubId !== "string" || !clubId) return null;
  // Un effectif est un entier positif ou nul. Un décimal, un négatif, un NaN ou
  // un `Infinity` ne viennent pas de nous : on les jette au lieu de décider avec.
  if (typeof memberCount !== "number" || !Number.isInteger(memberCount) || memberCount < 0) {
    return null;
  }
  return { clubId, memberCount };
}

/**
 * Mémorise la taille d'un effectif ABOUTI.
 *
 * À n'appeler qu'après une lecture réussie : mémoriser un effectif indisponible
 * inscrirait « 0 joueur » là où la vérité est « on n'a pas su lire », et le
 * portillon ouvrirait ensuite sur Semaine un club plein.
 */
export async function memoriserEffectifCoach(
  uid: string | null | undefined,
  clubId: string | null | undefined,
  memberCount: number,
): Promise<void> {
  if (!uid || !clubId) return;
  if (!Number.isInteger(memberCount) || memberCount < 0) return;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.COACH_ROSTER_SIZE(uid),
      JSON.stringify({ clubId, memberCount } satisfies EffectifMemorise),
    );
  } catch {
    // Silencieux volontairement : la mémoire est un confort de démarrage, pas un
    // état dont dépend l'exactitude de l'écran.
  }
}

/**
 * Taille mémorisée POUR CE CLUB, ou `null` s'il n'y en a pas.
 *
 * `null` couvre les quatre cas où l'on ne sait rien, et ils sont volontairement
 * indistinguables : jamais rien écrit, stockage illisible, valeur corrompue, et
 * — celui qui compte — valeur écrite pour un AUTRE club. Dans les quatre, le
 * portillon doit attendre la lecture réelle plutôt que décider sur du vide.
 */
export async function lireEffectifMemorise(
  uid: string | null | undefined,
  clubId: string | null | undefined,
): Promise<number | null> {
  if (!uid || !clubId) return null;
  let brut: string | null;
  try {
    brut = await AsyncStorage.getItem(STORAGE_KEYS.COACH_ROSTER_SIZE(uid));
  } catch {
    return null;
  }
  const memorise = parse(brut);
  if (!memorise || memorise.clubId !== clubId) return null;
  return memorise.memberCount;
}

/**
 * Oublie la mémoire d'un compte. Appelée à la déconnexion (le compte suivant sur
 * ce téléphone n'a rien à hériter) ; la suppression de compte l'emporte de son
 * côté via `localAccountKeysToPurge`. Ne lève jamais.
 */
export async function oublierEffectifCoach(uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.COACH_ROSTER_SIZE(uid));
  } catch {
    // Rien d'utile à faire, et surtout rien qui doive interrompre une déconnexion.
  }
}
