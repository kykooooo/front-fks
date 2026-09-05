// state/rattachementClubGate.ts
//
// « LE RATTACHEMENT AU CLUB N'EST PAS FINI » — DIT À LA RACINE, PAR L'ÉCRAN.
//
// ─── LE PROBLÈME QU'IL RÉSOUT ───────────────────────────────────────────────
// La carte « code club refusé » (screens/ProfileSetupScreen) est rendue par le
// questionnaire, lui-même monté DANS le portillon du RootNavigator. Or ce
// portillon retombe dès que `users/{uid}` dit « profil complet » — et c'est
// EXACTEMENT ce que la sauvegarde du profil vient d'écrire une ligne plus haut.
// Firestore notifie l'écriture en attente immédiatement (événement local, avant
// même l'aller-retour serveur) : le portillon tombait, `<AppNavigator/>`
// remplaçait le stack, et la carte était démontée — très probablement AVANT
// même d'avoir été affichée, puisque le `setDoc` est attendu avant `joinClub`.
// Le joueur se retrouvait sur l'accueil sans un mot, croyant avoir rejoint son
// club, et son coach ne le voyait jamais (R1 de la contre-vérification du
// 05/09, régression du correctif P0-01).
//
// ─── CE QUE CE MODULE EST, ET N'EST PAS ─────────────────────────────────────
// Un drapeau, rien de plus : « pour CE compte, un rattachement au club est en
// cours ou en échec, ne démonte pas l'écran qui le porte ». Il ne DÉCIDE rien
// d'autre, n'accorde aucun droit, ne touche à aucune donnée. La source durable
// de la complétude du profil reste l'instantané Firestore ; ce drapeau ne fait
// que RETARDER la bascule, le temps que la personne réponde à la question
// qu'on vient de lui poser.
//
// PAR COMPTE (`uid`), et pas un booléen global : sur un téléphone partagé, un
// drapeau resté levé par un compte bloquerait l'entrée du suivant.
//
// ─── POURQUOI UN SINGLETON DE MODULE ────────────────────────────────────────
// Ce dépôt n'a AUCUN contexte React — il diffuse par singleton de module
// (utils/toast, state/appSpaceGate, state/coachAuthorityGate). Même idiome que
// le voisin `appSpaceGate`, pour la même raison : l'émetteur (un écran profond)
// et le lecteur (la racine) ne peuvent pas se passer une prop sans traverser
// tout l'arbre.
//
// ÉTAT INITIAL : BAISSÉ. Tant que personne n'a rien posé, le portillon se
// comporte exactement comme avant — zéro diff sur tous les parcours qui ne
// saisissent pas de code club.

import { useSyncExternalStore } from "react";

/** Compte dont le rattachement est en cours, ou `null` si aucun. */
let compteEnCours: string | null = null;

type Ecouteur = () => void;
const ecouteurs = new Set<Ecouteur>();

function notifier(): void {
  for (const ecouteur of [...ecouteurs]) {
    try {
      ecouteur();
    } catch {
      // Un abonné qui échoue ne doit jamais empêcher les autres d'être notifiés.
    }
  }
}

/**
 * Lève le drapeau pour ce compte. À appeler AVANT l'écriture du profil : c'est
 * cette écriture-là qui déclenche l'instantané qui ferait tomber le portillon.
 */
export function poserRattachementClub(uid: string): void {
  const cible = String(uid ?? "").trim() || null;
  if (compteEnCours === cible) return;
  compteEnCours = cible;
  notifier();
}

/**
 * Baisse le drapeau : rattachement réussi, aucun code saisi, ou la personne a
 * répondu « Plus tard ». Toujours appelé avant de laisser partir l'écran.
 */
export function leverRattachementClub(): void {
  if (compteEnCours === null) return;
  compteEnCours = null;
  notifier();
}

/** Le compte dont le rattachement est en cours, ou `null`. */
export function readRattachementClub(): string | null {
  return compteEnCours;
}

/** S'abonne aux changements. Rend la fonction de désabonnement. */
function abonner(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/**
 * « Un rattachement est-il en cours POUR CE COMPTE ? »
 *
 * `uid` null (personne de connectée) rend toujours faux : un drapeau ne survit
 * pas à une déconnexion, et surtout il ne se transmet pas au compte suivant.
 */
export function useRattachementClubEnCours(uid: string | null): boolean {
  const enCours = useSyncExternalStore(abonner, readRattachementClub, readRattachementClub);
  if (!uid) return false;
  return enCours === uid;
}

/** RÉSERVÉ AUX TESTS : remet le drapeau à l'état baissé. */
export function resetRattachementClubForTests(): void {
  compteEnCours = null;
  ecouteurs.clear();
}
